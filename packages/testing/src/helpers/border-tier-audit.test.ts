import { describe, expect, test } from 'bun:test';

import {
  customPropertyReferences,
  effectiveOpacity,
  flattenMatchedStyles,
  isBorderProperty,
  isCustomProperty,
  isMixValue,
  type MatchedDeclaration,
  type MatchedStylesResult,
  opacityCompoundedTierDeclarations,
  referencesBorderTier,
  resolveCascadeWinner,
  type Specificity,
  tierNameIn,
  tierUses,
} from './border-tier-audit.ts';

/**
 * Builds a {@link MatchedDeclaration} fixture. `level` defaults from
 * `origin` (`0` for `'own'`, `1` for `'inherited'`) so every pre-existing
 * call site -- which only ever varied `origin` -- keeps meaning exactly what
 * it did before {@link resolveCascadeWinner} needed `level`/`important`/
 * `specificity` to pick a cascade winner. Pass `options` to exercise same-
 * level tie-breaking (a second inherited ancestor, `!important`, or an
 * explicit specificity) explicitly.
 */
function declaration(
  property: string,
  value: string,
  origin: MatchedDeclaration['origin'] = 'own',
  options: {
    level?: number;
    important?: boolean;
    specificity?: Specificity;
    inline?: boolean;
  } = {},
): MatchedDeclaration {
  const level = options.level ?? (origin === 'own' ? 0 : 1);
  const important = options.important ?? false;
  return {
    property,
    value,
    origin,
    level,
    important,
    ...(options.inline === true ? { inline: true } : {}),
    ...(options.specificity !== undefined ? { specificity: options.specificity } : {}),
  };
}

describe('referencesBorderTier', () => {
  test('matches all three tiers', () => {
    expect(referencesBorderTier('var(--cinder-border-muted)')).toBe(true);
    expect(referencesBorderTier('var(--cinder-border)')).toBe(true);
    expect(referencesBorderTier('var(--cinder-border-strong)')).toBe(true);
  });

  test('is false for an unrelated custom property', () => {
    expect(referencesBorderTier('var(--cinder-accent-solid)')).toBe(false);
  });

  test('is false for real, distinct --cinder-border-* tokens that share the tier prefix but are not tiers', () => {
    // --cinder-border-faint is a real production token (dropdown.css,
    // toolbar.css) referenced for non-border backgrounds -- a naive
    // `--cinder-border(?:-muted|-strong)?\b` regex matches it anyway because
    // `\b` only checks for a word/non-word transition, and the hyphen before
    // "faint" is itself a non-word character, so the boundary is satisfied
    // one character too early. Same reasoning applies to -ink and -inverse.
    expect(referencesBorderTier('var(--cinder-border-faint)')).toBe(false);
    expect(referencesBorderTier('var(--cinder-border-ink)')).toBe(false);
    expect(referencesBorderTier('var(--cinder-border-inverse)')).toBe(false);
  });

  test('survives light-dark() desugaring into a buncss pair', () => {
    // The exact shape the CDP spike captured from the dev server for the
    // Toggle track's generated :root declaration.
    const desugared =
      'var(--buncss-light,var(--cinder-border-muted))var(--buncss-dark,oklch(45% .02 245))';
    expect(referencesBorderTier(desugared)).toBe(true);
  });
});

describe('tierNameIn', () => {
  test('extracts each of the three tier names', () => {
    expect(tierNameIn('var(--cinder-border-muted)')).toBe('--cinder-border-muted');
    expect(tierNameIn('var(--cinder-border)')).toBe('--cinder-border');
    expect(tierNameIn('var(--cinder-border-strong)')).toBe('--cinder-border-strong');
  });

  test('extracts the tier name from a desugared light-dark() pair', () => {
    expect(
      tierNameIn(
        'var(--buncss-light,var(--cinder-border-muted))var(--buncss-dark,oklch(45% .02 245))',
      ),
    ).toBe('--cinder-border-muted');
  });

  test('is undefined when the value names no tier', () => {
    expect(tierNameIn('var(--cinder-accent-solid)')).toBeUndefined();
  });

  test('is undefined for a real --cinder-border-* token that is not a tier', () => {
    // Regression: the pre-fix `\b`-anchored pattern returned '--cinder-border'
    // here -- the wrong name entirely -- instead of correctly reporting no
    // tier match.
    expect(tierNameIn('var(--cinder-border-faint)')).toBeUndefined();
    expect(tierNameIn('var(--cinder-border-ink)')).toBeUndefined();
    expect(tierNameIn('var(--cinder-border-inverse)')).toBeUndefined();
  });
});

