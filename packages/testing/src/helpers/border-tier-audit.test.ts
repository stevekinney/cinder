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
  tierNameIn,
  tierUses,
} from './border-tier-audit.ts';

function declaration(
  property: string,
  value: string,
  origin: MatchedDeclaration['origin'] = 'own',
): MatchedDeclaration {
  return { property, value, origin };
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
});

describe('opacityCompoundedTierDeclarations', () => {
  test('the disabled Button shape: a border declaration under a cross-file opacity', () => {
    const declarations: MatchedDeclaration[] = [
      declaration('border-color', 'var(--cinder-border-muted)', 'own'), // button.css
      declaration('opacity', '.6', 'own'), // foundation.css -- not itself a tier reference
    ];
    const compounded = opacityCompoundedTierDeclarations(declarations, 0.6);
    expect(compounded).toEqual([
      { property: 'border-color', value: 'var(--cinder-border-muted)', origin: 'own' },
    ]);
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
      },
      {
        property: '--cinder-toggle-track-off-resting',
        value:
          'var(--buncss-light,var(--cinder-border-muted))var(--buncss-dark,oklch(45% .02 245))',
        origin: 'inherited',
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
