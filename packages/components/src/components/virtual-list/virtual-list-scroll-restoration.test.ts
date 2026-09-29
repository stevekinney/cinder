/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

function createStorage() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
}

describe('VirtualList — scrollRestoration', () => {
  const localRowSnippet = rowSnippet;
  const localMakeItems = makeItems;

  test('writes nothing without an id, because an implicit key would collide', async () => {
    const storage = createStorage();
    const originalSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: storage,
      configurable: true,
    });

    try {
      const { container, unmount } = render(VirtualList, {
        items: localMakeItems(500),
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      unmount();
      await tick();
      expect(storage.entries.size).toBe(0);
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      });
    }
  });

  test('saves on teardown and restores on the next mount', async () => {
    const storage = createStorage();
    const originalSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: storage,
      configurable: true,
    });

    const props = () => ({
      items: localMakeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      scrollRestoration: true,
      scrollRestorationId: 'feed',
      row: localRowSnippet(),
      'aria-label': 'Feed',
    });

    try {
      const first = render(VirtualList, props());
      await waitFor(() => expect(renderedRows(first.container).length).toBeGreaterThan(0));
      const list = requiredInstance(
        first.container.querySelector('.cinder-virtual-list'),
        HTMLElement,
      );
      list.scrollTop = 4_000;
      await fireEvent.scroll(list);
      await waitFor(() =>
        expect(renderedRows(first.container).some((node) => node.dataset['index'] === '200')).toBe(
          true,
        ),
      );

      first.unmount();
      await tick();
      expect(storage.entries.size).toBe(1);

      const second = render(VirtualList, props());
      await waitFor(() => expect(renderedRows(second.container).length).toBeGreaterThan(0));
      await waitFor(() =>
        expect(renderedRows(second.container).some((node) => node.dataset['index'] === '200')).toBe(
          true,
        ),
      );
      expect(renderedRows(second.container).some((node) => node.dataset['index'] === '0')).toBe(
        false,
      );
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      });
    }
  });

  test('does not apply a saved position whose row no longer exists', async () => {
    // The collection shrank between visits. The saved row is simply not restored —
    // clamping into range would drop the reader somewhere arbitrary and then re-save
    // that as though it were their place. The entry itself is left alone: nothing
    // reads it, and teardown overwrites it with the reader's real position. Deleting
    // it mattered only back when a missing anchor got clamped rather than skipped.
    const storage = createStorage();
    storage.setItem(
      'cinder:virtual-list:feed',
      JSON.stringify({ scrollOffset: 4_000, startIndex: 200 }),
    );
    const originalSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: storage,
      configurable: true,
    });

    try {
      const { container } = render(VirtualList, {
        items: localMakeItems(10),
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      });
    }
  });

  test('a storage that throws on every access does not break the list', async () => {
    // Safari in private browsing throws on access, not only on write.
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const originalSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: hostile,
      configurable: true,
    });

    try {
      const { container, unmount } = render(VirtualList, {
        items: localMakeItems(500),
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      expect(() => unmount()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      });
    }
  });
});
