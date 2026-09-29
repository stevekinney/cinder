import { describe, expect, test } from 'bun:test';

import {
  assertUniqueSeriesIds,
  assertValidChartNumber,
  assertValidNonNegativeInteger,
  assertValidTickCount,
  chartPalette,
  chartPaletteColor,
  chartResourceId,
  createBandScale,
  createLinearScale,
  createPointScale,
  dataTableClass,
  formatNumericValue,
  formatXValue,
  legendVisible,
  normalizeXValue,
  resolveChartTheme,
  toggleSeriesId,
} from './chart-utilities.ts';

describe('chartPaletteColor', () => {
  test('returns the palette color at the given index', () => {
    expect(chartPaletteColor(0)).toBe(chartPalette[0]);
    expect(chartPaletteColor(3)).toBe(chartPalette[3]);
  });

  test('wraps around the palette for indices past the end', () => {
    expect(chartPaletteColor(chartPalette.length)).toBe(chartPalette[0]);
    expect(chartPaletteColor(chartPalette.length + 2)).toBe(chartPalette[2]);
  });

  test('falls back to the first palette color for negative indices', () => {
    expect(chartPaletteColor(-1)).toBe(chartPalette[0]);
  });

  test('wraps through a chart-local palette override', () => {
    const palette = ['rebeccapurple', 'tomato'];

    expect(chartPaletteColor(0, palette)).toBe('rebeccapurple');
    expect(chartPaletteColor(3, palette)).toBe('tomato');
  });
});

describe('chartResourceId', () => {
  test('keeps URI-escaped series IDs collision-free', () => {
    const slash = chartResourceId('chart', 'gradient', 'a/b');
    const escaped = chartResourceId('chart', 'gradient', 'a_2Fb');

    expect(slash).toBe('chart-gradient-a_x2Fb');
    expect(escaped).toBe('chart-gradient-a_u2Fb');
    expect(slash).not.toBe(escaped);
  });

  test('escapes functional-IRI characters in the chart prefix', () => {
    expect(chartResourceId('usage)', 'gradient', 'series')).toBe('usage_x29-gradient-series');
    expect(chartResourceId('usage_x29', 'gradient', 'series')).toBe('usage_ux29-gradient-series');
  });

  test('escapes tuple delimiters without collapsing distinct resource ids', () => {
    const delimiterInSeries = chartResourceId('a', 'gradient', 'b-gradient-c');
    const delimiterInPrefix = chartResourceId('a-gradient-b', 'gradient', 'c');

    expect(delimiterInSeries).toBe('a-gradient-b_dgradient_dc');
    expect(delimiterInPrefix).toBe('a_dgradient_db-gradient-c');
    expect(delimiterInSeries).not.toBe(delimiterInPrefix);
  });
});

describe('resolveChartTheme', () => {
  test('inherits currentColor and the CSS-variable palette by default', () => {
    expect(resolveChartTheme()).toEqual({
      foreground: 'currentColor',
      muted: 'currentColor',
      grid: 'currentColor',
      background: 'transparent',
      palette: [...chartPalette],
    });
  });

  test('merges a partial override without replacing omitted defaults', () => {
    expect(resolveChartTheme({ foreground: 'CanvasText', palette: ['hotpink'] })).toEqual({
      foreground: 'CanvasText',
      muted: 'currentColor',
      grid: 'currentColor',
      background: 'transparent',
      palette: ['hotpink'],
    });
  });
});

describe('normalizeXValue', () => {
  test('classifies string values', () => {
    const value = normalizeXValue('Jan');
    expect(value.kind).toBe('string');
    expect(value.key).toBe('string:Jan');
    expect(value.label).toBe('Jan');
    expect(value.comparable).toBe('Jan');
  });

  test('classifies number values', () => {
    const value = normalizeXValue(42);
    expect(value.kind).toBe('number');
    expect(value.key).toBe('number:42');
    expect(value.label).toBe('42');
    expect(value.comparable).toBe(42);
  });

  test('classifies Date values by epoch milliseconds', () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const value = normalizeXValue(date);
    expect(value.kind).toBe('date');
    expect(value.comparable).toBe(date.getTime());
    expect(value.key).toBe(`date:${date.getTime()}`);
  });
});

describe('formatNumericValue', () => {
  test('uses a series-level formatter when provided', () => {
    const result = formatNumericValue(100, undefined, (value) => `series:${value}`, { index: 0 });
    expect(result).toBe('series:100');
  });

  test('falls back to the axis formatter when no series formatter exists', () => {
    const result = formatNumericValue(
      50,
      { format: (value) => `axis:${String(value)}` },
      undefined,
      { index: 0 },
    );
    expect(result).toBe('axis:50');
  });

  test('defaults to Intl.NumberFormat with the inherited locale', () => {
    // Tests run with LANG=en_US.UTF-8 so the inherited locale yields the
    // en-US grouping/decimal we can assert against.
    expect(formatNumericValue(1234.5, undefined, undefined, { index: 0 })).toBe('1,234.5');
  });
});

