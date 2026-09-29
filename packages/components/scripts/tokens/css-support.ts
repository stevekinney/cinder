import { type CorpusEntry, isPlainObject } from './corpus.ts';
import { DEFERRED_COMPONENT_ALIAS_FAMILIES } from './css-configuration.ts';
import type { ValueResolver } from './resolve.ts';
import type { ResolverDocument, ResolverReference, TokenDocument } from './types.ts';
import { normalizeSourcePath, parseResolutionOrder } from './validate-corpus.ts';
import { serializeEntryValue } from './value-entry.ts';
import { isAliasReference } from './value-formatters.ts';

import { sanitizeComment, stylelintDisableCommentFor } from './css-stylelint.ts';

/**
 * `documentsByPath` is keyed by the normalized relative path `loadTokenDocuments`
 * reports (see `load.ts`'s `Glob` scan), but a resolver `$ref` is a URI reference
 * that may spell the same file differently (`./sets/x.tokens.json`, a percent-escaped
 * path). `normalizeSourcePath` -- reused from `validate-corpus.ts`, which faces the
 * identical lookup and already normalizes before comparing -- collapses both to the
 * same key, so a schema-valid ref that validation accepts also resolves here.
 */
export function requireDocument(
  documentsByPath: Map<string, TokenDocument>,
  ref: string,
): TokenDocument {
  const normalizedRef = normalizeSourcePath(ref);
  const document = documentsByPath.get(normalizedRef);
  if (!document) {
    throw new Error(`Resolver references "${ref}" but no loaded token document has that path.`);
  }
  return document;
}

export function refsFor(
  documentsByPath: Map<string, TokenDocument>,
  refs: readonly ResolverReference[],
): TokenDocument[] {
  return refs.map((ref) => requireDocument(documentsByPath, ref.$ref));
}

export function isRootDeclaredEntry(entry: CorpusEntry): boolean {
  return !(
    entry.component &&
    DEFERRED_COMPONENT_ALIAS_FAMILIES.has(entry.component) &&
    !entry.cssRecipe &&
    isAliasReference(entry.value)
  );
}

export function renderBaseDeclarations(
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): string {
  const lines: string[] = [];
  for (const entry of baseIndex.values()) {
    if (!entry.cssProperty) {
      throw new Error(`Base corpus token at "${entry.path}" has no cssProperty extension.`);
    }
    // Component aliases are defaults at their consumption sites, not root
    // declarations. Deferring them lets both the public component property and
    // its referenced foundation token respond to scoped ancestor overrides.
    if (!isRootDeclaredEntry(entry)) continue;
    if (entry.description) lines.push(`/* ${sanitizeComment(entry.description)} */`);
    const value = serializeEntryValue(entry, baseIndex, resolveReferences);
    const stylelintDisable = stylelintDisableCommentFor(value);
    if (stylelintDisable) lines.push(stylelintDisable);
    lines.push(`${entry.cssProperty}: ${value};`);
  }
  return lines.join('\n');
}

export function renderOverrideDeclarations(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): string {
  const lines: string[] = [];
  for (const [path, entry] of overrides) {
    const base = baseIndex.get(path);
    if (!base?.cssProperty) {
      throw new Error(`Override token at "${path}" has no matching base token with a cssProperty.`);
    }
    const value = serializeEntryValue(entry, baseIndex, resolveReferences);
    const stylelintDisable = stylelintDisableCommentFor(value);
    if (stylelintDisable) lines.push(stylelintDisable);
    lines.push(`${base.cssProperty}: ${value};`);
  }
  return lines.join('\n');
}

export function withDependentBaseAliases(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  baseResolveReferences: ValueResolver,
  resolveReferences: ValueResolver,
): Map<string, CorpusEntry> {
  const scoped = new Map(overrides);
  for (const [path, entry] of baseIndex) {
    if (scoped.has(path)) continue;
    if (entry.cssRecipe || !entryContainsReference(entry)) continue;
    if (
      serializeEntryValue(entry, baseIndex, baseResolveReferences) !==
      serializeEntryValue(entry, baseIndex, resolveReferences)
    ) {
      scoped.set(path, entry);
    }
  }
  return scoped;
}

