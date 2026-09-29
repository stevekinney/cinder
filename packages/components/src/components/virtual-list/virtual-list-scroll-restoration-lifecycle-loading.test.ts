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

  test('keeps a saved position when the list mounts empty while its data loads', async () => {
    // A list that fetches its own data always renders empty first. Treating that as
    // "the collection shrank" deleted the entry, so such a list could never restore.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({ scrollOffset: 4_000, startIndex: 200 }),
    });

    await withStorage(storage, async () => {
      render(VirtualList, {
        items: [],
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });
      await tick();
      await tick();
      expect(storage.entries.has('cinder:virtual-list:feed')).toBe(true);
    });
  });

  test('restores once the asynchronously loaded items arrive', async () => {
    // The list that most needs restoring is the one that fetches its own data, and
    // its first render is always empty. Restoring strictly on mount would mean it
    // never restores at all.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({ scrollOffset: 4_000, startIndex: 200 }),
    });

    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: localMakeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      const { container, rerender } = render(VirtualList, props(0));
      await tick();

      // The fetch lands.
      await rerender(props(1_000));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('still saves on teardown after the list has grown', async () => {
    // An $effect cleanup runs on INVALIDATION as well as teardown. With the saver
    // folded into an effect that tracks the item count, the first append ran the
    // cleanup and then re-ran the effect — which, already having restored, returned
    // early and registered no new cleanup. From then on nothing saved at all.
    const storage = createStorage();
    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: localMakeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      const { container, rerender, unmount } = render(VirtualList, props(1_000));
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
      list.scrollTop = 4_000;
      await fireEvent.scroll(list);
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );

      // The list grows, which is what invalidated the effect.
      await rerender(props(1_010));
      await tick();

      unmount();
      await tick();

      const raw = storage.entries.get('cinder:virtual-list:feed');
      expect(raw).toBeDefined();
      expect(JSON.parse(raw ?? '').startIndex).toBe(200);
    });
  });

  test('a changed id is a new collection to restore', async () => {
    // A parent reusing this component for a different collection changes the id.
    // An instance-wide "already restored" flag would suppress the new restore.
    const storage = createStorage({
      'cinder:virtual-list:second': JSON.stringify({ scrollOffset: 4_000, startIndex: 200 }),
    });

    await withStorage(storage, async () => {
      const props = (id: string) => ({
        items: localMakeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: id,
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      const { container, rerender } = render(VirtualList, props('first'));
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

      await rerender(props('second'));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('finds the anchor by key after the collection grew at the front', async () => {
    // The list was unmounted while a feed received older messages. Every index moved;
    // no row did. An index-only anchor restores several rows off.
    const buildItems = (count: number, offset: number) => {
      if (!localScopeMarker) return [];
      return Array.from({ length: count }, (_, index) => ({ id: `key-${index - offset}` }));
    };

    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
        anchorKey: 'key-200',
      }),
    });

    await withStorage(storage, async () => {
      // 50 older rows arrived, so `key-200` now lives at index 250.
      const { container } = render(VirtualList, {
        items: buildItems(1_050, 50),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (item: unknown) => itemId(item),
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '250')).toBe(true),
      );
      expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(false);
    });
  });

  test('restores a fixed-size list from its row anchor, not the stale pixel offset', async () => {
    // `itemHeight` can differ between visits — a density setting, a responsive
    // breakpoint. The saved pixel offset then points at a different row entirely.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
      }),
    });

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: localMakeItems(1_000),
        // Half the height the position was saved at.
        itemHeight: 10,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      // Row 200, not the row at pixel 4000 (which is now row 400).
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('a pending restore outranks the initial reverse pin and the edge callbacks', async () => {
    // Both assume the list opens where it renders, and a restore is about to move it
    // somewhere else.
    //
    // The `onStartReached` half is what this test pins: without its guard the callback
    // fires because the list rendered at offset 0 for one frame. The reverse-pin half
    // currently holds by effect ordering alone — restoration runs after the pin and
    // overwrites it — so the guard there is defensive, and removing it does NOT fail
    // this test. It is kept so the intent survives a reordering.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
      }),
    });
    let startReachedCount = 0;

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: localMakeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        reverse: true,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (_item: unknown, index: number) => `row-${index}`,
        onStartReached: () => {
          startReachedCount += 1;
        },
        row: localRowSnippet(),
        'aria-label': 'Transcript',
      });

      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
      // Not pinned to the newest message.
      expect(renderedRows(container).some((node) => node.dataset['index'] === '999')).toBe(false);
      expect(startReachedCount).toBe(0);
    });
  });

  test('waits for an incrementally loaded page to reach the saved row', async () => {
    // A feed that loads page by page has a first non-empty render that does not
    // reach the saved anchor yet. Treating that as "the row was deleted" would
    // abandon the position before the page carrying it ever arrived.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
      }),
    });

    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: localMakeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: localRowSnippet(),
        'aria-label': 'Feed',
      });

      // First page: 50 rows, nowhere near index 200.
      const { container, rerender } = render(VirtualList, props(50));
      await tick();
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true);

      // The page carrying the anchor arrives.
      await rerender(props(1_000));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });
});
