import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, jest, test } from 'bun:test';
import { createTransitionEndEvent } from './transition-completion-test-events.ts';
import { waitForTransitionCompletion } from './transition-completion.ts';
setupHappyDom();
afterEach(() => {
  document.body.replaceChildren();
  if (jest.isFakeTimers()) jest.useRealTimers();
});
describe('waitForTransitionCompletion', () => {
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
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'all, opacity, transform, width, color',
          transitionDuration: '100ms, 0ms',
          transitionDelay: '0ms, 300ms, 0ms',
        });
      }
      return originalGetComputedStyle(target);
    };

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
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'all, none',
          transitionDuration: '100ms, 10s',
          transitionDelay: '0ms, 0ms',
        });
      }
      return originalGetComputedStyle(target);
    };

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

  test('the fallback timer only counts transition-property slots, ignoring unused excess duration/delay entries (CIN-376 round 18)', () => {
    // `transition-property: all` has exactly ONE effective slot — per the
    // CSS spec, transition-property defines how many transitions exist, and
    // any duration/delay entries beyond that count are simply unused, not
    // paired with a phantom additional transition. `transition-duration:
    // 100ms, 10s` here: the real longest boundary is ~100ms (the one slot
    // cyclically resolves duration[0 % 1]... actually the single property
    // slot only ever reads duration[0] = 100ms; the second, 10s entry has
    // no slot to pair with at all). Before this fix, `Math.max(durations.length,
    // delays.length, properties.length)` (2) would iterate a phantom second
    // slot and pick up the unused 10s entry as the "longest" boundary.
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'all',
          transitionDuration: '100ms, 10s',
          transitionDelay: '0ms',
        });
      }
      return originalGetComputedStyle(target);
    };

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

      jest.advanceTimersByTime(150);
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('ignoreUnknownPropertyEvents: true ignores individual events for "all" and waits for the fallback timer', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'all',
          transitionDuration: '60ms',
          transitionDelay: '0ms',
        });
      }
      return originalGetComputedStyle(target);
    };

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
});
