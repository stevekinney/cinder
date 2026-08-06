/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { useDragScroll } from './use-drag-scroll.svelte.ts';

setupHappyDom();

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

let animationFrameCallbacks = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;
let frameNow = 0;

function flushOneFrame(): void {
  frameNow += 16;
  const callbacks = Array.from(animationFrameCallbacks.values());
  animationFrameCallbacks.clear();
  for (const callback of callbacks) callback(frameNow);
}

function flushUntilSettled(maxFrames = 500): void {
  for (let i = 0; i < maxFrames && animationFrameCallbacks.size > 0; i++) {
    flushOneFrame();
  }
}

beforeEach(() => {
  animationFrameCallbacks = new Map();
  nextAnimationFrameId = 1;
  frameNow = 0;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextAnimationFrameId;
    nextAnimationFrameId += 1;
    animationFrameCallbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    animationFrameCallbacks.delete(id);
  };
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  document.body.innerHTML = '';
});

function createNode(): HTMLElement {
  const node = document.createElement('div');
  document.body.appendChild(node);
  Object.defineProperty(node, 'scrollTo', { configurable: true, value: jest.fn() });
  Object.defineProperty(node, 'scrollLeft', { configurable: true, value: 0, writable: true });
  Object.defineProperty(node, 'clientWidth', { configurable: true, value: 300 });
  return node;
}

function createVerticalNode(): HTMLElement {
  const node = document.createElement('div');
  document.body.appendChild(node);
  Object.defineProperty(node, 'scrollTo', { configurable: true, value: jest.fn() });
  Object.defineProperty(node, 'scrollTop', { configurable: true, value: 0, writable: true });
  Object.defineProperty(node, 'clientHeight', { configurable: true, value: 300 });
  return node;
}

function pointerEvent(
  type: string,
  init: {
    pointerId?: number;
    pointerType?: string;
    clientX?: number;
    clientY?: number;
    movementX?: number;
    movementY?: number;
  },
): PointerEvent {
  return new PointerEvent(type, {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'mouse',
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    movementX: init.movementX ?? 0,
    movementY: init.movementY ?? 0,
    bubbles: true,
    cancelable: true,
  });
}

