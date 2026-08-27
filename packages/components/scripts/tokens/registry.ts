/**
 * Extracts a typed, machine-readable registry of the DTCG token corpus.
 *
 * This is the SHARED extraction module CIN-32 and CIN-34 are blocked on, and
 * the module CIN-31 imports to build `src/tokens/registry.generated.ts` (a
 * package-exported registry for consumers). `generate-artifacts.ts` -- the
 * `tokens:generate` CLI entry point, which depends on both this module and
 * `generate.ts` (see that file's module doc for why the dependency can only
 * run in that direction) -- writes this module's output to
 * `src/tokens/registry.generated.json` as one more `tokens:generate`
 * artifact, via {@link serializeTokenRegistry}. The extraction itself lives
 * here, independent of any file-writing concern, so a caller (CIN-31's
 * generator, a test, `generate-artifacts.ts`'s own JSON writer) gets the
 * typed structure directly instead of having to re-parse generated JSON or
 * re-walk the corpus.
 *
 * Reuses generate.ts's corpus-walking machinery (`collectEntries`,
 * `CorpusEntry`, `loadCorpus`) and resolve.ts's `mergeAndExpandExtends`
 * rather than re-deriving corpus structure -- the base-token index this
 * module builds is assembled the same way `buildTokensBaseCss` assembles
 * `baseIndex`, so the registry and `tokens-base.css` can never structurally
 * disagree about which base tokens exist.
 */

import {
  assertUniqueCssProperties,
  collectEntries,
  documentsForResolutionOrder,
  loadCorpus,
  modifierValuesForContext,
  requireDocument,
  type CorpusEntry,
} from './generate.ts';
import { mergeAndExpandExtends } from './resolve.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';
import { expandContextSources, parseResolutionOrder, sourcesForEntry } from './validate-corpus.ts';

/**
 * The theme contexts `buildTokensBaseCss` emits a selector for. The registry's
 * `themeAware` facet means "light or dark overrides this token", so it must
 * track what the CSS actually emits rather than every context the resolver
 * happens to declare -- otherwise a future third context would mark tokens
 * theme-aware that no generated selector overrides.
 */
const EMITTED_THEME_CONTEXTS = new Set(['light', 'dark']);

/**
 * The two custom-property namespaces the package owns. They are disjoint --
 * `--_cinder-` diverges from `--cinder-` at the third character -- so neither
 * prefix is the complement of the other and a name can satisfy neither.
 */
const PUBLIC_TOKEN_PREFIX = '--cinder-';
const PRIVATE_TOKEN_PREFIX = '--_cinder-';

/**
 * The full grammar a `cssProperty` must satisfy, not just its prefix.
 *
 * CSS itself permits uppercase and underscores in a custom-property name, and
 * the generators would happily emit one -- but `tokens-doc-drift.test.ts`
 * parses generated rows with a `[a-z0-9-]+` suffix, so a token named
 * `--cinder-fontAxis` would generate CSS and a documentation row and then be
 * reported by the required drift gate as MISSING, pointing at documentation
 * rather than at the name. Rather than widen the parser to accept names the
 * design system does not actually use, the contract is enforced here, at the
 * boundary that owns it, where the error can name the offending token.
 *
 * Keep this in step with that test's row pattern: the two are one contract.
 */
const CSS_PROPERTY_PATTERN = /^--_?cinder-[a-z0-9-]+$/;

export type TokenRegistryEntry = {
  /** Dotted corpus path, e.g. `space.4` or `button.radius.xs`. */
  path: string;
  /** The `--cinder-*` (or `--_cinder-*`) custom property this token emits. */
  cssProperty: string;
  /** The `com.lostgradient.cinder` extension's `category`, when present. */
  category: string | undefined;
  /** The `com.lostgradient.cinder` extension's `component`, when present -- only component-scoped tokens carry one. */
  component: string | undefined;
  /** The `com.lostgradient.cinder` extension's `public` flag. */
  public: boolean;
  /** Whether the `light` or `dark` theme document overrides this token. */
  themeAware: boolean;
  /** The DTCG `$deprecated` field verbatim: `false` when absent, otherwise `true` or the deprecation message string. */
  deprecated: boolean | string;
  /** The token's `$description`, when present. */
  description: string | undefined;
};

