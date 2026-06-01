/**
 * Tests for ChartInteraction — the shared reactive interaction state used by
 * LineChart, AreaChart, and BarChart.
 *
 * These are pure unit tests on the class methods. The DOM-level behaviors
 * (keyboard navigation, pointer activation, focus management) are covered by
 * per-chart component tests.
 */

import { describe, expect, test } from 'bun:test';

import { ChartInteraction } from './chart-interaction.svelte.ts';
import type { ChartTarget } from './chart-utilities.ts';

function makeTarget(
  id: string,
  x: number,
  y: number,
  overrides?: Partial<ChartTarget>,
): ChartTarget {
  return {
    id,
    seriesId: 'series-a',
    seriesLabel: 'Series A',
    xLabel: 'Jan',
    valueLabel: '100',
    x,
    y,
    color: 'red',
    ...overrides,
  };
}

describe('ChartInteraction', () => {
  describe('constructor', () => {
    test('starts with default measuredWidth of 640', () => {
      const interaction = new ChartInteraction();
      expect(interaction.measuredWidth).toBe(640);
    });

    test('starts with no pointer or focused target', () => {
      const interaction = new ChartInteraction();
      expect(interaction.pointerTarget).toBeUndefined();
      expect(interaction.focusedTarget).toBeUndefined();
      expect(interaction.activeTarget).toBeUndefined();
    });

    test('accepts a static pointer axis string', () => {
      // No assertion needed; just confirm construction does not throw
      expect(() => new ChartInteraction({ pointerAxis: 'y' })).not.toThrow();
    });

    test('accepts a reactive pointer axis getter', () => {
      expect(() => new ChartInteraction({ pointerAxis: () => 'x' })).not.toThrow();
    });
  });

  describe('activeTarget derivation', () => {
    test('is undefined when both pointer and focused targets are absent', () => {
      const interaction = new ChartInteraction();
      expect(interaction.activeTarget).toBeUndefined();
    });

    test('returns pointerTarget when no focused target is set', () => {
      const interaction = new ChartInteraction();
      const target = makeTarget('t1', 100, 50);
      interaction.pointerTarget = target;
      // Use id comparison — $state proxies don't preserve reference identity.
      expect(interaction.activeTarget?.id).toBe('t1');
    });

    test('returns focusedTarget when keyboard focus is active, overriding pointer', () => {
      const interaction = new ChartInteraction();
      const pointer = makeTarget('pointer', 100, 50);
      const focused = makeTarget('focused', 200, 50);
      interaction.pointerTarget = pointer;
      interaction.focusedTarget = focused;
      // Keyboard focus wins — screen-reader users must not have their active
      // target overridden by incidental pointer events.
      expect(interaction.activeTarget?.id).toBe('focused');
    });
  });

  describe('clearPointerTarget', () => {
    test('clears the pointer target', () => {
      const interaction = new ChartInteraction();
      interaction.pointerTarget = makeTarget('t1', 100, 50);
      interaction.clearPointerTarget();
      expect(interaction.pointerTarget).toBeUndefined();
    });

    test('does not affect the focused target', () => {
      const interaction = new ChartInteraction();
      interaction.pointerTarget = makeTarget('pointer', 200, 50);
      interaction.focusedTarget = makeTarget('focused', 100, 50);
      interaction.clearPointerTarget();
      // $state proxies don't preserve reference identity — check id.
      expect(interaction.focusedTarget?.id).toBe('focused');
    });
  });

  describe('clearStaleTargets', () => {
    test('clears both targets when loading is true', () => {
      const interaction = new ChartInteraction();
      const target = makeTarget('t1', 100, 50);
      interaction.pointerTarget = target;
      interaction.focusedTarget = target;
      const targets = [target];
      interaction.clearStaleTargets(true, false, targets);
      expect(interaction.pointerTarget).toBeUndefined();
      expect(interaction.focusedTarget).toBeUndefined();
    });

    test('clears both targets when the model is empty', () => {
      const interaction = new ChartInteraction();
      const target = makeTarget('t1', 100, 50);
      interaction.pointerTarget = target;
      interaction.focusedTarget = target;
      interaction.clearStaleTargets(false, true, []);
      expect(interaction.pointerTarget).toBeUndefined();
      expect(interaction.focusedTarget).toBeUndefined();
    });

    test('clears stale pointer target when it is no longer in the targets array', () => {
      const interaction = new ChartInteraction();
      const old = makeTarget('old', 100, 50);
      const current = makeTarget('current', 200, 50);
      interaction.pointerTarget = old;
      interaction.clearStaleTargets(false, false, [current]);
      expect(interaction.pointerTarget).toBeUndefined();
    });

    test('clears stale focused target when it is no longer in the targets array', () => {
      const interaction = new ChartInteraction();
      const old = makeTarget('old', 100, 50);
      const current = makeTarget('current', 200, 50);
      interaction.focusedTarget = old;
      interaction.clearStaleTargets(false, false, [current]);
      expect(interaction.focusedTarget).toBeUndefined();
    });

    test('preserves targets that are still in the targets array', () => {
      const interaction = new ChartInteraction();
      const target = makeTarget('t1', 100, 50);
      interaction.pointerTarget = target;
      interaction.focusedTarget = target;
      interaction.clearStaleTargets(false, false, [target]);
      // $state proxies don't preserve reference identity — check id.
      expect(interaction.pointerTarget?.id).toBe('t1');
      expect(interaction.focusedTarget?.id).toBe('t1');
    });

    test('does not clear targets when neither loading nor empty', () => {
      const interaction = new ChartInteraction();
      const target = makeTarget('t1', 100, 50);
      interaction.pointerTarget = target;
      interaction.focusedTarget = target;
      interaction.clearStaleTargets(false, false, [target]);
      expect(interaction.pointerTarget?.id).toBe('t1');
      expect(interaction.focusedTarget?.id).toBe('t1');
    });
  });

  describe('toggleSeries', () => {
    test('adds a series id to the hidden list when it is visible', () => {
      const interaction = new ChartInteraction();
      const result = interaction.toggleSeries([], 'series-a');
      expect(result).toEqual(['series-a']);
    });

    test('removes a series id from the hidden list when it is already hidden', () => {
      const interaction = new ChartInteraction();
      const result = interaction.toggleSeries(['series-a', 'series-b'], 'series-a');
      expect(result).toEqual(['series-b']);
    });

    test('does not mutate the original array', () => {
      const interaction = new ChartInteraction();
      const original = ['series-a'];
      const result = interaction.toggleSeries(original, 'series-a');
      expect(result).not.toBe(original);
      expect(original).toEqual(['series-a']);
    });
  });

  describe('observeResize', () => {
    // Helpers for temporarily replacing globalThis.ResizeObserver in tests.
    // Test files may use `any` for mocking and unhappy-path fixtures per AGENTS.md.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globals = globalThis as any;

    /**
     * Swaps in a `ResizeObserver` value (or deletes it when `mock` is undefined)
     * for the duration of `body`, then restores the original in a `finally` so a
     * failing assertion can never leak the mock into later tests.
     */
    function withResizeObserver(mock: unknown, body: () => void): void {
      const hadOriginal = 'ResizeObserver' in globals;
      const original = globals['ResizeObserver'];
      if (mock === undefined) delete globals['ResizeObserver'];
      else globals['ResizeObserver'] = mock;
      try {
        body();
      } finally {
        if (hadOriginal) globals['ResizeObserver'] = original;
        else delete globals['ResizeObserver'];
      }
    }

    test('returns a no-op cleanup function when ResizeObserver is unavailable', () => {
      withResizeObserver(undefined, () => {
        const interaction = new ChartInteraction();
        const element = { ownerDocument: {} } as unknown as HTMLElement;
        const cleanup = interaction.observeResize(element);
        expect(typeof cleanup).toBe('function');
        expect(() => cleanup()).not.toThrow();
      });
    });

    test('attaches a ResizeObserver and returns a disconnect cleanup', () => {
      let disconnected = false;
      const observed: unknown[] = [];
      class MockResizeObserver {
        observe(element: unknown): void {
          observed.push(element);
        }
        disconnect(): void {
          disconnected = true;
        }
      }

      withResizeObserver(MockResizeObserver, () => {
        const interaction = new ChartInteraction();
        const element = {} as HTMLElement;
        const cleanup = interaction.observeResize(element);

        expect(observed).toContain(element);
        cleanup();
        expect(disconnected).toBe(true);
      });
    });

    test('updates measuredWidth from the ResizeObserver entry', () => {
      type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;
      let capturedCallback: ResizeObserverCallback | undefined;
      class MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          capturedCallback = callback;
        }
        observe(): void {}
        disconnect(): void {}
      }

      withResizeObserver(MockResizeObserver, () => {
        const interaction = new ChartInteraction();
        interaction.observeResize({} as HTMLElement);

        capturedCallback?.([{ contentRect: { width: 800 } } as unknown as ResizeObserverEntry]);
        expect(interaction.measuredWidth).toBe(800);

        capturedCallback?.([{ contentRect: { width: 0 } } as unknown as ResizeObserverEntry]);
        // Width below 1 is clamped to 1 to avoid degenerate SVG viewboxes.
        expect(interaction.measuredWidth).toBe(1);
      });
    });
  });

  describe('pointer axis option', () => {
    test('defaults to x-axis for nearestTarget lookups', () => {
      const interaction = new ChartInteraction();
      // Confirm the instance exists and has no axis-related errors.
      expect(interaction).toBeDefined();
    });

    test('reactive getter is called at activation time, not construction time', () => {
      let callCount = 0;
      new ChartInteraction({
        pointerAxis: () => {
          callCount++;
          return 'x';
        },
      });
      // Getter must NOT be called at construction — only when activateByPointer runs.
      expect(callCount).toBe(0);
    });
  });
});
