import { describe, expect, test } from 'bun:test';

import {
  normalizeStickyIndexes,
  resolveActiveStickyIndex,
  resolveStickyRenderSet,
} from './sticky-items.ts';

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

describe('resolveStickyRenderSet', () => {
  test('returns an empty array when there are no sticky indexes at all', () => {
    const result = resolveStickyRenderSet({
      stickyIndexes: [],
      windowStartIndex: 0,
      windowEndIndex: 20,
      firstVisibleIndex: 0,
    });

    expect(result).toEqual([]);
  });

  test('returns just the in-window sticky indexes when the active one is already among them', () => {
    // firstVisibleIndex 6 makes sticky index 5 active, and 5 already sits inside
    // [4, 12) alongside 10 — nothing needs to be added back in.
    const result = resolveStickyRenderSet({
      stickyIndexes: [5, 10],
      windowStartIndex: 4,
      windowEndIndex: 12,
      firstVisibleIndex: 6,
    });

    expect(result).toEqual([5, 10]);
  });

  test('splices the active sticky index back in once its row has scrolled above the window', () => {
    // Sticky index 0's own row scrolled out the top (window now starts at 8), but
    // the reader (firstVisibleIndex 9) is still past it, so it must stay active and
    // therefore stay mounted even though it is no longer in [8, 15).
    const result = resolveStickyRenderSet({
      stickyIndexes: [0, 10],
      windowStartIndex: 8,
      windowEndIndex: 15,
      firstVisibleIndex: 9,
    });

    expect(result).toEqual([0, 10]);
  });

  test('reports nothing extra when the reader has not reached any sticky row yet', () => {
    const result = resolveStickyRenderSet({
      stickyIndexes: [5, 10],
      windowStartIndex: 0,
      windowEndIndex: 3,
      firstVisibleIndex: 1,
    });

    expect(result).toEqual([]);
  });

  test('treats windowEndIndex as EXCLUSIVE: a sticky index equal to windowEndIndex is not "in window"', () => {
    // Sticky index 10 sits exactly at the exclusive end, so it is NOT counted as
    // already rendered by the window slice — but it also is not the active one
    // here (firstVisibleIndex 4 makes sticky index 0 active), so it is correctly
    // absent from the result entirely.
    const result = resolveStickyRenderSet({
      stickyIndexes: [0, 10],
      windowStartIndex: 0,
      windowEndIndex: 10,
      firstVisibleIndex: 4,
    });

    expect(result).toEqual([0]);
  });

  test('sorts the spliced-in active index ahead of the in-window entries', () => {
    const result = resolveStickyRenderSet({
      stickyIndexes: [0, 20, 21, 22],
      windowStartIndex: 20,
      windowEndIndex: 23,
      firstVisibleIndex: 5,
    });

    // firstVisibleIndex 5 makes sticky index 0 active, which has scrolled above
    // the [20, 23) window entirely, so it is prepended ahead of every in-window entry.
    expect(result).toEqual([0, 20, 21, 22]);
  });

  test('itemCount-0-derived empty stickyIndexes produces an empty render set regardless of window', () => {
    const stickyIndexes = normalizeStickyIndexes([0, 1, 2], 0);

    const result = resolveStickyRenderSet({
      stickyIndexes,
      windowStartIndex: 0,
      windowEndIndex: 5,
      firstVisibleIndex: 0,
    });

    expect(result).toEqual([]);
  });
});