/**
 * A token overridden in only ONE theme leaves the other theme's block with no
 * declaration for it. Custom properties inherit as COMPUTED values, so a nested
 * island of that other theme does not fall back to the `:root` `light-dark()`
 * declaration -- the themed ancestor has already substituted its own arm, and
 * the island inherits that substituted value.
 *
 * `--cinder-code-block-background` is the case this exists for: it is overridden
 * only in `dark.tokens.json`, so a `[data-theme='light']` island inside a dark
 * ancestor kept the dark `surface-inset` ground underneath github-light Shiki
 * token colors -- the exact AA failure that token's own `$description` warns
 * about. Redeclaring the foundation token it aliases (`--cinder-surface-inset`,
 * which the light block DOES reset) cannot rescue it, because the alias was
 * already resolved against the ancestor.
 *
 * So each scoped block carries a declaration for every path the OTHER block
 * declares. The added entry is the BASE entry, rendered by
 * {@link renderOverrideDeclarations} under this block's own resolver -- the same
 * mechanism {@link withDependentBaseAliases} already uses for the aliases it
 * pulls in, so a `cssRecipe` token re-emits its full `light-dark(...)` recipe
 * (self-resetting under the block's own `color-scheme`) and a plain alias
 * re-resolves against this theme.
 *
 * Applied symmetrically. Only dark currently has theme-exclusive overrides, but
 * the asymmetry is a property of the corpus on any given day, not of the
 * generator, and a light-only override added later must not reintroduce this.
 */
export function withOppositeThemeResets(
  aliases: Map<string, CorpusEntry>,
  oppositeAliases: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
): Map<string, CorpusEntry> {
  const scoped = new Map(aliases);
  for (const path of oppositeAliases.keys()) {
    if (scoped.has(path)) continue;
    const base = baseIndex.get(path);
    if (base) scoped.set(path, base);
  }
  return scoped;
}

export function withThemeDependentOverrides(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  systemResolveReferences: ValueResolver,
  themeResolveReferences: ValueResolver,
): Map<string, CorpusEntry> {
  const scoped = withDependentBaseAliases(
    new Map(),
    baseIndex,
    systemResolveReferences,
    themeResolveReferences,
  );
  for (const [path, entry] of overrides) {
    if (
      serializeEntryValue(entry, baseIndex, systemResolveReferences) !==
      serializeEntryValue(entry, baseIndex, themeResolveReferences)
    ) {
      scoped.set(path, entry);
    }
  }
  return scoped;
}

function valueContainsReference(value: unknown): boolean {
  if (typeof value === 'string') return /^\{[^{}]+\}$/.test(value) || value.startsWith('#/');
  if (Array.isArray(value)) return value.some(valueContainsReference);
  return isPlainObject(value) && Object.values(value).some(valueContainsReference);
}

export function entryContainsReference(entry: CorpusEntry): boolean {
  return valueContainsReference(entry.value);
}

/**
 * Two tokens mapping to one `cssProperty` with DIFFERENT values is not something
 * `tokens:validate` can catch -- the mapping lives in vendor extension data, which
 * the DTCG schema treats as free-form. Left undetected, both declarations are
 * emitted, CSS silently keeps whichever lands last, and the resolved snapshots go
 * on exposing both token paths, so `tokens:check` approves two artifacts that
 * disagree about the same custom property.
 *
 * Sharing a `cssProperty` is only a conflict when the values differ. `$extends`
 * inheritance legitimately produces two paths for one property -- the extending
 * group inherits members verbatim, extension metadata included -- and those emit
 * an identical declaration twice, which is redundant but harmless.
 */
export function assertUniqueCssProperties(
  entries: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry> = entries,
  resolveReferences: ValueResolver = (value) => value,
  resolveReferencesFactory?: () => ValueResolver,
): void {
  const claimants = claimantsByProperty(entries);
  const resolver = hasDuplicateClaimants(claimants)
    ? (resolveReferencesFactory?.() ?? resolveReferences)
    : resolveReferences;
  const conflicts = [...claimants]
    .filter(([, paths]) => paths.length > 1)
    .map(
      ([property, paths]) => [property, fingerprints(paths, entries, baseIndex, resolver)] as const,
    )
    .filter(([, values]) => values.size > 1);
  if (conflicts.length === 0) return;
  const detail = conflicts
    .map(
      ([property, values]) =>
        `${property} is claimed with conflicting values by ${[...values.values()].flat().toSorted().join(', ')}`,
    )
    .join('; ');
  throw new Error(`Conflicting cssProperty mappings in the token corpus: ${detail}`);
}

function claimantsByProperty(entries: Map<string, CorpusEntry>): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const [path, entry] of entries) {
    if (entry.cssProperty)
      grouped.set(entry.cssProperty, [...(grouped.get(entry.cssProperty) ?? []), path]);
  }
  return grouped;
}

function hasDuplicateClaimants(grouped: Map<string, string[]>): boolean {
  return [...grouped.values()].some((paths) => paths.length > 1);
}

