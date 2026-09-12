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

/** A selector's specificity as CDP reports it -- see `CSS.Specificity` in the protocol (`a` = ID selectors, `b` = classes/attributes/pseudo-classes, `c` = type selectors/pseudo-elements). */
export type Specificity = { readonly a: number; readonly b: number; readonly c: number };

/** A single CSS declaration as matched for one element by CDP's `CSS.getMatchedStylesForNode` (own rules) or its `inherited` ancestor levels (:root included). */
export type MatchedDeclaration = {
  /** The property this declaration sets: a real CSS property, or a custom-property name (`--cinder-toggle-track-off-resting`). */
  readonly property: string;
  /** The declared value, exactly as authored -- `var()`/`light-dark()` intact, never `getComputedStyle`'s resolved form. */
  readonly value: string;
  /** Whether this declaration matched the element itself or was inherited from an ancestor (`:root` included). */
  readonly origin: 'own' | 'inherited';
  /**
   * Distance from the element in the inheritance chain: `0` for the
   * element's own inline style or matched rules, `1` for its nearest
   * ancestor, increasing by one per level up to `:root`. This is what
   * {@link resolveCascadeWinner} uses to decide "own beats inherited" --
   * and, among several inherited levels, "nearer beats farther" -- since a
   * farther ancestor's declaration for a property never reaches an element
   * whose nearer ancestor (or the element itself) already set that property.
   */
  readonly level: number;
  /** Whether this declaration carries `!important`. */
  readonly important: boolean;
  /**
   * The highest specificity among this declaration's rule's MATCHING
   * selectors (a comma-separated selector list can match via more than one
   * branch; CDP reports each branch's own specificity, and the rule's
   * effective specificity for this element is the greatest of the ones that
   * actually matched). `undefined` for an inline-style declaration (no
   * selector at all) or when CDP did not report it.
   */
  readonly specificity?: Specificity;
};

/** A minimal structural shape for one `CSSStyle` from `CSS.getMatchedStylesForNode` -- only the fields {@link flattenMatchedStyles} reads. The real CDP protocol type is a superset and is structurally assignable here without importing it. */
type MatchedStyleLike = {
  readonly cssProperties?: readonly { name: string; value: string; important?: boolean }[];
};
/** A minimal structural shape for one selector-list entry (`CSS.Value`) -- only the specificity {@link flattenMatchedStyles} reads. */
type SelectorValueLike = { readonly specificity?: Specificity };
type RuleMatchLike = {
  readonly rule: {
    readonly style?: MatchedStyleLike;
    readonly selectorList?: { readonly selectors?: readonly SelectorValueLike[] };
  };
  /** Which of the rule's comma-separated selectors matched THIS element (0-based indices into `rule.selectorList.selectors`) -- see {@link ruleSpecificity}. */
  readonly matchingSelectors?: readonly number[];
};
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

/** The greatest specificity among `match`'s MATCHING selectors, or `undefined` when CDP reported none (an older CDP version, or a rule whose `matchingSelectors` came back empty). */
function ruleSpecificity(match: RuleMatchLike): Specificity | undefined {
  let best: Specificity | undefined;
  for (const index of match.matchingSelectors ?? []) {
    const candidate = match.rule.selectorList?.selectors?.[index]?.specificity;
    if (candidate === undefined) continue;
    if (best === undefined || compareSpecificity(candidate, best) > 0) best = candidate;
  }
  return best;
}

/**
 * Flattens one CDP `CSS.getMatchedStylesForNode` result into a flat list of
 * {@link MatchedDeclaration}s: the element's own inline style and matched
 * rules (`origin: 'own'`, `level: 0`), followed by every ancestor level's
 * inline style and matched rules, `:root` included (`origin: 'inherited'`,
 * `level` counting up from `1` at the nearest ancestor).
 *
 * The `inherited` chain is not optional detail -- it is where the Toggle
 * track's alias resolves (its own tier reference lives in the GENERATED
 * `:root` block, reached only through this chain, never through the
 * element's own matched rules). Omitting it is exactly what a source-text
 * scan effectively does by never having that block's text in reach at all.
 */