export type TokenRegistry = {
  /** Every base token, in corpus traversal order. */
  entries: readonly TokenRegistryEntry[];
  /** Token path -> CSS custom property. */
  pathToCssProperty: Readonly<Record<string, string>>;
  /**
   * CSS custom property -> a single CANONICAL token path (deterministic --
   * the first path to claim the property in corpus traversal order, never
   * "whichever happened to be assigned last"). The reverse of
   * {@link TokenRegistry.pathToCssProperty}, but not always its exact
   * inverse: `$extends` inheritance can legitimately produce two token paths
   * for one `cssProperty` (the extending group inherits the member, and its
   * `cssProperty`, verbatim -- `assertUniqueCssProperties` in `generate.ts`
   * permits this specific case because both paths emit an identical
   * declaration). When that happens, this map still returns exactly one
   * path so the common "what token backs this CSS property" lookup stays
   * simple; see {@link TokenRegistry.cssPropertyToPaths} for the full list.
   */
  cssPropertyToPath: Readonly<Record<string, string>>;
  /**
   * CSS custom property -> every token path that claims it, in corpus
   * traversal order (length 1 in the overwhelming common case; length > 1
   * only for the `$extends`-inherited-verbatim case described above).
   * `cssPropertyToPaths[property][0]` always equals
   * `cssPropertyToPath[property]`.
   */
  cssPropertyToPaths: Readonly<Record<string, readonly string[]>>;
  /** Category name -> the token paths in that category, in corpus traversal order. */
  byCategory: Readonly<Record<string, readonly string[]>>;
  /** Component name -> the token paths scoped to that component, in corpus traversal order. */
  byComponent: Readonly<Record<string, readonly string[]>>;
};

function refsFor(
  documentsByPath: Map<string, TokenDocument>,
  refs: ReadonlyArray<{ $ref: string }>,
): TokenDocument[] {
  return refs.map((ref) => requireDocument(documentsByPath, ref.$ref));
}

/**
 * The base `sets` document list the resolver orders -- the exact same
 * assembly `buildTokensBaseCss` uses for its own `baseDocuments`, factored
 * out here so a caller that needs a value resolver over the base scope (the
 * docs generator, serializing a token's `:root` value for its "Default"
 * column) builds it from this same list instead of re-deriving it.
 */
export function buildBaseDocuments(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): TokenDocument[] {
  return parseResolutionOrder(resolver)
    .filter((entry) => entry.kind === 'sets')
    .flatMap((entry) => refsFor(documentsByPath, sourcesForEntry(resolver, entry, {})));
}

/**
 * The base-token index (every token declared by the `sets` the resolver
 * orders, `$extends` already expanded) -- the exact same construction
 * `buildTokensBaseCss` performs for `baseIndex`, factored out here so the
 * registry and `tokens-base.css` generation can never structurally diverge.
 *
 * Also enforces the same `assertUniqueCssProperties` invariant
 * `buildTokensBaseCss` enforces before it ever emits CSS. This module is a
 * shared entry point -- `generate-artifacts.ts` (the `tokens:generate` CLI,
 * which already runs `buildTokensBaseCss` first) is only one caller; a test,
 * or a future CIN-31/32/34 consumer, can call `buildBaseIndex` directly
 * without going through `tokens:generate` at all, and would otherwise accept
 * a conflicting `cssProperty` mapping that CSS generation would have
 * rejected -- producing an ambiguous `cssPropertyToPath` (see
 * {@link buildTokenRegistryFromIndexes}) on a last-write-wins basis with no
 * error.
 */
