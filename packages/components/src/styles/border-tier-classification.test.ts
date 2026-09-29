import { describe, expect, test } from 'bun:test';

import { CLASSIFIED, allUseSites, classify } from './border-tier-non-border-uses.test.ts';

describe('CIN-245: structural border tier classification', () => {
  test('every site in every workspace is classified', () => {
    const unclassified = allUseSites()
      .filter(([file, declaration]) => classify(file, declaration) === undefined)
      .map(([file, declaration]) => `${file}  ${declaration}`);

    expect(
      unclassified,
      'A structural border tier is used outside a border declaration at a site that is not ' +
        "classified. Every such use carries the tier's alpha somewhere a border would not: " +
        'decide whether it is a hairline, an area, a mix, or an occlusion, add it here, and ' +
        'record an area in documentation/css-audit/translucent-border-seams.md with its measured ' +
        'contrast.',
    ).toEqual([]);
  });

  test('no file grew a new occurrence of an already-classified declaration', () => {
    const counts = new Map<string, number>();
    for (const [file, declaration] of allUseSites()) {
      const key = `${file}  ${declaration}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const drifted: string[] = [];
    for (const [file, entries] of Object.entries(CLASSIFIED)) {
      for (const entry of entries) {
        const key = `${file}  ${entry.declaration}`;
        const actual = counts.get(key) ?? 0;
        const expected = entry.occurrences ?? 1;
        if (actual !== expected) drifted.push(`${key}  expected ${expected}, found ${actual}`);
      }
    }

    expect(
      drifted,
      'A classified declaration appears a different number of times than recorded. The same ' +
        'declaration text in one file can belong to two rules with different geometry, so a new ' +
        'occurrence has to be looked at rather than inheriting the existing category. Check what ' +
        'the new one paints, then update `occurrences` (or split the entry).',
    ).toEqual([]);
  });

  test('the classifications all still exist', () => {
    const sites = new Set(allUseSites().map(([file, declaration]) => `${file}  ${declaration}`));
    const stale: string[] = [];
    for (const [file, entries] of Object.entries(CLASSIFIED)) {
      for (const entry of entries) {
        if (!sites.has(`${file}  ${entry.declaration}`))
          stale.push(`${file}  ${entry.declaration}`);
      }
    }
    expect(stale, 'A classified site no longer exists; remove it.').toEqual([]);
  });
});
