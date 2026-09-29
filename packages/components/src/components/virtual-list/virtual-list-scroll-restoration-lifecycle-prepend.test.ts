/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { itemId, makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

function createStorage(seed?: Record<string, string>) {
  const entries = new Map<string, string>(Object.entries(seed ?? {}));
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

function withStorage(storage: unknown, run: () => Promise<void>) {
  const original = globalThis.sessionStorage;
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true });
  return run().finally(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: original,
      configurable: true,
    });
  });
}

describe('VirtualList — scrollRestoration lifecycle', () => {
  const localRowSnippet = rowSnippet;
  const localMakeItems = makeItems;
  const localScopeMarker = true;

  test('lets pagination run while it waits for the restoration anchor', async () => {
    // The deadlock these two features can form: restoration suppresses the edge
    // callbacks so a half-rendered list does not fetch spuriously, but the edge
    // callbacks are exactly what loads the page carrying the saved anchor. Suppress
    // them while WAITING and nothing ever loads, so nothing ever restores.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
      }),
    });
    let endReachedCount = 0;

    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: localMakeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 2,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        onEndReached: () => {
          endReachedCount += 1;
        },
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      // A first page far short of the anchor, with its end already in view.
      const { container, rerender } = render(VirtualList, props(12));
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

      // The consumer must be asked for more, or the anchor never arrives.
      await waitFor(() => expect(endReachedCount).toBeGreaterThan(0));

      await rerender(props(1_000));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('restores the saved row when it arrives in a PREPENDED page', async () => {
    // The saved row usually arrives in a page of older history, and a prepend queues
    // its own correction to hold the pre-prepend viewport. That correction is applied
    // by a later effect, so without retiring it the reader lands back on the row they
    // were watching while loading rather than the one they left off at.
    //
    // The keys must form a genuine prepend — the previous sequence a SUFFIX of the
    // next — or the growth classifies as `replaced` and queues no correction at all,
    // which is what an earlier version of this test accidentally exercised.
    const buildItems = (count: number, offset: number) => {
      if (!localScopeMarker) return [];
      return Array.from({ length: count }, (_, index) => ({ id: `key-${index - offset}` }));
    };

    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 100,
        startIndex: 5,
        offsetWithinRow: 0,
        anchorKey: 'key--25',
      }),
    });

    await withStorage(storage, async () => {
      const props = (count: number, offset: number) => ({
        items: buildItems(count, offset),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (item: unknown) => itemId(item),
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      // key-0 .. key-19. The saved `key--25` is not here yet.
      const { container, rerender } = render(VirtualList, props(20, 0));
      await tick();

      // 30 older rows arrive at the front: key--30 .. key-19. The previous sequence
      // is now the suffix, so this is a true prepend, and `key--25` sits at index 5.
      await rerender(props(50, 30));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '5')).toBe(true),
      );
      // Not held at the pre-prepend view, where key-0 now lives at index 30.
      expect(renderedRows(container).some((node) => node.dataset['index'] === '30')).toBe(false);
    });
  });

  test('lets an empty list fetch its first page while restoration is configured', async () => {
    // The deadlock at the other end: an empty list has nothing to restore onto, and
    // the restore effect returns before recording an attempt — so suppressing the
    // edge callbacks here means a list that fetches its FIRST page from them never
    // loads anything, and restoration never becomes possible.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 100,
        startIndex: 5,
        offsetWithinRow: 0,
      }),
    });
    let endReachedCount = 0;

    await withStorage(storage, async () => {
      render(VirtualList, {
        items: [],
        itemHeight: 20,
        height: '200px',
        overscan: 2,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        onEndReached: () => {
          endReachedCount += 1;
        },
        onStartReached: () => {
          endReachedCount += 1;
        },
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      await tick();
      await tick();
      // An empty list reports no edges at all, so nothing fires — but crucially the
      // suppression is not what stopped it, so a list that renders one row can page.
      expect(endReachedCount).toBe(0);
    });
  });

  test('a restore overrides the append pin that armed while its page loaded', async () => {
    // Under `reverse`, a page arriving with the anchor also arms the append pin, whose
    // effect scrolls to the maximum offset a tick later — after the restore landed.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 100,
        startIndex: 5,
        offsetWithinRow: 0,
        anchorKey: 'row-5',
      }),
    });

    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: localMakeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        reverse: true,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (_item: unknown, index: number) => `row-${index}`,
        row: localRowSnippet(),
        'aria-label': 'Transcript',
      });

      const { container, rerender } = render(VirtualList, props(0));
      await tick();

      await rerender(props(200));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '5')).toBe(true),
      );
      // Not yanked to the newest message by the pin the append armed.
      expect(renderedRows(container).some((node) => node.dataset['index'] === '199')).toBe(false);
    });
  });

  test('keeps a remainder that no longer fits inside its own row', async () => {
    // 30px into a 40px row, restored when rows are 20px tall. An inclusive clamp
    // gives exactly 20 — which is row 201's start, not row 200's.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 8_030,
        startIndex: 200,
        offsetWithinRow: 30,
      }),
    });

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: localMakeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
      // Row 200 starts at 4000; anything from 4019 up would be row 201.
      expect(list.scrollTop).toBeGreaterThanOrEqual(4_000);
      expect(list.scrollTop).toBeLessThan(4_020);
    });
  });

  test('a whitespace-only id is not an id', async () => {
    const storage = createStorage();
    await withStorage(storage, async () => {
      const { container, unmount } = render(VirtualList, {
        items: localMakeItems(200),
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        scrollRestorationId: '   ',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      unmount();
      await tick();
      expect(storage.entries.size).toBe(0);
    });
  });

  test('saves the row the reader is on, not the overscanned window boundary', async () => {
    // `virtualWindow.startIndex` carries overscan, so saving it would restore the
    // reader a few rows above where they left off — every single time.
    const storage = createStorage();
    await withStorage(storage, async () => {
      const { container, unmount } = render(VirtualList, {
        items: localMakeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 5,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
      list.scrollTop = 4_000;
      await fireEvent.scroll(list);
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );

      unmount();
      await tick();

      const raw = storage.entries.get('cinder:virtual-list:feed');
      expect(raw).toBeDefined();
      expect(JSON.parse(raw ?? '').startIndex).toBe(200);
    });
  });
});
