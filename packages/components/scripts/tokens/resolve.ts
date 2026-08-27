import type { DesignToken, TokenDocument, TokenExtensions, TokenGroup } from './types.ts';
import { TokenValidationError } from './types.ts';

type JsonObject = Record<string, unknown>;
type ResolvedTokens = Map<string, DesignToken>;
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
type RawRefs = Map<string, string>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToken(value: unknown): value is DesignToken {
  // `$ref` is a DTCG 2025.10 whole-token alias -- mutually exclusive with
  // `$value`, so a node declaring either is token-shaped. Recognising only
  // `$value` here was the CIN-463 "live trap": `collectTokens` below falls
  // through to `isTokenGroup` for anything `isToken` rejects, so a `$ref`
  // token was walked as an empty group and silently vanished from the
  // resolved output instead of resolving or raising a named error.
  return isObject(value) && ('$value' in value || '$ref' in value);
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

export function tokenPathFromReference(reference: string): string {
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

/**
 * The `$deprecated` a group at `groupPath` carries EFFECTIVELY, once ordinary
 * (non-`$extends`) ancestor nesting is taken into account -- the nearest of
 * the group itself, its parent, its grandparent, and so on that declares
 * `$deprecated` directly. `groups` is keyed by the RAW merged tree
 * (`collectGroups`, run before any `$extends` expansion), so this reads each
 * candidate's own declared value only; it does not itself resolve a further
 * `$extends` chain on an ancestor (a deeper edge case -- an ancestor that is
 * itself only deprecated via its OWN `$extends` -- outside what this helper
 * addresses).
 *
 * `resolveExtends` needs this rather than a plain `extended.$deprecated`
 * property read: `generate.ts`'s `collectEntries` propagates `$deprecated`
 * down through ordinary group nesting at CSS/registry generation time, well
 * after `$extends` has already run here, so a group that inherits
 * `$deprecated` only from an ANCESTOR (never declaring it directly itself)
 * still reads `undefined` at this point unless this helper walks up for it.
 * Without it, `derived: { $extends: '{outer.base}' }` under a deprecated
 * `outer` (with `outer.base` itself never declaring `$deprecated`) copied no
 * deprecation onto `derived` at all, even though every token under
 * `outer.base` is itself effectively deprecated by the time generation walks
 * it.
 */
function effectiveGroupDeprecated(
  groupPath: string,
  groups: Map<string, TokenGroup>,
): TokenGroup['$deprecated'] {
  const segments = groupPath === '' ? [] : groupPath.split('.');
  for (let end = segments.length; end >= 0; end -= 1) {
    const candidate = groups.get(segments.slice(0, end).join('.'));
    if (candidate?.$deprecated !== undefined) return candidate.$deprecated;
  }
  return undefined;
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
    // `$deprecated: false` is a real, meaningful value (it un-deprecates a
    // subtree under a deprecated ancestor) rather than an absence, so this
    // must check `=== undefined` and assign directly -- the same `??`-not-`||`
    // rule `generate.ts`'s `collectEntries` already applies for ordinary
    // group nesting (see CIN-471). Nested extended groups already inherit
    // `$deprecated` through `inheritMissingGroupMembers`'s unfiltered member
    // copy below; this closes the top-level gap, where the extending group's
    // OWN `$deprecated` was previously left untouched even when the group it
    // extends was itself deprecated -- including when the extended group's
    // `$deprecated` is itself only inherited from ITS OWN ancestor rather
    // than declared directly (`effectiveGroupDeprecated`, not a bare property
    // read).
    // Known gap, tracked in CIN-475: `groups` is the single MERGED tree
    // `collectGroups` built -- when the extend target lives only in a
    // separate lookup document scope (theme/motion overrides extending a
    // foundation group via `mergeAndExpandExtends(ownDocuments,
    // lookupDocuments)`), and that lookup-scope ancestor's `$deprecated` is
    // shadowed by the override's own non-deprecated group of the same name,
    // `effectiveGroupDeprecated` walks the OVERRIDING tree's ancestor chain
    // here, not the lookup scope's, and misses it. Deferred rather than
    // reworked this late in review: fixing it means deciding a real
    // precedence rule across two independent document scopes, not a
    // one-line change, and nothing in the real corpus exercises it (no group
    // is `$deprecated` anywhere today).
    const effectiveExtendedDeprecated = effectiveGroupDeprecated(extendedPath, groups);
    if (group.$deprecated === undefined && effectiveExtendedDeprecated !== undefined)
      group.$deprecated = effectiveExtendedDeprecated;
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
  rawRefs: RawRefs,
  rootTokenPaths: Set<string>,
  resolving: Set<string>,
): unknown {
  const segments = tokenPathFromReference(reference).split('.');
  if (reference.startsWith('#/') && segments[0] === '$root') {
    const rootToken = tokens.get('');
    if (!rootToken) return issue(reference, 'reference target does not exist');
    const resolvedToken = resolveToken('', tokens, rawRefs, rootTokenPaths, resolving);
    // A bare `#/$root` pointer (nothing after `$root`) names the document
    // root token's WHOLE identity, exactly like an ordinary whole-token
    // pointer with no trailing segments -- it must extract `$value`, not
    // return the raw `DesignToken` object. An explicit reserved-property
    // segment (`#/$root/$value`, `#/$root/$description`, ...) should walk the
    // `DesignToken` object itself instead -- see the identical discrimination
    // in the loop below for why any `$`-prefixed segment, not just `$value`,
    // selects that base.
    const remainder = segments.slice(1);
    const usesTokenObjectBase = typeof remainder[0] === 'string' && remainder[0].startsWith('$');
    const propertyValue =
      remainder[0] === '$ref'
        ? getByPath(rawRefs.get(''), remainder.slice(1))
        : getByPath(usesTokenObjectBase ? resolvedToken : resolvedToken.$value, remainder);
    if (propertyValue === undefined)
      issue(reference, 'reference target $root has no requested property');
    return clone(propertyValue);
  }
  for (let end = segments.length; end > 0; end -= 1) {
    const candidatePath = segments.slice(0, end).join('.');
    const token = tokens.get(candidatePath);
    if (!token) continue;
    const resolvedToken = resolveToken(candidatePath, tokens, rawRefs, rootTokenPaths, resolving);
    const propertySegments = segments.slice(end);
    // `$root`, when present AND `candidatePath` actually names a GROUP that
    // carries one (`rootTokenPaths.has(candidatePath)`) -- not merely an
    // ordinary token that happens to share that path -- is a REDIRECT to the
    // group's own root token, already what `resolvedToken` is in that case,
    // not an extra path level, so it is stripped before walking the
    // remainder. Without the `rootTokenPaths` check, `#/base/$root` where
    // `base` is an ordinary token with no `$root` member would silently
    // redirect to `base` itself instead of correctly failing -- the token
    // index has no other way to distinguish a group's redirected root token
    // from an ordinary token indexed at the same path. A remainder that is
    // empty after stripping it (a bare `#/group/$root` alias) names the root
    // token's whole identity and must extract `$value`, exactly like the
    // ordinary whole-token case just below it; only an explicit `$value`
    // segment walks the raw `DesignToken` object.
    const targetsRootToken =
      reference.startsWith('#/') &&
      propertySegments[0] === '$root' &&
      rootTokenPaths.has(candidatePath);
    const remainder = targetsRootToken ? propertySegments.slice(1) : propertySegments;
    // A remainder starting with ANY of the token's own reserved `$`-prefixed
    // properties -- not just `$value` -- names something on the `DesignToken`
    // object itself: `#/base/$description`, `#/base/$deprecated`,
    // `#/base/$extensions/...` are all valid pointer targets alongside
    // `#/base/$value/...`. A resolved `$value` payload never itself carries a
    // `$`-prefixed key (DTCG values are plain objects, strings, numbers, or
    // arrays), so this discriminates cleanly without a fixed allowlist.
    const usesTokenObjectBase =
      reference.startsWith('#/') &&
      typeof remainder[0] === 'string' &&
      remainder[0].startsWith('$');
    // `$ref` is unique among token metadata: `resolveToken` deletes it from
    // the token object once resolved (see `resolveRefToken`'s doc comment --
    // deliberate, so downstream consumers never see a leftover alias pointer
    // next to the value it named). A pointer that targets another alias
    // token's OWN `$ref` string (`#/alias/$ref`) must read the pre-resolution
    // snapshot (`rawRefs`) rather than the mutated `resolvedToken` -- and
    // rather than `token.$ref` itself, which may already have been deleted by
    // an EARLIER, unrelated resolution of the same path (see `RawRefs`'s doc
    // comment). Every other reserved property is untouched by resolution.
    // Known gap, tracked in CIN-474: `remainder` came from `segments`, which
    // `tokenPathFromReference` produced by dot-joining the pointer and this
    // function re-split on `.` -- lossy for a pointer segment that itself
    // contains a literal dot, which vendor extension keys always do by
    // convention (`com.lostgradient.cinder`). A `$ref` into
    // `#/base/$extensions/com.lostgradient.cinder/cssProperty` therefore
    // walks the wrong segments and fails to resolve, even though the
    // property is genuinely there. Fixing it means preserving raw,
    // pre-join pointer segments through to this walk -- deferred rather
    // than reworked this late in review, since nothing in the real corpus
    // exercises it.
    const propertyValue =
      remainder[0] === '$ref'
        ? getByPath(rawRefs.get(candidatePath), remainder.slice(1))
        : getByPath(usesTokenObjectBase ? resolvedToken : resolvedToken.$value, remainder);
    if (propertyValue === undefined)
      issue(reference, `reference target ${candidatePath} has no requested property`);
    return clone(propertyValue);
  }
  return issue(reference, 'reference target does not exist');
}

function resolveValue(
  value: unknown,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  rootTokenPaths: Set<string>,
  resolving: Set<string>,
): unknown {
  if (typeof value === 'string')
    return /^\{[^{}]+\}$/.test(value) || value.startsWith('#/')
      ? resolveReference(value, tokens, rawRefs, rootTokenPaths, resolving)
      : value;
  if (Array.isArray(value))
    return value.map((entry) => resolveValue(entry, tokens, rawRefs, rootTokenPaths, resolving));
  if (!isObject(value)) return value;
  const resolved: JsonObject = Object.create(null);
  for (const [key, entry] of Object.entries(value))
    resolved[key] = resolveValue(entry, tokens, rawRefs, rootTokenPaths, resolving);
  return resolved;
}

/**
 * Resolves a `$ref` token -- a whole-token DTCG 2025.10 alias, distinct from
 * a `{a.b.c}`/`#/a/b/c` reference embedded IN a `$value`. Reuses
 * `resolveReference` (the same machinery an ordinary alias `$value` goes
 * through) rather than a separate path walk, so chained aliases and
 * property-level pointers (`#/base/$value/blur`) work identically for both
 * forms, and so `resolving` cycle detection is shared: a `$ref` chain that
 * loops back on itself trips the same "circular token alias" guard
 * `resolveToken` already applies before this runs.
 *
 * `$type` precedence for a `$ref` token: its own declared `$type` (validated
 * only for known-type membership in `validate.ts`, never required) wins;
 * failing that, the type already inherited from its enclosing group -- set
 * by `withResolvedType` before `resolveToken` is ever called -- wins;
 * failing THAT, the whole-token alias target's resolved `$type` is copied in
 * here. A property-level `$ref` has no whole-token target to borrow a type
 * from, so `$type` is left however it was (possibly still undefined), and
 * `validateResolvedToken` is what reports a genuinely untyped resolved
 * token, the same way it already does for an untyped ordinary token.
 *
 * The `$ref` key is deleted once resolved: a fully resolved `DesignToken` is
 * expected to carry `$value` alone (mirroring the `$value`/`$ref` mutual
 * exclusivity `validate.ts` enforces on the raw document), and downstream
 * consumers of `resolveDocuments`'s output should never have to check for a
 * leftover alias pointer next to the value it named.
 */
/**
 * The `tokens` index key a whole-token reference ultimately names, for type
 * inference below -- distinct from `tokenPathFromReference`'s plain dotted
 * join, which treats trailing `$value`/`$root` segments as ordinary path
 * levels. A group's root token is indexed under the GROUP's own path
 * (`collectTokens` sets it at `prefix`, not `prefix.$root`), so
 * `#/group/$root` and `#/$root` need their `$root` segment stripped before
 * the `tokens.get` lookup, or it misses -- the same redirect
 * `resolveReference`'s loop applies to `targetsRootToken` above, factored out
 * here since type inference needs only the final indexed path, not a
 * resolved value. A trailing `$value` segment (`#/base/$value`,
 * `#/group/$root/$value`, `#/$root/$value`) names the token's WHOLE value,
 * not a nested property, and must be stripped FIRST -- otherwise
 * `#/group/$root/$value` dot-joins to `group.$root.$value`, which ends in
 * neither `$root` nor a bare `$root`, and the redirect below never fires.
 */
function refTargetIndexPath(reference: string): string {
  let path = tokenPathFromReference(reference);
  if (!reference.startsWith('#/')) return path;
  if (path.endsWith('.$value')) path = path.slice(0, -'.$value'.length);
  if (path === '$root') return '';
  return path.endsWith('.$root') ? path.slice(0, -'.$root'.length) : path;
}

function resolveRefToken(
  path: string,
  token: DesignToken,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  rootTokenPaths: Set<string>,
  resolving: Set<string>,
): void {
  const ref = token.$ref;
  if (typeof ref !== 'string') return issue(path, '$ref must be a string');
  try {
    token.$value = resolveReference(ref, tokens, rawRefs, rootTokenPaths, resolving);
  } catch (error) {
    if (error instanceof TokenValidationError)
      return issue(
        path,
        `unresolvable $ref "${ref}": ${error.issues.map((tokenIssue) => tokenIssue.reason).join('; ')}`,
      );
    throw error;
  }
  if (token.$type === undefined) {
    const targetToken = tokens.get(refTargetIndexPath(ref));
    if (targetToken?.$type !== undefined) token.$type = targetToken.$type;
  }
  delete token.$ref;
}

function resolveToken(
  path: string,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  rootTokenPaths: Set<string>,
  resolving: Set<string>,
): DesignToken {
  const token = tokens.get(path);
  if (!token) return issue(path, 'token does not exist');
  if (resolving.has(path)) return issue(path, 'circular token alias');
  // Validation (`assertValidTokenDocument`) is what enforces `$value`/`$ref`
  // mutual exclusivity on the raw document; this is a resolve-time backstop
  // for a caller that reaches `resolveDocuments`/`createValueResolver`
  // without validating first (there is no such caller in this repo today --
  // every entry point runs validation first -- but nothing in the type
  // system enforces that, and a token carrying both keys would otherwise
  // silently prefer `$ref` and drop `$value` with no diagnostic). Named
  // explicitly rather than left as an implicit precondition.
  if (token.$ref !== undefined && token.$value !== undefined)
    return issue(path, '$value and $ref are mutually exclusive on a resolved token');
  resolving.add(path);
  if (token.$ref !== undefined)
    resolveRefToken(path, token, tokens, rawRefs, rootTokenPaths, resolving);
  else token.$value = resolveValue(token.$value, tokens, rawRefs, rootTokenPaths, resolving);
  resolving.delete(path);
  return token;
}

/**
 * Merges documents and applies `$extends` group inheritance (missing members copied in,
 * `$type` propagated) across the merged tree, WITHOUT resolving any alias reference --
 * factored out of `buildTokenIndex` so a caller that must keep raw, unresolved `$value`s (a
 * `{a.b.c}` string means "emit `var(--other-property)`", not "inline a literal") can still get
 * `$extends` applied before walking the tree, the same way `resolveDocuments` and
 * `createValueResolver` do.
 *
 * `lookupDocuments` (defaults to `documents` itself) is where `$extends` TARGETS are looked up --
 * distinct from `documents`, which is both what gets merged/mutated and what gets returned. A
 * caller that must return only ITS OWN documents' tree (an override context, whose returned shape
 * determines which tokens that context is considered to "define") but whose `$extends` may
 * reference a group that lives only in a broader document set (e.g. a foundation group the
 * override document never itself contains) passes that broader set as `lookupDocuments`. Own
 * groups are collected AFTER (and so take precedence over) the lookup groups, so `resolveExtends`
 * still mutates and returns the caller's own tree -- a target found only in `lookupDocuments`
 * contributes members by being copied in, never by becoming part of the returned tree itself.
 */
export function mergeAndExpandExtends(
  documents: TokenDocument[],
  lookupDocuments: TokenDocument[] = documents,
): TokenDocument {
  const merged = mergeDocuments(documents);
  const groups = new Map<string, TokenGroup>();
  if (lookupDocuments !== documents) collectGroups(mergeDocuments(lookupDocuments), '', groups);
  collectGroups(merged, '', groups);
  for (const groupPath of groups.keys()) resolveExtends(groupPath, groups, new Set(), new Set());
  return merged;
}

/** Builds the resolved token index (group inheritance and `$extends` already applied) that both `resolveDocuments` and `createValueResolver` resolve references against, plus the pre-resolution `$ref` snapshot (see `RawRefs`) and the set of paths that are a group's redirected `$root` token (see `collectTokens`'s `rootTokenPaths` comment) rather than an ordinary token that happens to share that path. */
function buildTokenIndex(documents: TokenDocument[]): {
  tokens: ResolvedTokens;
  rawRefs: RawRefs;
  rootTokenPaths: Set<string>;
} {
  const tokens: ResolvedTokens = new Map();
  const rootTokenPaths = new Set<string>();
  const merged = mergeAndExpandExtends(documents);
  collectTokens(merged, '', tokens, rootTokenPaths);
  const rawRefs: RawRefs = new Map();
  for (const [path, token] of tokens) {
    if (typeof token.$ref === 'string') rawRefs.set(path, token.$ref);
  }
  return { tokens, rawRefs, rootTokenPaths };
}

/** Resolves group inheritance, whole-token aliases, and property-level aliases. */
export function resolveDocuments(documents: TokenDocument[]): Record<string, DesignToken> {
  const { tokens, rawRefs, rootTokenPaths } = buildTokenIndex(documents);
  const resolved: Record<string, DesignToken> = Object.create(null);
  for (const path of tokens.keys())
    resolved[path] = clone(resolveToken(path, tokens, rawRefs, rootTokenPaths, new Set()));
  return resolved;
}

export type ValueResolver = (value: unknown) => unknown;

/**
 * Builds a resolver, against the given documents, for arbitrary raw value trees -- not just
 * whole tokens. `resolveDocuments` only exposes references already resolved at the top level of
 * each token's `$value`; a reference nested inside a composite member (a shadow layer's
 * `inset`, one component of a color, ...) needs the same reference machinery applied to an
 * arbitrary sub-value, including property-path splitting (`{a.b.c}` / `#/a/b/c` may name a
 * whole token OR a property within one) and cycle detection. Reuses `resolveValue` --
 * `resolveDocuments` calls the exact same function on each token's `$value` -- rather than a
 * second resolver.
 */
export function createValueResolver(documents: TokenDocument[]): ValueResolver {
  const { tokens, rawRefs, rootTokenPaths } = buildTokenIndex(documents);
  return (value: unknown) => resolveValue(value, tokens, rawRefs, rootTokenPaths, new Set());
}

/**
 * Merges ordered documents. A later document's token wins on VALUE and on
 * generation metadata, but no longer replaces the earlier token wholesale:
 * `mergeToken` keeps identity and documentation from the token being overridden
 * when the override does not restate them. "Last occurrence wins" therefore
 * still describes `$value`, and no longer describes the whole token.
 */
export function mergeDocuments(documents: TokenDocument[]): TokenDocument {
  const result: TokenDocument = Object.create(null);
  for (const document of documents) mergeGroup(result, document);
  return result;
}

function mergeGroup(target: TokenGroup, source: TokenGroup): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isTokenGroup(existing) && isTokenGroup(value)) mergeGroup(existing, value);
    else if (isToken(existing) && isToken(value)) target[key] = mergeToken(existing, value);
    else target[key] = clone(value);
  }
}

