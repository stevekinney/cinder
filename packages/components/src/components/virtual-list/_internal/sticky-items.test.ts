import { describe, expect, test } from 'bun:test';

import { normalizeStickyIndexes, resolveActiveStickyIndex } from './sticky-items.ts';

describe('normalizeStickyIndexes', () => {
  test('returns an empty array when stickyItems is undefined', () => {
    expect(normalizeStickyIndexes(undefined, 10)).toEqual([]);
  });

  test('returns an empty array when stickyItems is already empty', () => {
    expect(normalizeStickyIndexes([], 10)).toEqual([]);
  });

  test('sorts ascending and de-duplicates unordered, repeated input', () => {
    expect(normalizeStickyIndexes([5, 2, 5, 2, 8, 0], 10)).toEqual([0, 2, 5, 8]);
  });

  test('drops every rejected-value shape: fractional, negative, out-of-range, NaN, and Infinity', () => {
    // itemCount 5 means the valid range is [0, 4]; 5 and 100 both fall outside it.
    const stickyItems = [
      2.5,
      -1,
      5,
      100,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      3,
    ];

    expect(normalizeStickyIndexes(stickyItems, 5)).toEqual([3]);
  });

  test('treats an itemCount of 0 as having no valid indexes at all', () => {
    expect(normalizeStickyIndexes([0, 1, 2], 0)).toEqual([]);
  });

  test('accepts index 0 and the last valid index (itemCount - 1) as in-range', () => {
    expect(normalizeStickyIndexes([0, 4], 5)).toEqual([0, 4]);
  });

  test('rejects an index at or above a fractional itemCount', () => {
    // itemCount 4.9 means valid indexes go up to 4.9 - 1 = 3.9, so an integer
    // candidate of 4 is out of range but 3 is not.
    expect(normalizeStickyIndexes([3, 4], 4.9)).toEqual([3]);
  });

  test('drops everything when itemCount is NaN, rather than throwing', () => {
    expect(normalizeStickyIndexes([0, 1], Number.NaN)).toEqual([]);
  });
});

describe('resolveActiveStickyIndex', () => {
  test('returns null for an empty stickyIndexes array', () => {
    expect(resolveActiveStickyIndex([], 5)).toBeNull();
  });

  test('returns null when the reader is above the first sticky row', () => {
    expect(resolveActiveStickyIndex([5, 10], 2)).toBeNull();
  });

  test('returns the sticky index exactly at firstVisibleIndex', () => {
    expect(resolveActiveStickyIndex([5, 10], 5)).toBe(5);
  });

  test('returns the greatest sticky index at or before firstVisibleIndex', () => {
    expect(resolveActiveStickyIndex([0, 5, 10], 7)).toBe(5);
  });

  test('returns the last sticky index once the reader has scrolled past every one of them', () => {
    expect(resolveActiveStickyIndex([0, 5, 10], 999)).toBe(10);
  });

  test('resolves correctly over a long stickyIndexes array (binary search over many entries)', () => {
    const stickyIndexes = Array.from({ length: 2000 }, (_, groupIndex) => groupIndex * 5);

    expect(resolveActiveStickyIndex(stickyIndexes, 0)).toBe(0);
    expect(resolveActiveStickyIndex(stickyIndexes, 5017)).toBe(5015);
    expect(resolveActiveStickyIndex(stickyIndexes, 9995)).toBe(9995);
  });
});
