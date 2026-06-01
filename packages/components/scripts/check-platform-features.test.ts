import { describe, expect, test } from 'bun:test';

import {
  buildBaselineEntries,
  countByKey,
  FEATURE_PROBES,
  findRegressions,
  findViewportMediaQueries,
  flagKey,
  matchedProbesForLine,
  parseBaseline,
  scan,
  stripCssComments,
  VIEWPORT_WIDTH_MEDIA,
} from './check-platform-features.ts';

function probeIndex(feature: string): number {
  const index = FEATURE_PROBES.findIndex((probe) => probe.feature === feature);
  if (index === -1) throw new Error(`no probe for ${feature}`);
  return index;
}

describe('matchedProbesForLine — feature detection', () => {
  test('detects container queries in a .css file', () => {
    expect(
      matchedProbesForLine('components/x/x.css', '  @container cinder-x (max-width: 30rem) {'),
    ).toContain(probeIndex('container queries'));
  });

  test('detects CSS features authored inline in a .svelte <style> block', () => {
    expect(
      matchedProbesForLine('components/x/x.svelte', '    content-visibility: auto;'),
    ).toContain(probeIndex('content-visibility'));
  });

  test('<dialog> is probed in .svelte but NOT in .css', () => {
    expect(matchedProbesForLine('components/x/x.svelte', '<dialog>')).toContain(
      probeIndex('<dialog>'),
    );
    expect(matchedProbesForLine('components/x/x.css', '<dialog>')).not.toContain(
      probeIndex('<dialog>'),
    );
  });

  test('Popover API is probed in .svelte/.ts but NOT in .css', () => {
    expect(matchedProbesForLine('components/x/x.svelte', 'el.showPopover()')).toContain(
      probeIndex('Popover API'),
    );
    expect(matchedProbesForLine('components/x/overlay.ts', 'node.showPopover()')).toContain(
      probeIndex('Popover API'),
    );
    // The test name promises this negative — guards against globs widening to .css.
    expect(matchedProbesForLine('components/x/x.css', 'el.showPopover()')).not.toContain(
      probeIndex('Popover API'),
    );
  });

  test('inert is probed in .svelte/.ts but NOT in .css', () => {
    expect(matchedProbesForLine('components/x/x.svelte', '<div inert>')).toContain(
      probeIndex('inert'),
    );
    expect(matchedProbesForLine('components/x/x.css', 'inert')).not.toContain(probeIndex('inert'));
  });
});

describe('VIEWPORT_WIDTH_MEDIA — viewport vs container, legacy vs range syntax', () => {
  test('matches legacy min-width / max-width', () => {
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (min-width: 640px)')).toBe(true);
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (max-width: 48rem)')).toBe(true);
  });

  test('matches a compound @media screen and (min-width) prelude', () => {
    expect(VIEWPORT_WIDTH_MEDIA.test('@media screen and (min-width: 768px)')).toBe(true);
  });

  test('matches CSS Level 4 range syntax in both directions', () => {
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (width >= 640px)')).toBe(true);
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (width < 640px)')).toBe(true);
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (640px <= width)')).toBe(true);
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (640px <= width < 1024px)')).toBe(true);
  });

  test('does NOT match prefers-* or forced-colors media', () => {
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (prefers-reduced-motion: reduce)')).toBe(false);
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (forced-colors: active)')).toBe(false);
  });

  test('does NOT match a @container width query (the preferred primitive)', () => {
    // VIEWPORT_WIDTH_MEDIA is anchored to @media, so a @container prelude never matches.
    expect(VIEWPORT_WIDTH_MEDIA.test('@container cinder-x (max-width: 30rem)')).toBe(false);
  });
});

describe('stripCssComments', () => {
  test('removes single-line and multi-line block comments', () => {
    expect(stripCssComments('a /* x */ b').trim()).toBe('a   b'.trim());
    expect(stripCssComments('/* @media (min-width: 1px) */').trim()).toBe('');
  });
});

describe('findViewportMediaQueries — block-aware scanning', () => {
  test('finds a single-line viewport media query with its line number', () => {
    const hits = findViewportMediaQueries(
      '.a { color: red; }\n@media (min-width: 640px) {\n  .a { color: blue; }\n}',
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.lineNumber).toBe(2);
    expect(hits[0]!.query).toBe('@media (min-width: 640px)');
  });

  test('finds a viewport query whose prelude spans multiple lines', () => {
    const hits = findViewportMediaQueries('@media screen and\n  (min-width: 640px) {\n}');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.query).toBe('@media screen and (min-width: 640px)');
  });

  test('does NOT flag a commented-out media query', () => {
    expect(findViewportMediaQueries('/* @media (min-width: 640px) { } */')).toHaveLength(0);
  });

  test('does NOT flag a @container width query or a plain max-width sizing rule', () => {
    expect(findViewportMediaQueries('@container cinder-x (max-width: 30rem) {\n}')).toHaveLength(0);
    expect(findViewportMediaQueries('.a { max-width: 16rem; }')).toHaveLength(0);
  });

  test('flags CSS Level 4 range syntax', () => {
    expect(findViewportMediaQueries('@media (width < 640px) {\n}')).toHaveLength(1);
  });
});

