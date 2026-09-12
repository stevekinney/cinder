import { describe, expect, test } from 'bun:test';

import {
  createVelocityTracker,
  resolveAdaptiveItemSize,
  resolveAdaptiveOverscan,
  trackScrollVelocity,
  type VelocityTracker,
} from './adaptive-overscan.ts';

describe('createVelocityTracker', () => {
  test('starts with no velocity and no previous sample', () => {
    const tracker = createVelocityTracker();

    expect(tracker.velocityInPixelsPerMillisecond).toBe(0);
    expect(tracker.lastTimestamp).toBeNull();
    expect(tracker.lastScrollOffset).toBe(0);
  });
});

describe('trackScrollVelocity', () => {
  test('the first sample produces velocity 0, not Infinity or NaN', () => {
    const tracker = trackScrollVelocity(createVelocityTracker(), {
      scrollOffset: 500,
      timestamp: 1000,
    });

    expect(tracker.velocityInPixelsPerMillisecond).toBe(0);
    expect(Number.isFinite(tracker.velocityInPixelsPerMillisecond)).toBe(true);
  });

  test('does not mutate the input tracker', () => {
    const tracker = Object.freeze(createVelocityTracker());

    expect(() => trackScrollVelocity(tracker, { scrollOffset: 100, timestamp: 16 })).not.toThrow();
    expect(tracker.velocityInPixelsPerMillisecond).toBe(0);
    expect(tracker.lastTimestamp).toBeNull();
  });

  test('computes a smoothed positive velocity for a normal forward scroll', () => {
    const first = trackScrollVelocity(createVelocityTracker(), { scrollOffset: 0, timestamp: 0 });
    const second = trackScrollVelocity(first, { scrollOffset: 160, timestamp: 16 });

    // instantaneous = 160px / 16ms = 10 px/ms; smoothed = 0.3 * 10 + 0.7 * 0 = 3.
    expect(second.velocityInPixelsPerMillisecond).toBeCloseTo(3, 5);
  });

  test('reports the same velocity magnitude scrolling up as scrolling down at equal speed', () => {
    const down = trackScrollVelocity(
      trackScrollVelocity(createVelocityTracker(), { scrollOffset: 0, timestamp: 0 }),
      { scrollOffset: 160, timestamp: 16 },
    );
    const up = trackScrollVelocity(
      trackScrollVelocity(createVelocityTracker(), { scrollOffset: 1000, timestamp: 0 }),
      { scrollOffset: 840, timestamp: 16 },
    );

    expect(up.velocityInPixelsPerMillisecond).toBeCloseTo(down.velocityInPixelsPerMillisecond, 10);
    expect(down.velocityInPixelsPerMillisecond).toBeGreaterThan(0);
  });

  test('two samples with an identical timestamp do not produce Infinity or NaN', () => {
    const first = trackScrollVelocity(createVelocityTracker(), { scrollOffset: 0, timestamp: 100 });
    const second = trackScrollVelocity(first, { scrollOffset: 500, timestamp: 100 });

    expect(Number.isFinite(second.velocityInPixelsPerMillisecond)).toBe(true);
    expect(second).toEqual(first);
  });

  test('a zero elapsed time carries the previous velocity forward unchanged', () => {
    const first = trackScrollVelocity(createVelocityTracker(), { scrollOffset: 0, timestamp: 0 });
    const moving = trackScrollVelocity(first, { scrollOffset: 160, timestamp: 16 });
    const sameTimestampSample = trackScrollVelocity(moving, { scrollOffset: 999, timestamp: 16 });

    expect(sameTimestampSample).toEqual(moving);
    expect(sameTimestampSample.velocityInPixelsPerMillisecond).toBeCloseTo(3, 5);
  });

  test('a clock that goes backwards does not divide by zero and carries velocity forward', () => {
    const first = trackScrollVelocity(createVelocityTracker(), { scrollOffset: 0, timestamp: 0 });
    const moving = trackScrollVelocity(first, { scrollOffset: 160, timestamp: 16 });
    const wentBackwards = trackScrollVelocity(moving, { scrollOffset: 200, timestamp: 10 });

    expect(Number.isFinite(wentBackwards.velocityInPixelsPerMillisecond)).toBe(true);
    expect(wentBackwards).toEqual(moving);
  });

  test('a gap under the idle threshold blends normally, not a reset', () => {
    const first = trackScrollVelocity(createVelocityTracker(), { scrollOffset: 0, timestamp: 0 });
    const moving = trackScrollVelocity(first, { scrollOffset: 160, timestamp: 16 }); // velocity 3
    const afterShortGap = trackScrollVelocity(moving, { scrollOffset: 320, timestamp: 66 }); // +50ms

    // instantaneous = 160px / 50ms = 3.2; smoothed = 0.3 * 3.2 + 0.7 * 3 = 3.06.
    expect(afterShortGap.velocityInPixelsPerMillisecond).toBeCloseTo(3.06, 5);
  });

  test('a long idle gap decays velocity to 0 rather than reporting a stale spike', () => {
    const first = trackScrollVelocity(createVelocityTracker(), { scrollOffset: 0, timestamp: 0 });
    const moving = trackScrollVelocity(first, { scrollOffset: 160, timestamp: 16 }); // velocity 3
    const afterLongGap = trackScrollVelocity(moving, { scrollOffset: 900, timestamp: 16 + 5000 });

    expect(afterLongGap.velocityInPixelsPerMillisecond).toBe(0);
    expect(afterLongGap.lastScrollOffset).toBe(900);
    expect(afterLongGap.lastTimestamp).toBe(16 + 5000);
  });

  test('returns a plain new object, not a shared reference, across independent trackers', () => {
    const a: VelocityTracker = trackScrollVelocity(createVelocityTracker(), {
      scrollOffset: 10,
      timestamp: 10,
    });
    const b = trackScrollVelocity(createVelocityTracker(), { scrollOffset: 20, timestamp: 20 });

    expect(a).not.toBe(b);
  });
});

