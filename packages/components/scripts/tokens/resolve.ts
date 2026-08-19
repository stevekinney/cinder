import type { DesignToken, TokenDocument, TokenGroup } from './types.ts';
import { TokenValidationError } from './types.ts';

type JsonObject = Record<string, unknown>;
type ResolvedTokens = Map<string, DesignToken>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToken(value: unknown): value is DesignToken {
  return isObject(value) && '$value' in value;
}

function isTokenGroup(value: unknown): value is TokenGroup {
  return isObject(value) && !isToken(value);
}

function clone<T>(value: T): T {
  const copy = structuredClone(value);
  normalizeObjectPrototypes(copy);
  return copy;
}

function normalizeObjectPrototypes(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) normalizeObjectPrototypes(entry);
    return;
  }
  if (!isObject(value)) return;
  Object.setPrototypeOf(value, null);
  for (const entry of Object.values(value)) normalizeObjectPrototypes(entry);
}

function withResolvedType(token: DesignToken, inheritedType?: DesignToken['$type']): DesignToken {
  const resolved = clone(token);
  const type = resolved.$type ?? inheritedType;
  if (type) resolved.$type = type;
  return resolved;
}

function issue(path: string, reason: string): never {
  throw new TokenValidationError([{ path, reason }]);
}

function tokenPathFromReference(reference: string): string {
  if (/^\{[^{}]+\}$/.test(reference)) return reference.slice(1, -1);
  if (reference.startsWith('#/')) {
    let fragment: string;
    try {
      fragment = decodeURIComponent(reference.slice(2));
    } catch {
      return issue(reference, 'JSON Pointer contains invalid percent encoding');
    }
    return fragment
      .split('/')
      .map((segment) => {
        if (/~(?:[^01]|$)/.test(segment))
          issue(reference, 'JSON Pointer contains invalid tilde escape');
        return segment.replaceAll('~1', '/').replaceAll('~0', '~');
      })
      .join('.');
  }
  return issue(reference, 'reference must use curly-brace or JSON Pointer syntax');
}

function getByPath(value: unknown, segments: string[]): unknown {
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

function collectGroups(group: TokenGroup, prefix: string, groups: Map<string, TokenGroup>): void {
  groups.set(prefix, group);
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isTokenGroup(value)) collectGroups(value, path, groups);
  }
}

function collectTokens(
  group: TokenGroup,
  prefix: string,
  tokens: ResolvedTokens,
  inheritedType?: DesignToken['$type'],
): void {
  if (group.$root) tokens.set(prefix, withResolvedType(group.$root, group.$type ?? inheritedType));
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isToken(value)) tokens.set(path, withResolvedType(value, group.$type ?? inheritedType));
    else if (isTokenGroup(value)) collectTokens(value, path, tokens, group.$type ?? inheritedType);
  }
}

function inheritMissingGroupMembers(target: TokenGroup, source: TokenGroup): void {
  for (const [name, value] of Object.entries(source)) {
    const existing = target[name];
    if (isTokenGroup(existing) && isTokenGroup(value)) inheritMissingGroupMembers(existing, value);
    else if (!Object.hasOwn(target, name))
      Object.defineProperty(target, name, {
        configurable: true,
        enumerable: true,
        value: clone(value),
        writable: true,
      });
  }
}

function resolveExtends(
  groupPath: string,
  groups: Map<string, TokenGroup>,
  visiting: Set<string>,
  complete: Set<string>,
): TokenGroup {
  const group = groups.get(groupPath);
  if (!group) return issue(groupPath, '$extends must reference an existing group');
  if (complete.has(groupPath)) return group;
  if (visiting.has(groupPath)) return issue(groupPath, 'circular $extends reference');
  visiting.add(groupPath);
  if (group.$extends) {
    const extendedPath = tokenPathFromReference(group.$extends);
    const extended = resolveExtends(extendedPath, groups, visiting, complete);
    if (group.$type === undefined && extended.$type !== undefined) group.$type = extended.$type;
    for (const [name, value] of Object.entries(extended))
      if (!name.startsWith('$') || name === '$root') {
        const existing = group[name];
        if (isTokenGroup(existing) && isTokenGroup(value))
          inheritMissingGroupMembers(existing, value);
        else if (!Object.hasOwn(group, name))
          Object.defineProperty(group, name, {
            configurable: true,
            enumerable: true,
            value: clone(value),
            writable: true,
          });
      }
  }
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isTokenGroup(value)) continue;
    const nestedPath = groupPath ? `${groupPath}.${name}` : name;
    if (groups.has(nestedPath)) resolveExtends(nestedPath, groups, visiting, complete);
  }
  visiting.delete(groupPath);
  complete.add(groupPath);
  return group;
}

