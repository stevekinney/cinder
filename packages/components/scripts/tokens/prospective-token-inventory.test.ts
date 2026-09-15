import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { buildThemeTokenCatalogue } from './catalogue.ts';
import { loadCorpus } from './generate.ts';
import { buildInventoryForCorpus } from './prospective-token-inventory.ts';
import { observedUsageProperties } from './reviewed-css-usage.ts';
import type { DesignToken, DimensionValue, TokenGroup } from './types.ts';

describe('prospective token inventory', () => {
  test('uses authored values and new public identities before generated files or reviews change', async () => {
    const { resolver, documentsByPath } = await loadCorpus();
    const sources = [
      {
        path: 'tokens-base.css',
        content: ':root { --stale-artifact: 0; }',
        globalDefinitions: true,
      },
      {
        path: 'consumer.css',
        content: '.probe { padding: var(--cinder-space-4); gap: var(--cinder-inventory-probe); }',
      },
    ];
    const originalSources = structuredClone(sources);
    const before = await buildInventoryForCorpus(sources, resolver, documentsByPath);
    const review = {
      schemaVersion: 1,
      surfaces: [],
      producerEvidence: [],
      sourceFiles: before.inventory.sourceFiles,
    };
    const space = documentsByPath.get('sets/foundation.tokens.json')!['space'] as TokenGroup;
    const value = (space['4'] as DesignToken).$value as DimensionValue;
    value.value += 0.125;
    space['inventory-probe'] = {
      $type: 'dimension',
      $value: { value: 1.75, unit: 'rem' },
      $extensions: {
        'com.lostgradient.cinder': {
          cssProperty: '--cinder-inventory-probe',
          public: true,
          category: 'spacing',
          usageContracts: [{ property: 'gap', profile: 'nonnegative-length' }],
        },
      },
    };
    const after = await buildInventoryForCorpus(sources, resolver, documentsByPath);
    const cssSource = after.inventory.sourceFiles.find(
      (source) => source.path === 'tokens-base.css',
    )!;
    expect(cssSource.sha256).toBe(createHash('sha256').update(after.generatedCss).digest('hex'));
    expect(after.generatedCss).not.toBe(before.generatedCss);
    expect(after.inventory.tokenRegistry.sha256).not.toBe(before.inventory.tokenRegistry.sha256);
    expect(after.inventory.tokenRegistry.entries).toContainEqual({
      path: 'space.inventory-probe',
      cssProperty: '--cinder-inventory-probe',
    });
    expect(after.inventory.uses).toContainEqual(
      expect.objectContaining({ tokenProperty: '--cinder-inventory-probe', property: 'gap' }),
    );
    expect(sources).toEqual(originalSources);
    expect(() => observedUsageProperties(after.inventory, review, after.publicProperties)).toThrow(
      'CSS usage review source changed: tokens-base.css',
    );

    // Model a separately inspected approval; generation itself never refreshes it.
    const approvedReview = { ...review, sourceFiles: after.inventory.sourceFiles };
    const observed = observedUsageProperties(
      after.inventory,
      approvedReview,
      after.publicProperties,
    );
    const catalogue = buildThemeTokenCatalogue(resolver, documentsByPath, observed);
    expect(catalogue.entries.some((entry) => entry.path === 'space.inventory-probe')).toBe(true);
    expect(approvedReview.sourceFiles).not.toEqual(review.sourceFiles);
    const repeated = await buildInventoryForCorpus(sources, resolver, documentsByPath);
    expect(repeated.inventory).toEqual(after.inventory);
  });

  test('rejects an ambiguous or absent generated stylesheet', async () => {
    const { resolver, documentsByPath } = await loadCorpus();
    await expect(buildInventoryForCorpus([], resolver, documentsByPath)).rejects.toThrow(
      'exactly one generated token stylesheet',
    );
    await expect(
      buildInventoryForCorpus(
        [
          { path: 'a.css', content: '', globalDefinitions: true },
          { path: 'b.css', content: '', globalDefinitions: true },
        ],
        resolver,
        documentsByPath,
      ),
    ).rejects.toThrow('exactly one generated token stylesheet');
  });
});
