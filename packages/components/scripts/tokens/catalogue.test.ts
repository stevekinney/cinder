import { describe, expect, test } from 'bun:test';

import { buildThemeTokenCatalogue, THEME_CONTEXTS } from './catalogue.ts';
import { loadCorpus, serializeEntryValue } from './generate.ts';
import { buildBaseIndex, buildTokenRegistryFromIndexes, themeAwarePaths } from './registry.ts';
import { isToken, isTokenGroup } from './resolve-merge.ts';

describe('theme token catalogue', () => {
  test('contains one complete record for every public registry entry', async () => {
    const { resolver, documentsByPath } = await loadCorpus();
    const catalogue = buildThemeTokenCatalogue(resolver, documentsByPath);
    const registry = buildTokenRegistryFromIndexes(
      buildBaseIndex(resolver, documentsByPath),
      themeAwarePaths(resolver, documentsByPath),
    );
    const publicCount = registry.entries.filter((entry) => entry.public).length;
    expect(catalogue.entries.length).toBe(publicCount);
    expect(new Set(catalogue.entries.map((entry) => entry.path)).size).toBe(publicCount);
    expect(catalogue.entries.every((entry) => entry.public)).toBe(true);
    expect(catalogue.entries.some((entry) => entry.cssProperty.startsWith('--_cinder-'))).toBe(
      false,
    );
    expect(
      catalogue.entries.every((entry) => entry.contexts.length === THEME_CONTEXTS.length),
    ).toBe(true);
  });

  test('retains CSS-only recipes and omits placeholder portable values', async () => {
    const { resolver, documentsByPath } = await loadCorpus();
    const catalogue = buildThemeTokenCatalogue(resolver, documentsByPath);
    for (const path of [
      'carousel.slide-size',
      'carousel.aspect-ratio',
      'code-block.height',
      'spinner.indicator',
    ]) {
      const entry = catalogue.entries.find((candidate) => candidate.path === path);
      expect(entry).toBeDefined();
      expect(entry!.css.status).toBe('supported');
      expect(entry!.completePortable.status).toBe('omitted');
      expect(entry!.completePortable.value).toBeNull();
      expect(entry!.completePortable.reason).toBeString();
    }
  });

  test('records exact source pointers and ordered contributions', async () => {
    const { resolver, documentsByPath } = await loadCorpus();
    const catalogue = buildThemeTokenCatalogue(resolver, documentsByPath);
    const space = catalogue.entries.find((entry) => entry.path === 'space.2');
    const light = space!.contexts.find(
      (context) => context.context.theme === 'light' && context.context.motion === 'default',
    );
    expect(light!.winningLocation?.documentId).toBe('sets/foundation.tokens.json');
    expect(light!.winningLocation?.sourcePointer).toBe('/space/2');
    expect(light!.winningLocation?.sourceIndex).toBe(0);
    expect(light!.contributingLocations.length).toBeGreaterThan(0);
  });
});

test('publishes complete private usage contracts and truthful source, CSS, and resolved values', async () => {
  const { resolver, documentsByPath } = await loadCorpus();
  const catalogue = buildThemeTokenCatalogue(resolver, documentsByPath);
  const base = buildBaseIndex(resolver, documentsByPath);
  expect(Object.keys(catalogue.profileDefinitions).length).toBeGreaterThan(0);
  for (const entry of catalogue.entries) {
    expect(entry.usageContracts.length).toBeGreaterThan(0);
    expect(entry.css.value).toBe(serializeEntryValue(base.get(entry.path)!, base));
    if (entry.completePortable.status === 'supported') {
      expect(entry.completePortable.value).toEqual(entry.contexts[0]!.resolvedValue);
      expect(entry.subsetPortable.value).toEqual(entry.contexts[0]!.resolvedValue);
    }
  }
});

test('rejects missing authored usage metadata instead of generating an unclassified token', async () => {
  const { resolver, documentsByPath } = await loadCorpus();
  for (const document of documentsByPath.values()) {
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if ('$extensions' in value && value.$extensions && typeof value.$extensions === 'object') {
        const metadata = Reflect.get(value.$extensions, 'com.lostgradient.cinder');
        if (metadata && typeof metadata === 'object')
          Reflect.deleteProperty(metadata, 'usageContracts');
      }
      for (const child of Object.values(value)) walk(child);
    };
    walk(document);
  }
  expect(() => buildThemeTokenCatalogue(resolver, documentsByPath)).toThrow('usageContracts');
});

test('retains each source map key when the same document object is applied from two keys', async () => {
  const { resolver, documentsByPath } = await loadCorpus();
  const source = documentsByPath.get('sets/foundation.tokens.json')!;
  documentsByPath.set('overrides/foundation-copy.tokens.json', source);
  resolver.sets['foundation']!.sources.push({ $ref: 'overrides/foundation-copy.tokens.json' });
  const entry = buildThemeTokenCatalogue(resolver, documentsByPath).entries.find(
    (entry) => entry.path === 'space.2',
  )!;
  expect(
    entry.contexts[0]!.contributingLocations.map(({ documentId, sourceIndex }) => [
      documentId,
      sourceIndex,
    ]),
  ).toEqual([
    ['sets/foundation.tokens.json', 0],
    ['overrides/foundation-copy.tokens.json', 4],
  ]);
});