describe('count-based baseline — the grandfathering identity', () => {
  const flags = [
    { filePath: 'a.svelte', query: '@media (max-width: 480px)' },
    { filePath: 'a.svelte', query: '@media (max-width: 480px)' }, // a genuine duplicate site
    { filePath: 'b.css', query: '@media (min-width: 640px)' },
  ];

  test('flagKey format is stable (write/read coupling point)', () => {
    expect(flagKey({ filePath: 'a.svelte', query: '@media (max-width: 480px)' })).toBe(
      'a.svelte::@media (max-width: 480px)',
    );
  });

  test('countByKey counts duplicate file+query sites', () => {
    const counts = countByKey(flags);
    expect(counts.get('a.svelte::@media (max-width: 480px)')).toBe(2);
    expect(counts.get('b.css::@media (min-width: 640px)')).toBe(1);
  });

  test('buildBaselineEntries emits one sorted entry per key with allowedCount', () => {
    const entries = buildBaselineEntries(flags);
    expect(entries).toEqual([
      { filePath: 'a.svelte', query: '@media (max-width: 480px)', allowedCount: 2 },
      { filePath: 'b.css', query: '@media (min-width: 640px)', allowedCount: 1 },
    ]);
  });

  test('findRegressions: no regression when counts match the baseline', () => {
    const baseline = new Map([
      ['a.svelte::@media (max-width: 480px)', 2],
      ['b.css::@media (min-width: 640px)', 1],
    ]);
    expect(findRegressions(flags, baseline)).toEqual([]);
  });

  test('findRegressions: flags a NEW occurrence beyond the grandfathered count', () => {
    // The exact failure the Set model missed: a 3rd identical @media block.
    const withExtra = [...flags, { filePath: 'a.svelte', query: '@media (max-width: 480px)' }];
    const baseline = new Map([
      ['a.svelte::@media (max-width: 480px)', 2],
      ['b.css::@media (min-width: 640px)', 1],
    ]);
    expect(findRegressions(withExtra, baseline)).toEqual([
      { filePath: 'a.svelte', query: '@media (max-width: 480px)', allowed: 2, found: 3 },
    ]);
  });

  test('findRegressions: a site absent from the baseline is allowed 0, so any occurrence fails', () => {
    expect(
      findRegressions([{ filePath: 'new.css', query: '@media (min-width: 1px)' }], new Map()),
    ).toEqual([{ filePath: 'new.css', query: '@media (min-width: 1px)', allowed: 0, found: 1 }]);
  });

  test('parseBaseline: returns a key→count map for a well-formed array', () => {
    const map = parseBaseline([
      { filePath: 'b.css', query: '@media (min-width: 640px)', allowedCount: 1 },
    ]);
    expect(map.get('b.css::@media (min-width: 640px)')).toBe(1);
  });

  test('parseBaseline: throws on a non-array (a corrupt baseline must fail loudly, not disable the gate)', () => {
    expect(() => parseBaseline({})).toThrow(/must be a JSON array/);
  });

  test('parseBaseline: throws on an entry missing allowedCount', () => {
    expect(() =>
      parseBaseline([{ filePath: 'b.css', query: '@media (min-width: 640px)' }]),
    ).toThrow(/invalid baseline entry/);
  });
});

describe('scan — live inventory against the real source tree', () => {
  test('reports usage for every classified probe and only real viewport flags', async () => {
    const { counts, viewportFlags } = await scan();

    // Every probe in the policy table is represented in the report.
    expect(counts.map((entry) => entry.feature).toSorted()).toEqual(
      FEATURE_PROBES.map((probe) => probe.feature).toSorted(),
    );

    // Tier-1 baselines the library genuinely relies on must show real usage,
    // so a refactor that accidentally strips them is visible.
    const byFeature = new Map(counts.map((entry) => [entry.feature, entry.count]));
    for (const feature of ['@layer', 'container queries', '<dialog>', 'inert']) {
      expect(byFeature.get(feature) ?? 0).toBeGreaterThan(0);
    }

    // The scanner is actually walking the tree (known viewport sites exist today),
    // and every flag is a real @media(width) prelude with a concrete location.
    expect(viewportFlags.length).toBeGreaterThan(0);
    for (const flag of viewportFlags) {
      expect(flag.filePath).toMatch(/\.(css|svelte)$/);
      expect(flag.lineNumber).toBeGreaterThan(0);
      expect(VIEWPORT_WIDTH_MEDIA.test(flag.query)).toBe(true);
    }
  });
});