export function flattenMatchedStyles(matched: MatchedStylesResult): MatchedDeclaration[] {
  const declarations: MatchedDeclaration[] = [];

  const collectInline = (
    style: MatchedStyleLike | undefined,
    origin: MatchedDeclaration['origin'],
    level: number,
  ) => {
    for (const property of style?.cssProperties ?? []) {
      declarations.push({
        property: property.name,
        value: property.value,
        origin,
        level,
        important: property.important ?? false,
      });
    }
  };

  const collectRules = (
    matches: readonly RuleMatchLike[] | undefined,
    origin: MatchedDeclaration['origin'],
    level: number,
  ) => {
    for (const match of matches ?? []) {
      const specificity = ruleSpecificity(match);
      for (const property of match.rule.style?.cssProperties ?? []) {
        declarations.push({
          property: property.name,
          value: property.value,
          origin,
          level,
          important: property.important ?? false,
          // `exactOptionalPropertyTypes` treats an explicit `undefined` as a
          // type error for an optional field -- only spread it in when CDP
          // actually reported a specificity.
          ...(specificity !== undefined ? { specificity } : {}),
        });
      }
    }
  };

  collectInline(matched.inlineStyle, 'own', 0);
  collectRules(matched.matchedCSSRules, 'own', 0);

  let level = 0;
  for (const inheritedLevel of matched.inherited ?? []) {
    level += 1;
    collectInline(inheritedLevel.inlineStyle, 'inherited', level);
    collectRules(inheritedLevel.matchedCSSRules, 'inherited', level);
  }

  return declarations;
}

/**
 * Compares two selector specificities per
 * {@link https://drafts.csswg.org/selectors/#specificity-rules CSS
 * Selectors}: `a` (ID selectors) outranks `b` (classes/attributes/pseudo
 * classes) outranks `c` (type selectors/pseudo-elements). Positive when `x`
 * outranks `y`, negative when `y` outranks `x`, `0` when equal.
 */
function compareSpecificity(x: Specificity, y: Specificity): number {
  if (x.a !== y.a) return x.a - y.a;
  if (x.b !== y.b) return x.b - y.b;
  return x.c - y.c;
}

/**
 * The single {@link MatchedDeclaration} among `candidates` that actually WINS
 * the cascade for its property on this element -- or `undefined` when
 * `candidates` is empty. This is what {@link tierUses} and
 * {@link opacityCompoundedTierDeclarations} use instead of "any matching
 * declaration counts": a declaration that LOSES the cascade never
 * participates in what the element actually renders, so reporting it as a
 * tier use is a false positive the browser itself does not produce.
 *
 * Priority, in order:
 *
 * - A lower {@link MatchedDeclaration.level} always wins outright, regardless
 *   of specificity or `!important` -- this is exact, not an approximation.
 *   Inheritance only ever supplies a value when nothing at a nearer level
 *   (down to and including the element's own matched rules) sets the
 *   property at all; a farther ancestor's declaration for a property that a
 *   nearer level also declares never reaches this element, full stop.
 * - Within the same level, `!important` outranks a normal declaration. This
 *   corpus is exclusively regular (author-origin) CSS with no cascade layers
 *   -- see the limits below -- so origin/layer tiering is not modelled.
 * - Within the same level and importance, the higher CDP-reported
 *   {@link Specificity} wins.
 * - A genuine tie (equal level, importance, and specificity -- or either
 *   side missing specificity, e.g. an inline-style declaration) falls back
 *   to LATER-IN-`candidates`-WINS. `candidates` is in CDP's own
 *   `matchedCSSRules` order, which is a reasonable but NOT a fully reliable
 *   source-order signal (Chromium's internal rule-set bucketing does not
 *   guarantee the array reflects true document order across differently
 *   shaped selectors) -- documented here rather than silently assumed.
 *
 * Known, deliberate limits: cascade LAYERS (`@layer`) are not modelled at
 * all -- this mirrors the pre-existing caveat in this module's history (see
 * the CDP spike this ticket is built on) and the corpus does not currently
 * use layers for tier-bearing declarations. Style-sheet ORIGIN (user-agent
 * vs. author) is not modelled either, since every declaration this audit
 * sees is `regular` (author) CSS. Widening either would mean threading more
 * of `CSSRule` through {@link flattenMatchedStyles} and is left for when the
 * corpus actually needs it, not guessed at speculatively here.
 */
export function resolveCascadeWinner(
  candidates: readonly MatchedDeclaration[],
): MatchedDeclaration | undefined {
  let winner: MatchedDeclaration | undefined;
  for (const candidate of candidates) {
    if (winner === undefined || outranksCurrentWinner(candidate, winner)) winner = candidate;
  }
  return winner;
}

