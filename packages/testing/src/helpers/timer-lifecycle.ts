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

type TimerId = ReturnType<typeof setTimeout>;

/**
 * Returns a snapshot of currently-active timer IDs. Use as a baseline before
 * mounting a component, then call {@link expectNoLeakedTimers} after unmount.
 *
 * Implementation: monkey-patches `setTimeout`/`setInterval` to track active IDs
 * for the duration of the snapshot. Restores the originals when the returned
 * `release()` is called.
 */
export function trackTimers(): {
  active: () => Set<TimerId>;
  release: () => void;
} {
  const g = globalThis;
  const originalSetTimeout = g.setTimeout;
  const originalSetInterval = g.setInterval;
  const originalClearTimeout = g.clearTimeout;
  const originalClearInterval = g.clearInterval;

  const active = new Set<TimerId>();

  g.setTimeout = new Proxy(originalSetTimeout, {
    apply(target, receiver, arguments_) {
      const handler: unknown = arguments_[0];
      let id: TimerId;
      if (typeof handler === 'function') {
        arguments_[0] = (...values: unknown[]) => {
          active.delete(id);
          Reflect.apply(handler, receiver, values);
        };
      }
      id = Reflect.apply(target, receiver, arguments_);
      active.add(id);
      return id;
    },
  });
  g.setInterval = new Proxy(originalSetInterval, {
    apply(target, receiver, arguments_) {
      const id: TimerId = Reflect.apply(target, receiver, arguments_);
      active.add(id);
      return id;
    },
  });
  g.clearTimeout = new Proxy(originalClearTimeout, {
    apply(target, receiver, arguments_) {
      active.delete(arguments_[0]);
      return Reflect.apply(target, receiver, arguments_);
    },
  });
  g.clearInterval = new Proxy(originalClearInterval, {
    apply(target, receiver, arguments_) {
      active.delete(arguments_[0]);
      return Reflect.apply(target, receiver, arguments_);
    },
  });

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
export function expectNoLeakedTimers(active: Set<TimerId>): void {
  if (active.size > 0) {
    throw new Error(
      `expected no leaked timers after unmount, got ${active.size}: ${[...active].map(Number).join(', ')}`,
    );
  }
}