describe('isBorderProperty', () => {
  test('accepts border and outline, longhand and shorthand', () => {
    for (const property of [
      'border',
      'border-color',
      'border-top-color',
      'outline',
      'outline-color',
    ]) {
      expect(isBorderProperty(property)).toBe(true);
    }
  });

  test('rejects a non-border property, even one that mentions border in its name loosely', () => {
    for (const property of ['background', 'color', 'box-shadow', '--cinder-toggle-track-off']) {
      expect(isBorderProperty(property)).toBe(false);
    }
  });
});

describe('isCustomProperty / isMixValue', () => {
  test('isCustomProperty', () => {
    expect(isCustomProperty('--cinder-toggle-track-off')).toBe(true);
    expect(isCustomProperty('background')).toBe(false);
  });

  test('isMixValue', () => {
    expect(isMixValue('color-mix(in oklch, var(--cinder-border), transparent 10%)')).toBe(true);
    expect(isMixValue('var(--cinder-border)')).toBe(false);
  });
});

describe('customPropertyReferences', () => {
  test('extracts every var() reference, including a nested fallback', () => {
    expect(
      customPropertyReferences(
        'var(--cinder-toggle-track-off, var(--cinder-toggle-track-off-resting))',
      ),
    ).toEqual(['--cinder-toggle-track-off', '--cinder-toggle-track-off-resting']);
  });

  test('returns an empty array for a value with no var()', () => {
    expect(customPropertyReferences('transparent')).toEqual([]);
  });
});

