import { describe, expect, test } from 'bun:test';
import { documentsForResolutionOrder, loadCorpus, modifierValuesForCombo } from './generate.ts';
import { resolveDocuments } from './resolve.ts';
import { PROFILE_DEFINITIONS, validateUsageContracts, type UsageToken } from './usage-contracts.ts';

const length = (metadata: Record<string, unknown> = {}): UsageToken => ({
  path: 'space.small',
  cssProperty: '--cinder-space-small',
  type: 'dimension',
  value: { value: 4, unit: 'px' },
  metadata: {
    usageContracts: [{ property: 'padding', profile: 'nonnegative-length' }],
    ...metadata,
  },
});

describe('authoritative token usage contracts', () => {
  test('validates component values in the grammar position of their terminal CSS property', () => {
    expect(PROFILE_DEFINITIONS['color']?.validationTemplates?.['box-shadow']).toBe('0 0 {value}');
    expect(PROFILE_DEFINITIONS['nonnegative-length']?.validationTemplates?.['box-shadow']).toBe(
      '0 0 0 {value} black',
    );
    expect(PROFILE_DEFINITIONS['signed-length']?.validationTemplates?.['transform']).toBe(
      'translateX({value})',
    );
    expect(PROFILE_DEFINITIONS['font-family']?.validationTemplates?.['font']).toBe(
      '400 16px {value}',
    );
    expect(PROFILE_DEFINITIONS['easing']?.validationTemplates?.['transition']).toBe(
      'opacity 1s {value}',
    );
    for (const profile of Object.values(PROFILE_DEFINITIONS)) {
      for (const [property, template] of Object.entries(profile.validationTemplates ?? {})) {
        expect(Object.hasOwn(profile.cssGrammar, property)).toBe(true);
        expect(template.includes('{value}')).toBe(true);
      }
    }
  });

  test('every public token has valid authored metadata in all six concrete contexts', async () => {
    const { resolver, documentsByPath } = await loadCorpus();
    let basePaths: string[] | undefined;
    for (const theme of ['light', 'dark']) {
      for (const motion of ['default', 'reduced', 'forced-reduced-motion']) {
        const documents = documentsForResolutionOrder(
          resolver,
          documentsByPath,
          modifierValuesForCombo(resolver, { name: `${theme}-${motion}`, theme, motion }),
        );
        const resolved = resolveDocuments(documents);
        const tokens: UsageToken[] = [];
        for (const [path, token] of Object.entries(resolved)) {
          const metadata = token.$extensions?.['com.lostgradient.cinder'];
          if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue;
          if (!('public' in metadata) || metadata.public !== true) continue;
          if (!('cssProperty' in metadata) || typeof metadata.cssProperty !== 'string')
            throw new Error(`${path}: missing CSS property`);
          tokens.push({
            path,
            cssProperty: metadata.cssProperty,
            type: token.$type,
            value: token.$value,
            metadata,
          });
        }
        const contracts = validateUsageContracts(tokens);
        expect(contracts.size).toBeGreaterThan(0);
        const paths = [...contracts.keys()].sort();
        if (basePaths) expect(paths).toEqual(basePaths);
        basePaths ??= paths;
        expect(
          [...contracts.values()].filter((entry) => entry.portabilityReason !== null),
        ).toHaveLength(4);
      }
    }
  });

  test('retains multiple observed constraints and declared consumer-only contracts', () => {
    const token = length({
      usageContracts: [
        { property: 'padding', profile: 'nonnegative-length' },
        { property: 'margin', profile: 'signed-length' },
      ],
    });
    const result = validateUsageContracts([token], new Map([[token.cssProperty, ['padding']]]));
    expect(result.get(token.path)?.usageContracts).toEqual([
      { property: 'padding', profile: 'nonnegative-length' },
      { property: 'margin', profile: 'signed-length' },
    ]);
    expect(validateUsageContracts([length()], new Map()).size).toBe(1);
  });

  test.each(
    [undefined, [], {}, [{ property: 'padding' }]].map((usageContracts) => ({ usageContracts })),
  )('rejects missing or malformed public usage metadata: %j', ({ usageContracts }) => {
    expect(() => validateUsageContracts([length({ usageContracts })])).toThrow('space.small');
  });

  test('rejects unknown profiles and custom-property grammar substitutes', () => {
    for (const contract of [
      { property: 'padding', profile: 'invented' },
      { property: '--cinder-space-small', profile: 'nonnegative-length' },
      { property: 'opacity', profile: 'nonnegative-length' },
    ]) {
      expect(() => validateUsageContracts([length({ usageContracts: [contract] })])).toThrow();
    }
  });

  test('rejects duplicated contracts and missing observed property mappings', () => {
    const token = length();
    expect(() =>
      validateUsageContracts([
        length({
          usageContracts: [
            token.metadata['usageContracts'],
            token.metadata['usageContracts'],
          ].flat(),
        }),
      ]),
    ).toThrow('duplicate');
    expect(() => validateUsageContracts([token], new Map([[token.cssProperty, ['gap']]]))).toThrow(
      'gap',
    );
  });

  test('rejects contradictory value kinds without guessing from token names', () => {
    expect(() =>
      validateUsageContracts([
        length({
          usageContracts: [
            { property: 'padding', profile: 'nonnegative-length' },
            { property: 'color', profile: 'color' },
          ],
        }),
      ]),
    ).toThrow('incompatible');
  });

  test('rejects a single profile that contradicts its resolved token type', () => {
    expect(() =>
      validateUsageContracts([
        length({ usageContracts: [{ property: 'color', profile: 'color' }] }),
      ]),
    ).toThrow('incompatible token type');
    expect(() => validateUsageContracts([{ ...length(), type: 'number', value: 4 }])).toThrow(
      'incompatible token type',
    );
    // CSS permits unitless zero in length positions; no inferred unit is added.
    expect(validateUsageContracts([{ ...length(), type: 'number', value: 0 }]).size).toBe(1);
  });

  test('rejects a recipe-backed color token claiming a length profile', () => {
    expect(() =>
      validateUsageContracts([
        {
          ...length(),
          type: 'color',
          value: { colorSpace: 'srgb', components: [0, 0, 0] },
          metadata: {
            usageContracts: [{ property: 'padding', profile: 'nonnegative-length' }],
            cssRecipe: 'oklch(50% 0.1 20)',
            recipeInputs: [],
          },
        },
      ]),
    ).toThrow('incompatible token type');
  });

  test.each(['rgb(1em 0 0)', 'red 1em', 'var(--cinder-space-small, 1em)', 'red'])(
    'does not mistake a nested or unrelated length for a numeric length projection: %s',
    (cssRecipe) => {
      expect(() =>
        validateUsageContracts([
          {
            ...length(),
            type: 'number',
            value: 0,
            metadata: {
              usageContracts: [{ property: 'padding', profile: 'nonnegative-length' }],
              cssRecipe,
              recipeInputs: cssRecipe.startsWith('var(') ? ['space.small'] : [],
            },
          },
        ]),
      ).toThrow('incompatible token type');
    },
  );

  test.each(['-0.01em', '65ch', '100%', '+1e1px'])(
    'recognizes one complete numeric CSS length projection: %s',
    (cssRecipe) => {
      expect(
        validateUsageContracts([
          {
            ...length(),
            type: 'number',
            value: 1,
            metadata: {
              usageContracts: [{ property: 'margin', profile: 'signed-length' }],
              cssRecipe,
              recipeInputs: [],
            },
          },
        ]).size,
      ).toBe(1);
    },
  );

  test('cross-checks exact recipe inputs against actual public CSS references', () => {
    const base = length();
    const alias: UsageToken = {
      ...length(),
      path: 'space.alias',
      cssProperty: '--cinder-space-alias',
      metadata: {
        ...base.metadata,
        cssRecipe: 'calc(var(--cinder-space-small) * 2)',
        recipeInputs: ['space.small'],
      },
    };
    expect(validateUsageContracts([base, alias]).get(alias.path)?.recipeInputs).toEqual([
      'space.small',
    ]);
    for (const recipeInputs of [undefined, [], ['space.alias'], ['space.small', 'space.small']]) {
      expect(() =>
        validateUsageContracts([
          base,
          {
            ...alias,
            metadata: { ...alias.metadata, recipeInputs },
          },
        ]),
      ).toThrow('recipe');
    }
    expect(() =>
      validateUsageContracts([
        {
          ...alias,
          metadata: { ...alias.metadata, cssRecipe: 'var(--missing)' },
        },
      ]),
    ).toThrow('recipe');
  });

  test('preserves CSS-only real values and requires a portability reason', () => {
    const token: UsageToken = {
      ...length(),
      path: 'content.height',
      metadata: {
        usageContracts: [{ property: 'height', profile: 'auto-size' }],
        nonRepresentableValue: true,
        cssRecipe: 'auto',
        portabilityReason: 'DTCG dimensions have no intrinsic size keyword.',
      },
    };
    expect(validateUsageContracts([token]).get(token.path)?.portabilityReason).toBe(
      'DTCG dimensions have no intrinsic size keyword.',
    );
    for (const change of [{ portabilityReason: '' }, { cssRecipe: undefined }]) {
      expect(() =>
        validateUsageContracts([{ ...token, metadata: { ...token.metadata, ...change } }]),
      ).toThrow('CSS-only');
    }
  });

  test('scale membership accepts only public literal dimensions', () => {
    expect(validateUsageContracts([length({ scale: 'spacing' })]).get('space.small')?.scale).toBe(
      'spacing',
    );
    for (const change of [
      { value: '{space.other}' },
      { type: 'number' as const, value: 1 },
      { cssProperty: '--_cinder-space-small' },
    ]) {
      expect(() =>
        validateUsageContracts([{ ...length({ scale: 'spacing' }), ...change }]),
      ).toThrow('scale');
    }
  });

  test('does not mutate source metadata or allow extra recipe inputs without a recipe', () => {
    const token = length();
    Object.freeze(token.metadata);
    Object.freeze(token);
    const before = JSON.stringify(token);
    validateUsageContracts([token]);
    expect(JSON.stringify(token)).toBe(before);
    expect(() => validateUsageContracts([length({ recipeInputs: ['space.small'] })])).toThrow(
      'recipe',
    );
  });
});