function fingerprints(
  paths: string[],
  entries: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  resolver: ValueResolver,
): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (const path of paths) {
    const entry = entries.get(path)!;
    const emitted = serializeEntryValue(entry, baseIndex, resolver);
    const fingerprint = `${entry.type ?? ''}\u0000${emitted}`;
    values.set(fingerprint, [...(values.get(fingerprint) ?? []), path]);
  }
  return values;
}

/**
 * The same conflict {@link assertUniqueCssProperties} catches for `baseIndex`,
 * applied to ONE override block (a theme or motion context) in isolation.
 * `$extends` can legitimately give two base paths the same `cssProperty` with
 * IDENTICAL base values (assertUniqueCssProperties already lets that through) --
 * but nothing stopped a theme or motion override from then explicitly
 * diverging those two paths to DIFFERENT values, because the base-only guard
 * ran exactly once, against `baseIndex`, and never again against an override
 * block.
 *
 * An override token does not always restate its own `cssProperty` extension --
 * it is inherited, immutable metadata; an override document typically states
 * only a new `$value` -- so grouping by `entry.cssProperty` alone would skip
 * most override entries as property-less. `baseIndex` supplies whichever
 * `cssProperty` (and `$type`, needed for the same type-directed fingerprint
 * `assertUniqueCssProperties` already keys on) an override entry left
 * unstated, so the same two-paths-one-property conflict this guards against
 * at the base level is caught here too.
 */
export function assertUniqueOverrideCssProperties(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  scopeIndex: Map<string, CorpusEntry>,
  blockName: string,
  resolveReferences: ValueResolver = (value) => value,
): void {
  const resolved = effectiveOverrideEntries(overrides, baseIndex, scopeIndex);
  try {
    assertUniqueCssProperties(resolved, baseIndex, resolveReferences);
  } catch (error) {
    if (error instanceof Error)
      throw new Error(`[${blockName}] ${error.message}`, { cause: error });
    throw error;
  }
}

function effectiveOverrideEntries(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  scopeIndex: Map<string, CorpusEntry>,
): Map<string, CorpusEntry> {
  const pathsByProperty = claimantsByProperty(baseIndex);
  const relevant = relevantOverridePaths(overrides, baseIndex, pathsByProperty);
  const resolved = new Map<string, CorpusEntry>();
  for (const path of relevant) {
    const base = baseIndex.get(path);
    const entry = overrides.get(path) ?? scopeIndex.get(path) ?? base;
    if (entry)
      resolved.set(path, {
        ...entry,
        cssProperty: base?.cssProperty ?? entry.cssProperty,
        type: entry.type ?? base?.type,
      });
  }
  return resolved;
}

function relevantOverridePaths(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  pathsByProperty: Map<string, string[]>,
): Set<string> {
  const relevant = new Set<string>();
  for (const [path, entry] of overrides) {
    relevant.add(path);
    const property = baseIndex.get(path)?.cssProperty ?? entry.cssProperty;
    for (const sibling of property ? (pathsByProperty.get(property) ?? []) : [])
      relevant.add(sibling);
  }
  return relevant;
}

type OverrideScope = {
  name: string;
  resolveReferences: ValueResolver;
};

/** A single emitted override declaration must be valid in every scope its selector reaches. */
export function assertOverrideScopeConsistency(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  scopes: readonly OverrideScope[],
  blockName: string,
): void {
  if (![...overrides.values()].some((entry) => entry.isRefAlias || entryContainsReference(entry)))
    return;
  for (const [path, entry] of overrides) {
    const values = scopes.map((scope) => ({
      scope: scope.name,
      value: serializeEntryValue(entry, baseIndex, scope.resolveReferences),
    }));
    const distinct = new Set(values.map(({ value }) => value));
    if (distinct.size <= 1) continue;
    throw new Error(
      `[${blockName}] override token "${path}" serializes differently across reachable scopes: ` +
        values.map(({ scope, value }) => `${scope}=${value}`).join(', '),
    );
  }
}

