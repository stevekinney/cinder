/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { overflowFadeEdges } = await import('./overflow-fade-edges.ts');

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly callback: ResizeObserverCallback;
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(target: Element): void {
    const index = this.observed.indexOf(target);
    if (index >= 0) this.observed.splice(index, 1);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

let frameCallbacks = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

function installFakeEnvironment(): () => void {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  FakeResizeObserver.instances = [];
  frameCallbacks = new Map();
  nextFrameId = 1;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    frameCallbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frameCallbacks.delete(id);
  };

  return () => {
    globalThis.ResizeObserver = originalResizeObserver;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    FakeResizeObserver.instances = [];
    frameCallbacks.clear();
  };
}

function flushFrames(): void {
  const callbacks = Array.from(frameCallbacks.values());
  frameCallbacks.clear();
  for (const callback of callbacks) callback(performance.now());
}

function setScrollMeasurements(
  node: HTMLElement,
  measurements: { clientHeight: number; scrollHeight: number; scrollTop?: number },
): void {
  Object.defineProperty(node, 'clientHeight', {
    configurable: true,
    value: measurements.clientHeight,
  });
  Object.defineProperty(node, 'scrollHeight', {
    configurable: true,
    value: measurements.scrollHeight,
  });
  Object.defineProperty(node, 'scrollTop', {
    configurable: true,
    value: measurements.scrollTop ?? 0,
    writable: true,
  });
}

describe('overflowFadeEdges (chat local copy)', () => {
  test('reports the start and end edges independently as scroll position changes', () => {
    const cleanup = installFakeEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFadeEdges()(node) as () => void;

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
      FakeResizeObserver.instances[0]?.trigger();
      flushFrames();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(false);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 100 });
      node.dispatchEvent(new Event('scroll'));
      flushFrames();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(true);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 200 });
      node.dispatchEvent(new Event('scroll'));
      flushFrames();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(true);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

      teardown();
    } finally {
      cleanup();
    }
  });

  test('a non-overflowing container never sets either attribute', () => {
    const cleanup = installFakeEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFadeEdges()(node) as () => void;

      setScrollMeasurements(node, { clientHeight: 200, scrollHeight: 200, scrollTop: 0 });
      FakeResizeObserver.instances[0]?.trigger();
      flushFrames();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(false);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

      teardown();
    } finally {
      cleanup();
    }
  });

  test('coalesces rapid updates into a single pending animation frame', () => {
    const cleanup = installFakeEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFadeEdges()(node) as () => void;

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
      // Two scroll events back-to-back before the frame flushes: the second
      // scheduleUpdate() call must be a no-op (frame already pending) rather
      // than queuing a second frame.
      node.dispatchEvent(new Event('scroll'));
      node.dispatchEvent(new Event('scroll'));
      expect(frameCallbacks.size).toBe(1);

      flushFrames();
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      teardown();
    } finally {
      cleanup();
    }
  });

  test('teardown cancels a pending frame, disconnects observers, and removes the scroll listener', () => {
    const cleanup = installFakeEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFadeEdges()(node) as () => void;
      const instance = FakeResizeObserver.instances[0];
      expect(instance?.disconnected).toBe(false);

      // Schedule a frame that teardown must cancel before it ever fires.
      node.dispatchEvent(new Event('scroll'));
      expect(frameCallbacks.size).toBe(1);

      teardown();
      expect(frameCallbacks.size).toBe(0);
      expect(instance?.disconnected).toBe(true);

      // The scroll listener was removed — dispatching again must not throw
      // or schedule a new frame.
      node.dispatchEvent(new Event('scroll'));
      expect(frameCallbacks.size).toBe(0);
    } finally {
      cleanup();
    }
  });

  test('falls back to setTimeout-based frame scheduling when requestAnimationFrame/cancelAnimationFrame are unavailable', async () => {
    const cleanup = installFakeEnvironment();
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    // @ts-expect-error — simulating an environment without rAF/cAF, forcing
    // the window.setTimeout/clearTimeout fallback closures to run.
    delete globalThis.requestAnimationFrame;
    // @ts-expect-error — see above
    delete globalThis.cancelAnimationFrame;
    try {
      const node = document.createElement('div');
      const teardown = overflowFadeEdges()(node) as () => void;

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
      node.dispatchEvent(new Event('scroll'));
      // The fallback schedules via a real window.setTimeout — let it actually
      // fire (covers the nested `() => callback(performance.now())` closure).
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      // Exercise the cancelFrame fallback too: teardown while a fallback
      // timer is still pending.
      node.dispatchEvent(new Event('scroll'));
      teardown();
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
      cleanup();
    }
  });

  test('without ResizeObserver support, clears both attributes and returns undefined (no teardown needed)', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    // @ts-expect-error — simulating an environment without ResizeObserver
    delete globalThis.ResizeObserver;
    try {
      const node = document.createElement('div');
      node.setAttribute('data-cinder-overflows-start', '');
      node.setAttribute('data-cinder-overflows', '');

      const teardown = overflowFadeEdges()(node);

      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(false);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
      expect(teardown).toBeUndefined();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });
});