describe('resolveAdaptiveOverscan', () => {
  test('a stationary reader gets exactly baseOverscan', () => {
    const overscan = resolveAdaptiveOverscan({
      baseOverscan: 5,
      velocityInPixelsPerMillisecond: 0,
      itemSize: 40,
    });

    expect(overscan).toBe(5);
  });

  test('faster scrolling yields a strictly larger overscan than slower scrolling', () => {
    const slow = resolveAdaptiveOverscan({
      baseOverscan: 5,
      velocityInPixelsPerMillisecond: 0.1,
      itemSize: 40,
    });
    const fast = resolveAdaptiveOverscan({
      baseOverscan: 5,
      velocityInPixelsPerMillisecond: 5,
      itemSize: 40,
    });

    expect(fast).toBeGreaterThan(slow);
  });

  test('never drops below baseOverscan, at any velocity including 0', () => {
    const baseOverscan = 5;
    for (const velocityInPixelsPerMillisecond of [0, 0.0001, 1, 100, 1_000_000]) {
      const overscan = resolveAdaptiveOverscan({
        baseOverscan,
        velocityInPixelsPerMillisecond,
        itemSize: 40,
      });
      expect(overscan).toBeGreaterThanOrEqual(baseOverscan);
    }
  });

  test('never exceeds the default maximum, even at an absurd velocity', () => {
    const overscan = resolveAdaptiveOverscan({
      baseOverscan: 5,
      velocityInPixelsPerMillisecond: 1e9,
      itemSize: 40,
    });

    expect(overscan).toBe(50);
  });

  test('never exceeds an explicit maximumOverscan, even at an absurd velocity', () => {
    const overscan = resolveAdaptiveOverscan({
      baseOverscan: 5,
      velocityInPixelsPerMillisecond: 1e9,
      itemSize: 40,
      maximumOverscan: 20,
    });

    expect(overscan).toBe(20);
  });

  test('the baseOverscan floor wins even when maximumOverscan is misconfigured below it', () => {
    const overscan = resolveAdaptiveOverscan({
      baseOverscan: 10,
      velocityInPixelsPerMillisecond: 0,
      itemSize: 40,
      maximumOverscan: 5,
    });

    expect(overscan).toBe(10);
  });

  test('an itemSize of 0 returns baseOverscan rather than dividing by zero', () => {
    const overscan = resolveAdaptiveOverscan({
      baseOverscan: 5,
      velocityInPixelsPerMillisecond: 10,
      itemSize: 0,
    });

    expect(overscan).toBe(5);
    expect(Number.isFinite(overscan)).toBe(true);
  });

  test('a negative itemSize returns baseOverscan rather than dividing by zero', () => {
    const overscan = resolveAdaptiveOverscan({
      baseOverscan: 5,
      velocityInPixelsPerMillisecond: 10,
      itemSize: -40,
    });

    expect(overscan).toBe(5);
  });

  test('guards a non-finite baseOverscan by clamping to 0', () => {
    expect(
      resolveAdaptiveOverscan({
        baseOverscan: Number.NaN,
        velocityInPixelsPerMillisecond: 0,
        itemSize: 40,
      }),
    ).toBe(0);
    expect(
      resolveAdaptiveOverscan({
        baseOverscan: Number.POSITIVE_INFINITY,
        velocityInPixelsPerMillisecond: 0,
        itemSize: 40,
      }),
    ).toBe(0);
  });

  test('guards a negative baseOverscan by clamping to 0', () => {
    const overscan = resolveAdaptiveOverscan({
      baseOverscan: -5,
      velocityInPixelsPerMillisecond: 0,
      itemSize: 40,
    });

    expect(overscan).toBe(0);
  });

  test('guards a non-finite velocity by treating it as 0', () => {
    expect(
      resolveAdaptiveOverscan({
        baseOverscan: 5,
        velocityInPixelsPerMillisecond: Number.NaN,
        itemSize: 40,
      }),
    ).toBe(5);
    expect(
      resolveAdaptiveOverscan({
        baseOverscan: 5,
        velocityInPixelsPerMillisecond: Number.POSITIVE_INFINITY,
        itemSize: 40,
      }),
    ).toBe(5);
  });

  test('the returned value is always an integer', () => {
    const overscan = resolveAdaptiveOverscan({
      baseOverscan: 5,
      velocityInPixelsPerMillisecond: 0.37,
      itemSize: 13,
    });

    expect(Number.isInteger(overscan)).toBe(true);
  });
});

