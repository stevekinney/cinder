import { describe, expect, test } from 'bun:test';

import type { VirtualListKey } from '../../../utilities/fixed-virtual-window.ts';
import {
  buildVirtualOffsets,
  computeScrollToIndexOffset,
  findOffsetIndex,
  getDynamicVirtualWindow,
  resolveMeasurementCorrectionDelta,
  type MeasurementCorrection,
  type VirtualItemLocator,
  type VirtualListScrollAlign,
  type VirtualOffsets,
} from './measurement-window.ts';

function keyAt(index: number): VirtualListKey {
  return `key-${index}`;
}

describe('buildVirtualOffsets', () => {
  test('builds an all-estimate table when measuredSizes is empty', () => {
    const result = buildVirtualOffsets({
      itemCount: 4,
      estimateSize: 20,
      getKey: keyAt,
      measuredSizes: new Map(),
    });

    expect(result.offsets).toEqual([0, 20, 40, 60, 80]);
    expect(result.totalSize).toBe(80);
  });

  test('mixes measured and estimated sizes correctly', () => {
    const measuredSizes = new Map<VirtualListKey, number>([
      [keyAt(1), 30],
      [keyAt(3), 10],
    ]);
    const result = buildVirtualOffsets({
      itemCount: 5,
      estimateSize: 20,
      getKey: keyAt,
      measuredSizes,
    });

    // index0: estimate 20, index1: measured 30, index2: estimate 20,
    // index3: measured 10, index4: estimate 20.
    expect(result.offsets).toEqual([0, 20, 50, 70, 80, 100]);
    expect(result.totalSize).toBe(100);
  });

  test('treats a zero item count as an empty table', () => {
    const result = buildVirtualOffsets({
      itemCount: 0,
      estimateSize: 20,
      getKey: keyAt,
      measuredSizes: new Map(),
    });

    expect(result.offsets).toEqual([0]);
    expect(result.totalSize).toBe(0);
  });

  test('floors a negative item count to zero', () => {
    const result = buildVirtualOffsets({
      itemCount: -3,
      estimateSize: 20,
      getKey: keyAt,
      measuredSizes: new Map(),
    });

    expect(result.offsets).toEqual([0]);
    expect(result.totalSize).toBe(0);
  });

  test('floors a non-integer item count', () => {
    const result = buildVirtualOffsets({
      itemCount: 3.9,
      estimateSize: 10,
      getKey: keyAt,
      measuredSizes: new Map(),
    });

    expect(result.offsets).toEqual([0, 10, 20, 30]);
    expect(result.totalSize).toBe(30);
  });

  test('floors a non-positive estimate size up to 1', () => {
    const result = buildVirtualOffsets({
      itemCount: 2,
      estimateSize: 0,
      getKey: keyAt,
      measuredSizes: new Map(),
    });

    expect(result.offsets).toEqual([0, 1, 2]);
    expect(result.totalSize).toBe(2);
  });
});

describe('findOffsetIndex', () => {
  test('returns 0 for a genuinely empty offsets array', () => {
    expect(findOffsetIndex([], 100)).toBe(0);
  });

  test('returns 0 for a zero-item table (single 0 entry)', () => {
    expect(findOffsetIndex([0], 100)).toBe(0);
  });

  const offsets = [0, 10, 20, 30];

  test('returns 0 when the target is before every offset', () => {
    expect(findOffsetIndex(offsets, -5)).toBe(0);
  });

  test('returns the exact index when the target matches an offset', () => {
    expect(findOffsetIndex(offsets, 20)).toBe(2);
  });

  test('returns the enclosing index when the target falls between offsets', () => {
    expect(findOffsetIndex(offsets, 25)).toBe(2);
  });

  test('returns the last valid item index when the target is beyond the max offset', () => {
    // offsets has itemCount + 1 entries (a trailing totalSize sentinel), so the
    // largest returnable item index is itemCount - 1 = 2, never the sentinel's
    // own index (3).
    expect(findOffsetIndex(offsets, 1000)).toBe(2);
  });

  test('returns 0 when the target equals the first offset', () => {
    expect(findOffsetIndex(offsets, 0)).toBe(0);
  });
});

