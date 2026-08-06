import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import {
  flushOverflowFadeAnimationFrames,
  installOverflowFadeTestEnvironment,
  OverflowFadeResizeObserver,
  setScrollMeasurements,
} from '../test/overflow-fade-test-helpers.ts';

setupHappyDom();

const { overflowFade, overflowShadow, overflowFadeEdges } = await import('./attachments.ts');

describe('overflowFade', () => {
  test('marks and clears data-cinder-overflows from real scroll measurements', () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFade()(node);

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160, scrollTop: 0 });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160, scrollTop: 60 });
      node.dispatchEvent(new Event('scroll'));
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

      (teardown as () => void)();
    } finally {
      cleanup();
    }
  });

  test('a mutation on the subtree (e.g. new content) schedules a re-measure without a per-descendant ResizeObserver', async () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFade()(node);

      // Only `node` itself is registered — the perf-refactored implementation
      // no longer fans out a ResizeObserver to every descendant.
      expect(OverflowFadeResizeObserver.instances.length).toBe(1);
      expect(OverflowFadeResizeObserver.instances[0]?.observedElements).toEqual([node]);

      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100, scrollTop: 0 });
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

      // Simulate new content arriving (e.g. a chat message) growing scrollHeight,
      // without touching ResizeObserver at all — the MutationObserver alone
      // must schedule the re-measure. MutationObserver callbacks fire on the
      // microtask queue, so a real mutation needs a tick to drain before its
      // scheduled rAF callback exists to flush.
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
      const child = document.createElement('span');
      node.appendChild(child);
      await new Promise((resolve) => setTimeout(resolve, 0));
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      (teardown as () => void)();
    } finally {
      cleanup();
    }
  });

  test('teardown disconnects observers and removes the scroll listener', () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFade()(node) as () => void;
      const instance = OverflowFadeResizeObserver.instances[0];
      expect(instance?.disconnected).toBe(false);

      teardown();
      expect(instance?.disconnected).toBe(true);
    } finally {
      cleanup();
    }
  });
});

describe('overflowShadow', () => {
  test('inline axis: marks data-cinder-overflows-inline from scrollWidth/clientWidth, ignores scroll position', () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowShadow('inline')(node) as () => void;

      setScrollMeasurements(node, {
        clientHeight: 0,
        scrollHeight: 0,
        clientWidth: 100,
        scrollWidth: 100,
      });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows-inline')).toBe(false);

      setScrollMeasurements(node, {
        clientHeight: 0,
        scrollHeight: 0,
        clientWidth: 100,
        scrollWidth: 240,
      });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      // Unlike overflowFade, this stays true regardless of scroll position —
      // it backs a static both-edges shadow, not a position-aware fade.
      expect(node.hasAttribute('data-cinder-overflows-inline')).toBe(true);

      teardown();
    } finally {
      cleanup();
    }
  });

  test('block axis: marks data-cinder-overflows-block from scrollHeight/clientHeight', () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowShadow('block')(node) as () => void;

      setScrollMeasurements(node, { clientHeight: 200, scrollHeight: 200 });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows-block')).toBe(false);

      setScrollMeasurements(node, { clientHeight: 200, scrollHeight: 500 });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows-block')).toBe(true);

      teardown();
    } finally {
      cleanup();
    }
  });

  test('does not attach a scroll listener (not scroll-position-aware)', () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const addEventListenerCalls: string[] = [];
      const originalAddEventListener = node.addEventListener.bind(node);
      node.addEventListener = ((type: string, ...rest: unknown[]) => {
        addEventListenerCalls.push(type);
        // @ts-expect-error — forwarding a variadic spy call
        return originalAddEventListener(type, ...rest);
      }) as typeof node.addEventListener;

      const teardown = overflowShadow('inline')(node) as () => void;
      expect(addEventListenerCalls).not.toContain('scroll');
      teardown();
    } finally {
      cleanup();
    }
  });
});

describe('overflowFadeEdges', () => {
  test('block axis: reports the start edge and end edge independently as scroll position changes', () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFadeEdges('block')(node) as () => void;

      // At the very top: no start fade (nothing above), but an end fade
      // (more below) since content overflows.
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(false);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      // Scrolled to the middle: both edges fade.
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 100 });
      node.dispatchEvent(new Event('scroll'));
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(true);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

      // Scrolled to the very bottom: start fade only, no end fade.
      setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 300, scrollTop: 200 });
      node.dispatchEvent(new Event('scroll'));
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(true);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

      teardown();
    } finally {
      cleanup();
    }
  });

  test('inline axis: reports data-cinder-overflows-inline-start / -inline-end from scrollLeft', () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFadeEdges('inline')(node) as () => void;

      setScrollMeasurements(node, {
        clientHeight: 0,
        scrollHeight: 0,
        clientWidth: 100,
        scrollWidth: 300,
        scrollLeft: 0,
      });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
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
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows-inline-start')).toBe(true);
      expect(node.hasAttribute('data-cinder-overflows-inline-end')).toBe(false);

      teardown();
    } finally {
      cleanup();
    }
  });

  test('a non-overflowing container never sets either attribute', () => {
    const cleanup = installOverflowFadeTestEnvironment();
    try {
      const node = document.createElement('div');
      const teardown = overflowFadeEdges('block')(node) as () => void;

      setScrollMeasurements(node, { clientHeight: 200, scrollHeight: 200, scrollTop: 0 });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(node.hasAttribute('data-cinder-overflows-start')).toBe(false);
      expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

      teardown();
    } finally {
      cleanup();
    }
  });
});
