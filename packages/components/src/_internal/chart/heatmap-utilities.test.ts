import { describe, expect, test } from 'bun:test';

import {
  finiteNumbers,
  heatmapCellFill,
  heatmapDomain,
  heatmapDomainOfRows,
  normalizeHeatmapValue,
  toFiniteOrNull,
} from './heatmap-utilities.ts';

describe('finiteNumbers', () => {
  test('drops NaN, Infinity, null, undefined', () => {
    expect(finiteNumbers([1, NaN, 2, Infinity, 3, -Infinity, null, undefined])).toEqual([1, 2, 3]);
  });

  test('returns empty for all-invalid input', () => {
    expect(finiteNumbers([NaN, Infinity, null])).toEqual([]);
  });
});

describe('toFiniteOrNull', () => {
  test('passes finite numbers, nulls everything else', () => {
    expect(toFiniteOrNull(5)).toBe(5);
    expect(toFiniteOrNull(0)).toBe(0);
    expect(toFiniteOrNull(NaN)).toBeNull();
    expect(toFiniteOrNull(Infinity)).toBeNull();
    expect(toFiniteOrNull('5')).toBeNull();
    expect(toFiniteOrNull(null)).toBeNull();
  });
});

describe('heatmapDomain', () => {
  test('ignores non-finite values', () => {
    expect(heatmapDomain([1, NaN, 5, Infinity, 3])).toEqual({ min: 1, max: 5, isEmpty: false });
  });

  test('reports empty when no finite values', () => {
    expect(heatmapDomain([NaN, null]).isEmpty).toBe(true);
  });
});

describe('heatmapDomainOfRows', () => {
  test('matches the flattened domain without materializing a flat array', () => {
    const rows = [
      [1, NaN, 5],
      [3, Infinity],
      [-2, 4],
    ];
    expect(heatmapDomainOfRows(rows)).toEqual({ min: -2, max: 5, isEmpty: false });
  });

  test('reports empty when every row is empty or all-non-finite', () => {
    expect(heatmapDomainOfRows([[], [NaN, Infinity], []]).isEmpty).toBe(true);
  });

  test('handles ragged rows (differing lengths)', () => {
    expect(
      heatmapDomainOfRows([
        [0.2, 0.4],
        [0.5, 0.6, 0.7, 0.8],
      ]),
    ).toEqual({
      min: 0.2,
      max: 0.8,
      isEmpty: false,
    });
  });
});

describe('normalizeHeatmapValue — sequential', () => {
  const domain = heatmapDomain([0, 100]);

  test('maps min→0, max→1, midpoint→0.5', () => {
    expect(normalizeHeatmapValue(0, domain)).toBe(0);
    expect(normalizeHeatmapValue(100, domain)).toBe(1);
    expect(normalizeHeatmapValue(50, domain)).toBe(0.5);
  });

  test('degenerate domain (min === max) maps everything to 0.5', () => {
    const flat = heatmapDomain([7, 7, 7]);
    expect(normalizeHeatmapValue(7, flat)).toBe(0.5);
  });

  test('clamps out-of-domain values into [0,1]', () => {
    expect(normalizeHeatmapValue(-50, domain)).toBe(0);
    expect(normalizeHeatmapValue(200, domain)).toBe(1);
  });

  test('non-finite value normalizes to neutral 0.5', () => {
    expect(normalizeHeatmapValue(NaN, domain)).toBe(0.5);
  });
});

describe('normalizeHeatmapValue — diverging (zero-centered)', () => {
  test('zero maps to 0.5 even for a lopsided domain', () => {
    // Regression: [-10, 30] must still map 0 → 0.5 (neutral), not blue.
    const domain = heatmapDomain([-10, 30]);
    expect(normalizeHeatmapValue(0, domain, 'diverging')).toBe(0.5);
    // +30 is the larger absolute bound → 1.0; -30-equivalent would be 0.
    expect(normalizeHeatmapValue(30, domain, 'diverging')).toBe(1);
    expect(normalizeHeatmapValue(-30, domain, 'diverging')).toBe(0);
  });

  test('all-zero domain maps to neutral', () => {
    const domain = heatmapDomain([0, 0]);
    expect(normalizeHeatmapValue(0, domain, 'diverging')).toBe(0.5);
  });
});

describe('heatmapCellFill', () => {
  test('uses the cool side below the diverging midpoint', () => {
    const fill = heatmapCellFill(-5, heatmapDomain([-10, 10]), 'diverging');

    expect(fill).toContain('var(--cinder-chart-series-5)');
    expect(fill).toContain('50%');
  });
});