describe('getDynamicVirtualWindow', () => {
  function uniformOffsets(itemCount: number, itemSize: number): VirtualOffsets {
    return buildVirtualOffsets({
      itemCount,
      estimateSize: itemSize,
      getKey: keyAt,
      measuredSizes: new Map(),
    });
  }

  test('returns an empty window for a zero-item table', () => {
    const result = getDynamicVirtualWindow({
      offsets: { offsets: [0], totalSize: 0 },
      getKey: keyAt,
      scrollOffset: 0,
      viewportSize: 100,
      overscan: 2,
    });

    expect(result).toEqual({
      items: [],
      totalSize: 0,
      leadingSize: 0,
      trailingSize: 0,
      startIndex: 0,
      endIndex: 0,
    });
  });

  test('returns every row at the estimate when measuredSizes is empty', () => {
    const offsets = uniformOffsets(10, 20);
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      scrollOffset: 0,
      viewportSize: 50,
      overscan: 1,
    });

    // scrollOffset 0, viewportSize 50 (2.5 rows of 20), overscan 1 applied
    // symmetrically: visible = [0, 2], overscan widens to [0, 4) (start clamps at 0).
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(4);
    expect(result.items).toEqual([
      { index: 0, key: 'key-0', start: 0, size: 20 },
      { index: 1, key: 'key-1', start: 20, size: 20 },
      { index: 2, key: 'key-2', start: 40, size: 20 },
      { index: 3, key: 'key-3', start: 60, size: 20 },
    ]);
    expect(result.leadingSize).toBe(0);
    expect(result.trailingSize).toBe(120);
    expect(result.totalSize).toBe(200);
  });

  test('windows correctly at a mid-list scroll offset', () => {
    const offsets = uniformOffsets(10, 20);
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      scrollOffset: 90,
      viewportSize: 50,
      overscan: 1,
    });

    expect(result.startIndex).toBe(3);
    expect(result.endIndex).toBe(8);
    expect(result.items.map((item) => item.index)).toEqual([3, 4, 5, 6, 7]);
    expect(result.leadingSize).toBe(60);
    expect(result.trailingSize).toBe(40);
  });

  test('clamps scrollOffset to maxScrollOffset at the end of the list', () => {
    const offsets = uniformOffsets(10, 20);
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      // Deliberately beyond maxScrollOffset (200 - 50 = 150) to prove clamping.
      scrollOffset: 10_000,
      viewportSize: 50,
      overscan: 1,
    });

    expect(result.startIndex).toBe(6);
    expect(result.endIndex).toBe(10);
    expect(result.items.map((item) => item.index)).toEqual([6, 7, 8, 9]);
    expect(result.leadingSize).toBe(120);
    expect(result.trailingSize).toBe(0);
  });

  test('clamps a negative scrollOffset to zero', () => {
    const offsets = uniformOffsets(10, 20);
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      scrollOffset: -50,
      viewportSize: 50,
      overscan: 0,
    });

    expect(result.startIndex).toBe(0);
    expect(result.leadingSize).toBe(0);
  });

  test('handles a single-item list', () => {
    const offsets = uniformOffsets(1, 20);
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      scrollOffset: 0,
      viewportSize: 50,
      overscan: 0,
    });

    expect(result.items).toEqual([{ index: 0, key: 'key-0', start: 0, size: 20 }]);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(1);
    expect(result.leadingSize).toBe(0);
    expect(result.trailingSize).toBe(0);
  });

  test('falls back to average size * 10 for a zero viewportSize', () => {
    const offsets = uniformOffsets(10, 20);
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      scrollOffset: 0,
      viewportSize: 0,
      overscan: 0,
    });

    // fallback viewport = (200 / 10) * 10 = 200 = totalSize, so maxScrollOffset is 0
    // and the whole list fits in one window.
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
  });

  test('falls back to average size * 10 for a non-finite viewportSize', () => {
    const offsets = uniformOffsets(10, 20);
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      scrollOffset: 0,
      viewportSize: Number.NaN,
      overscan: 0,
    });

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
  });

  test('falls back to average size * 10 for a negative viewportSize', () => {
    const offsets = uniformOffsets(10, 20);
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      scrollOffset: 0,
      viewportSize: -100,
      overscan: 0,
    });

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
  });

  test('mixes measured and estimated sizes when windowing', () => {
    const offsets = buildVirtualOffsets({
      itemCount: 5,
      estimateSize: 20,
      getKey: keyAt,
      measuredSizes: new Map([
        [keyAt(1), 100],
        [keyAt(3), 5],
      ]),
    });

    const result = getDynamicVirtualWindow({
      offsets,
      getKey: keyAt,
      scrollOffset: 0,
      viewportSize: 30,
      overscan: 0,
    });

    // offsets: [0, 20, 120, 140, 145, 165]; a viewport of 30px only reaches
    // partway into the oversized measured row at index 1.
    expect(result.items.map((item) => item.index)).toEqual([0, 1]);
    expect(result.items[1]).toEqual({ index: 1, key: 'key-1', start: 20, size: 100 });
  });
});

