/**
 * Tier boundaries of the diff controller. "Size" is the larger input's
 * `string.length` (UTF-16 code units) and both thresholds are inclusive.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import { installFakeClock } from '../../test/fake-clock.js';
import { mountDiffController } from './diff-controller-test-helpers.svelte.ts';
import type { DiffControllerOptions } from './diff-controller.svelte.ts';

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

async function mount(text: string, options?: DiffControllerOptions) {
  const { controller, dispose } = await mountDiffController('', text, options);
  cleanups.push(dispose);
  return controller;
}

describe('createDiffController tier boundaries (default thresholds)', () => {
  test.each([
    [19_999, 'realtime'],
    [20_000, 'debounced'],
    [99_999, 'debounced'],
    [100_000, 'manual'],
  ] as const)('a %d-unit document is in the %s tier', async (length, tier) => {
    const controller = await mount('a'.repeat(length));
    expect(controller.state.documentSize).toBe(length);
    expect(controller.state.tier).toBe(tier);
  });

  test('exactly at the manual threshold is gated: stale, not computed', async () => {
    const controller = await mount('a'.repeat(100_000));
    expect(controller.state.isStale).toBe(true);
    expect(controller.state.diffs).toEqual([]);
    expect(controller.state.warning).toContain('manual trigger');
  });

  test('one unit below the manual threshold is debounced, not gated', async () => {
    const controller = await mount('a'.repeat(99_999));
    expect(controller.state.warning).toContain('debounced');
    expect(controller.state.diffs).toEqual([]);
  });
});

describe('createDiffController gating after the debounce fires', () => {
  const small = { manualThreshold: 10, debouncedThreshold: 5, debounceMs: 0 };
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
  };

  test('a document at the manual threshold is never computed on its own', async () => {
    const controller = await mount('a'.repeat(10), small);
    await settle();
    expect(controller.state.isStale).toBe(true);
    expect(controller.state.diffs).toEqual([]);
  });

  test('a document at the debounced threshold waits for the debounce instead of computing at once', async () => {
    const clock = installFakeClock();
    try {
      const controller = await mount('a'.repeat(5), { ...small, debounceMs: 50 });
      expect(controller.state.isStale).toBe(true);
      expect(controller.state.diffs).toEqual([]);
      clock.advance(50);
      await tick();
      expect(controller.state.isStale).toBe(false);
      expect(controller.state.diffs.length).toBeGreaterThan(0);
    } finally {
      clock.restore();
    }
  });

  test('a document one unit below the manual threshold is computed after the debounce', async () => {
    const controller = await mount('a'.repeat(9), small);
    await settle();
    expect(controller.state.isStale).toBe(false);
    expect(controller.state.diffs.length).toBeGreaterThan(0);
  });
});

describe('createDiffController real-time tier', () => {
  test('just below the debounced threshold computes in real time with no warning', async () => {
    const controller = await mount('a'.repeat(19_999));
    expect(controller.state.warning).toBeNull();
    expect(controller.state.isStale).toBe(false);
    expect(controller.state.diffs.length).toBeGreaterThan(0);
  });
});

describe('createDiffController size unit', () => {
  test('measures UTF-16 code units, not encoded bytes', async () => {
    // 'é' is 2 UTF-8 bytes but 1 code unit: 9 of them are 18 bytes, length 9.
    const belowByLength = await mount('é'.repeat(9), {
      manualThreshold: 10,
      debouncedThreshold: 5,
    });
    expect(belowByLength.state.documentSize).toBe(9);
    expect(belowByLength.state.tier).toBe('debounced');

    const atByLength = await mount('é'.repeat(10), { manualThreshold: 10, debouncedThreshold: 5 });
    expect(atByLength.state.tier).toBe('manual');
  });
});