/**
 * The vendor-extension keys that describe what a token IS, as opposed to how
 * this particular context writes it. These are inherited by an override that
 * does not restate them; everything else in the namespace is taken from the
 * overriding document.
 *
 * `cssRecipe` is deliberately absent: it is generation metadata, and inheriting
 * it is actively wrong. `shadow.small`'s base carries a two-arm `light-dark()`
 * recipe while its light override is a plain literal, so an inherited recipe
 * would contradict the `$value` sitting beside it. An omitted `cssRecipe` on an
 * override therefore means "no recipe", not "keep the base's".
 */
const INHERITED_EXTENSION_KEYS = [
  'cssProperty',
  'public',
  'category',
  'component',
  'contrastPairs',
] as const;

const CINDER_EXTENSION_NAMESPACE = 'com.lostgradient.cinder';

/**
 * Merges a token over the one it overrides, keeping identity and documentation
 * from the base while taking value and generation metadata from the override.
 *
 * Replacing wholesale -- what this did before -- dropped `$description` and the
 * whole `$extensions` block for every override, so 96 of the 216 tokens in
 * `resolved/dark.json` came out with no `cssProperty` and no description at
 * all. A consumer importing a resolved context could not map most tokens back
 * to a CSS custom property, which is the main thing a resolved artifact is for.
 *
 * A shallow merge of the `$extensions` OBJECT is not enough either: an override
 * carrying its own namespace entry (a light-only `color-mix()` recipe on
 * `surface.raised.hover`, say) would still wipe the `cssProperty`, `public`,
 * and `category` it does not restate. The split has to be per key.
 */
