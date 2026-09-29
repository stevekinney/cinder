import { expect, test } from 'bun:test';

import { expectNoLeakedTimers, trackTimers } from './timer-lifecycle.ts';

test('tracks native timeout handles and removes fired or cleared timers', async () => {
  const original = globalThis.setTimeout;
  const timers = trackTimers();
  try {
    expect(Reflect.ownKeys(globalThis.setTimeout)).toEqual(Reflect.ownKeys(original));
    const canceled = setTimeout(() => {}, 0);
    expect(timers.active().has(canceled)).toBe(true);
    clearTimeout(canceled);
    expect(timers.active().has(canceled)).toBe(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expectNoLeakedTimers(timers.active());
  } finally {
    timers.release();
  }
  expect(globalThis.setTimeout).toBe(original);
});

test('tracks intervals until explicitly cleared and restores native functions', () => {
  const original = globalThis.setInterval;
  const timers = trackTimers();
  try {
    const interval = setInterval(() => {}, 1);
    expect(timers.active().has(interval)).toBe(true);
    clearInterval(interval);
    expectNoLeakedTimers(timers.active());
  } finally {
    timers.release();
  }
  expect(globalThis.setInterval).toBe(original);
});
