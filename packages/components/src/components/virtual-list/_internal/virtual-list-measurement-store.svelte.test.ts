import { describe, expect, test } from 'bun:test';

import { VirtualListMeasurementStore } from './virtual-list-measurement-store.svelte.ts';

describe('VirtualListMeasurementStore', () => {
  test('starts with no cached sizes, no pending corrections, and version 0', () => {
    const store = new VirtualListMeasurementStore();

    expect(store.version).toBe(0);
    expect(store.pendingCorrectionsVersion).toBe(0);
    expect(store.sizes.size).toBe(0);
    expect(store.consumePendingCorrections()).toEqual([]);
  });

  test('record() stores the measured size at full precision', () => {
    // Quantizing here would compound down the offsets table: 5,000 rows measured
    // at 20.4px and cached as 20px leaves the spacer ~2,000px short and every
    // scrollToIndex target past the top of the list wrong.
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 40.4, 40);
    expect(store.sizes.get('a')).toBe(40.4);

    store.record('b', 1, 40.6, 40);
    expect(store.sizes.get('b')).toBe(40.6);
  });

  test('record() accumulates no drift across many fractional measurements', () => {
    const store = new VirtualListMeasurementStore();
    for (let index = 0; index < 5_000; index += 1) {
      store.record(`row-${index}`, index, 20.4, 20);
    }

    let total = 0;
    for (const size of store.sizes.values()) total += size;

    expect(total).toBeCloseTo(102_000, 6);
  });

  test('record() ignores a re-measurement within the sub-pixel noise epsilon', () => {
    const store = new VirtualListMeasurementStore();

    // First measurement equals the estimate exactly, so no correction is queued,
    // but the cache itself changed (nothing was cached before), so version bumps.
    store.record('a', 0, 40, 40);
    expect(store.version).toBe(1);
    expect(store.pendingCorrectionsVersion).toBe(0);

    // A re-measurement inside the epsilon is float jitter, not a resize: no
    // version bump and no correction, which is what stops the correction ->
    // relayout -> same-size-reported -> correction feedback loop.
    store.record('a', 0, 40.005, 40);
    expect(store.version).toBe(1);
    expect(store.pendingCorrectionsVersion).toBe(0);
    expect(store.sizes.get('a')).toBe(40);
  });

  test('record() no-ops on an unchanged rounded size: no version bump, no queued correction', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 52, 40);
    expect(store.version).toBe(1);
    expect(store.pendingCorrectionsVersion).toBe(1);
    expect(store.consumePendingCorrections()).toEqual([{ index: 0, delta: 12 }]);

    // Re-recording the exact same rounded size must be a complete no-op.
    store.record('a', 0, 52, 40);
    expect(store.version).toBe(1);
    expect(store.pendingCorrectionsVersion).toBe(1);
    expect(store.sizes.get('a')).toBe(52);
    expect(store.consumePendingCorrections()).toEqual([]);
  });

  test('the queued correction delta for a first measurement is measuredSize - estimateSize', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 3, 65, 40);

    expect(store.pendingCorrectionsVersion).toBe(1);
    expect(store.consumePendingCorrections()).toEqual([{ index: 3, delta: 25 }]);
  });

  test('a first measurement that rounds to exactly the estimate queues no correction', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 3, 40, 40);

    expect(store.version).toBe(1); // the cache still changed from absent to present
    expect(store.pendingCorrectionsVersion).toBe(0);
    expect(store.consumePendingCorrections()).toEqual([]);
  });

  test('the queued correction delta for a re-measurement is newSize - previousSize', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 2, 40, 40); // first measurement, matches estimate
    store.consumePendingCorrections();

    store.record('a', 2, 55, 40); // re-measurement: baseline is the previous cached size, not the estimate

    expect(store.pendingCorrectionsVersion).toBe(1);
    expect(store.consumePendingCorrections()).toEqual([{ index: 2, delta: 15 }]);
  });

  test('a re-measurement that shrinks back to the estimate queues a negative delta', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 80, 40);
    store.consumePendingCorrections();

    store.record('a', 0, 40, 40);

    expect(store.consumePendingCorrections()).toEqual([{ index: 0, delta: -40 }]);
  });

  test('version bumps once per record() call that actually changes a cached size', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 50, 40);
    expect(store.version).toBe(1);

    store.record('b', 1, 60, 40);
    expect(store.version).toBe(2);

    store.record('b', 1, 61, 40); // genuine re-measurement change
    expect(store.version).toBe(3);

    store.record('b', 1, 61, 40); // no-op: unchanged
    expect(store.version).toBe(3);
  });

  test('pendingCorrectionsVersion bumps only when a non-zero-delta correction is queued', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 40, 40); // matches estimate: zero delta, no queue
    expect(store.pendingCorrectionsVersion).toBe(0);

    store.record('b', 1, 55, 40); // non-zero delta: queues and bumps
    expect(store.pendingCorrectionsVersion).toBe(1);

    store.record('c', 2, 40, 40); // another zero-delta first measurement
    expect(store.pendingCorrectionsVersion).toBe(1);
  });

  test('consumePendingCorrections() drains: a second call with no intervening record() returns empty', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 55, 40);
    store.record('b', 1, 30, 40);

    const corrections = store.consumePendingCorrections();
    expect(corrections).toEqual([
      { index: 0, delta: 15 },
      { index: 1, delta: -10 },
    ]);

    expect(store.consumePendingCorrections()).toEqual([]);
    expect(store.consumePendingCorrections()).toEqual([]);
  });

  test('consumePendingCorrections() only returns corrections queued since the last drain', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 55, 40);
    expect(store.consumePendingCorrections()).toEqual([{ index: 0, delta: 15 }]);

    store.record('b', 1, 30, 40);
    expect(store.consumePendingCorrections()).toEqual([{ index: 1, delta: -10 }]);
  });

  test('sizes exposes a live, read-only view of every cached measurement', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 40, 40);
    store.record('b', 1, 55, 40);

    expect(store.sizes).toBeInstanceOf(Map);
    expect(Object.fromEntries(store.sizes)).toEqual({ a: 40, b: 55 });
  });

  test('prune() drops cached sizes for keys not in the valid set and bumps version', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 40, 40);
    store.record('b', 1, 55, 40);
    store.record('c', 2, 30, 40);
    const versionBeforePrune = store.version;

    store.prune(new Set(['b']));

    expect(store.version).toBe(versionBeforePrune + 1);
    expect(Object.fromEntries(store.sizes)).toEqual({ b: 55 });
  });

  test('prune() is a no-op — no version bump — when nothing is actually removed', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 40, 40);
    store.record('b', 1, 55, 40);
    const versionBeforePrune = store.version;

    store.prune(new Set(['a', 'b', 'c']));

    expect(store.version).toBe(versionBeforePrune);
    expect(Object.fromEntries(store.sizes)).toEqual({ a: 40, b: 55 });
  });

  test('prune() on an already-empty store is a no-op', () => {
    const store = new VirtualListMeasurementStore();

    store.prune(new Set());

    expect(store.version).toBe(0);
    expect(store.sizes.size).toBe(0);
  });

  test('reset() clears every cached size and bumps version when there was something to clear', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 40, 40);
    store.record('b', 1, 55, 40);
    const versionBeforeReset = store.version;

    store.reset();

    expect(store.version).toBe(versionBeforeReset + 1);
    expect(store.sizes.size).toBe(0);
  });

  test('reset() clears any undrained pending corrections', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 55, 40); // queues a correction, never drained

    store.reset();

    expect(store.consumePendingCorrections()).toEqual([]);
  });

  test('reset() on an already-empty store does not bump version', () => {
    const store = new VirtualListMeasurementStore();

    store.reset();

    expect(store.version).toBe(0);
    expect(store.sizes.size).toBe(0);
  });

  test('reset() leaves the store usable for further measurements', () => {
    const store = new VirtualListMeasurementStore();

    store.record('a', 0, 55, 40);
    store.reset();

    store.record('a', 0, 55, 40);
    expect(store.sizes.get('a')).toBe(55);
    expect(store.consumePendingCorrections()).toEqual([{ index: 0, delta: 15 }]);
  });
});

