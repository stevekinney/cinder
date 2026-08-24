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

function createTransitionCancelEvent(propertyName: string): Event {
  const event = new Event('transitioncancel');
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
