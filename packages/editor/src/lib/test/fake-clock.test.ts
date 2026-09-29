import { afterEach, describe, expect, test } from 'bun:test';

import { drainMount, installFakeClock, type FakeClock } from './fake-clock.ts';

let clock: FakeClock | undefined;
afterEach(() => {
  clock?.restore();
  clock = undefined;
});

describe('timeout-only fake clock', () => {
  test('returns native timeout handles and counts cancellation and firing', () => {
    clock = installFakeClock();
    const events: string[] = [];
    const canceled = setTimeout(() => events.push('canceled'), 10);
    setTimeout(() => events.push('fired'), 20);
    expect(typeof canceled).toBe('object');
    expect(clock.scheduledCount).toBe(2);
    expect(clock.pendingCount).toBe(2);
    clearTimeout(canceled);
    clock.advance(10);
    expect(events).toEqual([]);
    expect(clock.pendingCount).toBe(1);
    clock.advance(10);
    expect(events).toEqual(['fired']);
    expect(clock.scheduledCount).toBe(2);
    expect(clock.pendingCount).toBe(0);
  });

  test('does not run newly scheduled callbacks in the same advance', () => {
    clock = installFakeClock();
    const events: string[] = [];
    setTimeout(() => {
      events.push('outer');
      setTimeout(() => events.push('inner'), 0);
    }, 20);
    clock.advance(20);
    expect(events).toEqual(['outer']);
    expect(clock.pendingCount).toBe(1);
    clock.advance(0);
    expect(events).toEqual(['outer', 'inner']);
    expect(clock.pendingCount).toBe(0);
  });

  test('cancels a due callback from an earlier callback in the same advance', () => {
    clock = installFakeClock();
    const events: string[] = [];
    setTimeout(() => clearTimeout(canceled), 10);
    const canceled = setTimeout(() => events.push('canceled'), 20);
    clock.advance(20);
    expect(events).toEqual([]);
    expect(clock.pendingCount).toBe(0);
  });

  test('leaves Date and interval scheduling untouched and restores both timeout functions', () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const originalDate = globalThis.Date;
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const start = Date.now();
    clock = installFakeClock();
    let intervalCalls = 0;
    const interval = setInterval(() => intervalCalls++, 10);
    try {
      clock.advance(86_400_000);
      expect(intervalCalls).toBe(0);
      expect(globalThis.Date).toBe(originalDate);
      expect(Date.now() - start).toBeLessThan(86_400_000);
      expect(globalThis.setInterval).toBe(originalSetInterval);
      expect(globalThis.clearInterval).toBe(originalClearInterval);
    } finally {
      clearInterval(interval);
      clock.restore();
    }
    expect(globalThis.setTimeout).toBe(originalSetTimeout);
    expect(globalThis.clearTimeout).toBe(originalClearTimeout);
  });
});

describe('drainMount settlement', () => {
  test('preserves a fulfilled undefined value', async () => {
    clock = installFakeClock();
    expect(await drainMount(Promise.resolve(undefined), clock)).toBeUndefined();
  });

  test('preserves an undefined rejection reason', async () => {
    clock = installFakeClock();
    const settlement = await drainMount(Promise.reject(undefined), clock).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason: unknown) => ({ status: 'rejected', reason }),
    );
    expect(settlement).toEqual({ status: 'rejected', reason: undefined });
  });

  test('preserves the exact rejection object', async () => {
    clock = installFakeClock();
    const reason = { message: 'mount failed' };
    const settlement = await drainMount(Promise.reject(reason), clock).then(
      (value) => ({ status: 'fulfilled', value }),
      (error: unknown) => ({ status: 'rejected', reason: error }),
    );
    expect(settlement).toEqual({ status: 'rejected', reason });
    expect('reason' in settlement && settlement.reason).toBe(reason);
  });

  test('drains startup timers and retains the fulfilled value', async () => {
    clock = installFakeClock();
    const value = { mounted: true };
    const pending = new Promise<typeof value>((resolve) => setTimeout(() => resolve(value), 40));
    expect(await drainMount(pending, clock)).toBe(value);
    expect(clock.pendingCount).toBe(0);
  });

  test('retains the 200 iteration bound and 20 millisecond steps', async () => {
    const advances: number[] = [];
    const observedClock: FakeClock = {
      advance(milliseconds) {
        advances.push(milliseconds);
      },
      pendingCount: 0,
      scheduledCount: 0,
      restore() {},
    };
    const never = new Promise<never>(() => {});
    const settlement = await drainMount(never, observedClock).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason: unknown) => ({ status: 'rejected', reason }),
    );
    expect(settlement).toEqual({
      status: 'rejected',
      reason: new Error('drainMount: promise did not settle within 200 iterations'),
    });
    expect(advances).toHaveLength(200);
    expect(new Set(advances)).toEqual(new Set([20]));
  });
});