describe('tierUses', () => {
  test('a direct non-border use is reported', () => {
    const uses = tierUses([declaration('background', 'var(--cinder-border)')]);
    expect(uses).toEqual([{ property: 'background', value: 'var(--cinder-border)', isMix: false }]);
  });

  test('only the winning direct declaration is reported', () => {
    expect(
      tierUses([
        declaration('background', 'var(--cinder-border-muted)', 'own', {
          specificity: { a: 0, b: 1, c: 0 },
        }),
        declaration('background', 'var(--cinder-accent-solid)', 'own', {
          specificity: { a: 0, b: 2, c: 0 },
        }),
      ]),
    ).toEqual([]);
  });

  test('does not inspect an unreachable var() fallback', () => {
    expect(
      tierUses([
        declaration('background', 'var(--track, var(--cinder-border-muted))'),
        declaration('--track', 'var(--cinder-accent-solid)'),
      ]),
    ).toEqual([]);
  });

  test('resolves alias uses only from the winning direct property and preserves sibling vars', () => {
    const declarations = [
      declaration('background', 'var(--track)', 'own', { specificity: { a: 0, b: 1, c: 0 } }),
      declaration('background', 'var(--accent)', 'own', { specificity: { a: 0, b: 2, c: 0 } }),
      declaration('--track', 'var(--cinder-border-muted)'),
      declaration('--accent', 'var(--cinder-accent-solid)'),
    ];
    expect(tierUses(declarations).some((use) => use.property === 'background')).toBe(false);
    expect(
      tierUses([
        declaration('background', 'color-mix(in oklch, var(--accent), var(--cinder-border-muted))'),
        declaration('--accent', 'var(--cinder-accent-solid)'),
      ]),
    ).toHaveLength(1);
  });

  test('a border use is exempt, even when it is the only declaration', () => {
    expect(tierUses([declaration('border-color', 'var(--cinder-border-muted)')])).toEqual([]);
  });

  test('a real --cinder-border-faint use is NOT reported -- it is a distinct, non-tier token', () => {
    // The site this misreport would actually hit: dropdown.css:239 and
    // toolbar.css:42 both declare `background: var(--cinder-border-faint)`
    // -- a non-border use of a REAL, non-tier token that happens to share the
    // `--cinder-border` prefix. The pre-fix `\b`-anchored TIER_PATTERN
    // reported this as a use of `--cinder-border` itself (the wrong name
    // entirely), which is exactly the defect class CIN-602 exists to retire,
    // reintroduced one level up the call stack from `referencesBorderTier`.
    expect(tierUses([declaration('background', 'var(--cinder-border-faint)')])).toEqual([]);
  });

  test('the Toggle track shape: a one-hop alias through a var() fallback resolves', () => {
    // The exact declarations the CDP spike captured: the hand-authored rule
    // in toggle.css, plus the generated :root rule that toggle.css's alias
    // resolves through when unset. No file mentions `--cinder-border-muted`
    // directly next to `background`.
    const declarations: MatchedDeclaration[] = [
      declaration(
        'background',
        'var(--cinder-toggle-track-off, var(--cinder-toggle-track-off-resting))',
        'own',
      ),
      declaration(
        '--cinder-toggle-track-off-resting',
        'var(--buncss-light,var(--cinder-border-muted))var(--buncss-dark,oklch(45% .02 245))',
        'inherited',
      ),
    ];
    const uses = tierUses(declarations);
    expect(uses).toHaveLength(2);
    expect(uses).toContainEqual({
      property: 'background',
      value: 'var(--cinder-toggle-track-off, var(--cinder-toggle-track-off-resting))',
      viaAlias: '--cinder-toggle-track-off-resting',
      aliasValue:
        'var(--buncss-light,var(--cinder-border-muted))var(--buncss-dark,oklch(45% .02 245))',
      isMix: false,
    });
    // The alias's own declaration is reported too -- the corpus-alias case,
    // independent of whether anything reads it back.
    expect(uses).toContainEqual({
      property: '--cinder-toggle-track-off-resting',
      value: 'var(--buncss-light,var(--cinder-border-muted))var(--buncss-dark,oklch(45% .02 245))',
      isMix: false,
    });
  });

  test('a var() reference to an alias that does NOT name the tier is not a use', () => {
    const declarations: MatchedDeclaration[] = [
      declaration('background', 'var(--cinder-toggle-track-on)'),
      declaration('--cinder-toggle-track-on', 'var(--cinder-accent-solid)'),
    ];
    expect(tierUses(declarations)).toEqual([]);
  });

  test('a mix use is flagged as isMix', () => {
    const uses = tierUses([
      declaration('background', 'color-mix(in oklch, var(--cinder-border-muted), transparent 90%)'),
    ]);
    expect(uses[0]?.isMix).toBe(true);
  });

  test('only one hop is resolved -- a chained alias-of-an-alias is not followed', () => {
    const declarations: MatchedDeclaration[] = [
      declaration('background', 'var(--cinder-a)'),
      declaration('--cinder-a', 'var(--cinder-b)'),
      declaration('--cinder-b', 'var(--cinder-border-muted)'),
    ];
    const uses = tierUses(declarations);
    // `--cinder-b` is reported (its own declaration names the tier), and
    // `--cinder-a` is NOT (one hop from `--cinder-a` reaches `--cinder-b`,
    // whose value is `var(--cinder-border-muted)` -- a var() reference, not
    // the tier's own name, so `referencesBorderTier` is false on it). The
    // `background` use is not reached at all: it is two hops from the tier.
    expect(uses.map((use) => use.property)).toEqual(['--cinder-b']);
  });

  test('a custom property declared twice is resolved from EVERY candidate, not just the first seen', () => {
    // Regression: `aliasValues` used to keep only the first-seen value per
    // custom property name (`!aliasValues.has(...)` guarding the `.set`), so
    // a later declaration of a repeated custom property was never even a
    // candidate for {@link resolveCascadeWinner} to consider -- collecting
    // every declaration (not just the first) is a prerequisite for winner
    // resolution to work at all, tier-naming or not. Here `--cinder-a` is
    // declared twice: an unrelated inherited (`:root`-level) color, and the
    // element's OWN declaration naming the tier. `resolveCascadeWinner`
    // picks the own declaration on level alone (own always beats inherited,
    // independent of which was seen first), and it happens to be the one
    // naming the tier, so the alias use is reported.
    const declarations: MatchedDeclaration[] = [
      declaration('--cinder-a', 'var(--cinder-accent-solid)', 'inherited'),
      declaration('--cinder-a', 'var(--cinder-border-muted)', 'own'),
      declaration('background', 'var(--cinder-a)'),
    ];
    const uses = tierUses(declarations);
    expect(uses).toContainEqual({
      property: 'background',
      value: 'var(--cinder-a)',
      viaAlias: '--cinder-a',
      aliasValue: 'var(--cinder-border-muted)',
      isMix: false,
    });
  });

  test('CIN-602 round 4: an OWN declaration shadows an inherited alias -- the alias use is not reported', () => {
    // The exact shape from the review thread: `:root { --track:
    // var(--cinder-border-muted) }` (inherited) and the element itself
    // overriding `--track: var(--cinder-accent-solid)` (own). Own beats
    // inherited unconditionally, regardless of declaration order in the
    // fixture -- the `:root` declaration naming the tier can never
    // participate in this element's `background: var(--track)`, so no use
    // through that alias should be reported. (The `:root` declaration is
    // still reported in its own right under the corpus-alias rule --
    // authoring a tier reference in a custom property is flagged
    // independent of whether THIS element's cascade ever reads it back --
    // so this asserts specifically that `background` is unreachable, not
    // that `uses` is empty.)
    const declarations: MatchedDeclaration[] = [
      declaration('background', 'var(--track)', 'own'),
      declaration('--track', 'var(--cinder-accent-solid)', 'own'),
      declaration('--track', 'var(--cinder-border-muted)', 'inherited'),
    ];
    const uses = tierUses(declarations);
    expect(uses.some((use) => use.property === 'background')).toBe(false);
  });

  test('CIN-602 round 4: declaration order does not matter -- own still shadows inherited when the inherited entry comes first', () => {
    const declarations: MatchedDeclaration[] = [
      declaration('--track', 'var(--cinder-border-muted)', 'inherited'),
      declaration('background', 'var(--track)', 'own'),
      declaration('--track', 'var(--cinder-accent-solid)', 'own'),
    ];
    const uses = tierUses(declarations);
    expect(uses.some((use) => use.property === 'background')).toBe(false);
  });
});