describe('VirtualListMeasurementStore — measuredTotalSize', () => {
  test('starts at zero', () => {
    expect(new VirtualListMeasurementStore().measuredTotalSize).toBe(0);
  });

  test('sums the sizes recorded', () => {
    const store = new VirtualListMeasurementStore();
    store.record('a', 0, 30, 20);
    store.record('b', 1, 50, 20);

    expect(store.measuredTotalSize).toBe(80);
    expect(store.measuredCount).toBe(2);
  });

  test('replaces rather than adds when a row is measured again', () => {
    // The whole hazard of keeping a running total: a re-measurement that added its
    // new size without removing the old one would drift upward forever, and the
    // adaptive ruler that divides by the count would grow with it.
    const store = new VirtualListMeasurementStore();
    store.record('a', 0, 30, 20);
    store.record('a', 0, 45, 20);

    expect(store.measuredTotalSize).toBe(45);
    expect(store.measuredCount).toBe(1);
  });

  test('leaves the total alone when a report is within the epsilon', () => {
    const store = new VirtualListMeasurementStore();
    store.record('a', 0, 30, 20);
    const before = store.measuredTotalSize;
    store.record('a', 0, 30.000_001, 20);

    expect(store.measuredTotalSize).toBe(before);
  });

  test('subtracts the rows a prune removes', () => {
    const store = new VirtualListMeasurementStore();
    store.record('a', 0, 30, 20);
    store.record('b', 1, 50, 20);
    store.prune(new Set(['a']));

    expect(store.measuredTotalSize).toBe(30);
    expect(store.measuredCount).toBe(1);
  });

  test('returns to zero on reset', () => {
    const store = new VirtualListMeasurementStore();
    store.record('a', 0, 30, 20);
    store.reset();

    expect(store.measuredTotalSize).toBe(0);
    expect(store.measuredCount).toBe(0);
  });

  test('agrees with summing the cache after a mixed sequence', () => {
    // The relational check: whatever the running total says, it must equal what
    // walking the map would have produced. That is the property the incremental
    // maintenance exists to preserve, and it survives any future mutation path.
    const store = new VirtualListMeasurementStore();
    store.record('a', 0, 30, 20);
    store.record('b', 1, 50, 20);
    store.record('c', 2, 10, 20);
    store.record('b', 1, 70, 20);
    store.prune(new Set(['a', 'b']));
    store.record('a', 0, 25, 20);

    const summed = [...store.sizes.values()].reduce((total, size) => total + size, 0);
    expect(store.measuredTotalSize).toBeCloseTo(summed, 10);
  });
});