function mergeToken(base: DesignToken, override: DesignToken): DesignToken {
  const merged = clone(override);
  if (merged.$type === undefined && base.$type !== undefined) merged.$type = base.$type;
  if (merged.$description === undefined && base.$description !== undefined) {
    merged.$description = base.$description;
  }
  if (merged.$deprecated === undefined && base.$deprecated !== undefined) {
    merged.$deprecated = base.$deprecated;
  }

  const baseExtensions = base.$extensions;
  if (!baseExtensions) return merged;

  // Every namespace the base declares survives, not just Cinder's: the format
  // requires unknown extension data to survive resolution, and an override has
  // no way to restate a namespace it knows nothing about.
  const extensions: TokenExtensions = { ...clone(baseExtensions), ...clone(merged.$extensions) };

  const baseCinder = baseExtensions[CINDER_EXTENSION_NAMESPACE];
  if (isObject(baseCinder)) {
    // Rebuilt from the override's OWN namespace entry -- an empty one when it
    // has no `$extensions` at all -- rather than from the spread above. The
    // spread inherits every key, including `cssRecipe`, which is exactly the
    // case that matters: `shadow.small`'s light override is a bare `$value`
    // with no extensions, so spreading gave the light context the base's
    // two-arm `light-dark()` recipe, contradicting the literal `$value` beside
    // it. Starting from the override and pulling back only the identity keys
    // makes "absent" mean "no recipe" whether the override omitted the key or
    // the whole block.
    const overrideCinder = merged.$extensions?.[CINDER_EXTENSION_NAMESPACE];
    const cinder: Record<string, unknown> = isObject(overrideCinder) ? clone(overrideCinder) : {};
    for (const key of INHERITED_EXTENSION_KEYS) {
      if (cinder[key] === undefined && baseCinder[key] !== undefined) {
        cinder[key] = clone(baseCinder[key]);
      }
    }
    extensions[CINDER_EXTENSION_NAMESPACE] = cinder;
  }

  merged.$extensions = extensions;
  return merged;
}

export function resolveDocument(document: TokenDocument): Record<string, DesignToken> {
  return resolveDocuments([document]);
}
