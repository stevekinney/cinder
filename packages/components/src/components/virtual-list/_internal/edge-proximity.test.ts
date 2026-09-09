import { describe, expect, test } from 'bun:test';

import {
  createEdgeLatch,
  resolveEdgeFireDecision,
  resolveEdgeProximity,
  type EdgeLatch,
  type EdgeProximity,
} from './edge-proximity.ts';

describe('resolveEdgeProximity', () => {
  test('reports near-start only at the very first item with overscan 0', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 0,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 0,
      lastVisibleIndex: 5,
      itemCount: 100,
      overscan: 0,
    });

    expect(result).toEqual({ isNearStart: true, isNearEnd: false });
  });

  test('reports near-end only at the very last item with overscan 0', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 900,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 94,
      lastVisibleIndex: 99,
      itemCount: 100,
      overscan: 0,
    });

    expect(result).toEqual({ isNearStart: false, isNearEnd: true });
  });

  test('extends near-start within the overscan threshold', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 20,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 3,
      lastVisibleIndex: 10,
      itemCount: 100,
      overscan: 3,
    });

    expect(result.isNearStart).toBe(true);
  });

  test('is not near-start just past the overscan threshold', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 20,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 4,
      lastVisibleIndex: 10,
      itemCount: 100,
      overscan: 3,
    });

    expect(result.isNearStart).toBe(false);
  });

  test('extends near-end within the overscan threshold', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 800,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 90,
      lastVisibleIndex: 96,
      itemCount: 100,
      overscan: 3,
    });

    // itemCount - 1 - overscan = 100 - 1 - 3 = 96
    expect(result.isNearEnd).toBe(true);
  });

  test('is not near-end just short of the overscan threshold', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 800,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 90,
      lastVisibleIndex: 95,
      itemCount: 100,
      overscan: 3,
    });

    expect(result.isNearEnd).toBe(false);
  });

  test('is not near either edge in the middle of a long list', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 500,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 50,
      lastVisibleIndex: 55,
      itemCount: 100,
      overscan: 2,
    });

    expect(result).toEqual({ isNearStart: false, isNearEnd: false });
  });

  test('reports neither edge for a zero-item list', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 0,
      viewportSize: 100,
      totalSize: 0,
      firstVisibleIndex: 0,
      lastVisibleIndex: 0,
      itemCount: 0,
      overscan: 2,
    });

    expect(result).toEqual({ isNearStart: false, isNearEnd: false });
  });

  test('the zero-item guard wins even when totalSize <= viewportSize would otherwise trigger the fits-viewport case', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 0,
      viewportSize: 500,
      totalSize: 0,
      firstVisibleIndex: 0,
      lastVisibleIndex: 0,
      itemCount: 0,
      overscan: 0,
    });

    expect(result).toEqual({ isNearStart: false, isNearEnd: false });
  });

  test('reports both edges near when the entire list fits the viewport', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 0,
      viewportSize: 500,
      totalSize: 200,
      firstVisibleIndex: 0,
      lastVisibleIndex: 9,
      itemCount: 10,
      overscan: 0,
    });

    expect(result).toEqual({ isNearStart: true, isNearEnd: true });
  });

  test('reports both edges near when totalSize exactly equals viewportSize', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 0,
      viewportSize: 200,
      totalSize: 200,
      firstVisibleIndex: 0,
      lastVisibleIndex: 9,
      itemCount: 10,
      overscan: 0,
    });

    expect(result).toEqual({ isNearStart: true, isNearEnd: true });
  });

  test('clamps a negative overscan to 0', () => {
    const withNegative = resolveEdgeProximity({
      scrollOffset: 20,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 1,
      lastVisibleIndex: 10,
      itemCount: 100,
      overscan: -5,
    });
    const withZero = resolveEdgeProximity({
      scrollOffset: 20,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 1,
      lastVisibleIndex: 10,
      itemCount: 100,
      overscan: 0,
    });

    expect(withNegative).toEqual(withZero);
    expect(withNegative.isNearStart).toBe(false);
  });

  test('clamps a NaN overscan to 0', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 0,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 0,
      lastVisibleIndex: 10,
      itemCount: 100,
      overscan: Number.NaN,
    });

    expect(result.isNearStart).toBe(true);
  });

  test('clamps a positive-Infinity overscan to 0 rather than treating every index as near', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 500,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 50,
      lastVisibleIndex: 55,
      itemCount: 100,
      overscan: Number.POSITIVE_INFINITY,
    });

    // A raw firstVisibleIndex <= Infinity comparison would report near-start
    // for an item plainly in the middle of the list. Clamping to 0 keeps
    // this a genuinely middle-of-list result instead.
    expect(result).toEqual({ isNearStart: false, isNearEnd: false });
  });

  test('clamps a negative-Infinity overscan to 0', () => {
    const result = resolveEdgeProximity({
      scrollOffset: 0,
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 0,
      lastVisibleIndex: 10,
      itemCount: 100,
      overscan: Number.NEGATIVE_INFINITY,
    });

    expect(result.isNearStart).toBe(true);
  });

  test('does not read scrollOffset when deciding proximity', () => {
    const base = {
      viewportSize: 100,
      totalSize: 1000,
      firstVisibleIndex: 50,
      lastVisibleIndex: 55,
      itemCount: 100,
      overscan: 2,
    };

    const atZero = resolveEdgeProximity({ ...base, scrollOffset: 0 });
    const atSomeOffset = resolveEdgeProximity({ ...base, scrollOffset: 12_345 });

    expect(atZero).toEqual(atSomeOffset);
  });
});

