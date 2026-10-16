import type { DesignToken, TokenGroup, TokenType } from './types.ts';

// Collects every `$value`-bearing node in a merged
// document into a flat `path -> entry` map, preserving RAW (unresolved)
// values -- alias references stay as `{a.b.c}` strings rather than being
// resolved to a literal, since a raw alias tells us to emit `var(...)`
// against the referenced token's OWN `cssProperty`, matching how
// tokens-base.css is hand-authored today. This mirrors resolve.ts's
// `collectTokens` (group `$root` handling, `$type` inheritance through
// nested groups) but deliberately stops short of alias resolution.

export type CorpusEntry = {
  path: string;
  value: unknown;
  type: TokenType | undefined;
  description: string | undefined;
  cssProperty: string | undefined;
  cssRecipe: string | undefined;
  /**
   * The remaining `com.lostgradient.cinder` extension fields and the DTCG
   * `$deprecated` flag, carried through purely for {@link registry.ts}'s
   * `buildTokenRegistry` -- CSS generation in this file never reads them.
   * Kept on `CorpusEntry` itself (rather than a second, parallel tree walk)
   * so the registry reuses the exact same `collectEntries` traversal that
   * produces `tokens-base.css`, instead of re-deriving corpus structure.
   */
  public?: boolean | undefined;
  category?: string | undefined;
  component?: string | undefined;
  deprecated?: boolean | string | undefined;
  /**
   * True when `value` came from `$ref` rather than `$value`. `$ref` is a
   * generic JSON Pointer with no DTCG requirement that its target be a whole
   * token -- unlike an ordinary bare alias `$value`, which this generator has
   * always required to name a whole token (a deliberate, pre-existing
   * restriction; see `resolveAlias`'s own comment). `serializeEntryValue`
   * uses this flag to allow a `$ref` alone to fall through to typed
   * serialization when it targets a property rather than a whole token,
   * without loosening that restriction for ordinary `$value` aliases.
   */
  isRefAlias?: boolean | undefined;
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToken(value: unknown): value is DesignToken {
  // Mirrors resolve.ts's `isToken`: a DTCG 2025.10 `$ref` whole-token alias
  // is mutually exclusive with `$value`, so a node declaring either is
  // token-shaped. This walker classifies the RAW, unresolved corpus (see the
  // module doc above) -- checking `$value` alone was the CIN-463 "live trap"
  // recurring a third time here, independent of resolve.ts's own copy: a
  // `$ref`-only node fell through to `isTokenGroup`, was walked as an empty
  // group, and silently vanished from `tokens-base.css` and the generated
  // registry (both of which reuse `collectEntries` below) even though it
  // validated and resolved correctly.
  return isPlainObject(value) && ('$value' in value || '$ref' in value);
}

function isTokenGroup(value: unknown): value is TokenGroup {
  return isPlainObject(value) && !isToken(value);
}

export function cinderExtensions(token: DesignToken): Record<string, unknown> | undefined {
  const extensions = token.$extensions;
  if (!isPlainObject(extensions)) return undefined;
  const own = extensions['com.lostgradient.cinder'];
  return isPlainObject(own) ? own : undefined;
}

function extensionString(
  extensions: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  const value = extensions?.[name];
  return typeof value === 'string' ? value : undefined;
}

function extensionBoolean(
  extensions: Record<string, unknown> | undefined,
  name: string,
): boolean | undefined {
  const value = extensions?.[name];
  return typeof value === 'boolean' ? value : undefined;
}

function deprecatedValue(
  token: DesignToken | TokenGroup,
  fallback: boolean | string | undefined,
): boolean | string | undefined {
  return typeof token.$deprecated === 'boolean' || typeof token.$deprecated === 'string'
    ? token.$deprecated
    : fallback;
}

function toEntry(
  path: string,
  token: DesignToken,
  inheritedType: TokenType | undefined,
  inheritedDeprecated: boolean | string | undefined,
): CorpusEntry {
  const extensions = cinderExtensions(token);
  const cssProperty = extensionString(extensions, 'cssProperty');
  const cssRecipe = extensionString(extensions, 'cssRecipe');
  const category = extensionString(extensions, 'category');
  const component = extensionString(extensions, 'component');
  const isPublic = extensionBoolean(extensions, 'public');
  // DTCG makes `$deprecated` inheritable the same way `$type` is, and the
  // flattened corpus keeps no group records -- so without carrying the
  // ancestor state down, a `$deprecated` group whose children do not repeat the
  // field loses it entirely and every descendant is reported `deprecated:
  // false`, letting registry consumers surface a deprecated group's tokens as
  // current. A token's own `$deprecated` still wins: a group can deprecate its
  // children, and a child can carry its own (more specific) reason string.
  const deprecated = deprecatedValue(token, inheritedDeprecated);
  // A `$ref` whole-token alias has no `$value` of its own -- the reference
  // string ITSELF is the raw, unresolved value this walker records (mirroring
  // how an ordinary embedded `{a.b.c}`/`#/a/b/c` alias is kept raw rather than
  // resolved here; see the module doc above). `isAliasReference` in
  // `serializeEntryValue` recognizes both forms identically, so a `$ref`
  // token flows through the exact same `var(--referenced-property)` emission
  // path as an ordinary aliased `$value`, rather than a second alias-handling
  // code path.
  const value = token.$ref ?? token.$value;
  return {
    path,
    value,
    type: token.$type ?? inheritedType,
    description: token.$description,
    cssProperty,
    cssRecipe,
    public: isPublic,
    category,
    component,
    deprecated,
    isRefAlias: token.$ref !== undefined,
  };
}

export function collectEntries(
  group: TokenGroup,
  prefix: string,
  inheritedType: TokenType | undefined,
  into: Map<string, CorpusEntry>,
  inheritedDeprecated?: boolean | string,
): void {
  const groupType = group.$type ?? inheritedType;
  // `false` on a group is a real value, not an absence: it un-deprecates a
  // subtree beneath a deprecated ancestor, so `??` rather than `||` here.
  const groupDeprecated = deprecatedValue(group, inheritedDeprecated);
  collectRootEntry(group, prefix, groupType, groupDeprecated, into);
  collectChildEntries(group, prefix, groupType, groupDeprecated, into);
}

function collectRootEntry(
  group: TokenGroup,
  prefix: string,
  type: TokenType | undefined,
  deprecated: boolean | string | undefined,
  into: Map<string, CorpusEntry>,
): void {
  if (isToken(group.$root)) into.set(prefix, toEntry(prefix, group.$root, type, deprecated));
}

function collectChildEntries(
  group: TokenGroup,
  prefix: string,
  type: TokenType | undefined,
  deprecated: boolean | string | undefined,
  into: Map<string, CorpusEntry>,
): void {
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isPlainObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isToken(value)) into.set(path, toEntry(path, value, type, deprecated));
    else if (isTokenGroup(value)) collectEntries(value, path, type, into, deprecated);
  }
}
