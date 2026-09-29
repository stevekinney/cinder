/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import {
  animationFrameCallbacks,
  FakeMutationObserver,
  FakeResizeObserver,
  flushAnimationFrames,
  restoreGlobal,
  setScrollMeasurements,
  setupAttachmentTests,
} from './attachments-test-support.ts';
import { overflowFadeEdges } from './attachments.ts';
setupHappyDom();
setupAttachmentTests();

describe('overflowFadeEdges', () => {
  test('block axis: reports the start edge and end edge independently as scroll position changes', () => {
    const node = document.createElement('div');

    overflowFadeEdges('block')(node);

    // At the very top: no start fade (nothing above), but an end fade (more
    // below) since content overflows.
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
    FakeResizeObserver.instances[0]?.trigger();
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-start')).toBe(false);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

    // Scrolled to the middle: both edges fade.
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 100 });
    node.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-start')).toBe(true);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

    // Scrolled to the very bottom: start fade only, no end fade.
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 200 });
    node.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-start')).toBe(true);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
  });

  test('inline axis: reports data-cinder-overflows-inline-start / -inline-end from scrollLeft', () => {
    const node = document.createElement('div');

    overflowFadeEdges('inline')(node);

    setScrollMeasurements(node, {
      clientHeight: 0,
      scrollHeight: 0,
      clientWidth: 100,
      scrollWidth: 300,
      scrollLeft: 0,
    });
    FakeResizeObserver.instances[0]?.trigger();
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-inline-start')).toBe(false);
    expect(node.hasAttribute('data-cinder-overflows-inline-end')).toBe(true);

    setScrollMeasurements(node, {
      clientHeight: 0,
      scrollHeight: 0,
      clientWidth: 100,
      scrollWidth: 300,
      scrollLeft: 200,
    });
    node.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-inline-start')).toBe(true);
    expect(node.hasAttribute('data-cinder-overflows-inline-end')).toBe(false);
  });

  test('a non-overflowing container never sets either attribute', () => {
    const node = document.createElement('div');

    overflowFadeEdges('block')(node);

    setScrollMeasurements(node, { clientHeight: 200, scrollHeight: 200, scrollTop: 0 });
    FakeResizeObserver.instances[0]?.trigger();
    flushAnimationFrames();
    expect(node.hasAttribute('data-cinder-overflows-start')).toBe(false);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
  });

  test('clears both attributes and exits when ResizeObserver is unavailable', () => {
    const node = document.createElement('div');
    node.setAttribute('data-cinder-overflows-start', '');
    node.setAttribute('data-cinder-overflows', '');
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: undefined });
    try {
      const cleanup = overflowFadeEdges('block')(node);

      expect(cleanup).toBeUndefined();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(false);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
    } finally {
      restoreGlobal('ResizeObserver', resizeObserverDescriptor);
    }
  });

  test('teardown disconnects observers and removes the scroll listener', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });

    const cleanup = overflowFadeEdges('block')(node);
    if (typeof cleanup !== 'function') throw new Error('Expected attachment cleanup');
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(false);

    cleanup();
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
    expect(FakeMutationObserver.instances[0]?.disconnected).toBe(true);

    node.dispatchEvent(new Event('scroll'));
    expect(animationFrameCallbacks.size).toBe(0);
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
      const cleanup = overflowFadeEdges('block')(node);
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160, scrollTop: 0 });
      node.dispatchEvent(new Event('scroll'));

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      // Schedule another pending fallback timer, then tear down WHILE it is
      // still pending — this is what exercises the fallback's own
      // `cancelAnimationFrame` substitute (`window.clearTimeout`), which the
      // await above already let run to completion once.
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100, scrollTop: 0 });
      node.dispatchEvent(new Event('scroll'));
      cleanup?.();
    } finally {
      restoreGlobal('requestAnimationFrame', requestAnimationFrameDescriptor);
      restoreGlobal('cancelAnimationFrame', cancelAnimationFrameDescriptor);
    }
  });
});