/**
 * `tokens-base.css`'s block structure is FIXED, not derived from
 * `resolver.resolutionOrder`: `:root` is always assembled from every `sets`
 * entry (regardless of where it sits in `resolutionOrder`), and the theme
 * override blocks (`[data-theme='dark']`/`[data-theme='light']`) are always
 * emitted before the motion override blocks (the `prefers-reduced-motion`
 * media block and the `data-reduced-motion='on'` override) -- see
 * `buildTokensBaseCss`'s `darkDeclarations`/`lightDeclarations` vs.
 * `reducedMotionDeclarations`/`forcedReducedMotionDeclarations` ordering in
 * the template below.
 *
 * DECISION (CIN-469 finding 5): rather than deriving CSS block order from
 * `resolutionOrder` at generation time -- a bigger, riskier change for a PR
 * whose whole point is a no-diff, tests-and-generator-only fix -- this
 * generator keeps its fixed block structure and instead REJECTS a resolver
 * document whose `resolutionOrder` the fixed structure cannot faithfully
 * express: every `sets` entry must precede every `modifiers` entry (so
 * `:root`'s "every set, unconditionally" assembly matches what
 * `resolutionOrder` actually says the base layer is), and the `theme`
 * modifier must precede the `motion` modifier (so theme-before-motion block
 * emission matches cascade precedence, i.e. a motion override still wins over
 * a theme override for a token both touch, the same way "last non-`:root`
 * block wins" already works today). `cinder.resolver.json`'s current
 * `resolutionOrder` -- foundation, then theme, then motion -- already
 * satisfies this, so the guard is presently a no-op; it exists so a future
 * resolver edit that would silently desync `resolutionOrder` from emission
 * order fails loudly at generate time instead of shipping a CSS cascade that
 * disagrees with the resolver's own stated precedence. If `resolutionOrder`
 * ever legitimately needs a different shape, deriving block order for real
 * -- not just validating it -- is the follow-up.
 */
export function assertResolutionOrderMatchesCssBlockStructure(resolver: ResolverDocument): void {
  const order = parseResolutionOrder(resolver);
  const lastSetsIndex = order.reduce(
    (last, entry, index) => (entry.kind === 'sets' ? index : last),
    -1,
  );
  const firstModifierIndex = order.findIndex((entry) => entry.kind === 'modifiers');
  if (firstModifierIndex !== -1 && lastSetsIndex > firstModifierIndex) {
    throw new Error(
      'resolver\'s resolutionOrder interleaves a "sets" entry after a "modifiers" entry, but ' +
        'tokens-base.css always assembles :root from every "sets" entry unconditionally, ' +
        'regardless of position -- reorder resolutionOrder so every "sets" entry precedes every ' +
        '"modifiers" entry, or teach buildTokensBaseCss to derive :root membership from position.',
    );
  }
  const themeIndex = order.findIndex(
    (entry) => entry.kind === 'modifiers' && entry.name === 'theme',
  );
  const motionIndex = order.findIndex(
    (entry) => entry.kind === 'modifiers' && entry.name === 'motion',
  );
  if (themeIndex !== -1 && motionIndex !== -1 && themeIndex > motionIndex) {
    throw new Error(
      'resolver\'s resolutionOrder has "motion" before "theme", but tokens-base.css always ' +
        "emits the theme override blocks ([data-theme='dark']/[data-theme='light']) before the " +
        'motion override blocks (prefers-reduced-motion / data-reduced-motion) -- reorder ' +
        'resolutionOrder so "theme" precedes "motion", or teach buildTokensBaseCss to derive ' +
        'override block order from resolutionOrder.',
    );
  }
  // `buildTokensBaseCss`'s override-block template is hardcoded to exactly two
  // modifiers, "theme" and "motion" -- it never reads `resolver.modifiers` generically,
  // so a third modifier's context documents would never reach ANY emitted CSS block,
  // while `buildResolvedContexts`/`modifierValuesForCombo` fill every declared
  // modifier (including a third one, at its own default) when composing each resolved
  // snapshot's document scope. A third modifier whose default context overrides
  // anything the base sets don't would then make a published resolved-context
  // snapshot disagree with what the actual CSS renders, for every combination, not just
  // a cross-modifier edge case -- the same class of artifact/CSS disagreement this
  // whole guard exists to prevent, just triggered structurally instead of by a specific
  // value collision. Reject a third modifier here rather than silently generating CSS
  // that can't express it.
  const unsupportedModifiers = Object.keys(resolver.modifiers).filter(
    (name) => name !== 'theme' && name !== 'motion',
  );
  if (unsupportedModifiers.length > 0) {
    throw new Error(
      `resolver declares modifier(s) ${unsupportedModifiers.map((name) => `"${name}"`).join(', ')}, ` +
        'but tokens-base.css\'s override-block template only knows how to emit "theme" and ' +
        '"motion" -- add support for the new modifier to buildTokensBaseCss (and to ' +
        "buildResolvedContexts's published combos) before adding it to the resolver, or the " +
        'generated CSS and published resolved-context snapshots will silently disagree.',
    );
  }
}