/** Whether `candidate` outranks `current` per {@link resolveCascadeWinner}'s priority order -- ties (including a missing specificity on either side) resolve in `candidate`'s favor, since callers walk `candidates` in order and a tie means "later wins". */
function outranksCurrentWinner(
  candidate: MatchedDeclaration,
  current: MatchedDeclaration,
): boolean {
  if (candidate.level !== current.level) return candidate.level < current.level;
  if (candidate.important !== current.important) return candidate.important;
  if (candidate.specificity !== undefined && current.specificity !== undefined) {
    const bySpecificity = compareSpecificity(candidate.specificity, current.specificity);
    if (bySpecificity !== 0) return bySpecificity > 0;
  }
  return true; // a genuine tie (or unknown specificity on either side): later wins
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

const TIER_PATTERN = /--cinder-border(?:-muted|-strong)?(?![\w-])/;
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
 * Which declaration of a repeated custom property actually reaches this
 * element IS decided here, via {@link resolveCascadeWinner} -- an element
 * overriding an inherited alias (`:root { --track: var(--cinder-border-muted)
 * }`, the element itself setting `--track: var(--cinder-accent-solid)`) means
 * the tier-referencing `:root` declaration never participates in this
 * element's `var(--track)`, and reporting it as a use would be exactly the
 * false positive an audit "derived from computed styles" exists to avoid.
 * Only the alias's WINNING declaration is checked; a losing one, tier or not,
 * is never consulted.
 */
export function tierUses(declarations: readonly MatchedDeclaration[]): TierUse[] {
  // Every declaration of each repeated custom property, in declaration order
  // -- not just the first seen. {@link resolveCascadeWinner} needs every
  // candidate to pick the actual winner from, not merely "the first one that
  // happens to name the tier" (the defect this replaced).
  const aliasDeclarations = new Map<string, MatchedDeclaration[]>();
  for (const declaration of declarations) {
    if (!isCustomProperty(declaration.property)) continue;
    const existing = aliasDeclarations.get(declaration.property);
    if (existing === undefined) aliasDeclarations.set(declaration.property, [declaration]);
    else existing.push(declaration);
  }

  const uses: TierUse[] = [];
  for (const { property, value } of declarations) {
    if (isBorderProperty(property)) continue;

    if (isCustomProperty(property)) {
      // A corpus alias's own declaration: reported as a use in its own right,
      // independent of whether anything on THIS element ever reads it back
      // through a `var()` chain, and independent of whether it wins the
      // cascade for ITS OWN property -- the corpus-alias case. This is a
      // deliberately different question from "does the tier reach this
      // element's render" (which the loop below answers): it flags that the
      // corpus AUTHORED a tier reference in a custom property's value at
      // all, since the same declaration can win on a different element where
      // no override shadows it.
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
      const candidates = aliasDeclarations.get(reference);
      if (candidates === undefined) continue;
      const winner = resolveCascadeWinner(candidates);
      if (winner !== undefined && referencesBorderTier(winner.value)) {
        uses.push({
          property,
          value,
          viaAlias: reference,
          aliasValue: winner.value,
          isMix: isMixValue(winner.value),
        });
        break;
      }
    }
  }
  return uses;
}

/**
 * Every declaration among `declarations` that WINS the cascade for its
 * property and names a structural border tier -- in ANY property,
 * border/outline included -- while `elementOpacity` is fractional.
 *
 * A fractional element `opacity` multiplies every tier reference's own alpha,
 * border declarations included: the ordinary "a tier as a border is exempt"
 * rule does not hold once the element itself is translucent. Only
 * declarations with `level: 0` (the element's own inline style or matched
 * rules) can ever win here -- {@link resolveCascadeWinner} always prefers a
 * lower level, so a property with any own-level candidate never resolves to
 * an inherited one, matching the prior exclusion of `inherited`, but now
 * exactly rather than by construction. This DOES need to know which of
 * several own matched declarations for the same property actually wins: if a
 * base rule sets `border-color: var(--cinder-border-muted)` and a later,
 * higher-specificity (or `!important`) rule overrides it with
 * `border-color: var(--cinder-accent-solid)`, the base rule's tier reference
 * never paints -- reporting it as opacity-compounded would flag a value the
 * element never actually renders.
 */
export function opacityCompoundedTierDeclarations(
  declarations: readonly MatchedDeclaration[],
  elementOpacity: number,
): MatchedDeclaration[] {
  if (!(elementOpacity < 1)) return [];

  const byProperty = new Map<string, MatchedDeclaration[]>();
  for (const declaration of declarations) {
    const existing = byProperty.get(declaration.property);
    if (existing === undefined) byProperty.set(declaration.property, [declaration]);
    else existing.push(declaration);
  }

  const winners: MatchedDeclaration[] = [];
  for (const candidates of byProperty.values()) {
    const winner = resolveCascadeWinner(candidates);
    if (winner !== undefined && winner.level === 0 && referencesBorderTier(winner.value)) {
      winners.push(winner);
    }
  }
  return winners;
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