describe('createEdgeLatch', () => {
  test('returns an unlatched initial state', () => {
    expect(createEdgeLatch()).toEqual({
      startLatched: false,
      endLatched: false,
      itemCountAtLatch: 0,
    });
  });
});

describe('resolveEdgeFireDecision', () => {
  const nearStartOnly: EdgeProximity = { isNearStart: true, isNearEnd: false };
  const nearEndOnly: EdgeProximity = { isNearStart: false, isNearEnd: true };
  const nearNeither: EdgeProximity = { isNearStart: false, isNearEnd: false };
  const nearBoth: EdgeProximity = { isNearStart: true, isNearEnd: true };

  test('fires start on the rising edge from the initial unlatched state', () => {
    const result = resolveEdgeFireDecision({
      proximity: nearStartOnly,
      previous: createEdgeLatch(),
      itemCount: 50,
    });

    expect(result.fireStart).toBe(true);
    expect(result.fireEnd).toBe(false);
    expect(result.next).toEqual({ startLatched: true, endLatched: false, itemCountAtLatch: 50 });
  });

  test('fires end on the rising edge from the initial unlatched state', () => {
    const result = resolveEdgeFireDecision({
      proximity: nearEndOnly,
      previous: createEdgeLatch(),
      itemCount: 50,
    });

    expect(result.fireStart).toBe(false);
    expect(result.fireEnd).toBe(true);
    expect(result.next).toEqual({ startLatched: false, endLatched: true, itemCountAtLatch: 50 });
  });

  test('fires both edges in the same call when both are near and unlatched', () => {
    const result = resolveEdgeFireDecision({
      proximity: nearBoth,
      previous: createEdgeLatch(),
      itemCount: 5,
    });

    expect(result.fireStart).toBe(true);
    expect(result.fireEnd).toBe(true);
    expect(result.next).toEqual({ startLatched: true, endLatched: true, itemCountAtLatch: 5 });
  });

  test('does not fire when proximity is false, regardless of latch state', () => {
    const alreadyLatched: EdgeLatch = {
      startLatched: true,
      endLatched: true,
      itemCountAtLatch: 50,
    };

    const result = resolveEdgeFireDecision({
      proximity: nearNeither,
      previous: alreadyLatched,
      itemCount: 50,
    });

    expect(result.fireStart).toBe(false);
    expect(result.fireEnd).toBe(false);
    // Proximity going false also releases the latch for next time.
    expect(result.next).toEqual({ startLatched: false, endLatched: false, itemCountAtLatch: 50 });
  });

  test('approaching the end fires exactly once across several scroll updates that all sit near the end', () => {
    let latch = createEdgeLatch();
    const fireCounts = { start: 0, end: 0 };

    // Five consecutive scroll updates, all still reporting near-end with an
    // unchanged itemCount — as would happen while the reader hovers near the
    // bottom of the list without new data arriving yet.
    for (let update = 0; update < 5; update += 1) {
      const decision = resolveEdgeFireDecision({
        proximity: nearEndOnly,
        previous: latch,
        itemCount: 50,
      });
      if (decision.fireStart) fireCounts.start += 1;
      if (decision.fireEnd) fireCounts.end += 1;
      latch = decision.next;
    }

    expect(fireCounts.end).toBe(1);
    expect(fireCounts.start).toBe(0);
  });

  test('scrolling away and back fires a second time', () => {
    // First approach: fires and latches.
    const first = resolveEdgeFireDecision({
      proximity: nearEndOnly,
      previous: createEdgeLatch(),
      itemCount: 50,
    });
    expect(first.fireEnd).toBe(true);

    // Scrolls away from the edge: latch releases, no fire.
    const away = resolveEdgeFireDecision({
      proximity: nearNeither,
      previous: first.next,
      itemCount: 50,
    });
    expect(away.fireEnd).toBe(false);
    expect(away.next.endLatched).toBe(false);

    // Scrolls back to the edge: rising edge again, fires a second time.
    const back = resolveEdgeFireDecision({
      proximity: nearEndOnly,
      previous: away.next,
      itemCount: 50,
    });
    expect(back.fireEnd).toBe(true);
  });

  test('items arriving while still near the end releases the latch and allows another fire', () => {
    // First approach at itemCount 50: fires and latches against 50.
    const first = resolveEdgeFireDecision({
      proximity: nearEndOnly,
      previous: createEdgeLatch(),
      itemCount: 50,
    });
    expect(first.fireEnd).toBe(true);
    expect(first.next).toEqual({ startLatched: false, endLatched: true, itemCountAtLatch: 50 });

    // A second update at the SAME itemCount, still near-end: must not refire.
    const stillWaiting = resolveEdgeFireDecision({
      proximity: nearEndOnly,
      previous: first.next,
      itemCount: 50,
    });
    expect(stillWaiting.fireEnd).toBe(false);

    // The requested page lands: itemCount grows, and the window is still
    // reporting near-end (there is now more list to approach). This is the
    // case that makes infinite scroll keep working instead of firing once.
    const afterLoad = resolveEdgeFireDecision({
      proximity: nearEndOnly,
      previous: stillWaiting.next,
      itemCount: 75,
    });
    expect(afterLoad.fireEnd).toBe(true);
    expect(afterLoad.next).toEqual({ startLatched: false, endLatched: true, itemCountAtLatch: 75 });
  });

  test('an itemCount change does not fire an edge that is not currently near', () => {
    const latched: EdgeLatch = { startLatched: false, endLatched: true, itemCountAtLatch: 50 };

    // itemCount changed, but the window is no longer near the end at all.
    const result = resolveEdgeFireDecision({
      proximity: nearNeither,
      previous: latched,
      itemCount: 75,
    });

    expect(result.fireStart).toBe(false);
    expect(result.fireEnd).toBe(false);
    expect(result.next).toEqual({ startLatched: false, endLatched: false, itemCountAtLatch: 75 });
  });

  test('a list of 0 items fires neither callback', () => {
    const proximity = resolveEdgeProximity({
      scrollOffset: 0,
      viewportSize: 200,
      totalSize: 0,
      firstVisibleIndex: 0,
      lastVisibleIndex: 0,
      itemCount: 0,
      overscan: 3,
    });

    const result = resolveEdgeFireDecision({
      proximity,
      previous: createEdgeLatch(),
      itemCount: 0,
    });

    expect(result.fireStart).toBe(false);
    expect(result.fireEnd).toBe(false);
  });

  test('does not mutate the previous latch object', () => {
    const previous: EdgeLatch = { startLatched: false, endLatched: false, itemCountAtLatch: 10 };
    const snapshot = { ...previous };

    resolveEdgeFireDecision({ proximity: nearBoth, previous, itemCount: 10 });

    expect(previous).toEqual(snapshot);
  });

  test('remains latched across repeated calls with an unchanged itemCount (no refire)', () => {
    const first = resolveEdgeFireDecision({
      proximity: nearStartOnly,
      previous: createEdgeLatch(),
      itemCount: 20,
    });
    expect(first.fireStart).toBe(true);

    const second = resolveEdgeFireDecision({
      proximity: nearStartOnly,
      previous: first.next,
      itemCount: 20,
    });
    expect(second.fireStart).toBe(false);

    const third = resolveEdgeFireDecision({
      proximity: nearStartOnly,
      previous: second.next,
      itemCount: 20,
    });
    expect(third.fireStart).toBe(false);
  });

  test('one edge latching does not suppress the other edge firing independently', () => {
    // Start is already latched from an earlier approach; end becomes near
    // for the first time in this call, at the same itemCount.
    const previous: EdgeLatch = { startLatched: true, endLatched: false, itemCountAtLatch: 30 };

    const result = resolveEdgeFireDecision({ proximity: nearBoth, previous, itemCount: 30 });

    expect(result.fireStart).toBe(false);
    expect(result.fireEnd).toBe(true);
    expect(result.next).toEqual({ startLatched: true, endLatched: true, itemCountAtLatch: 30 });
  });
});
