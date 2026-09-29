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
  test('waits for all tracked transition properties before completing', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'translate, opacity',
          transitionDuration: '100ms, 200ms',
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

      element.dispatchEvent(createTransitionEndEvent('translate'));
      expect(completionCount).toBe(0);

      element.dispatchEvent(createTransitionEndEvent('opacity'));
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
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'opacity, transform, width',
          transitionDuration: '100ms, 0ms',
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
    window.getComputedStyle = (target: Element) => {
      if (target === element) {
        return Object.assign(document.createElement('div').style, {
          transitionProperty: 'all',
          transitionDuration: '100ms',
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

      element.dispatchEvent(createTransitionEndEvent('opacity'));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
});
