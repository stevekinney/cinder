import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, jest, test } from 'bun:test';
import {
  createTransitionCancelEvent,
  createTransitionEndEvent,
} from './transition-completion-test-events.ts';
import { waitForTransitionCompletion } from './transition-completion.ts';
setupHappyDom();
afterEach(() => {
  document.body.replaceChildren();
  if (jest.isFakeTimers()) jest.useRealTimers();
});
describe('waitForTransitionCompletion', () => {
  test('a transitioncancel on a tracked property completes immediately by default, once the exit has had two frames to start (CIN-376 round 11/16)', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'opacity, transform',
          transitionDuration: '150ms, 150ms',
          transitionDelay: '0ms, 0ms',
        });
      }
      return originalGetComputedStyle(target);
    };

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
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'opacity',
          transitionDuration: '150ms',
          transitionDelay: '0ms',
        });
      }
      return originalGetComputedStyle(target);
    };

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

  test('ignores a transitioncancel that bubbles up from a descendant (CIN-376)', async () => {
    // Transition events bubble like most others: a completely unrelated
    // child transition being interrupted must not force-complete the
    // panel's own exit — the same target-identity filter `transitionend`
    // already applies must also guard `transitioncancel`.
    const element = document.createElement('div');
    const child = document.createElement('span');
    element.appendChild(child);
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'opacity',
          transitionDuration: '150ms',
          transitionDelay: '0ms',
        });
      }
      return originalGetComputedStyle(target);
    };

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        onComplete: () => {
          completionCount += 1;
        },
      });

      // Exercise the target filter after the deferred listener is active.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      child.dispatchEvent(createTransitionCancelEvent('opacity', true));
      expect(completionCount).toBe(0);

      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('attaches the transitioncancel listener immediately when requestAnimationFrame is unavailable', () => {
    // The double-rAF deferral above exists to survive a real browser's
    // render pipeline. Without `requestAnimationFrame` at all, there is no
    // frame to wait for — the listener must attach synchronously instead,
    // so a transitioncancel is never silently missed there. (This stubs rAF
    // away in happy-dom to exercise that fallback branch; it doesn't
    // reproduce an actual SSR environment.)
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'opacity',
          transitionDuration: '150ms',
          transitionDelay: '0ms',
        });
      }
      return originalGetComputedStyle(target);
    };
    const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(
      globalThis,
      'requestAnimationFrame',
    );
    const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(
      globalThis,
      'cancelAnimationFrame',
    );
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
    expect(typeof globalThis.requestAnimationFrame).toBe('undefined');
    expect(typeof globalThis.cancelAnimationFrame).toBe('undefined');

    try {
      let completionCount = 0;
      waitForTransitionCompletion({
        element,
        reducedMotion: false,
        onComplete: () => {
          completionCount += 1;
        },
      });

      // No frame wait at all — if the listener were still deferred, this
      // synchronous dispatch would be missed and completionCount would stay 0.
      element.dispatchEvent(createTransitionCancelEvent('opacity'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      if (originalRequestAnimationFrame)
        Object.defineProperty(globalThis, 'requestAnimationFrame', originalRequestAnimationFrame);
      if (originalCancelAnimationFrame)
        Object.defineProperty(globalThis, 'cancelAnimationFrame', originalCancelAnimationFrame);
    }
  });

  test('ignoreCancel: true ignores transitioncancel and still waits for transitionend', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'opacity, transform',
          transitionDuration: '150ms, 150ms',
          transitionDelay: '0ms, 0ms',
        });
      }
      return originalGetComputedStyle(target);
    };

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

      // If ignoreCancel regresses, the listener would be active by this point.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
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
