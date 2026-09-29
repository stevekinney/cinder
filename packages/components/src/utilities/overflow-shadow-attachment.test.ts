/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import {
  FakeMutationObserver,
  FakeResizeObserver,
  flushAnimationFrames,
  restoreGlobal,
  setScrollMeasurements,
  setupAttachmentTests,
} from './attachments-test-support.ts';
import { overflowShadow } from './attachments.ts';
setupHappyDom();
setupAttachmentTests();

describe('overflowShadow', () => {
  test('inline axis: marks data-cinder-overflows-inline from scrollWidth/clientWidth, ignoring scroll position', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, {
      clientHeight: 0,
      scrollHeight: 0,
      clientWidth: 100,
      scrollWidth: 100,
    });

    overflowShadow('inline')(node);
    expect(node.hasAttribute('data-cinder-overflows-inline')).toBe(false);

    setScrollMeasurements(node, {
      clientHeight: 0,
      scrollHeight: 0,
      clientWidth: 100,
      scrollWidth: 240,
      scrollLeft: 0,
    });
    FakeResizeObserver.instances[0]?.trigger();
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-inline')).toBe(true);

    // Unlike overflowFade, this stays true regardless of scroll position — it
    // backs a static both-edges shadow, not a position-aware fade.
    setScrollMeasurements(node, {
      clientHeight: 0,
      scrollHeight: 0,
      clientWidth: 100,
      scrollWidth: 240,
      scrollLeft: 140,
    });
    node.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-inline')).toBe(true);
  });

  test('block axis: marks data-cinder-overflows-block from scrollHeight/clientHeight', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 200, scrollHeight: 200 });

    overflowShadow('block')(node);
    expect(node.hasAttribute('data-cinder-overflows-block')).toBe(false);

    setScrollMeasurements(node, { clientHeight: 200, scrollHeight: 500 });
    FakeResizeObserver.instances[0]?.trigger();
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-block')).toBe(true);
  });

  test('does not attach a scroll listener — not scroll-position-aware', () => {
    const node = document.createElement('div');
    const addEventListenerCalls: string[] = [];
    const originalAddEventListener = node.addEventListener.bind(node);
    node.addEventListener = ((type: string, ...rest: unknown[]) => {
      addEventListenerCalls.push(type);
      // @ts-expect-error — forwarding a variadic spy call
      return originalAddEventListener(type, ...rest);
    }) as typeof node.addEventListener;

    overflowShadow('inline')(node);
    expect(addEventListenerCalls).not.toContain('scroll');
  });

  test('clears the attribute and exits when ResizeObserver is unavailable', () => {
    const node = document.createElement('div');
    node.setAttribute('data-cinder-overflows-inline', '');
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: undefined });
    try {
      const cleanup = overflowShadow('inline')(node);

      expect(cleanup).toBeUndefined();
      expect(node.hasAttribute('data-cinder-overflows-inline')).toBe(false);
    } finally {
      restoreGlobal('ResizeObserver', resizeObserverDescriptor);
    }
  });

  test('teardown disconnects observers', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, {
      clientHeight: 0,
      scrollHeight: 0,
      clientWidth: 100,
      scrollWidth: 100,
    });

    const cleanup = overflowShadow('inline')(node);
    if (typeof cleanup !== 'function') throw new Error('Expected attachment cleanup');
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(false);

    cleanup();
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
    expect(FakeMutationObserver.instances[0]?.disconnected).toBe(true);
  });

  test('falls back to timeout scheduling when animation frames are unavailable', async () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });
    const requestAnimationFrameDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'requestAnimationFrame',
    );
    const cancelAnimationFrameDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'cancelAnimationFrame',
    );
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: undefined,
    });
    try {
      const cleanup = overflowShadow('block')(node);
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160 });
      FakeResizeObserver.instances[0]?.trigger();

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(node.hasAttribute('data-cinder-overflows-block')).toBe(true);

      // Schedule another pending fallback timer, then tear down WHILE it is
      // still pending — this is what exercises the fallback's own
      // `cancelAnimationFrame` substitute (`window.clearTimeout`), which the
      // await above already let run to completion once.
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });
      FakeResizeObserver.instances[0]?.trigger();
      cleanup?.();
    } finally {
      restoreGlobal('requestAnimationFrame', requestAnimationFrameDescriptor);
      restoreGlobal('cancelAnimationFrame', cancelAnimationFrameDescriptor);
    }
  });
});
