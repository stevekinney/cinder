import { describe, expect, test } from 'bun:test';

import {
  buildBaselineEntries,
  COLOR_PROBES,
  countByKey,
  extractInlineReason,
  extractStyleSurface,
  findRegressions,
  flagKey,
  isTestPath,
  parseBaseline,
  stripCssComments,
  toPosixPath,
  type RawColorClass,
} from './check-component-css-raw-colors.ts';

function probe(colorClass: RawColorClass): RegExp {
  const entry = COLOR_PROBES.find((candidate) => candidate.colorClass === colorClass);
  if (!entry) throw new Error(`no probe for ${colorClass}`);
  // Fresh, non-global copy so repeated `.test()` calls in assertions don't carry lastIndex.
  return new RegExp(entry.pattern.source);
}

describe('COLOR_PROBES — raw color class detection', () => {
  test('hex matches 3, 4, 6, and 8 digit forms', () => {
    for (const value of ['#abc', '#abcd', '#aabbcc', '#aabbccdd']) {
      expect(probe('hex').test(`color: ${value};`)).toBe(true);
    }
  });

  test('hex does NOT match a non-color #fragment of the wrong length', () => {
    expect(probe('hex').test('animation-name: #ab;')).toBe(false);
    expect(probe('hex').test('content: "#abcde";')).toBe(false); // 5 digits — not a valid hex color
  });

  test('rgb matches both rgb() and rgba()', () => {
    expect(probe('rgb').test('background: rgb(0 0 0);')).toBe(true);
    expect(probe('rgb').test('background: rgba(0, 0, 0, 0.5);')).toBe(true);
  });

  test('hsl matches both hsl() and hsla()', () => {
    expect(probe('hsl').test('color: hsl(0, 100%, 50%);')).toBe(true);
    expect(probe('hsl').test('color: hsla(0 100% 50% / 0.5);')).toBe(true);
  });

  test('oklch and light-dark are matched as their own classes', () => {
    expect(probe('oklch').test('color: oklch(0.7 0.1 200);')).toBe(true);
    expect(probe('light-dark').test('color: light-dark(white, black);')).toBe(true);
  });

  test('does NOT match a var() token reference (the desired state)', () => {
    const line = 'color: var(--cinder-color-danger-fg);';
    for (const { pattern } of COLOR_PROBES) {
      expect(new RegExp(pattern.source).test(line)).toBe(false);
    }
  });
});

describe('extractStyleSurface — .svelte <style> extraction', () => {
  test('returns the whole body for a .css file unchanged', () => {
    const css = '.x { color: #fff; }';
    expect(extractStyleSurface(css, false)).toBe(css);
  });

  test('keeps only <style> content for a .svelte file, blanking markup', () => {
    const svelte = [
      '<div style="color: #000">markup #abc</div>',
      '<style>',
      '  .x { color: #fff; }',
      '</style>',
    ].join('\n');
    const surface = extractStyleSurface(svelte, true);
    // The markup hex (#000, #abc) must be blanked out...
    expect(surface).not.toContain('#000');
    expect(surface).not.toContain('#abc');
    // ...but the style-block hex survives.
    expect(surface).toContain('#fff');
  });

  test('preserves line count so line numbers map back to the .svelte source', () => {
    const svelte = ['<div>x</div>', '<style>', '.x { color: #fff; }', '</style>', '<p>y</p>'].join(
      '\n',
    );
    const surface = extractStyleSurface(svelte, true);
    expect(surface.split('\n').length).toBe(svelte.split('\n').length);
    // #fff is on line 3 in both.
    expect(surface.split('\n')[2]).toContain('#fff');
  });

  test('handles a <style lang="postcss"> opener with attributes', () => {
    const svelte = '<style lang="postcss">\n.x { color: #fff; }\n</style>';
    expect(extractStyleSurface(svelte, true)).toContain('#fff');
  });
});

