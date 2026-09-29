import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { makeTarget } from './chart-interaction-test-target.ts';
import { ChartInteraction } from './chart-interaction.svelte.ts';
setupHappyDom();
afterEach(() => {
  document.body.replaceChildren();
});
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

    test('rebinds a stable target id to the latest geometry and value', () => {
      const interaction = new ChartInteraction();
      interaction.focusedTarget = makeTarget('t1', 100, 50, { valueLabel: '100' });
      const updated = makeTarget('t1', 140, 25, { valueLabel: '125' });

      interaction.clearStaleTargets(false, false, [updated]);

      expect(interaction.focusedTarget).toMatchObject({
        id: 't1',
        x: 140,
        y: 25,
        valueLabel: '125',
      });
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
});
