/**
 * A controllable `setTimeout`/`clearTimeout` for tests that have to cross a
 * debounce.
 *
 * Re-anchoring is debounced 300ms, so the tests around it need to get to the
 * other side of that boundary. Sleeping for a real 300-odd milliseconds is the
 * obvious way and the wrong one: the number has to be padded to survive a loaded
 * CI machine, the padding is a guess, and the test still flakes when the guess
 * is beaten, so the padding grows. Advancing a fake clock takes the timing out
 * of the test entirely, which is both faster and actually deterministic.
 *
 * @module
 */

import { spyOn } from 'bun:test';

/** A `setTimeout` replacement whose passage of time the caller controls. */
export interface FakeClock {
  /**
   * Fire every timer due at or before `now + ms`.
   *
   * Timers scheduled BY a firing timer are deliberately not fired in the same
   * advance. That is what keeps a self-rescheduling loop visible as a loop —
   * one advance, one round — instead of running away inside a single call.
   */
  advance(ms: number): void;
  /** Total `setTimeout` calls since install, including ones already fired. */
  readonly scheduledCount: number;
  /** Timers currently armed. */
  readonly pendingCount: number;
  /** Put the real timer functions back. Always call this in `afterEach`. */
  restore(): void;
}

/**
 * Swap the global timer functions for controllable ones.
 *
 * Global rather than injected because the code under test schedules through the
 * ambient `setTimeout`, which is the thing being controlled.
 */
export function installFakeClock(): FakeClock {
  // This harness runs in Bun. The DOM overload's numeric return type does not
  // describe its native Timeout objects, so spy through the runtime contract.
  const timers: {
    setTimeout: (
      callback: Bun.TimerHandler,
      delay?: number,
      ...arguments_: unknown[]
    ) => ReturnType<typeof globalThis.setTimeout>;
    clearTimeout: (handle: ReturnType<typeof globalThis.setTimeout> | number | undefined) => void;
  } = globalThis;
  const originalSetTimeout = timers.setTimeout;
  const originalClearTimeout = timers.clearTimeout;

  let now = 0;
  const pending = new Map<number, { callback: () => void; dueAt: number }>();

  const setTimeoutSpy = spyOn(timers, 'setTimeout');
  setTimeoutSpy.mockImplementation((callback, delay = 0, ...arguments_) => {
    if (typeof callback !== 'function') throw new TypeError('Expected a timeout callback');
    // Keep the native handle contract without leaving a real timeout armed.
    const handle = originalSetTimeout(() => {}, 0);
    originalClearTimeout(handle);
    pending.set(Number(handle), {
      callback: () => callback(...arguments_),
      dueAt: now + delay,
    });
    return handle;
  });

  const clearTimeoutSpy = spyOn(timers, 'clearTimeout');
  clearTimeoutSpy.mockImplementation((handle) => {
    pending.delete(Number(handle));
    originalClearTimeout(Number(handle));
  });

  return {
    advance(ms: number) {
      now += ms;
      const due = [...pending.entries()]
        .filter(([, timer]) => timer.dueAt <= now)
        .toSorted((a, b) => a[1].dueAt - b[1].dueAt);
      for (const [id, timer] of due) {
        if (pending.delete(id)) timer.callback();
      }
    },
    get scheduledCount() {
      return setTimeoutSpy.mock.calls.length;
    },
    get pendingCount() {
      return pending.size;
    },
    restore() {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      pending.clear();
    },
  };
}

/**
 * Drive `promise` to settlement while a fake clock is already installed,
 * without ever directly `await`ing it.
 *
 * The whole point of installing a fake clock BEFORE some async startup
 * (rather than after, once it's already mounting) is to capture every
 * `setTimeout` that startup arms — but a bare `await promise` at that point
 * blocks this function's own stack until `promise` settles, and nothing
 * else runs meanwhile to call `clock.advance()`. If `promise`'s own chain
 * is waiting on one of those now-fake timers, it hangs forever. This drains
 * it instead: yield a microtask (letting any of `promise`'s own pending
 * `.then`s run), advance the clock (firing whatever real code scheduled
 * through the now-fake `setTimeout`), repeat. Bounded by iteration count,
 * not wall time, so it can never itself become a padded wait — a review
 * finding on an earlier, less careful version of this pattern (installing
 * the clock AFTER the async work had already started) is why late-install
 * call sites in this package were migrated to this one.
 */
type Settlement<T> =
  | { status: 'pending' }
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

export async function drainMount<T>(promise: Promise<T>, clock: FakeClock): Promise<T> {
  const outcome: { current: Settlement<T> } = { current: { status: 'pending' } };
  promise
    .then((value) => {
      outcome.current = { status: 'fulfilled', value };
      return value;
    })
    .catch((reason: unknown) => {
      outcome.current = { status: 'rejected', reason };
    });

  const maxIterations = 200;
  for (let i = 0; i < maxIterations && outcome.current.status === 'pending'; i++) {
    await Promise.resolve();
    clock.advance(20);
  }
  if (outcome.current.status === 'pending') {
    throw new Error(`drainMount: promise did not settle within ${maxIterations} iterations`);
  }
  if (outcome.current.status === 'rejected') throw outcome.current.reason;
  return outcome.current.value;
}
