/// <reference lib="dom" />
import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { waitForTransitionCompletion } from './transition-completion.ts';

setupHappyDom();

/**
 * Fallback-duration tests advance Bun's fake timers instead of sleeping past
 * the real wall-clock boundary (CIN-376 round 14 review): a real
 * `setTimeout(resolve, 360)` followed by another `setTimeout(resolve, 120)`
 * to straddle a ~450ms fallback boundary is racy on a loaded CI worker — an
 * overloaded event loop can wake the first timer late enough that the
 * fallback has already fired, failing the `completionCount === 0` assertion
 * despite entirely correct code. `waitForTransitionCompletion` only ever
 * calls `setTimeout`/`clearTimeout` (no `performance.now()` reads), so fake
 * timers alone are a complete, deterministic stand-in — no injectable clock
 * seam needed in the helper itself. Mirrors the pattern already used by
 * `toast-region.test.ts` and others.
 */

function createTransitionEndEvent(propertyName: string): Event {
  const event = new Event('transitionend');
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  return event;
}

function createTransitionCancelEvent(propertyName: string, bubbles = false): Event {
  const event = new Event('transitioncancel', { bubbles });
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  return event;
}

afterEach(() => {
  document.body.replaceChildren();
  if (jest.isFakeTimers()) {
    jest.useRealTimers();
  }
});

