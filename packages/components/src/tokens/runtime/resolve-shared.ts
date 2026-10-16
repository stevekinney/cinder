import type { DesignToken, TokenGroup } from './types.ts';
import { TokenValidationError } from './types.ts';

export type JsonObject = Record<string, unknown>;
export type ResolvedTokens = Map<string, DesignToken>;
// Origins follow group objects through the same merges and clones as values.
// A path-only map would confuse an earlier prefix with later lookup overrides.
export type ExtensionOrigin = { source: string; path: string };
export type ExtensionOrigins = WeakMap<object, ExtensionOrigin>;
/**
 * Every token's ORIGINAL `$ref` string, captured once in `buildTokenIndex`
 * before any resolution runs. `resolveRefToken` deletes `$ref` from a
 * token's live entry in `ResolvedTokens` once resolved (so a resolved token
 * never carries a leftover alias pointer) -- a pointer that targets another
 * alias token's OWN `$ref` property (`#/alias/$ref`) would otherwise always
 * find it already gone, regardless of processing order, since
 * `resolveDocuments`'s top-level loop may resolve `alias` before anything
 * ever asks to read its `$ref`. This snapshot is immune to that mutation.
 */
export type RawRefs = Map<string, string>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isToken(value: unknown): value is DesignToken {
  // `$ref` is a DTCG 2025.10 whole-token alias -- mutually exclusive with
  // `$value`, so a node declaring either is token-shaped. Recognising only
  // `$value` here was the CIN-463 "live trap": `collectTokens` below falls
  // through to `isTokenGroup` for anything `isToken` rejects, so a `$ref`
  // token was walked as an empty group and silently vanished from the
  // resolved output instead of resolving or raising a named error.
  return isObject(value) && ('$value' in value || '$ref' in value);
}

export function isTokenGroup(value: unknown): value is TokenGroup {
  return isObject(value) && !isToken(value);
}

export function clone<T>(value: T, extensionOrigins?: ExtensionOrigins): T {
  const copy = structuredClone(value);
  normalizeObjectPrototypes(copy);
  if (extensionOrigins) copyExtensionOrigins(value, copy, extensionOrigins);
  return copy;
}

export function copyExtensionOrigins(
  value: unknown,
  copy: unknown,
  origins: ExtensionOrigins,
): void {
  if (!isObject(value) || !isObject(copy)) return;
  const origin = origins.get(value);
  if (origin) origins.set(copy, origin);
  for (const [key, child] of Object.entries(value)) copyExtensionOrigins(child, copy[key], origins);
}

export function normalizeObjectPrototypes(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) normalizeObjectPrototypes(entry);
    return;
  }
  if (!isObject(value)) return;
  Object.setPrototypeOf(value, null);
  for (const entry of Object.values(value)) normalizeObjectPrototypes(entry);
}

export function withResolvedType(
  token: DesignToken,
  inheritedType?: DesignToken['$type'],
): DesignToken {
  const resolved = clone(token);
  const type = resolved.$type ?? inheritedType;
  if (type) resolved.$type = type;
  return resolved;
}

export function issue(path: string, reason: string): never {
  throw new TokenValidationError([{ path, reason }]);
}

export function tokenPathFromReference(reference: string): string {
  if (/^\{[^{}]+\}$/.test(reference)) return reference.slice(1, -1);
  if (reference === '#/') return issue(reference, 'reference target does not exist');
  if (reference.startsWith('#/')) return pointerSegments(reference).join('.');
  return issue(reference, 'reference must use curly-brace or JSON Pointer syntax');
}

export function pointerSegments(reference: string): string[] {
  if (!reference.startsWith('#/')) return [];
  let fragment: string;
  try {
    fragment = decodeURIComponent(reference.slice(2));
  } catch {
    return issue(reference, 'JSON Pointer contains invalid percent encoding');
  }
  return fragment.split('/').map((segment) => {
    if (/~(?:[^01]|$)/.test(segment))
      issue(reference, 'JSON Pointer contains invalid tilde escape');
    return segment.replaceAll('~1', '/').replaceAll('~0', '~');
  });
}

export function getByPath(value: unknown, segments: string[]): unknown {
  let current = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(segment)) return undefined;
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
    } else if (isObject(current)) current = current[segment];
    else return undefined;
  }
  return current;
}

export function collectGroups(
  group: TokenGroup,
  prefix: string,
  groups: Map<string, TokenGroup>,
): void {
  groups.set(prefix, group);
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isTokenGroup(value)) collectGroups(value, path, groups);
  }
}

export function collectExtensionOrigins(
  group: TokenGroup,
  prefix: string,
  source: string | undefined,
  origins: ExtensionOrigins,
): void {
  if (source !== undefined && typeof group.$extends === 'string')
    origins.set(group, { source, path: prefix });
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isObject(value) || !isTokenGroup(value)) continue;
    collectExtensionOrigins(value, prefix ? `${prefix}.${name}` : name, source, origins);
  }
}

export function extensionIssue(
  groupPath: string,
  reason: string,
  group: TokenGroup,
  extensionOrigins?: ExtensionOrigins,
): never {
  const origin = extensionOrigins?.get(group);
  throw new TokenValidationError(
    [
      {
        path: origin
          ? `${origin.source}${origin.path ? `.${origin.path}` : ''}.$extends`
          : groupPath,
        reason,
      },
    ],
    origin !== undefined,
  );
}

export function collectTokens(
  group: TokenGroup,
  prefix: string,
  tokens: ResolvedTokens,
  rootTokenPaths: Set<string>,
  inheritedType?: DesignToken['$type'],
): void {
  if (group.$root) {
    tokens.set(prefix, withResolvedType(group.$root, group.$type ?? inheritedType));
    // Marks `prefix` as a GROUP's redirected root token, not an ordinary
    // token that merely happens to be indexed at the same path -- see
    // `resolveReference`'s use of this set for why the distinction matters.
    rootTokenPaths.add(prefix);
  }
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isToken(value)) tokens.set(path, withResolvedType(value, group.$type ?? inheritedType));
    else if (isTokenGroup(value))
      collectTokens(value, path, tokens, rootTokenPaths, group.$type ?? inheritedType);
  }
}
