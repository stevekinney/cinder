import { describe, expect, test } from 'bun:test';
import { flushSync } from 'svelte';
import { createChangeTrackerFixture } from './reactive-utilities-test-fixture.svelte.ts';
import { useReducedMotion } from './use-reduced-motion.svelte.ts';

describe('reactive editor utilities', () => {
  test('change tracker reports clean and changed content synchronously', () => {
    const { tracker, dispose } = createChangeTrackerFixture();

    try {
      tracker.setBaseline('Original content.');
      tracker.setCurrent('Original content.');
      flushSync();
      expect(tracker.hasChanges).toBe(false);

      tracker.setCurrent('Updated content.');
      flushSync();
      expect(tracker.hasChanges).toBe(true);
      expect(tracker.verifyNow()).toBe(true);
    } finally {
      dispose();
    }
  });

  test('reduced-motion watcher is false when no browser media query is available', () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });

    try {
      expect(useReducedMotion().current).toBe(false);
    } finally {
      if (previousWindow) {
        Object.defineProperty(globalThis, 'window', previousWindow);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }
  });
});
