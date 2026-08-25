/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { waitForTransitionCompletion } from './transition-completion.ts';

setupHappyDom();

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

      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(completionCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('a transitioncancel on a tracked property completes immediately by default', () => {
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

      element.dispatchEvent(createTransitionCancelEvent('opacity'));
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