function resolveReference(
  reference: string,
  tokens: ResolvedTokens,
  resolving: Set<string>,
): unknown {
  const segments = tokenPathFromReference(reference).split('.');
  for (let end = segments.length; end > 0; end -= 1) {
    const candidatePath = segments.slice(0, end).join('.');
    const token = tokens.get(candidatePath);
    if (!token) continue;
    const resolvedToken = resolveToken(candidatePath, tokens, resolving);
    const propertySegments = segments.slice(end);
    const targetsRootToken = reference.startsWith('#/') && propertySegments[0] === '$root';
    const propertyValue = getByPath(
      reference.startsWith('#/') && (propertySegments[0] === '$value' || targetsRootToken)
        ? resolvedToken
        : resolvedToken.$value,
      targetsRootToken ? propertySegments.slice(1) : propertySegments,
    );
    if (propertyValue === undefined)
      issue(reference, `reference target ${candidatePath} has no requested property`);
    return clone(propertyValue);
  }
  return issue(reference, 'reference target does not exist');
}

function resolveValue(value: unknown, tokens: ResolvedTokens, resolving: Set<string>): unknown {
  if (typeof value === 'string')
    return /^\{[^{}]+\}$/.test(value) || value.startsWith('#/')
      ? resolveReference(value, tokens, resolving)
      : value;
  if (Array.isArray(value)) return value.map((entry) => resolveValue(entry, tokens, resolving));
  if (!isObject(value)) return value;
  const resolved: JsonObject = Object.create(null);
  for (const [key, entry] of Object.entries(value))
    resolved[key] = resolveValue(entry, tokens, resolving);
  return resolved;
}

function resolveToken(path: string, tokens: ResolvedTokens, resolving: Set<string>): DesignToken {
  const token = tokens.get(path);
  if (!token) return issue(path, 'token does not exist');
  if (resolving.has(path)) return issue(path, 'circular token alias');
  resolving.add(path);
  token.$value = resolveValue(token.$value, tokens, resolving);
  resolving.delete(path);
  return token;
}

/** Resolves group inheritance, whole-token aliases, and property-level aliases. */
export function resolveDocuments(documents: TokenDocument[]): Record<string, DesignToken> {
  const tokens: ResolvedTokens = new Map();
  const groups = new Map<string, TokenGroup>();
  const documentCopies = [mergeDocuments(documents)];
  for (const document of documentCopies) collectGroups(document, '', groups);
  for (const groupPath of groups.keys()) resolveExtends(groupPath, groups, new Set(), new Set());
  for (const document of documentCopies) collectTokens(document, '', tokens);
  const resolved: Record<string, DesignToken> = Object.create(null);
  for (const path of tokens.keys()) resolved[path] = clone(resolveToken(path, tokens, new Set()));
  return resolved;
}

/** Merges ordered documents, retaining only the last occurrence of each token path. */
export function mergeDocuments(documents: TokenDocument[]): TokenDocument {
  const result: TokenDocument = Object.create(null);
  for (const document of documents) mergeGroup(result, document);
  return result;
}

function mergeGroup(target: TokenGroup, source: TokenGroup): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isTokenGroup(existing) && isTokenGroup(value)) mergeGroup(existing, value);
    else target[key] = clone(value);
  }
}

export function resolveDocument(document: TokenDocument): Record<string, DesignToken> {
  return resolveDocuments([document]);
}