describe('resolveCascadeWinner', () => {
  test('an empty candidate list has no winner', () => {
    expect(resolveCascadeWinner([])).toBeUndefined();
  });

  test('a lower level always wins, regardless of specificity or importance', () => {
    const own = declaration('border-color', 'var(--cinder-accent-solid)', 'own');
    const inherited = declaration('border-color', 'var(--cinder-border-muted)', 'inherited', {
      important: true,
      specificity: { a: 1, b: 0, c: 0 },
    });
    expect(resolveCascadeWinner([inherited, own])).toEqual(own);
    expect(resolveCascadeWinner([own, inherited])).toEqual(own);
  });

  test('within the same level, `!important` outranks a normal declaration', () => {
    const normal = declaration('border-color', 'var(--cinder-border-muted)', 'own', {
      specificity: { a: 1, b: 0, c: 0 },
    });
    const important = declaration('border-color', 'var(--cinder-accent-solid)', 'own', {
      important: true,
      specificity: { a: 0, b: 0, c: 0 },
    });
    expect(resolveCascadeWinner([normal, important])).toEqual(important);
  });

  test('within the same level and importance, the higher specificity wins', () => {
    const lessSpecific = declaration('border-color', 'var(--cinder-border-muted)', 'own', {
      specificity: { a: 0, b: 1, c: 0 },
    });
    const moreSpecific = declaration('border-color', 'var(--cinder-accent-solid)', 'own', {
      specificity: { a: 0, b: 2, c: 0 },
    });
    expect(resolveCascadeWinner([lessSpecific, moreSpecific])).toEqual(moreSpecific);
    expect(resolveCascadeWinner([moreSpecific, lessSpecific])).toEqual(moreSpecific);
  });

  test('a genuine tie (equal level, importance, and specificity) resolves to the later candidate', () => {
    const first = declaration('border-color', 'var(--cinder-border-muted)', 'own', {
      specificity: { a: 0, b: 1, c: 0 },
    });
    const second = declaration('border-color', 'var(--cinder-accent-solid)', 'own', {
      specificity: { a: 0, b: 1, c: 0 },
    });
    expect(resolveCascadeWinner([first, second])).toEqual(second);
  });

  test('missing specificity on either side is treated as a tie, not as losing', () => {
    const withSpecificity = declaration('border-color', 'var(--cinder-border-muted)', 'own', {
      specificity: { a: 0, b: 1, c: 0 },
    });
    const withoutSpecificity = declaration('border-color', 'var(--cinder-accent-solid)', 'own');
    // Order decides when specificity cannot: whichever comes later wins.
    expect(resolveCascadeWinner([withSpecificity, withoutSpecificity])).toEqual(withoutSpecificity);
    expect(resolveCascadeWinner([withoutSpecificity, withSpecificity])).toEqual(withSpecificity);
  });

  test('inline declarations outrank same-level author rules', () => {
    const inline = declaration('background', 'var(--cinder-border-muted)', 'own', { inline: true });
    const rule = declaration('background', 'var(--cinder-accent-solid)', 'own', {
      specificity: { a: 0, b: 1, c: 0 },
    });
    expect(resolveCascadeWinner([inline, rule])).toEqual(inline);
  });
});

