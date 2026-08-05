/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { TreeAutoscrollController } = await import('./tree-autoscroll.svelte.ts');

function stubScrollElement(rect: { top: number; bottom: number }): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      top: rect.top,
      bottom: rect.bottom,
      left: 0,
      right: 0,
      width: 0,
      height: rect.bottom - rect.top,
      x: 0,
      y: rect.top,
      toJSON: () => ({}),
    }),
  });
  return element;
}

function createController() {
  return new TreeAutoscrollController({
    isPointerDragging: () => true,
    setDropTarget: () => {},
  });
}

/**
 * Captures every scheduled frame without auto-invoking it, so a test can
 * decide exactly when (and how many times) to run the autoscroll callback —
 * running it automatically would recurse indefinitely while the pointer
 * stays within the edge threshold.
 */
function stubRaf(): { calls: FrameRequestCallback[] } {
  const state: { calls: FrameRequestCallback[] } = { calls: [] };
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    state.calls.push(callback);
    return state.calls.length;
  }) as typeof requestAnimationFrame;
  return state;
}

describe('TreeAutoscrollController', () => {
  const originalRaf = globalThis.requestAnimationFrame;

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
  });

  test('keeps scheduling frames while the pointer stays within the edge threshold', () => {
    const raf = stubRaf();
    const controller = createController();
    const scrollElement = stubScrollElement({ top: 0, bottom: 400 });
    scrollElement.scrollTop = 50;

    // 10px from the top edge — inside the 32px threshold, so the callback
    // scrolls (changing scrollTop) and reschedules itself.
    const event = new PointerEvent('pointermove', { clientX: 50, clientY: 10 });
    controller.handlePointerMove(event, scrollElement);

    expect(raf.calls.length).toBe(1);
    raf.calls[0]?.(0);
    expect(raf.calls.length).toBe(2);
  });

  test('stops scheduling frames once the pointer is away from both edges', () => {
    const raf = stubRaf();
    const controller = createController();
    const scrollElement = stubScrollElement({ top: 0, bottom: 400 });
    scrollElement.scrollTop = 50;

    // 200px from the top edge and 200px from the bottom edge — outside the
    // 32px threshold on both sides, so the callback leaves scrollTop
    // unchanged and does not reschedule.
    const event = new PointerEvent('pointermove', { clientX: 50, clientY: 200 });
    controller.handlePointerMove(event, scrollElement);

    expect(raf.calls.length).toBe(1);
    raf.calls[0]?.(0);
    expect(raf.calls.length).toBe(1);
  });
});
