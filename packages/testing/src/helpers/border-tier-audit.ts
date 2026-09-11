/**
 * CIN-602/CIN-245: pure classification logic for the computed-cascade border
 * tier audit.
 *
 * This module contains no browser or CDP calls -- it operates on plain data
 * shapes a Playwright test extracts from `CSS.getMatchedStylesForNode` and
 * `getComputedStyle`, so it can be unit-tested with `bun:test` fixtures
 * without a running browser (see `border-tier-audit.test.ts`), and so it has
 * unit coverage independent of whatever CIN-604 makes of Playwright-only
 * coverage.
 *
 * The mechanism it implements replaces a hand-maintained, source-text scan
 * (`packages/components/src/styles/border-tier-non-border-uses.test.ts`) for
 * exactly the two shapes that scan cannot see, because neither is present as
 * literal text in any one file:
 *
 * - a NON-BORDER use of a tier reached through one hop of a custom-property
 *   alias, where the alias's OWN tier reference lives in a different rule --
 *   often the generated `:root` block, which no hand-authored file mentions
 *   at all (the Toggle track: `background: var(--cinder-toggle-track-off,
 *   var(--cinder-toggle-track-off-resting))` in `toggle.css`, whose fallback
 *   resolves through a generated `:root` custom property to
 *   `var(--cinder-border-muted)`);
 * - a tier reference (border or not) that composites under a fractional
 *   element `opacity` declared in a DIFFERENT file (a disabled Button: the
 *   border comes from `button.css`, the `opacity: 0.6` from `foundation.css`'s
 *   shared disabled-visual rule).
 *
 * Both require seeing what the CASCADE resolves for one real element across
 * every stylesheet that touches it, which is exactly what
 * `CSS.getMatchedStylesForNode` returns and a source-text scan structurally
 * cannot reconstruct.
 */

/** A single CSS declaration as matched for one element by CDP's `CSS.getMatchedStylesForNode` (own rules) or its `inherited` ancestor levels (:root included). */
export type MatchedDeclaration = {
  /** The property this declaration sets: a real CSS property, or a custom-property name (`--cinder-toggle-track-off-resting`). */
  readonly property: string;
  /** The declared value, exactly as authored -- `var()`/`light-dark()` intact, never `getComputedStyle`'s resolved form. */
  readonly value: string;
  /** Whether this declaration matched the element itself or was inherited from an ancestor (`:root` included). */
  readonly origin: 'own' | 'inherited';
};

/** A minimal structural shape for one `CSSStyle` from `CSS.getMatchedStylesForNode` -- only the fields {@link flattenMatchedStyles} reads. The real CDP protocol type is a superset and is structurally assignable here without importing it. */
type MatchedStyleLike = { readonly cssProperties?: readonly { name: string; value: string }[] };
type RuleMatchLike = { readonly rule: { readonly style?: MatchedStyleLike } };
type InheritedLevelLike = {
  readonly inlineStyle?: MatchedStyleLike;
  readonly matchedCSSRules?: readonly RuleMatchLike[];
};

/** A minimal structural shape for `CSS.getMatchedStylesForNode`'s return value -- only the fields {@link flattenMatchedStyles} reads. */
export type MatchedStylesResult = {
  readonly inlineStyle?: MatchedStyleLike;
  readonly matchedCSSRules?: readonly RuleMatchLike[];
  /** A chain of inherited styles from the immediate parent up to `:root`. This is where a corpus alias's OWN tier reference lives when nothing in a hand-authored file ever declares it -- see the module doc comment's Toggle example. */
  readonly inherited?: readonly InheritedLevelLike[];
};

/**
 * Flattens one CDP `CSS.getMatchedStylesForNode` result into a flat list of
 * {@link MatchedDeclaration}s: the element's own inline style and matched
 * rules (`origin: 'own'`), followed by every ancestor level's inline style
 * and matched rules, `:root` included (`origin: 'inherited'`).
 *
 * The `inherited` chain is not optional detail -- it is where the Toggle
 * track's alias resolves (its own tier reference lives in the GENERATED
 * `:root` block, reached only through this chain, never through the
 * element's own matched rules). Omitting it is exactly what a source-text
 * scan effectively does by never having that block's text in reach at all.
 */
