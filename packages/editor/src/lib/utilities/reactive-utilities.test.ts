import { describe, expect, test } from 'bun:test';
import { flushSync } from 'svelte';
// `$effect.root` is a rune, and plain test files are not compiled by the
// Svelte plugin. The rune compiles to this untyped runtime primitive.
// @ts-expect-error -- untyped internal entry point
import { effect_root as untypedEffectRoot } from 'svelte/internal/client';
import { createChangeTracker } from './change-tracker.svelte.ts';
import { useReducedMotion } from './use-reduced-motion.svelte.ts';

const effectRoot = untypedEffectRoot as (run: () => void) => () => void;

describe('reactive editor utilities', () => {
  test('change tracker reports clean and changed content synchronously', () => {
    let tracker: ReturnType<typeof createChangeTracker> | undefined;
    const destroyRoot = effectRoot(() => {
      tracker = createChangeTracker();
    });

    try {
      if (!tracker) throw new Error('Change tracker did not initialize.');
      tracker.setBaseline('Original content.');
      tracker.setCurrent('Original content.');
      flushSync();
      expect(tracker.hasChanges).toBe(false);

      tracker.setCurrent('Updated content.');
      flushSync();
      expect(tracker.hasChanges).toBe(true);
      expect(tracker.verifyNow()).toBe(true);
    } finally {
      tracker?.destroy();
      destroyRoot();
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
