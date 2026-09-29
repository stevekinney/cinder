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
import { overflowFade } from './attachments.ts';
setupHappyDom();
setupAttachmentTests();

describe('overflowFade', () => {
  test('sets data-cinder-overflows when content extends below the visible area', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160 });

    overflowFade()(node);

    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);
  });

  test('removes data-cinder-overflows when content fits', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160 });

    overflowFade()(node);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });
    FakeResizeObserver.instances[0]?.trigger();
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
  });

  test('removes data-cinder-overflows when scrolled to the bottom', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160, scrollTop: 0 });

    overflowFade()(node);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160, scrollTop: 60 });
    node.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
  });

  test('updates when mutations change scrollHeight without resizing the container', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });

    overflowFade()(node);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 140 });
    FakeMutationObserver.instances[0]?.trigger();
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);
  });

  test('only the container itself is registered with ResizeObserver — never its descendants', () => {
    // Perf regression guard: the earlier implementation additionally
    // registered every descendant (node.querySelectorAll('*')), which
    // registers thousands of observers on a long scroll surface such as a
    // chat timeline. Only `node` should ever be observed now — content
    // changes are caught by the MutationObserver above instead (see the
    // "updates when mutations change scrollHeight" test just above, which
    // covers that path without any ResizeObserver trigger at all).
    const node = document.createElement('div');
    const child = document.createElement('div');
    node.appendChild(child);
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });

    overflowFade()(node);

    expect(FakeResizeObserver.instances[0]?.observedElements).toEqual([node]);
  });

  test('clears stale state and exits when ResizeObserver is unavailable', () => {
    const node = document.createElement('div');
    node.setAttribute('data-cinder-overflows', '');
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: undefined });
    try {
      const cleanup = overflowFade()(node);

      expect(cleanup).toBeUndefined();
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
    } finally {
      restoreGlobal('ResizeObserver', resizeObserverDescriptor);
    }
  });

  test('cleanup disconnects observers and removes pending scroll updates', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160 });

    const cleanup = overflowFade()(node);
    expect(typeof cleanup).toBe('function');

    FakeResizeObserver.instances[0]?.trigger();
    expect(animationFrameCallbacks.size).toBe(1);

    cleanup?.();
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
    expect(FakeMutationObserver.instances[0]?.disconnected).toBe(true);
    expect(animationFrameCallbacks.size).toBe(0);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });
    node.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);
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
      const cleanup = overflowFade()(node);
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160 });
      node.dispatchEvent(new Event('scroll'));

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });
      node.dispatchEvent(new Event('scroll'));
      cleanup?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);
    } finally {
      restoreGlobal('requestAnimationFrame', requestAnimationFrameDescriptor);
      restoreGlobal('cancelAnimationFrame', cancelAnimationFrameDescriptor);
    }
  });
});