export function buildBaseIndex(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Map<string, CorpusEntry> {
  const baseDocuments = buildBaseDocuments(resolver, documentsByPath);
  const mergedBase = mergeAndExpandExtends(baseDocuments);
  const baseIndex = new Map<string, CorpusEntry>();
  collectEntries(mergedBase, '', undefined, baseIndex);
  assertUniqueCssProperties(baseIndex);
  return baseIndex;
}

/**
 * The set of base-token paths that the `light` OR `dark` theme document
 * overrides -- "theme-aware" per the registry contract. Built the same way
 * `buildTokensBaseCss` builds `lightOverrides`/`darkOverrides` (own theme
 * documents, `$extends` resolved against the theme's full composed scope so
 * a theme override reaching a foundation group via `$extends` still counts),
 * but only the PATHS are needed here, not the override values themselves.
 */
export function themeAwarePaths(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Set<string> {
  const themeModifier = resolver.modifiers['theme'];
  if (!themeModifier) return new Set();

  const aware = new Set<string>();
  // Only the contexts buildTokensBaseCss actually emits a selector for. The
  // registry contract defines themeAware as "light or dark overrides this", so
  // counting a future third context (say `high-contrast`) would advertise
  // tokens as theme-aware that no generated theme selector overrides.
  for (const themeName of Object.keys(themeModifier.contexts).filter((name) =>
    EMITTED_THEME_CONTEXTS.has(name),
  )) {
    // `expandContextSources`, not a raw `themeModifier.contexts[themeName]`
    // read -- the same resolver-internal `#/sets/<name>` expansion
    // `buildTokensBaseCss` in `generate.ts` needs for the identical reason:
    // an unexpanded internal reference reaches `refsFor`'s `requireDocument`,
    // which looks for a literal on-disk document by that name and throws.
    const ownDocuments = refsFor(
      documentsByPath,
      expandContextSources(resolver, 'theme', themeName),
    );
    const scopeDocuments = documentsForResolutionOrder(
      resolver,
      documentsByPath,
      modifierValuesForContext(resolver, 'theme', themeName),
    );
    const overrides = new Map<string, CorpusEntry>();
    collectEntries(mergeAndExpandExtends(ownDocuments, scopeDocuments), '', undefined, overrides);
    for (const path of overrides.keys()) aware.add(path);
  }
  return aware;
}

/**
 * Builds the typed {@link TokenRegistry} from already-collected corpus
 * indexes. Kept pure and synchronous (no file I/O) so CIN-31's generator, and
 * any test, can construct fixtures directly rather than loading the real
 * corpus from disk. {@link buildTokenRegistry} is the disk-reading wrapper.
 */
export function buildTokenRegistryFromIndexes(
  baseIndex: ReadonlyMap<string, CorpusEntry>,
  themeAware: ReadonlySet<string>,
): TokenRegistry {
  const entries: TokenRegistryEntry[] = [];
  // Every string-keyed index below is built with `Object.create(null)` rather
  // than an object literal. A token path or a free-form `category`/`component`
  // extension value can legitimately be `__proto__` (`resolve.test.ts` asserts
  // this is a supported token path), and assigning into an ordinary object
  // under that key hits the inherited prototype setter instead of creating an
  // own property: the entry silently vanishes from `JSON.stringify` output,
  // a lookup returns `Object.prototype` instead of `undefined`, and a later
  // `(byCategory[entry.category] ??= []).push(...)` throws because
  // `Object.prototype` has no `.push`. `Object.create(null)` sidesteps all of
  // that -- every key becomes a real own property, `__proto__` included.
  const pathToCssProperty: Record<string, string> = Object.create(null);
  const cssPropertyToPath: Record<string, string> = Object.create(null);
  const cssPropertyToPaths: Record<string, string[]> = Object.create(null);
  const byCategory: Record<string, string[]> = Object.create(null);
  const byComponent: Record<string, string[]> = Object.create(null);

  for (const entry of baseIndex.values()) {
    if (!entry.cssProperty) {
      throw new Error(`Base corpus token at "${entry.path}" has no cssProperty extension.`);
    }
    if (entry.public === undefined) {
      throw new Error(`Base corpus token at "${entry.path}" has no public extension.`);
    }
    // Nothing in corpus validation relates these two free-form extension fields,
    // so without this a token could advertise an internal implementation detail
    // as part of the public surface to every registry consumer.
    if (entry.category !== undefined && entry.category.trim() === '') {
      throw new Error(`Base corpus token at "${entry.path}" has a blank category extension.`);
    }
    if (entry.component !== undefined && entry.component.trim() === '') {
      throw new Error(`Base corpus token at "${entry.path}" has a blank component extension.`);
    }
    // `cssRecipe` is free-form, so the schema accepts `""`. An empty recipe
    // still WINS over the typed `$value` during serialization, so the token
    // emits a custom property with no value and a documentation row whose
    // Default cell is an empty code span -- which `extractDocTokens` cannot
    // match (its value group is `(.+?)`), so the required drift test reports
    // the token missing. Same shape as the cssProperty grammar guard: reject
    // what the generators accept but the drift parser cannot read back.
    if (entry.cssRecipe !== undefined && entry.cssRecipe.trim() === '') {
      throw new Error(
        `Base corpus token at "${entry.path}" has a blank cssRecipe extension. ` +
          'Omit the field to fall back to the typed $value, rather than setting it empty.',
      );
    }
    // Both branches check positively for the prefix the flag requires. Deriving
    // either from the absence of the other admits a third namespace: a
    // `--vendor-foo` token marked public does not start with `--_cinder-`, so a
    // negative public check accepts it and the registry then advertises a name
    // that is not part of the package's `--cinder-` contract at all. The prefix
    // and the flag are one contract, not two, and neither prefix is the
    // complement of the other.
    const requiredPrefix = entry.public ? PUBLIC_TOKEN_PREFIX : PRIVATE_TOKEN_PREFIX;
    if (!entry.cssProperty.startsWith(requiredPrefix)) {
      throw new Error(
        `Base corpus token at "${entry.path}" is marked ` +
          `${entry.public ? 'public' : 'private'} but its cssProperty ` +
          `"${entry.cssProperty}" does not use the ${requiredPrefix} prefix.`,
      );
    }
    if (!CSS_PROPERTY_PATTERN.test(entry.cssProperty)) {
      throw new Error(
        `Base corpus token at "${entry.path}" has cssProperty ` +
          `"${entry.cssProperty}", which is outside the kebab-case grammar ` +
          `${String(CSS_PROPERTY_PATTERN)} that the generated documentation is ` +
          `parsed with. Rename the token to lowercase letters, digits, and hyphens.`,
      );
    }

    const registryEntry: TokenRegistryEntry = {
      path: entry.path,
      cssProperty: entry.cssProperty,
      category: entry.category,
      component: entry.component,
      public: entry.public,
      themeAware: themeAware.has(entry.path),
      deprecated: entry.deprecated ?? false,
      description: entry.description,
    };
    entries.push(registryEntry);

    pathToCssProperty[entry.path] = entry.cssProperty;

    // A cssProperty may legitimately be claimed by more than one path only
    // when `$extends` inheritance produces two paths for one identical
    // declaration (see generate.ts's `assertUniqueCssProperties`, which
    // `buildBaseIndex` above already runs before any registry is built from
    // its output -- conflicting, non-identical claims never reach this loop).
    // `cssPropertyToPath` keeps the FIRST path to claim a property
    // (deterministic corpus-traversal order) as the canonical answer, rather
    // than last-write-wins, so the common "one token per property" lookup is
    // stable; `cssPropertyToPaths` records every claimant for a caller that
    // needs the full set.
    if (!(entry.cssProperty in cssPropertyToPath)) {
      cssPropertyToPath[entry.cssProperty] = entry.path;
    }
    (cssPropertyToPaths[entry.cssProperty] ??= []).push(entry.path);

    // Test for presence, not truthiness. `toEntry` preserves a blank
    // `category`/`component` (the DTCG schema does not validate vendor-extension
    // contents), so a truthiness check would keep the empty string on the entry
    // while omitting the token from the index -- leaving the registry internally
    // inconsistent, with indexed consumers silently missing it. Blank grouping
    // names are rejected outright instead.
    if (entry.category !== undefined) (byCategory[entry.category] ??= []).push(entry.path);
    if (entry.component !== undefined) (byComponent[entry.component] ??= []).push(entry.path);
  }

  return {
    entries,
    pathToCssProperty,
    cssPropertyToPath,
    cssPropertyToPaths,
    byCategory,
    byComponent,
  };
}

/** Loads the corpus from disk and builds the {@link TokenRegistry}. */
export async function buildTokenRegistry(): Promise<TokenRegistry> {
  const { resolver, documentsByPath } = await loadCorpus();
  const baseIndex = buildBaseIndex(resolver, documentsByPath);
  const aware = themeAwarePaths(resolver, documentsByPath);
  return buildTokenRegistryFromIndexes(baseIndex, aware);
}

/**
 * Serializes a {@link TokenRegistry} to its committed JSON form. Pure
 * string-building, deliberately separate from writing the file to disk (that
 * thin layer lives in `generate-artifacts.ts`, alongside the other
 * `tokens:generate` outputs) so CIN-31's generator, or a test, can call this
 * without touching the filesystem.
 */
export function serializeTokenRegistry(registry: TokenRegistry): string {
  return JSON.stringify(registry);
}