export function flattenMatchedStyles(matched: MatchedStylesResult): MatchedDeclaration[] {
  const declarations: MatchedDeclaration[] = [];
  const collect = (style: MatchedStyleLike | undefined, origin: MatchedDeclaration['origin']) => {
    for (const property of style?.cssProperties ?? []) {
      declarations.push({ property: property.name, value: property.value, origin });
    }
  };

  collect(matched.inlineStyle, 'own');
  for (const match of matched.matchedCSSRules ?? []) collect(match.rule.style, 'own');

  for (const level of matched.inherited ?? []) {
    collect(level.inlineStyle, 'inherited');
    for (const match of level.matchedCSSRules ?? []) collect(match.rule.style, 'inherited');
  }

  return declarations;
}

/** One non-border use of a structural border tier, found on a real element's matched cascade. */
export type TierUse = {
  readonly property: string;
  readonly value: string;
  /**
   * Set when the tier is not named in `value` directly, but in the value of
   * SOME OTHER custom property that `value` references via `var()` -- the
   * one-hop alias case. `undefined` for a direct reference.
   */
  readonly viaAlias?: string;
  /** The alias's OWN declared value, when `viaAlias` is set -- the value {@link tierNameIn} and {@link isMixValue} were read from. `undefined` for a direct reference. */
  readonly aliasValue?: string;
  /** Whether the tier sits inside a `color-mix()` call in the referencing value (its alpha is diluted further, not composited as-is). */
  readonly isMix: boolean;
};