describe('resolveAdaptiveItemSize', () => {
  test('uses the estimate in fixed mode, where it IS the row size', () => {
    expect(
      resolveAdaptiveItemSize({
        dynamicSize: false,
        measuredTotalSize: 200,
        measuredCount: 20,
        estimateSize: 40,
      }),
    ).toBe(40);
  });

  test('averages the rows actually measured', () => {
    // The reported case: a 100px estimate over rows that really measure 10px. Keeping
    // the estimate converts a frame covering 100px into one row instead of ten.
    expect(
      resolveAdaptiveItemSize({
        dynamicSize: true,
        measuredTotalSize: 200,
        measuredCount: 20,
        estimateSize: 100,
      }),
    ).toBe(10);
  });

  test('is not diluted by the rows still carrying an estimate', () => {
    // The whole reason this takes a measured total rather than the offsets table's.
    // Twenty measured rows of 10px among ten thousand estimated at 100px average out
    // to 99.8px across the collection — the estimate again in all but name, and a
    // ruler as wrong as it started.
    const measuredOnly = resolveAdaptiveItemSize({
      dynamicSize: true,
      measuredTotalSize: 20 * 10,
      measuredCount: 20,
      estimateSize: 100,
    });
    expect(measuredOnly).toBe(10);

    const blendedTotal = 20 * 10 + 9_980 * 100;
    expect(blendedTotal / 10_000).toBeGreaterThan(99);
  });

  test('reports an average larger than the estimate just as readily', () => {
    expect(
      resolveAdaptiveItemSize({
        dynamicSize: true,
        measuredTotalSize: 800,
        measuredCount: 10,
        estimateSize: 20,
      }),
    ).toBe(80);
  });

  test('falls back to the estimate before anything has been measured', () => {
    expect(
      resolveAdaptiveItemSize({
        dynamicSize: true,
        measuredTotalSize: 0,
        measuredCount: 0,
        estimateSize: 20,
      }),
    ).toBe(20);
  });

  test('falls back to the estimate when every measured row collapsed to zero', () => {
    // An average of 0 is not a ruler. `resolveAdaptiveOverscan` would take the floor
    // and stop adapting entirely, which is worse than converting with a stale guess.
    expect(
      resolveAdaptiveItemSize({
        dynamicSize: true,
        measuredTotalSize: 0,
        measuredCount: 100,
        estimateSize: 20,
      }),
    ).toBe(20);
  });

  test('falls back to the estimate on a non-finite total', () => {
    expect(
      resolveAdaptiveItemSize({
        dynamicSize: true,
        measuredTotalSize: Number.POSITIVE_INFINITY,
        measuredCount: 100,
        estimateSize: 20,
      }),
    ).toBe(20);
  });

  test('feeds a velocity conversion that the estimate would have understated', () => {
    // End to end: 100px of travel in a frame over 10px rows is ten rows crossed.
    const measured = resolveAdaptiveItemSize({
      dynamicSize: true,
      measuredTotalSize: 200,
      measuredCount: 20,
      estimateSize: 100,
    });
    const withMeasured = resolveAdaptiveOverscan({
      baseOverscan: 0,
      velocityInPixelsPerMillisecond: 6,
      itemSize: measured,
    });
    const withEstimate = resolveAdaptiveOverscan({
      baseOverscan: 0,
      velocityInPixelsPerMillisecond: 6,
      itemSize: 100,
    });
    expect(withMeasured).toBeGreaterThan(withEstimate);
  });
});
