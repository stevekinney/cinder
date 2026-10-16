import { resolveExtends } from './resolve-extends.ts';
import { resolveToken, resolveValue } from './resolve-references.ts';
import {
  type ExtensionOrigins,
  type RawRefs,
  type ResolvedTokens,
  clone,
  collectExtensionOrigins,
  collectGroups,
  collectTokens,
  isObject,
  isToken,
  isTokenGroup,
} from './resolve-shared.ts';
import type { DesignToken, TokenDocument, TokenExtensions, TokenGroup } from './types.ts';

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
  sourceByDocument?: ReadonlyMap<object, string>,
): TokenDocument {
  const extensionOrigins: ExtensionOrigins | undefined = sourceByDocument
    ? new WeakMap()
    : undefined;
  if (extensionOrigins)
    for (const document of new Set([...lookupDocuments, ...documents]))
      collectExtensionOrigins(document, '', sourceByDocument?.get(document), extensionOrigins);
  const merged = mergeDocuments(documents, extensionOrigins);
  const groups = new Map<string, TokenGroup>();
  const lookupGroups = new Map<string, TokenGroup>();
  const ownGroups = new Map<string, TokenGroup>();
  if (lookupDocuments !== documents) {
    const lookupMerged = mergeDocuments(lookupDocuments, extensionOrigins);
    collectGroups(lookupMerged, '', lookupGroups);
    collectGroups(lookupMerged, '', groups);
  }
  collectGroups(merged, '', ownGroups);
  for (const [groupPath, group] of ownGroups) groups.set(groupPath, group);
  // Resolve only groups contributed by the authored documents. Lookup groups
  // remain indexed so an authored `$extends` can resolve forward, but an
  // unrelated later lookup group must not make an earlier source fail while
  // it is being validated.
  for (const groupPath of ownGroups.keys())
    resolveExtends(
      groupPath,
      groups,
      new Set(),
      new Set(),
      lookupDocuments === documents ? groups : lookupGroups,
      extensionOrigins,
    );
  return merged;
}

/** Builds the resolved token index (group inheritance and `$extends` already applied) that both `resolveDocuments` and `createValueResolver` resolve references against, plus the pre-resolution `$ref` snapshot (see `RawRefs`) and the set of paths that are a group's redirected `$root` token (see `collectTokens`'s `rootTokenPaths` comment) rather than an ordinary token that happens to share that path. */
function buildTokenIndex(documents: TokenDocument[]): {
  tokens: ResolvedTokens;
  rawRefs: RawRefs;
  rootTokenPaths: Set<string>;
  groups: Map<string, TokenGroup>;
} {
  const tokens: ResolvedTokens = new Map();
  const rootTokenPaths = new Set<string>();
  const merged = mergeAndExpandExtends(documents);
  const groups = new Map<string, TokenGroup>();
  collectGroups(merged, '', groups);
  collectTokens(merged, '', tokens, rootTokenPaths);
  const rawRefs: RawRefs = new Map();
  for (const [path, token] of tokens) {
    if (typeof token.$ref === 'string') rawRefs.set(path, token.$ref);
  }
  return { tokens, rawRefs, rootTokenPaths, groups };
}

/** Resolves group inheritance, whole-token aliases, and property-level aliases. */
export function resolveDocuments(documents: TokenDocument[]): Record<string, DesignToken> {
  const { tokens, rawRefs, rootTokenPaths, groups } = buildTokenIndex(documents);
  const completed = new Set<string>();
  const resolved: Record<string, DesignToken> = Object.create(null);
  for (const path of tokens.keys())
    resolved[path] = clone(
      resolveToken(path, tokens, rawRefs, rootTokenPaths, new Set(), groups, completed),
    );
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
  const { tokens, rawRefs, rootTokenPaths, groups } = buildTokenIndex(documents);
  // Keep completion state for the lifetime of this resolver. Each invocation
  // may resolve a different composite value, but the token index is shared;
  // resetting completion state per call can revisit and mutate an already
  // resolved alias differently during generator validation versus emission.
  const completed = new Set<string>();
  return (value: unknown) =>
    resolveValue(value, tokens, rawRefs, rootTokenPaths, new Set(), groups, completed);
}

/**
 * Merges ordered documents. A later document's token wins on VALUE and on
 * generation metadata, but no longer replaces the earlier token wholesale:
 * `mergeToken` keeps identity and documentation from the token being overridden
 * when the override does not restate them. "Last occurrence wins" therefore
 * still describes `$value`, and no longer describes the whole token.
 */
export function mergeDocuments(
  documents: TokenDocument[],
  extensionOrigins?: ExtensionOrigins,
): TokenDocument {
  const result: TokenDocument = Object.create(null);
  for (const document of documents) mergeGroup(result, document, extensionOrigins);
  return result;
}

function mergeGroup(
  target: TokenGroup,
  source: TokenGroup,
  extensionOrigins?: ExtensionOrigins,
): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isTokenGroup(existing) && isTokenGroup(value))
      mergeGroup(existing, value, extensionOrigins);
    else if (isToken(existing) && isToken(value)) target[key] = mergeToken(existing, value);
    else target[key] = clone(value, extensionOrigins);
    if (key === '$extends') {
      const origin = extensionOrigins?.get(source);
      if (origin) extensionOrigins?.set(target, origin);
    }
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
  'scale',
  'palette',
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