describe('computeScrollToIndexOffset', () => {
  // A locator built over a mixed measured/estimated offsets table, mirroring
  // how virtual-list.svelte wires the dynamic-mode locator in production.
  const offsets = buildVirtualOffsets({
    itemCount: 5,
    estimateSize: 20,
    getKey: keyAt,
    measuredSizes: new Map([
      [keyAt(1), 30],
      [keyAt(3), 10],
    ]),
  });
  // offsets.offsets = [0, 20, 50, 70, 80, 100]; sizes = [20, 30, 20, 10, 20]
  const locator: VirtualItemLocator = {
    getStart: (index) => offsets.offsets[index]!,
    getSize: (index) => offsets.offsets[index + 1]! - offsets.offsets[index]!,
  };

  function offsetFor(options: {
    index: number;
    align: VirtualListScrollAlign;
    viewportSize: number;
    currentScrollOffset?: number;
  }): number {
    return computeScrollToIndexOffset({
      index: options.index,
      itemCount: 5,
      locator,
      totalSize: offsets.totalSize,
      viewportSize: options.viewportSize,
      currentScrollOffset: options.currentScrollOffset ?? 0,
      align: options.align,
    });
  }

  test('align "start" scrolls the item flush to the leading edge', () => {
    expect(offsetFor({ index: 2, align: 'start', viewportSize: 40 })).toBe(50);
  });

  test('align "end" scrolls the item flush to the trailing edge', () => {
    expect(offsetFor({ index: 2, align: 'end', viewportSize: 40 })).toBe(30);
  });

  test('align "center" centers the item in the viewport', () => {
    expect(offsetFor({ index: 1, align: 'center', viewportSize: 40 })).toBe(15);
  });

  test('align "auto" scrolls up when the item starts before the viewport', () => {
    const target = offsetFor({
      index: 0,
      align: 'auto',
      viewportSize: 40,
      currentScrollOffset: 60,
    });
    expect(target).toBe(0);
  });

  test('align "auto" scrolls down when the item ends after the viewport', () => {
    const target = offsetFor({ index: 3, align: 'auto', viewportSize: 40, currentScrollOffset: 0 });
    expect(target).toBe(40);
  });

  test('align "auto" is a no-op when the item is already fully visible', () => {
    const target = offsetFor({
      index: 1,
      align: 'auto',
      viewportSize: 40,
      currentScrollOffset: 20,
    });
    expect(target).toBe(20);
  });

  test('falls back to the "auto" branch for an unrecognized align value', () => {
    const target = computeScrollToIndexOffset({
      index: 1,
      itemCount: 5,
      locator,
      totalSize: offsets.totalSize,
      viewportSize: 40,
      currentScrollOffset: 20,
      // A defensive default-arm test: TypeScript forbids this, but a plain-JS
      // caller could still pass an unrecognized string at runtime.
      align: 'bogus' as VirtualListScrollAlign,
    });
    expect(target).toBe(20);
  });

  test('clamps the target to zero when it would go negative', () => {
    const overshootLocator: VirtualItemLocator = { getStart: () => -1000, getSize: () => 10 };
    const target = computeScrollToIndexOffset({
      index: 0,
      itemCount: 1,
      locator: overshootLocator,
      totalSize: 200,
      viewportSize: 50,
      currentScrollOffset: 0,
      align: 'center',
    });
    expect(target).toBe(0);
  });

  test('clamps the target to maxScrollOffset when it would overshoot', () => {
    const overshootLocator: VirtualItemLocator = { getStart: () => 1000, getSize: () => 10 };
    const target = computeScrollToIndexOffset({
      index: 0,
      itemCount: 1,
      locator: overshootLocator,
      totalSize: 200,
      viewportSize: 50,
      currentScrollOffset: 0,
      align: 'start',
    });
    expect(target).toBe(150); // totalSize - viewportSize
  });

  test('clamps an out-of-range positive index down to the last item', () => {
    // A small enough viewportSize keeps maxScrollOffset (100 - 20 = 80) above
    // the last item's start (80), so this isolates the index clamp from the
    // separate maxScrollOffset clamp (covered by its own test below).
    const target = offsetFor({ index: 999, align: 'start', viewportSize: 20 });
    expect(target).toBe(80); // start of index 4, the last item
  });

  test('clamps an out-of-range negative index up to the first item', () => {
    const target = offsetFor({ index: -5, align: 'start', viewportSize: 40 });
    expect(target).toBe(0);
  });

  test('resolves to zero for an empty item collection', () => {
    const emptyLocator: VirtualItemLocator = { getStart: () => 0, getSize: () => 0 };
    const target = computeScrollToIndexOffset({
      index: 0,
      itemCount: 0,
      locator: emptyLocator,
      totalSize: 0,
      viewportSize: 10,
      currentScrollOffset: 0,
      align: 'start',
    });
    expect(target).toBe(0);
  });
});

