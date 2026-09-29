/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import {
  instrumentScrollTop,
  makeItems,
  renderedRows,
  rowSnippet,
} from './virtual-list-test-helpers.ts';

import type { VirtualListRef } from './virtual-list.types.ts';

setupHappyDom();

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

/** Restores whatever `window.innerHeight` was before a test overrides it. */
function withInnerHeight(value: number): () => void {
  const original = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  Object.defineProperty(window, 'innerHeight', { configurable: true, value });
  return () => {
    if (original) Object.defineProperty(window, 'innerHeight', original);
  };
}

/**
 * `windowScroll`'s document-offset remeasurement is batched onto an animation
 * frame (`scheduleWindowMeasurement`, see `frame-scheduler.ts`) rather than
 * applied synchronously by the resize listener — deliberately, so it never
 * forces a layout read on the listener's own turn. Tests that trigger a
 * resize have to wait for that frame, not just a Svelte `tick()`.
 */
function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.requestAnimationFrame(() => resolve());
  });
}

describe('VirtualList — windowScroll', () => {
  const localRowSnippet = rowSnippet;
  const localMakeItems = makeItems;

  afterEach(() => {
    // Every test that touches window.scrollY leaves it wherever it landed;
    // happy-dom's Window persists across tests in this file otherwise.
    window.scrollTo(0, 0);
  });

  test('defaults to false and leaves the internal scroll container untouched', async () => {
    const { container } = render(VirtualList, {
      items: localMakeItems(500),
      itemHeight: 20,
      height: '200px',
      row: localRowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    expect(list.hasAttribute('data-cinder-window-scroll')).toBe(false);
    expect(list.style.getPropertyValue('--cinder-virtual-list-height')).toBe('200px');

    // The internal container still drives the window from its own scrollTop —
    // the refactor that shares scroll-offset handling with windowScroll must not
    // have redirected this path to the window.
    list.scrollTop = 400;
    list.dispatchEvent(new Event('scroll'));
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '20')).toBe(true),
    );
  });

  test('renders no scrolling container of its own and ignores height', async () => {
    const restoreInnerHeight = withInnerHeight(1_000);
    try {
      const { container } = render(VirtualList, {
        items: localMakeItems(5_000),
        itemHeight: 20,
        height: '50px',
        windowScroll: true,
        overscan: 0,
        row: localRowSnippet(),
        'aria-label': 'Events',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

      expect(list.getAttribute('data-cinder-window-scroll')).toBe('true');
      // `height` plays no part under this mode: the custom property it would
      // normally drive is not written at all.
      expect(list.style.getPropertyValue('--cinder-virtual-list-height')).toBe('');

      // A 50px `height` would render at most a handful of 20px rows. The viewport
      // actually used is window.innerHeight (mocked to 1000px above), so ignoring
      // `height` is observable in how many rows mount, not just in the missing
      // custom property.
      expect(renderedRows(container).length).toBeGreaterThan(20);
    } finally {
      restoreInnerHeight();
    }
  });

  test('window scroll events drive the rendered window', async () => {
    const restoreInnerHeight = withInnerHeight(200);
    try {
      const { container } = render(VirtualList, {
        items: localMakeItems(5_000),
        itemHeight: 20,
        windowScroll: true,
        overscan: 0,
        row: localRowSnippet(),
        'aria-label': 'Events',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true);

      // The list starts at the top of the (unmocked, zero-rect) page in this test,
      // so the window's own scroll position IS the list's scroll offset.
      window.scrollTo(0, 2_000);
      window.dispatchEvent(new Event('scroll'));

      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '100')).toBe(true),
      );
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(false);
    } finally {
      restoreInnerHeight();
    }
  });

  test('measures the viewport from window.innerHeight and responds to resize', async () => {
    const restoreInnerHeight = withInnerHeight(100);
    try {
      const { container } = render(VirtualList, {
        items: localMakeItems(5_000),
        itemHeight: 20,
        windowScroll: true,
        overscan: 0,
        row: localRowSnippet(),
        'aria-label': 'Events',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const shortViewportCount = renderedRows(container).length;

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1_000 });
      window.dispatchEvent(new Event('resize'));

      // The remeasurement is batched onto an animation frame (see
      // `scheduleWindowMeasurement`), not applied synchronously by the resize
      // listener, so this has to wait rather than assert immediately.
      await waitFor(() =>
        expect(renderedRows(container).length).toBeGreaterThan(shortViewportCount),
      );
    } finally {
      restoreInnerHeight();
    }
  });

  test("windows relative to the list's own offset when it starts below other content", async () => {
    const restoreInnerHeight = withInnerHeight(200);
    try {
      const { container } = render(VirtualList, {
        items: localMakeItems(5_000),
        itemHeight: 20,
        windowScroll: true,
        overscan: 0,
        row: localRowSnippet(),
        'aria-label': 'Events',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

      // Simulate 500px of page content above the list: the next re-measurement
      // (window resize, which this test triggers directly) reads this rect.
      list.getBoundingClientRect = () => new DOMRect(0, 500, list.clientWidth || 100, 100);
      window.dispatchEvent(new Event('resize'));
      await nextAnimationFrame();
      await tick();

      // Scroll exactly to the list's own top edge. If the document offset were
      // ignored, this would read as 700px into the list instead of 0.
      window.scrollTo(0, 500);
      window.dispatchEvent(new Event('scroll'));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true),
      );

      // 200px further scrolls exactly 200px into the list — row 10 at 20px each —
      // not row 35, which is what `scrollY` alone (700 / 20) would say.
      window.scrollTo(0, 700);
      window.dispatchEvent(new Event('scroll'));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '10')).toBe(true),
      );
      expect(renderedRows(container).some((node) => node.dataset['index'] === '35')).toBe(false);
    } finally {
      restoreInnerHeight();
    }
  });

  test('picks up content above the list changing size without any resize', async () => {
    // An image loading or an accordion collapsing above the list moves its top
    // edge without resizing the window or the list's own box, so neither resize
    // path fires. The scroll that follows has to notice the move on its own.
    const restoreInnerHeight = withInnerHeight(200);
    try {
      const { container } = render(VirtualList, {
        items: localMakeItems(5_000),
        itemHeight: 20,
        windowScroll: true,
        overscan: 0,
        row: localRowSnippet(),
        'aria-label': 'Events',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

      // 500px of content appears above the list. The rect is viewport-relative,
      // so it moves up as the window scrolls.
      list.getBoundingClientRect = () =>
        new DOMRect(0, 500 - window.scrollY, list.clientWidth || 100, 100);

      window.scrollTo(0, 700);
      window.dispatchEvent(new Event('scroll'));
      await nextAnimationFrame();
      await tick();

      // 200px into the list — row 10 — not row 35, which a stale zero offset
      // would read from `scrollY` alone.
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '10')).toBe(true),
      );
      expect(renderedRows(container).some((node) => node.dataset['index'] === '35')).toBe(false);
    } finally {
      restoreInnerHeight();
    }
  });

  test('scrollToIndex scrolls the window rather than the internal container', async () => {
    let listRef: VirtualListRef | undefined;
    const restoreInnerHeight = withInnerHeight(200);
    try {
      const { container } = render(VirtualList, {
        items: localMakeItems(5_000),
        itemHeight: 20,
        windowScroll: true,
        overscan: 0,
        row: localRowSnippet(),
        'aria-label': 'Events',
        get ref() {
          return listRef;
        },
        set ref(next: VirtualListRef | undefined) {
          listRef = next;
        },
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
      const scrollTopTracker = instrumentScrollTop(list);

      listRef?.scrollToIndex(200, { align: 'start' });
      await tick();

      expect(window.scrollY).toBeGreaterThan(0);
      // Never the internal element: there is no scroll container to write to.
      expect(scrollTopTracker.writes()).toBe(0);
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    } finally {
      restoreInnerHeight();
    }
  });

  test('removes the window listeners on teardown', async () => {
    const originalAddEventListener = window.addEventListener.bind(window);
    const originalRemoveEventListener = window.removeEventListener.bind(window);
    const addedTypes: string[] = [];
    const removedTypes: string[] = [];
    const handlersByType = new Map<string, EventListenerOrEventListenerObject>();

    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'scroll' || type === 'resize') {
        addedTypes.push(type);
        handlersByType.set(type, listener);
      }
      return originalAddEventListener(type, listener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      if ((type === 'scroll' || type === 'resize') && handlersByType.get(type) === listener) {
        removedTypes.push(type);
      }
      return originalRemoveEventListener(type, listener, options);
    }) as typeof window.removeEventListener;

    try {
      const { container, unmount } = render(VirtualList, {
        items: localMakeItems(500),
        itemHeight: 20,
        windowScroll: true,
        overscan: 0,
        row: localRowSnippet(),
        'aria-label': 'Events',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      expect(addedTypes).toContain('scroll');
      expect(addedTypes).toContain('resize');

      unmount();

      expect(removedTypes).toContain('scroll');
      expect(removedTypes).toContain('resize');
    } finally {
      window.addEventListener = originalAddEventListener;
      window.removeEventListener = originalRemoveEventListener;
    }
  });
});