describe('useDragScroll', () => {
  test('ignores touch and pen pointers — they already pan the native scroller', () => {
    const node = createNode();
    const cleanup = useDragScroll()(node);
    node.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch', clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: 50, movementX: 50 }));
    expect(node.hasAttribute('data-cinder-dragging')).toBe(false);
    cleanup?.();
  });

  test('does not attach any drag state when enabled() returns false', () => {
    const node = createNode();
    const cleanup = useDragScroll({ enabled: () => false })(node);
    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: 50, movementX: 50 }));
    expect(node.hasAttribute('data-cinder-dragging')).toBe(false);
    cleanup?.();
  });

  test('does not mark dragging until the pointer moves past the 10px threshold', () => {
    const node = createNode();
    const cleanup = useDragScroll()(node);
    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: 5, movementX: 5 }));
    expect(node.hasAttribute('data-cinder-dragging')).toBe(false);
    node.dispatchEvent(pointerEvent('pointermove', { clientX: 12, movementX: 7 }));
    expect(node.hasAttribute('data-cinder-dragging')).toBe(true);
    cleanup?.();
  });

  test('stashes and restores scroll-snap-type around a drag', () => {
    const node = createNode();
    node.style.scrollSnapType = 'x mandatory';
    const cleanup = useDragScroll()(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    expect(node.style.scrollSnapType).toBe('none');

    node.dispatchEvent(pointerEvent('pointermove', { clientX: 20, movementX: 20 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: 20 }));
    flushUntilSettled();

    expect(node.style.scrollSnapType).toBe('x mandatory');
    cleanup?.();
  });

  test('restores scroll-snap-type immediately for a click that never crosses the drag threshold', () => {
    const node = createNode();
    node.style.scrollSnapType = 'x mandatory';
    const cleanup = useDragScroll()(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: 0 }));

    expect(node.style.scrollSnapType).toBe('x mandatory');
    expect(node.hasAttribute('data-cinder-dragging')).toBe(false);
    cleanup?.();
  });

  test('suppresses the click that follows a real drag, past threshold', () => {
    const node = createNode();
    const cleanup = useDragScroll()(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: 20, movementX: 20 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: 20 }));

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    node.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);

    flushUntilSettled();
    cleanup?.();
  });

  test('does not suppress an ordinary click that never dragged', () => {
    const node = createNode();
    const cleanup = useDragScroll()(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: 0 }));

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    node.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    cleanup?.();
  });

  test('settles and calls onSettle after a released drag decays to rest', () => {
    const node = createNode();
    const onSettle = jest.fn();
    const cleanup = useDragScroll({ onSettle })(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: 20, movementX: 20 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: 20 }));

    flushUntilSettled();

    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(node.hasAttribute('data-cinder-dragging')).toBe(false);
    cleanup?.();
  });

  test('snaps to the nearest supplied snap position on release', () => {
    const node = createNode();
    const scrollTo = node.scrollTo as ReturnType<typeof jest.fn>;
    const cleanup = useDragScroll({ getSnapPositions: () => [0, 300, 600] })(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    // A single synthetic move (unlike many small real pointermove events)
    // concentrates the whole 250px delta into one frame's velocity, so the
    // decay-projected coast distance (velocity * friction / (1 - friction),
    // ~19x at this engine's friction) lands far past all three candidates —
    // 300 is 250 units away from the drag's raw endpoint, 600 only 350
    // further beyond a projection multiple times that size, so 600 is
    // unambiguously nearest.
    node.dispatchEvent(pointerEvent('pointermove', { clientX: -250, movementX: -250 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: -250 }));

    flushUntilSettled();

    const finalCallArgs = scrollTo.mock.calls.at(-1)?.[0] as { left: number };
    expect(finalCallArgs.left).toBeCloseTo(600, 0);
    cleanup?.();
  });

  test('coasts to a natural stop without snapping when no snap positions are supplied', () => {
    const node = createNode();
    const scrollTo = node.scrollTo as ReturnType<typeof jest.fn>;
    const cleanup = useDragScroll()(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: -50, movementX: -50 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: -50 }));

    flushUntilSettled();

    // Coasts to wherever momentum carries it — just confirm it actually moved
    // and stopped calling scrollTo once settled.
    expect(scrollTo).toHaveBeenCalled();
    const callCountAtSettle = scrollTo.mock.calls.length;
    flushUntilSettled();
    expect(scrollTo.mock.calls.length).toBe(callCountAtSettle);
    cleanup?.();
  });

  test('proximity snap mode does not snap when released far from a snap position', () => {
    const node = createNode();
    const scrollTo = node.scrollTo as ReturnType<typeof jest.fn>;
    // A -50px move projects to a natural coast of ~1000 (friction 0.95).
    // Neither candidate is within a third of the 300px snapport (100px) of
    // that projection, so proximity mode must leave the natural coast alone.
    const cleanup = useDragScroll({
      snapMode: 'proximity',
      getSnapPositions: () => [0, 5000],
    })(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: -50, movementX: -50 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: -50 }));

    flushUntilSettled();

    const finalCallArgs = scrollTo.mock.calls.at(-1)?.[0] as { left: number };
    expect(finalCallArgs.left).toBeCloseTo(1000, 0);
    cleanup?.();
  });

  test("axis: 'y' drag-scrolls scrollTop instead of scrollLeft — for ScrollArea's vertical direction", () => {
    const node = createVerticalNode();
    const scrollTo = node.scrollTo as ReturnType<typeof jest.fn>;
    const cleanup = useDragScroll({ axis: 'y' })(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientY: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientY: 20, movementY: 20 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientY: 20 }));

    flushUntilSettled();

    const calls = scrollTo.mock.calls as unknown as { 0: { top?: number; left?: number } }[];
    expect(calls.length).toBeGreaterThan(0);
    // Every call moves `top`, never `left` — this is a vertical drag.
    expect(calls.every((call) => 'top' in call[0] && !('left' in call[0]))).toBe(true);
    cleanup?.();
  });

  test('cleanup removes listeners so a later pointerdown has no effect', () => {
    const node = createNode();
    const cleanup = useDragScroll()(node);
    cleanup?.();

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: 50, movementX: 50 }));
    expect(node.hasAttribute('data-cinder-dragging')).toBe(false);
  });

  test('falls back to scrollLeft assignment when scrollTo is unavailable', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);
    Object.defineProperty(node, 'clientWidth', { configurable: true, value: 300 });
    // No scrollTo defined — happy-dom's default `HTMLElement.scrollTo` (if
    // present) is removed to force the fallback branch.
    Object.defineProperty(node, 'scrollTo', { configurable: true, value: undefined });
    const cleanup = useDragScroll()(node);

    node.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
    node.dispatchEvent(pointerEvent('pointermove', { clientX: 20, movementX: 20 }));
    node.dispatchEvent(pointerEvent('pointerup', { clientX: 20 }));

    flushUntilSettled();

    expect(node.scrollLeft).not.toBe(0);
    cleanup?.();
  });
});