describe('waitForTransitionCompletion', () => {
  test('waits for all tracked transition properties before completing', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'translate, opacity',
          transitionDuration: '100ms, 200ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        onComplete: () => {
          completionCount += 1;
        },
      });

      element.dispatchEvent(createTransitionEndEvent('translate'));
      expect(completionCount).toBe(0);

      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('the fallback timer counts every transitionProperty slot, not just max(durations, delays) (CIN-376)', async () => {
    // Five properties (`all, opacity, transform, width, color`), only three
    // durations/delays (`100ms, 0ms` / `0ms, 300ms, 0ms`). The fifth slot
    // (index 4) cyclically resolves to `durations[4 % 2] + delays[4 % 3] =
    // 100ms + 300ms = 400ms` — the real longest boundary. A fallback that
    // only iterates `max(durations.length, delays.length)` (3 slots) would
    // stop at index 2 and miss it, scheduling completion after 350ms
    // instead of the correct ~450ms. `all` makes
    // `getTrackedTransitionProperties` return `null`, so with
    // `ignoreUnknownPropertyEvents: true` (Speed Dial's case) completion can
    // ONLY come from this fallback timer — no individual event ever fires it.
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'all, opacity, transform, width, color',
          transitionDuration: '100ms, 0ms',
          transitionDelay: '0ms, 300ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    jest.useFakeTimers();
    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        ignoreUnknownPropertyEvents: true,
        onComplete: () => {
          completionCount += 1;
        },
      });

      jest.advanceTimersByTime(360);
      expect(completionCount).toBe(0);

      jest.advanceTimersByTime(120);
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('excludes `none` transition-property slots from the fallback duration (CIN-376 round 12)', async () => {
    // `transition-property: all, none` with durations `100ms, 10s`: the
    // `none` slot can never produce a transition, however long its paired
    // duration happens to be. Without excluding it, this fallback would wait
    // out the unreachable 10s instead of the real ~100ms boundary — e.g. a
    // Speed Dial action closing behind consumer CSS shaped exactly like
    // this would stay retained and portaled for ~10s instead of ~100ms.
    // `all` makes `getTrackedTransitionProperties` return `null`, so with
    // `ignoreUnknownPropertyEvents: true` completion can ONLY come from this
    // fallback timer.
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'all, none',
          transitionDuration: '100ms, 10s',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    jest.useFakeTimers();
    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        ignoreUnknownPropertyEvents: true,
        onComplete: () => {
          completionCount += 1;
        },
      });

      jest.advanceTimersByTime(100);
      expect(completionCount).toBe(0);

      jest.advanceTimersByTime(100);
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('repeats a shorter duration/delay list CYCLICALLY, per the CSS spec (CIN-376)', () => {
    // Three properties, only two durations (`100ms, 0ms`) — CSS repeats the
    // shorter list from the beginning: the third property (index 2)
    // resolves to `durations[2 % 2] = durations[0] = 100ms`, tracked. The
    // second property (index 1) resolves to `durations[1] = 0ms`, not
    // tracked. A "repeat the last value" implementation would instead give
    // the third property `durations.at(-1) = 0ms` (also not tracked),
    // wrongly narrowing the tracked set to just the first property.
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'opacity, transform, width',
          transitionDuration: '100ms, 0ms',
          transitionDelay: '0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        onComplete: () => {
          completionCount += 1;
        },
      });

      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(0);

      element.dispatchEvent(createTransitionEndEvent('width'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('completes on the next microtask when reduced motion is enabled', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    let completionCount = 0;
    waitForTransitionCompletion({
      element,
      reducedMotion: true,
      onComplete: () => {
        completionCount += 1;
      },
    });

    expect(completionCount).toBe(0);
    await Promise.resolve();
    expect(completionCount).toBe(1);
  });

  test('completes on the first transitionend when all transition properties are tracked', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'all',
          transitionDuration: '100ms',
          transitionDelay: '0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        onComplete: () => {
          completionCount += 1;
        },
      });

      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('ignoreUnknownPropertyEvents: true ignores individual events for "all" and waits for the fallback timer', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'all',
          transitionDuration: '60ms',
          transitionDelay: '0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    jest.useFakeTimers();
    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        ignoreUnknownPropertyEvents: true,
        onComplete: () => {
          completionCount += 1;
        },
      });

      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(0);

      jest.advanceTimersByTime(120);
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('a transitioncancel on a tracked property completes immediately by default, once the exit has had two frames to start (CIN-376 round 11/16)', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'opacity, transform',
          transitionDuration: '150ms, 150ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        onComplete: () => {
          completionCount += 1;
        },
      });

      // The `transitioncancel` listener is deliberately deferred by a DOUBLE
      // animation frame (see the fix below, CIN-376 round 16) — before both
      // frames have elapsed, a cancel is not observed at all.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      element.dispatchEvent(createTransitionCancelEvent('opacity'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('ignores a transitioncancel from a canceled ENTER transition, arriving before the exit has had a frame to start (CIN-376 round 11)', async () => {
    // Closing an element mid-ENTER-transition retargets the same property to
    // its exit value, canceling the in-flight entrance transition — the
    // browser dispatches `transitioncancel` for it essentially synchronously
    // with the style change that starts this exit wait. Because that event's
    // target is this same element, treating it as "the exit already
    // canceled" would finish() before the exit transition even started,
    // snapping the panel away instead of animating it out.
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'opacity',
          transitionDuration: '150ms',
          transitionDelay: '0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        onComplete: () => {
          completionCount += 1;
        },
      });

      // Simulates the leftover cancel of the just-interrupted ENTER
      // transition, dispatched before the deferred listener attaches.
      element.dispatchEvent(createTransitionCancelEvent('opacity'));
      expect(completionCount).toBe(0);

      // The exit's own `transitionend` still completes things normally.
      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('ignores a transitioncancel that bubbles up from a descendant (CIN-376)', () => {
    // Transition events bubble like most others: a completely unrelated
    // child transition being interrupted must not force-complete the
    // panel's own exit — the same target-identity filter `transitionend`
    // already applies must also guard `transitioncancel`.
    const element = document.createElement('div');
    const child = document.createElement('span');
    element.appendChild(child);
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'opacity',
          transitionDuration: '150ms',
          transitionDelay: '0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        onComplete: () => {
          completionCount += 1;
        },
      });

      child.dispatchEvent(createTransitionCancelEvent('opacity', true));
      expect(completionCount).toBe(0);

      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('ignoreCancel: true ignores transitioncancel and still waits for transitionend', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element) => {
      if (target === element) {
        return {
          transitionProperty: 'opacity, transform',
          transitionDuration: '150ms, 150ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        ignoreCancel: true,
        onComplete: () => {
          completionCount += 1;
        },
      });

      element.dispatchEvent(createTransitionCancelEvent('opacity'));
      element.dispatchEvent(createTransitionCancelEvent('transform'));
      expect(completionCount).toBe(0);

      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(0);
      element.dispatchEvent(createTransitionEndEvent('transform'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
});