describe('opacityCompoundedTierDeclarations', () => {
  test('the disabled Button shape: a border declaration under a cross-file opacity', () => {
    const declarations: MatchedDeclaration[] = [
      declaration('border-color', 'var(--cinder-border-muted)', 'own'), // button.css
      declaration('opacity', '.6', 'own'), // foundation.css -- not itself a tier reference
    ];
    const compounded = opacityCompoundedTierDeclarations(declarations, 0.6);
    expect(compounded).toEqual([declaration('border-color', 'var(--cinder-border-muted)', 'own')]);
  });

  test('opacity 1 (or greater) compounds nothing', () => {
    const declarations: MatchedDeclaration[] = [
      declaration('border-color', 'var(--cinder-border-muted)'),
    ];
    expect(opacityCompoundedTierDeclarations(declarations, 1)).toEqual([]);
  });

  test("an inherited tier declaration is not reported -- only the element's own", () => {
    const declarations: MatchedDeclaration[] = [
      declaration('border-color', 'var(--cinder-border-muted)', 'inherited'),
    ];
    expect(opacityCompoundedTierDeclarations(declarations, 0.6)).toEqual([]);
  });

  test('CIN-602 round 4: a higher-priority own declaration overrides a base tier declaration for the same property -- the losing one is not reported', () => {
    // The exact shape from the review thread: a base rule sets
    // `border-color: var(--cinder-border-muted)`, and a LATER, more specific
    // rule overrides it with `border-color: var(--cinder-accent-solid)`.
    // The base declaration never paints, so it must not be reported as
    // opacity-compounded even though it references a tier and matched the
    // element's own rules.
    const declarations: MatchedDeclaration[] = [
      declaration('border-color', 'var(--cinder-border-muted)', 'own', {
        specificity: { a: 0, b: 1, c: 0 }, // .cinder-button:disabled
      }),
      declaration('border-color', 'var(--cinder-accent-solid)', 'own', {
        specificity: { a: 0, b: 2, c: 0 }, // a more specific variant rule
      }),
      declaration('opacity', '.6', 'own'),
    ];
    expect(opacityCompoundedTierDeclarations(declarations, 0.6)).toEqual([]);
  });

  test('CIN-602 round 4: order does not matter -- the higher-specificity override still wins when it is matched FIRST', () => {
    const declarations: MatchedDeclaration[] = [
      declaration('border-color', 'var(--cinder-accent-solid)', 'own', {
        specificity: { a: 0, b: 2, c: 0 },
      }),
      declaration('border-color', 'var(--cinder-border-muted)', 'own', {
        specificity: { a: 0, b: 1, c: 0 },
      }),
    ];
    expect(opacityCompoundedTierDeclarations(declarations, 0.6)).toEqual([]);
  });

  test('CIN-602 round 4: the winning declaration IS reported when it is the one that names the tier', () => {
    // The mirror image of the two tests above: proves the fix did not
    // simply stop reporting same-property conflicts altogether -- when the
    // WINNING declaration is the tier reference, it is still found.
    const declarations: MatchedDeclaration[] = [
      declaration('border-color', 'var(--cinder-accent-solid)', 'own', {
        specificity: { a: 0, b: 1, c: 0 },
      }),
      declaration('border-color', 'var(--cinder-border-muted)', 'own', {
        specificity: { a: 0, b: 2, c: 0 },
      }),
    ];
    expect(opacityCompoundedTierDeclarations(declarations, 0.6)).toEqual([
      declaration('border-color', 'var(--cinder-border-muted)', 'own', {
        specificity: { a: 0, b: 2, c: 0 },
      }),
    ]);
  });
});