const TIER_PATTERN = /--cinder-border(?:-muted|-strong)?\b/;
const BORDER_PROPERTY = /^(?:border|outline)(?:-[a-z-]+)?$/;
const CUSTOM_PROPERTY_REFERENCE = /var\(\s*(--[a-zA-Z0-9-]+)/g;

/**
 * Whether `value` names a structural border tier anywhere in its text.
 *
 * A substring match, deliberately: the dev/playground server desugars
 * `light-dark()` into a `--buncss-light`/`--buncss-dark` pair before the
 * browser ever sees the declaration (`light-dark(var(--cinder-border-muted),
 * ...)` becomes `var(--buncss-light, var(--cinder-border-muted)) var(--buncss-dark,
 * ...)`), so a check that requires an EXACT `light-dark(...)`/`var(...)` shape
 * would miss it post-desugaring. The tier's own custom-property name survives
 * that rewrite intact, which is what this actually keys on.
 */
export function referencesBorderTier(value: string): boolean {
  return TIER_PATTERN.test(value);
}

/** The specific tier custom-property name (`--cinder-border`, `--cinder-border-muted`, or `--cinder-border-strong`) that `value` references, or `undefined` when it references none. */
export function tierNameIn(value: string): string | undefined {
  return TIER_PATTERN.exec(value)?.[0];
}

/** Whether `property` is a border- or outline-shorthand or longhand. Tier uses in these are the ordinary, expected case and are not reported. */
export function isBorderProperty(property: string): boolean {
  return BORDER_PROPERTY.test(property);
}

/** Whether `property` is a custom property (a declaration like `--cinder-toggle-track-off-resting: …`, not a real CSS property). */
export function isCustomProperty(property: string): boolean {
  return property.startsWith('--');
}

/** Whether `value` puts the tier inside a `color-mix()` call, so its own alpha is what gets diluted rather than composited as-is. */
export function isMixValue(value: string): boolean {
  return /color-mix\(/i.test(value);
}

/** Every `var(--name…)` reference in `value`, in the order they appear. */
export function customPropertyReferences(value: string): string[] {
  const names: string[] = [];
  for (const match of value.matchAll(CUSTOM_PROPERTY_REFERENCE)) {
    const name = match[1];
    if (name !== undefined) names.push(name);
  }
  return names;
}

/**
 * Every non-border use of a structural border tier reachable from
 * `declarations` -- the full matched-style set for one element (its own
 * rules, plus every ancestor's including `:root`), in the shape
 * `CSS.getMatchedStylesForNode` returns.
 *
 * A use is either DIRECT (the tier's own custom-property name appears in a
 * non-border property's declared value) or reached through ONE HOP of a
 * custom-property alias: a non-border property references some
 * `--custom-name`, and `--custom-name` is ITSELF declared somewhere in the
 * same matched set with a value that names the tier. Only one hop is
 * resolved, deliberately -- the corpus never chains an alias through a
 * second alias, and a mechanism that recurses arbitrarily deep risks walking
 * an unrelated custom property that happens to share a fallback shape.
 *
 * Which declaration of a repeated custom property "wins" the cascade is not
 * decided here (see the module doc comment and the CDP spike's caveat on
 * `@layer` order) -- ANY declaration of the alias that names the tier is
 * enough to flag the site as a use, because the question this answers is
 * "can this element's tier alpha reach a non-border position", not "does it
 * always".
 */
export function tierUses(declarations: readonly MatchedDeclaration[]): TierUse[] {
  const aliasValues = new Map<string, string>();
  for (const declaration of declarations) {
    if (isCustomProperty(declaration.property) && !aliasValues.has(declaration.property)) {
      aliasValues.set(declaration.property, declaration.value);
    }
  }

  const uses: TierUse[] = [];
  for (const { property, value } of declarations) {
    if (isBorderProperty(property)) continue;

    if (isCustomProperty(property)) {
      // A corpus alias's own declaration: reported as a use in its own right,
      // independent of whether anything on THIS element ever reads it back
      // through a `var()` chain -- the corpus-alias case.
      if (referencesBorderTier(value)) {
        uses.push({ property, value, isMix: isMixValue(value) });
      }
      continue;
    }

    if (referencesBorderTier(value)) {
      uses.push({ property, value, isMix: isMixValue(value) });
      continue;
    }

    for (const reference of customPropertyReferences(value)) {
      const aliasValue = aliasValues.get(reference);
      if (aliasValue !== undefined && referencesBorderTier(aliasValue)) {
        uses.push({
          property,
          value,
          viaAlias: reference,
          aliasValue,
          isMix: isMixValue(aliasValue),
        });
        break;
      }
    }
  }
  return uses;
}

/**
 * Every declaration among `declarations` that names a structural border tier
 * -- in ANY property, border/outline included -- while `elementOpacity` is
 * fractional.
 *
 * A fractional element `opacity` multiplies every tier reference's own alpha,
 * border declarations included: the ordinary "a tier as a border is exempt"
 * rule does not hold once the element itself is translucent. This does not
 * need to know which of several matched declarations for the same property
 * actually wins the cascade (see {@link tierUses}'s doc comment on the same
 * point) -- any matched declaration naming the tier is a real compounding
 * risk regardless of which one is currently painted.
 */
export function opacityCompoundedTierDeclarations(
  declarations: readonly MatchedDeclaration[],
  elementOpacity: number,
): MatchedDeclaration[] {
  if (!(elementOpacity < 1)) return [];
  return declarations.filter(
    (declaration) => declaration.origin === 'own' && referencesBorderTier(declaration.value),
  );
}

/**
 * The product of every fractional `opacity` from `element` up through its
 * ancestors (`getComputedStyle(element).opacity`, walked via
 * `element.parentElement`). `opacity` is always a literal number in this
 * corpus (never a `var()`), so reading it from `getComputedStyle` loses
 * nothing the way a color read would -- see the module doc comment on why
 * tier VALUES cannot use the same computed-style shortcut.
 */
export function effectiveOpacity(opacities: readonly number[]): number {
  return opacities.reduce((product, value) => product * value, 1);
}