describe('extractInlineReason — inline reason markers', () => {
  test('reads domain-rendering and structural-pattern markers', () => {
    expect(
      extractInlineReason(
        'background: hsl(0,100%,50%); /* cinder-allow-raw-color: domain-rendering — hue */',
      ),
    ).toBe('domain-rendering');
    expect(
      extractInlineReason('/* cinder-allow-raw-color: structural-pattern — checkerboard */'),
    ).toBe('structural-pattern');
  });

  test('returns null when there is no marker', () => {
    expect(extractInlineReason('background: #fff;')).toBeNull();
  });

  test('returns null for an unknown reason word (only the two classes are valid)', () => {
    expect(extractInlineReason('/* cinder-allow-raw-color: because-i-said-so */')).toBeNull();
  });
});

describe('stripCssComments', () => {
  test('removes block comments but preserves newline count', () => {
    const source = 'a\n/* multi\nline */\nb';
    const stripped = stripCssComments(source);
    expect(stripped).not.toContain('multi');
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
  });
});

describe('toPosixPath / isTestPath', () => {
  test('toPosixPath converts backslashes', () => {
    expect(toPosixPath('src\\components\\x\\x.css')).toBe('src/components/x/x.css');
  });

  test('isTestPath matches test/spec/examples but not real sources', () => {
    expect(isTestPath('x/x.test.ts')).toBe(true);
    expect(isTestPath('x/__tests__/y.ts')).toBe(true);
    expect(isTestPath('x/x.examples.json')).toBe(true);
    expect(isTestPath('x/x.css')).toBe(false);
  });
});

describe('count-based baseline + regression detection', () => {
  const flags = [
    { filePath: 'src/components/a/a.css', colorClass: 'hex' as RawColorClass },
    { filePath: 'src/components/a/a.css', colorClass: 'hex' as RawColorClass },
    { filePath: 'src/components/a/a.css', colorClass: 'rgb' as RawColorClass },
    { filePath: 'src/components/b/b.css', colorClass: 'hex' as RawColorClass },
  ];

  test('countByKey aggregates by file + color class', () => {
    const counts = countByKey(flags);
    expect(counts.get(flagKey({ filePath: 'src/components/a/a.css', colorClass: 'hex' }))).toBe(2);
    expect(counts.get(flagKey({ filePath: 'src/components/a/a.css', colorClass: 'rgb' }))).toBe(1);
  });

  test('buildBaselineEntries dedupes to one entry per key with the count', () => {
    const entries = buildBaselineEntries(flags);
    expect(entries).toHaveLength(3); // a:hex, a:rgb, b:hex
    const aHex = entries.find(
      (e) => e.filePath === 'src/components/a/a.css' && e.colorClass === 'hex',
    );
    expect(aHex?.allowedCount).toBe(2);
  });

  test('findRegressions flags a count ABOVE baseline (not vacuous)', () => {
    const baseline = parseBaseline(buildBaselineEntries(flags));
    // Same flags + one extra hex in a/a.css → regression on that key only.
    const withExtra = [
      ...flags,
      { filePath: 'src/components/a/a.css', colorClass: 'hex' as RawColorClass },
    ];
    const regressions = findRegressions(withExtra, baseline);
    expect(regressions).toHaveLength(1);
    expect(regressions[0]).toMatchObject({
      filePath: 'src/components/a/a.css',
      colorClass: 'hex',
      allowed: 2,
      found: 3,
    });
  });

  test('findRegressions returns nothing when counts equal the baseline', () => {
    const baseline = parseBaseline(buildBaselineEntries(flags));
    expect(findRegressions(flags, baseline)).toEqual([]);
  });

  test('a brand-new file (absent from baseline) regresses on first occurrence', () => {
    const baseline = parseBaseline(buildBaselineEntries(flags));
    const withNewFile = [
      ...flags,
      { filePath: 'src/components/c/c.css', colorClass: 'hex' as RawColorClass },
    ];
    const regressions = findRegressions(withNewFile, baseline);
    expect(regressions).toHaveLength(1);
    expect(regressions[0]).toMatchObject({
      filePath: 'src/components/c/c.css',
      allowed: 0,
      found: 1,
    });
  });

  test('parseBaseline throws on a non-array', () => {
    expect(() => parseBaseline({})).toThrow();
  });

  test('parseBaseline throws on a malformed entry', () => {
    expect(() =>
      parseBaseline([{ filePath: 'x', colorClass: 'not-a-class', allowedCount: 1 }]),
    ).toThrow();
  });
});