describe('flattenMatchedStyles', () => {
  // The exact shape the CDP spike captured for the Toggle track: the
  // hand-authored rule declares `background`'s own var() chain among the
  // element's OWN matched rules, and the generated `:root` alias declaration
  // only ever shows up in the `inherited` chain -- never in `matchedCSSRules`
  // for the element itself.
  const toggleTrackShape: MatchedStylesResult = {
    matchedCSSRules: [
      {
        rule: {
          style: {
            cssProperties: [
              {
                name: 'background',
                value: 'var(--cinder-toggle-track-off, var(--cinder-toggle-track-off-resting))',
              },
            ],
          },
        },
      },
    ],
    inherited: [
      {
        matchedCSSRules: [
          {
            rule: {
              style: {
                cssProperties: [
                  {
                    name: '--cinder-toggle-track-off-resting',
                    value:
                      'var(--buncss-light,var(--cinder-border-muted))var(--buncss-dark,oklch(45% .02 245))',
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  };

  test('flattens own rules, inline style, and the full inherited chain (:root included)', () => {
    const declarations = flattenMatchedStyles(toggleTrackShape);
    expect(declarations).toEqual([
      {
        property: 'background',
        value: 'var(--cinder-toggle-track-off, var(--cinder-toggle-track-off-resting))',
        origin: 'own',
        level: 0,
        important: false,
      },
      {
        property: '--cinder-toggle-track-off-resting',
        value:
          'var(--buncss-light,var(--cinder-border-muted))var(--buncss-dark,oklch(45% .02 245))',
        origin: 'inherited',
        level: 1,
        important: false,
      },
    ]);
  });

  test('the Toggle alias use is reachable end to end: flatten this real CDP shape, then find it with tierUses', () => {
    const uses = tierUses(flattenMatchedStyles(toggleTrackShape));
    expect(uses.some((use) => use.property === 'background' && use.viaAlias !== undefined)).toBe(
      true,
    );
  });

  test('without the inherited chain, the SAME alias use is unreachable -- proving `inherited` is load-bearing, not incidental', () => {
    // The only difference from `toggleTrackShape` above is the omitted
    // `inherited` field -- exactly what the Playwright side would produce if
    // it only ever read `matched.matchedCSSRules`, the mistake this test
    // exists to catch.
    const withoutInherited: MatchedStylesResult = {
      matchedCSSRules: [
        {
          rule: {
            style: {
              cssProperties: [
                {
                  name: 'background',
                  value: 'var(--cinder-toggle-track-off, var(--cinder-toggle-track-off-resting))',
                },
              ],
            },
          },
        },
      ],
    };
    const uses = tierUses(flattenMatchedStyles(withoutInherited));
    expect(uses.some((use) => use.property === 'background' && use.viaAlias !== undefined)).toBe(
      false,
    );
  });

  test('preserves inline provenance for cascade resolution', () => {
    const declarations = flattenMatchedStyles({
      inlineStyle: {
        cssProperties: [{ name: 'background', value: 'var(--cinder-border-muted)' }],
      },
      matchedCSSRules: [
        {
          rule: {
            style: {
              cssProperties: [{ name: 'background', value: 'var(--cinder-accent-solid)' }],
            },
            selectorList: { selectors: [{ specificity: { a: 0, b: 1, c: 0 } }] },
          },
          matchingSelectors: [0],
        },
      ],
    });
    expect(resolveCascadeWinner(declarations)).toEqual(declarations[0]);
  });

  test('reports a currentColor paint fed by an inherited tier color', () => {
    expect(
      opacityCompoundedTierDeclarations(
        [
          declaration('background', 'currentColor'),
          declaration('color', 'var(--cinder-border-strong)', 'inherited'),
        ],
        0.5,
      ),
    ).toEqual([declaration('background', 'currentColor')]);
  });
});

describe('effectiveOpacity', () => {
  test('multiplies every ancestor opacity', () => {
    expect(effectiveOpacity([1, 1, 0.6])).toBeCloseTo(0.6);
    expect(effectiveOpacity([0.4, 0.5])).toBeCloseTo(0.2);
  });

  test('an empty list is fully opaque', () => {
    expect(effectiveOpacity([])).toBe(1);
  });
});