describe('formatXValue', () => {
  test('uses the axis formatter when provided', () => {
    const value = normalizeXValue('Jan');
    expect(formatXValue(value, { format: () => 'January' }, { index: 0 })).toBe('January');
  });

  test('falls back to the normalized label otherwise', () => {
    const value = normalizeXValue(7);
    expect(formatXValue(value, undefined, { index: 0 })).toBe('7');
  });
});

describe('assertValidChartNumber', () => {
  test('accepts positive finite numbers', () => {
    expect(() => assertValidChartNumber('demo', 'rule', 1, 'value')).not.toThrow();
    expect(() => assertValidChartNumber('demo', 'rule', 1024.5, 'value')).not.toThrow();
  });

  test('throws on zero, negative, or non-finite values', () => {
    expect(() => assertValidChartNumber('demo', 'rule', 0, 'value')).toThrow('rule=rule');
    expect(() => assertValidChartNumber('demo', 'rule', -1, 'value')).toThrow();
    expect(() => assertValidChartNumber('demo', 'rule', Number.NaN, 'value')).toThrow();
    expect(() => assertValidChartNumber('demo', 'rule', Infinity, 'value')).toThrow();
  });
});

describe('assertValidNonNegativeInteger', () => {
  test('accepts zero and positive integers', () => {
    expect(() => assertValidNonNegativeInteger('demo', 'rule', 0, 'value')).not.toThrow();
    expect(() => assertValidNonNegativeInteger('demo', 'rule', 500, 'value')).not.toThrow();
  });

  test('throws on negative or non-integer values', () => {
    expect(() => assertValidNonNegativeInteger('demo', 'rule', -1, 'value')).toThrow();
    expect(() => assertValidNonNegativeInteger('demo', 'rule', 1.5, 'value')).toThrow();
  });
});

describe('assertValidTickCount', () => {
  test('is a no-op when the axis or tickCount is missing', () => {
    expect(() => assertValidTickCount('demo')).not.toThrow();
    expect(() => assertValidTickCount('demo', {})).not.toThrow();
  });

  test('throws on zero, negative, or non-integer tickCount', () => {
    expect(() => assertValidTickCount('demo', { tickCount: 0 })).toThrow('invalid-tick-count');
    expect(() => assertValidTickCount('demo', { tickCount: -1 })).toThrow();
    expect(() => assertValidTickCount('demo', { tickCount: 1.5 })).toThrow();
  });
});

describe('assertUniqueSeriesIds', () => {
  test('passes for distinct ids', () => {
    expect(() => assertUniqueSeriesIds('demo', [{ id: 'a' }, { id: 'b' }])).not.toThrow();
  });

  test('throws on duplicates', () => {
    expect(() => assertUniqueSeriesIds('demo', [{ id: 'a' }, { id: 'a' }])).toThrow(
      'duplicate-series-id',
    );
  });
});

describe('dataTableClass', () => {
  test('maps "screen-reader-only" to the sr-only class', () => {
    expect(dataTableClass('screen-reader-only')).toBe('cinder-sr-only');
  });

  test('returns undefined for visible and hidden', () => {
    expect(dataTableClass('visible')).toBeUndefined();
    expect(dataTableClass('hidden')).toBeUndefined();
  });
});

describe('legendVisible', () => {
  test('returns true when the position is renderable and any series exist', () => {
    expect(legendVisible('top', 1)).toBe(true);
    expect(legendVisible('bottom', 4)).toBe(true);
  });

  test('returns false for "none" or zero series', () => {
    expect(legendVisible('none', 3)).toBe(false);
    expect(legendVisible('top', 0)).toBe(false);
  });
});

describe('toggleSeriesId', () => {
  test('adds a missing id', () => {
    expect(toggleSeriesId([], 'a')).toEqual(['a']);
  });

  test('removes a present id', () => {
    expect(toggleSeriesId(['a', 'b'], 'a')).toEqual(['b']);
  });

  test('returns a new array (no mutation)', () => {
    const input = ['a'];
    const output = toggleSeriesId(input, 'b');
    expect(output).not.toBe(input);
    expect(input).toEqual(['a']);
  });
});

describe('scale factories', () => {
  test('createLinearScale maps a domain value into the range and reports ticks', () => {
    const scale = createLinearScale([0, 100], [0, 200]);
    expect(scale(50)).toBe(100);
    expect(scale.ticks(3)).toEqual([0, 50, 100]);
  });

  test('createPointScale positions each domain entry within the range', () => {
    const scale = createPointScale(['a', 'b', 'c'], [0, 100], 0);
    expect(scale('a')).toBeCloseTo(0);
    expect(scale('c')).toBeCloseTo(100);
  });

  test('createBandScale positions each band and reports a positive bandwidth', () => {
    const scale = createBandScale(['a', 'b'], [0, 100], 0);
    expect(scale('a')).toBeCloseTo(0);
    expect(scale('b')).toBeCloseTo(50);
    expect(scale.bandwidth()).toBeCloseTo(50);
  });
});