describe('resolveMeasurementCorrectionDelta', () => {
  test('returns 0 for an empty corrections list', () => {
    expect(resolveMeasurementCorrectionDelta([], 5)).toBe(0);
  });

  test('sums only corrections strictly before the anchor', () => {
    const corrections: MeasurementCorrection[] = [
      { index: 0, delta: 5 },
      { index: 2, delta: 3 },
      { index: 5, delta: -2 },
      { index: 6, delta: 100 },
    ];

    // index 5 equals the anchor and must be excluded; index 6 is after it.
    expect(resolveMeasurementCorrectionDelta(corrections, 5)).toBe(8);
  });

  test('returns 0 when every correction is at or after the anchor', () => {
    const corrections: MeasurementCorrection[] = [
      { index: 5, delta: 10 },
      { index: 8, delta: 20 },
    ];

    expect(resolveMeasurementCorrectionDelta(corrections, 5)).toBe(0);
  });

  test('returns 0 when the anchor is index 0', () => {
    const corrections: MeasurementCorrection[] = [{ index: 0, delta: 5 }];
    expect(resolveMeasurementCorrectionDelta(corrections, 0)).toBe(0);
  });
});

describe('round-four engine regressions', () => {
  test('auto alignment holds position for a row taller than the viewport', () => {
    // Such a row fails BOTH visibility checks at once. Preferring either edge makes
    // the settle loop alternate start -> end -> start, so the final position would
    // depend on the attempt cap and jitter visibly under smooth scrolling.
    const locator = {
      getStart: () => 100,
      getSize: () => 500,
    };
    const shared = {
      index: 0,
      itemCount: 1,
      locator,
      totalSize: 600,
      viewportSize: 200,
      align: 'auto' as const,
    };

    // Viewport sits inside the oversized row.
    const target = computeScrollToIndexOffset({ ...shared, currentScrollOffset: 300 });
    expect(target).toBe(300);

    // And it is genuinely stable: feeding the result back changes nothing.
    expect(computeScrollToIndexOffset({ ...shared, currentScrollOffset: target })).toBe(target);
  });

  test('auto alignment still scrolls to a row that is merely out of view', () => {
    // The oversized-row rule must not swallow the ordinary cases.
    const locator = { getStart: () => 400, getSize: () => 20 };
    const shared = {
      index: 0,
      itemCount: 1,
      locator,
      totalSize: 1000,
      viewportSize: 200,
      align: 'auto' as const,
    };

    // Below the viewport: align its end.
    expect(computeScrollToIndexOffset({ ...shared, currentScrollOffset: 0 })).toBe(220);
    // Above the viewport: align its start.
    expect(computeScrollToIndexOffset({ ...shared, currentScrollOffset: 600 })).toBe(400);
  });

  test('keeps a zero-height row mounted at the window edge', () => {
    // Zero-height rows share an offset with their neighbour and findOffsetIndex
    // resolves the tie to the LAST index, so a collapsed row at the leading edge
    // would fall outside the window. With overscan 0 it then unmounts, loses its
    // observer, keeps its cached zero, and can never be remeasured to expand.
    const measured = new Map<number, number>([[2, 0]]);
    const offsets = buildVirtualOffsets({
      itemCount: 6,
      estimateSize: 10,
      getKey: (index) => index,
      measuredSizes: measured,
    });

    // Offsets: [0, 10, 20, 20, 30, 40, 50] — index 2 is the collapsed row.
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: (index) => index,
      scrollOffset: 20,
      viewportSize: 10,
      overscan: 0,
    });

    expect(result.items.some((item) => item.index === 2)).toBe(true);
    expect(result.items.find((item) => item.index === 2)?.size).toBe(0);
  });
});

