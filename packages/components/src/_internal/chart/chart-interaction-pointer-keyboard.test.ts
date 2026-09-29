import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { makeTarget } from './chart-interaction-test-target.ts';
import { ChartInteraction } from './chart-interaction.svelte.ts';
setupHappyDom();
afterEach(() => {
  document.body.replaceChildren();
});
function keydownWithCurrentTarget(key: string, currentTarget: Element): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  Object.defineProperty(event, 'currentTarget', { value: currentTarget });
  return event;
}
describe('ChartInteraction', () => {
  describe('pointer axis option', () => {
    test('defaults to x-axis for nearestTarget lookups', () => {
      const interaction = new ChartInteraction();
      const hitSurface = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hitSurface.getBoundingClientRect = () => new DOMRect(10, 20, 200, 100);
      const event = new PointerEvent('pointermove', {
        clientX: 105,
        clientY: 20,
      });
      Object.defineProperty(event, 'currentTarget', { value: hitSurface });

      interaction.activateByPointer(event, [
        makeTarget('first', 0, 100),
        makeTarget('second', 100, 0),
      ]);

      expect(interaction.pointerTarget?.id).toBe('second');
    });

    test('reactive getter is called at activation time, not construction time', () => {
      let callCount = 0;
      const interaction = new ChartInteraction({
        pointerAxis: () => {
          callCount++;
          return 'y';
        },
      });
      // Getter must NOT be called at construction — only when activateByPointer runs.
      expect(callCount).toBe(0);

      const hitSurface = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hitSurface.getBoundingClientRect = () => new DOMRect(0, 0, 100, 200);
      const event = new PointerEvent('pointermove', {
        clientX: 0,
        clientY: 95,
      });
      Object.defineProperty(event, 'currentTarget', { value: hitSurface });

      interaction.activateByPointer(event, [
        makeTarget('first', 100, 0),
        makeTarget('second', 0, 100),
      ]);

      expect(callCount).toBe(1);
      expect(interaction.pointerTarget?.id).toBe('second');
    });
  });

  describe('keyboard and focus targeting', () => {
    test('focusDomTarget focuses the element matching the target id', () => {
      const interaction = new ChartInteraction();
      const root = document.createElement('div');
      const target = document.createElement('button');
      target.setAttribute('data-cinder-target-id', 'point-a');
      root.append(target);
      document.body.append(root);

      interaction.focusDomTarget(root, 'point-a');

      expect(document.activeElement).toBe(target);
    });

    test('activateByKeyboard advances, jumps, and clears the focused target', () => {
      const interaction = new ChartInteraction();
      const root = document.createElement('div');
      const firstElement = document.createElement('button');
      const secondElement = document.createElement('button');
      firstElement.setAttribute('data-cinder-target-id', 'first');
      secondElement.setAttribute('data-cinder-target-id', 'second');
      root.append(firstElement, secondElement);
      document.body.append(root);
      const targets = [makeTarget('first', 0, 0), makeTarget('second', 100, 0)];

      const arrowRight = keydownWithCurrentTarget('ArrowRight', firstElement);
      interaction.activateByKeyboard(arrowRight, root, targets, true);
      expect(arrowRight.defaultPrevented).toBe(true);
      expect(interaction.focusedTarget?.id).toBe('second');
      expect(document.activeElement).toBe(secondElement);

      const home = keydownWithCurrentTarget('Home', secondElement);
      interaction.activateByKeyboard(home, root, targets, true);
      expect(interaction.focusedTarget?.id).toBe('first');
      expect(document.activeElement).toBe(firstElement);

      const escape = keydownWithCurrentTarget('Escape', firstElement);
      interaction.activateByKeyboard(escape, root, targets, true);
      expect(escape.defaultPrevented).toBe(true);
      expect(interaction.focusedTarget).toBeUndefined();
    });

    test('activateByKeyboard ignores disabled keyboard navigation and unrelated keys', () => {
      const interaction = new ChartInteraction();
      const root = document.createElement('div');
      const current = document.createElement('button');
      current.setAttribute('data-cinder-target-id', 'first');
      root.append(current);
      document.body.append(root);
      const targets = [makeTarget('first', 0, 0), makeTarget('second', 100, 0)];

      const disabledEvent = keydownWithCurrentTarget('ArrowRight', current);
      interaction.activateByKeyboard(disabledEvent, root, targets, false);
      expect(disabledEvent.defaultPrevented).toBe(false);
      expect(interaction.focusedTarget).toBeUndefined();

      const letterEvent = keydownWithCurrentTarget('a', current);
      interaction.activateByKeyboard(letterEvent, root, targets, true);
      expect(letterEvent.defaultPrevented).toBe(false);
      expect(interaction.focusedTarget).toBeUndefined();
    });
  });
});
