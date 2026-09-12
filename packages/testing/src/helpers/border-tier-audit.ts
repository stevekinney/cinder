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

import {
  resolveTierReferences,
  type TierReference,
  type VariableValue,
} from './border-tier-value-resolution.ts';

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
  /** Whether this declaration came from the element's inline style. Inline author declarations outrank selector rules. */
  readonly inline?: boolean;
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
      if (property.value.trim() === '' && !property.name.startsWith('--')) continue;
      declarations.push({
        property: property.name,
        value: property.value,
        origin,
        level,
        important: property.important ?? false,
        inline: true,
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
        // CDP expands a var()-valued shorthand into empty synthetic longhands.
        // They have no authored value and must not override the shorthand.
        if (property.value.trim() === '' && !property.name.startsWith('--')) continue;
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
 * - Within the same level, `!important` outranks a normal declaration. Origin/layer tiering is not modelled; see the limits below.
 * - Within the same level and importance, inline styles outrank selector rules.
 * - Among selector rules, the higher CDP-reported
 *   {@link Specificity} wins.
 * - A genuine tie (equal level, importance, and specificity -- or either
 *   selector rule missing specificity) falls back
 *   to LATER-IN-`candidates`-WINS. `candidates` is in CDP's own
 *   `matchedCSSRules` order, which is a reasonable but NOT a fully reliable
 *   source-order signal (Chromium's internal rule-set bucketing does not
 *   guarantee the array reflects true document order across differently
 *   shaped selectors) -- documented here rather than silently assumed.
 *
 * Known, deliberate limits: cascade LAYERS (`@layer`) are not modelled at
 * all -- this mirrors the pre-existing caveat in this module's history (see
 * the CDP spike this ticket is built on) even though the library uses layers. The captured audit sites therefore need
 * browser regression probes; this helper is not a general CSS cascade engine. Style-sheet ORIGIN (user-agent
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
  if (Boolean(candidate.inline) !== Boolean(current.inline)) return candidate.inline === true;
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
  /** The reachable terminal tier reference after alias and fallback resolution. `undefined` for a direct reference. */
  readonly resolvedTierReference?: string;
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

/** Index declarations once, retaining all candidates for each property. */
function declarationIndex(declarations: readonly MatchedDeclaration[]) {
  const index = new Map<string, MatchedDeclaration[]>();
  for (const declaration of declarations) {
    const candidates = index.get(declaration.property) ?? [];
    candidates.push(declaration);
    index.set(declaration.property, candidates);
  }
  return index;
}

/** Resolve shorthand/color-longhand pairs in one paint slot, preserving extraction order. */
function paintWinner(
  property: string,
  candidates: readonly MatchedDeclaration[],
  declarations: readonly MatchedDeclaration[],
): MatchedDeclaration | undefined {
  const shorthand = property.replace(/-color$/, '');
  if (!/^(?:border(?:-(?:top|right|bottom|left))?|outline|background)$/.test(shorthand))
    return resolveCascadeWinner(candidates);
  return resolveCascadeWinner(
    declarations.filter(
      (item) => item.property === shorthand || item.property === `${shorthand}-color`,
    ),
  );
}

/** Custom properties inherit computed values, so ancestor aliases cannot see child overrides. */
function variableLookup(index: ReadonlyMap<string, readonly MatchedDeclaration[]>) {
  return function lookup(name: string, minimumLevel: number): VariableValue | undefined {
    const candidates = index.get(name) ?? [];
    let level = minimumLevel;
    for (;;) {
      const winner = resolveCascadeWinner(
        candidates.filter((candidate) => candidate.level >= level),
      );
      if (!winner) return undefined;
      const keyword = winner.value.trim().toLowerCase();
      if (keyword === 'inherit' || keyword === 'unset') {
        level = winner.level + 1;
        continue;
      }
      if (keyword === 'revert' || keyword === 'revert-layer') {
        throw new Error(
          `The tier audit cannot resolve ${name}: ${keyword} without cascade origin/layer data.`,
        );
      }
      return winner;
    }
  };
}

/** Report winning direct tier uses and one-hop aliases; deeper chains are outside this audit's scope. */
export function tierUses(declarations: readonly MatchedDeclaration[]): TierUse[] {
  const index = declarationIndex(declarations);
  const lookup = variableLookup(index);
  const uses: TierUse[] = [];
  for (const [property, candidates] of index) {
    if (isBorderProperty(property) || isCustomProperty(property)) continue;
    const winner = paintWinner(property, candidates, declarations);
    if (!winner || winner.level !== 0 || winner.property !== property) continue;
    const colorMinimumLevel = property === 'color' ? winner.level + 1 : winner.level;
    const reference = resolveTierReferences(winner.value, lookup, winner.level, {
      currentColor: () => colorTierReferenceAt(index, lookup, colorMinimumLevel),
    }).find((candidate) => candidate.depth <= 1);
    if (!reference) continue;
    uses.push({
      property,
      value: winner.value,
      isMix: reference.isMix,
      ...(reference.alias
        ? {
            viaAlias: reference.alias,
            resolvedTierReference: `var(${reference.tier})`,
          }
        : {}),
    });
  }
  return uses;
}

export type OpacityTierDeclaration = MatchedDeclaration & {
  /** Reachable ink when var() or currentColor obscures it in the authored value. */
  readonly resolvedValue?: string;
};

function colorTierReferenceAt(
  index: ReadonlyMap<string, readonly MatchedDeclaration[]>,
  lookup: (name: string, minimumLevel: number) => VariableValue | undefined,
  minimumLevel: number,
): TierReference | undefined {
  const candidates = index.get('color') ?? [];
  let level = minimumLevel;
  for (;;) {
    const color = resolveCascadeWinner(candidates.filter((item) => item.level >= level));
    if (color === undefined) return undefined;
    if (/^(?:currentcolor|inherit|unset)$/i.test(color.value.trim())) {
      level = color.level + 1;
      continue;
    }
    return resolveTierReferences(color.value, lookup, color.level, {
      currentColor: () => colorTierReferenceAt(index, lookup, color.level + 1),
    })[0];
  }
}

/** Report winning paint declarations under fractional opacity, including inherited currentColor. */
export function opacityCompoundedTierDeclarations(
  declarations: readonly MatchedDeclaration[],
  elementOpacity: number,
): OpacityTierDeclaration[] {
  if (!(elementOpacity < 1)) return [];
  const index = declarationIndex(declarations);
  const lookup = variableLookup(index);
  const winners: OpacityTierDeclaration[] = [];
  for (const [property, candidates] of index) {
    if (isCustomProperty(property)) continue;
    const winner = paintWinner(property, candidates, declarations);
    if (!winner || winner.level !== 0 || winner.property !== property) continue;
    const colorMinimumLevel = property === 'color' ? winner.level + 1 : winner.level;
    const reference = resolveTierReferences(winner.value, lookup, winner.level, {
      currentColor: () => colorTierReferenceAt(index, lookup, colorMinimumLevel),
    })[0];
    if (reference)
      winners.push({
        ...winner,
        ...(tierNameIn(winner.value) !== reference.tier
          ? { resolvedValue: `var(${reference.tier})` }
          : {}),
      });
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
