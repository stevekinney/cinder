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
});