test('records trusted recipe input edges at the actual context recipe declaration', async () => {
  const { resolver, documentsByPath } = await loadCorpus();
  const entry = buildThemeTokenCatalogue(resolver, documentsByPath).entries.find(
    (entry) => entry.path === 'border.control',
  )!;
  for (const context of entry.contexts) {
    expect(context.directDependencies.filter((dependency) => dependency.kind === 'recipe')).toEqual(
      [
        expect.objectContaining({
          targetPath: 'border.ink',
          source: expect.objectContaining({
            documentId: `themes/${context.context.theme}.tokens.json`,
            sourcePointer: '/border/control/$extensions/com.lostgradient.cinder/cssRecipe',
          }),
          target: expect.objectContaining({ tokenPath: 'border.ink' }),
        }),
      ],
    );
  }
});

test('declares exactly the nineteen authored literal spacing members and no aliases', async () => {
  const { resolver, documentsByPath } = await loadCorpus();
  const catalogue = buildThemeTokenCatalogue(resolver, documentsByPath);
  expect(
    catalogue.entries
      .filter((entry) => entry.scale === 'spacing')
      .map((entry) => entry.path)
      .sort(),
  ).toEqual(
    [
      '0',
      '0-5',
      'one',
      '1-5',
      '2',
      '2-5',
      '3',
      '3-5',
      '4',
      '5',
      '6',
      '7',
      '8',
      '10',
      '12',
      '16',
      '20',
      '24',
      '32',
    ]
      .map((name) => `space.${name}`)
      .sort(),
  );
  const foundation = documentsByPath.get('sets/foundation.tokens.json')!;
  const space = foundation['space'];
  if (!isTokenGroup(space) || !isToken(space['2'])) throw new Error('Malformed space fixture');
  space['2']['$value'] = '{space.one}';
  expect(() => buildThemeTokenCatalogue(resolver, documentsByPath)).toThrow(
    'spacing scale requires an authored literal dimension',
  );
});

test('new public tokens enter every context automatically while private entries remain excluded', async () => {
  const { resolver, documentsByPath } = await loadCorpus();
  const before = buildThemeTokenCatalogue(resolver, documentsByPath);
  const foundation = documentsByPath.get('sets/foundation.tokens.json')!;
  const token = {
    $type: 'dimension' as const,
    $value: { value: 3, unit: 'px' },
    $extensions: {
      'com.lostgradient.cinder': {
        public: true,
        cssProperty: '--cinder-catalogue-growth',
        usageContracts: [{ property: 'padding', profile: 'nonnegative-length' }],
      },
    },
  };
  foundation['catalogue-growth'] = token;
  foundation['catalogue-private'] = {
    ...structuredClone(token),
    $extensions: {
      'com.lostgradient.cinder': { public: false, cssProperty: '--_cinder-catalogue-private' },
    },
  };
  const catalogue = buildThemeTokenCatalogue(resolver, documentsByPath);
  expect(catalogue.entries).toHaveLength(before.entries.length + 1);
  const added = catalogue.entries.filter((entry) => entry.path === 'catalogue-growth');
  expect(added).toHaveLength(1);
  expect(added[0]!.contexts).toHaveLength(6);
  expect(added[0]!.observedProperties).toEqual([]);
  for (const context of added[0]!.contexts) expect(context.resolvedValue).toEqual(token.$value);
  expect(catalogue.entries.some((entry) => entry.path === 'catalogue-private')).toBe(false);
});

test('exposes recipe inputs in their effective theme and motion context only', async () => {
  const { resolver, documentsByPath } = await loadCorpus();
  const catalogue = buildThemeTokenCatalogue(resolver, documentsByPath);
  for (const entry of catalogue.entries) {
    expect(entry).not.toHaveProperty('recipeInputs');
    for (const context of entry.contexts) {
      expect(context.recipeInputs).toEqual(
        context.directDependencies
          .filter((dependency) => dependency.kind === 'recipe')
          .map((dependency) => dependency.targetPath),
      );
    }
  }
  const background = catalogue.entries.find((entry) => entry.path === 'code-block.background')!;
  expect(
    background.contexts
      .filter((record) => record.context.theme === 'light')
      .every((record) => record.recipeInputs.length > 0),
  ).toBe(true);
  expect(
    background.contexts
      .filter((record) => record.context.theme === 'dark')
      .every((record) => record.recipeInputs.length === 0),
  ).toBe(true);
});

test('retains inputs introduced only by a dark recipe override', async () => {
  const { resolver, documentsByPath } = await loadCorpus();
  documentsByPath.get('sets/foundation.tokens.json')!['context-probe'] = {
    $type: 'dimension',
    $value: { value: 1, unit: 'rem' },
    $extensions: {
      'com.lostgradient.cinder': {
        public: true,
        cssProperty: '--cinder-context-probe',
        usageContracts: [{ property: 'gap', profile: 'nonnegative-length' }],
      },
    },
  };
  documentsByPath.get('themes/dark.tokens.json')!['context-probe'] = {
    $value: { value: 1, unit: 'rem' },
    $extensions: {
      'com.lostgradient.cinder': {
        cssRecipe: 'var(--cinder-space-4)',
        recipeInputs: ['space.4'],
      },
    },
  };
  const entry = buildThemeTokenCatalogue(resolver, documentsByPath).entries.find(
    (entry) => entry.path === 'context-probe',
  )!;
  for (const context of entry.contexts) {
    expect(context.recipeInputs).toEqual(context.context.theme === 'dark' ? ['space.4'] : []);
    expect(
      context.directDependencies
        .filter((dependency) => dependency.kind === 'recipe')
        .map((dependency) => dependency.targetPath),
    ).toEqual([...context.recipeInputs]);
  }
});
