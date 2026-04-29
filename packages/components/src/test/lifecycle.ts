/**
 * Lifecycle / leak detection helpers.
 *
 * Components in Cinder that attach listeners to `window`/`document`, register
 * timers, or hold long-lived observers must clean up on unmount. These helpers
 * snapshot relevant globals before mount, then assert no leak after unmount.
 *
 * Currently focused on timer leaks because they're the most common failure mode
 * in components like Tooltip and Toast. Listener and observer leak detection is
 * deliberately out of scope for v1 — those are best caught with explicit
 * spying/assertions in the component's own test.
 */

/// <reference lib="dom" />

type GlobalWithTimers = typeof globalThis & {
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
};

/**
 * Returns a snapshot of currently-active timer IDs. Use as a baseline before
 * mounting a component, then call {@link expectNoLeakedTimers} after unmount.
 *
 * Implementation: monkey-patches `setTimeout`/`setInterval` to track active IDs
 * for the duration of the snapshot. Restores the originals when the returned
 * `release()` is called.
 */
export function trackTimers(): {
  active: () => Set<number>;
  release: () => void;
} {
  const g = globalThis as GlobalWithTimers;
  const originalSetTimeout = g.setTimeout;
  const originalSetInterval = g.setInterval;
  const originalClearTimeout = g.clearTimeout;
  const originalClearInterval = g.clearInterval;

  const active = new Set<number>();

  // Best-effort wrappers. happy-dom's timer types differ slightly from lib.dom;
  // we coerce IDs to numbers since that's what the standard says.
  g.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = originalSetTimeout(
      ((...a: unknown[]) => {
        active.delete(id as unknown as number);
        if (typeof handler === 'function') {
          (handler as (...args: unknown[]) => unknown)(...a);
        }
      }) as TimerHandler,
      timeout,
      ...args,
    );
    active.add(id as unknown as number);
    return id;
  }) as typeof setTimeout;

  g.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = originalSetInterval(handler, timeout, ...args);
    active.add(id as unknown as number);
    return id;
  }) as typeof setInterval;

  g.clearTimeout = ((id?: number) => {
    if (id !== undefined) active.delete(id);
    return originalClearTimeout(id);
  }) as typeof clearTimeout;

  g.clearInterval = ((id?: number) => {
    if (id !== undefined) active.delete(id);
    return originalClearInterval(id);
  }) as typeof clearInterval;

  return {
    active: () => new Set(active),
    release: () => {
      g.setTimeout = originalSetTimeout;
      g.setInterval = originalSetInterval;
      g.clearTimeout = originalClearTimeout;
      g.clearInterval = originalClearInterval;
    },
  };
}

/**
 * Asserts that the `active` set returned from {@link trackTimers} is empty
 * after the component has been unmounted. Throws with the leaked IDs if not.
 */
export function expectNoLeakedTimers(active: Set<number>): void {
  if (active.size > 0) {
    throw new Error(
      `expected no leaked timers after unmount, got ${active.size}: ${[...active].join(', ')}`,
    );
  }
}