describe('round-five engine regressions', () => {
  test('keeps a zero-height row mounted at the TRAILING window edge', () => {
    // The mirror of the leading-edge case. A collapsed row at the trailing
    // boundary is otherwise excluded, and with overscan 0 it unmounts, loses its
    // observer, and its cached zero keeps it out of every later window.
    const measured = new Map<number, number>([[3, 0]]);
    const offsets = buildVirtualOffsets({
      itemCount: 6,
      estimateSize: 10,
      getKey: (index) => index,
      measuredSizes: measured,
    });

    // Offsets: [0, 10, 20, 30, 30, 40, 50] — index 3 is the collapsed row.
    const result = getDynamicVirtualWindow({
      offsets,
      getKey: (index) => index,
      scrollOffset: 20,
      viewportSize: 10,
      overscan: 0,
    });

    expect(result.items.some((item) => item.index === 3)).toBe(true);
    expect(result.items.find((item) => item.index === 3)?.size).toBe(0);
  });
});

describe('round-eleven engine regressions', () => {
  test('computeScrollToIndexOffset never touches the locator for an empty list', () => {
    // Clamping turns index -1 into 0, so without an explicit guard the helper reads
    // a locator at an index that does not exist and depends on every caller's
    // locator tolerating that.
    let locatorCalls = 0;
    const locator = {
      getStart: () => {
        locatorCalls += 1;
        return 0;
      },
      getSize: () => {
        locatorCalls += 1;
        return 0;
      },
    };

    const target = computeScrollToIndexOffset({
      index: 0,
      itemCount: 0,
      locator,
      totalSize: 0,
      viewportSize: 200,
      currentScrollOffset: 0,
      align: 'start',
    });

    expect(target).toBe(0);
    expect(locatorCalls).toBe(0);
  });

  test('auto alignment is idempotent for an oversized row approached from outside', () => {
    // The row is taller than the viewport and starts entirely below it. Aligning its
    // start puts the viewport exactly at its boundary, where only the OPPOSITE
    // overflow check is true — so an edge-preference rule flips to the end, then
    // back, and the final position depends on the attempt cap.
    const locator = { getStart: () => 500, getSize: () => 400 };
    const shared = {
      index: 0,
      itemCount: 1,
      locator,
      totalSize: 2000,
      viewportSize: 200,
      align: 'auto' as const,
    };

    const first = computeScrollToIndexOffset({ ...shared, currentScrollOffset: 0 });
    expect(first).toBe(500);

    // Feeding the result back must not move again, and must stay put thereafter.
    const second = computeScrollToIndexOffset({ ...shared, currentScrollOffset: first });
    expect(second).toBe(first);
    const third = computeScrollToIndexOffset({ ...shared, currentScrollOffset: second });
    expect(third).toBe(second);
  });

  test('auto alignment is idempotent for an oversized row approached from below', () => {
    const locator = { getStart: () => 500, getSize: () => 400 };
    const shared = {
      index: 0,
      itemCount: 1,
      locator,
      totalSize: 2000,
      viewportSize: 200,
      align: 'auto' as const,
    };

    // Viewport well past the row: its start is above, so bring the start into view.
    const first = computeScrollToIndexOffset({ ...shared, currentScrollOffset: 1200 });
    expect(first).toBe(500);
    expect(computeScrollToIndexOffset({ ...shared, currentScrollOffset: first })).toBe(first);
  });
});
