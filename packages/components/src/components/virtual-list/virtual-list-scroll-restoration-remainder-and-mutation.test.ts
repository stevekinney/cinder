/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { createMutableItems } from './virtual-list-mutable-items.svelte.ts';
import {
  installFakeResizeObserver,
  keyedItemId,
  keyedRowSnippet,
  makeItems,
  renderedRows,
  reportRowSizes,
  restoreResizeObserver,
  rowSnippet,
  type KeyedItem,
} from './virtual-list-test-helpers.ts';

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

describe('VirtualList — scrollRestoration under dynamicSize', () => {
  afterEach(() => restoreResizeObserver());

  test('re-applies the saved intra-row remainder once the anchor row is measured', async () => {
    // COR-533: the offsets table is all ESTIMATES when the restore effect writes
    // the initial scroll offset, so a saved remainder deeper than the estimate
    // gets clamped away at mount. Once the anchor row is actually measured
    // taller than the estimate, the full remainder must land — not the clamp.
    installFakeResizeObserver();
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_035,
        startIndex: 200,
        // Deeper than the 20px estimate: the mount-time write can only honour
        // 19px of this (0-indexed, strictly inside a 20px row).
        offsetWithinRow: 35,
      }),
    });

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        dynamicSize: true,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

      // Intermediate, observable state: the anchor row is still only the 20px
      // ESTIMATE, so the write at restore time clamps to the row's top rather
      // than the reader's actual 35px remainder.
      expect(list.scrollTop).toBe(4_019);

      // The anchor row measures taller than the estimate.
      reportRowSizes(new Map([[200, 60]]));
      await tick();

      // Settled: the row is now known to be 60px tall, which comfortably holds
      // the full 35px remainder, and the correction pass re-applies it.
      expect(list.scrollTop).toBe(4_035);
    });
  });

  test('a reader who scrolls before the anchor row is measured is not dragged back by it', async () => {
    // The remainder waits for a measurement that can arrive at any time. By then
    // the reader may have scrolled elsewhere themselves, and re-applying the saved
    // position over that would undo their own scroll.
    installFakeResizeObserver();
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_035,
        startIndex: 200,
        offsetWithinRow: 35,
      }),
    });

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        dynamicSize: true,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
      expect(list.scrollTop).toBe(4_019);

      // Still close enough that row 200 stays mounted, so its measurement does
      // arrive — the reader simply is not where the saved remainder points.
      await fireEvent.wheel(list);
      list.scrollTop = 3_950;
      await fireEvent.scroll(list);
      await tick();

      reportRowSizes(new Map([[200, 60]]));
      await tick();

      expect(list.scrollTop).toBe(3_950);
    });
  });

  test('a row measuring no taller than the estimate needs no correction', async () => {
    // Companion to the above: when the saved remainder already fit inside the
    // estimate, there is nothing left to re-apply, and a later measurement of
    // the SAME size must not move the scroll offset at all.
    installFakeResizeObserver();
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_010,
        startIndex: 200,
        offsetWithinRow: 10,
      }),
    });

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        dynamicSize: true,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
      expect(list.scrollTop).toBe(4_010);

      reportRowSizes(new Map([[200, 20]]));
      await tick();

      expect(list.scrollTop).toBe(4_010);
    });
  });
});

describe('VirtualList — scrollRestoration wakes on an in-place items mutation', () => {
  test('a same-length, in-place mutation that introduces the anchor key resolves a pending keyed restore', async () => {
    // COR-533: the restore effect tracks `items.length` and the array's own
    // identity. A consumer mutating an existing (`$state`) array in place —
    // replacing a row without changing the count — moves neither, so a still-
    // missing keyed anchor that mutation just introduced was never looked for
    // again.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 10_005,
        startIndex: 500,
        offsetWithinRow: 5,
        anchorKey: 'key-500',
      }),
    });

    await withStorage(storage, async () => {
      const state = createMutableItems<KeyedItem>(
        Array.from({ length: 1_000 }, (_, index) => ({
          id: index === 500 ? 'placeholder-500' : `key-${index}`,
          label: `Item ${index}`,
        })),
      );

      const { container } = render(VirtualList, {
        items: state.items,
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (item: unknown) => keyedItemId(item),
        row: keyedRowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

      // Still at the top: the anchor key has not appeared in `items` yet, so
      // there is nothing resolvable to restore onto.
      expect(list.scrollTop).toBe(0);
      expect(renderedRows(container).some((node) => node.dataset['id'] === 'key-500')).toBe(false);

      // Same length, same array reference — only the row AT index 500 changes,
      // from a placeholder into the saved anchor.
      state.replaceAt(500, { id: 'key-500', label: 'Item 500' });

      // Resolved: the final offset lands at the anchor's saved position.
      await waitFor(() => expect(list.scrollTop).toBe(10_005));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['id'] === 'key-500')).toBe(true),
      );

      // The anchor key stops being tracked as pending: scrolling elsewhere and
      // mutating an unrelated row again must not jump the reader back. If the
      // restore were still considered pending, this in-place mutation would
      // re-trigger it and clobber the reader's own scroll position.
      list.scrollTop = 200;
      await fireEvent.scroll(list);
      await tick();
      state.replaceAt(10, { id: 'key-10-changed', label: 'Changed' });
      await tick();
      await tick();
      expect(list.scrollTop).toBe(200);
    });
  });

  test('a reader who scrolls while a keyed anchor is missing is not yanked back when it appears', async () => {
    // A keyed restore waits for its anchor rather than giving up when the list
    // stops growing. That wait has to end when the reader takes over, or an anchor
    // arriving minutes later would drag them back to a position they had left.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 10_005,
        startIndex: 500,
        offsetWithinRow: 5,
        anchorKey: 'key-500',
      }),
    });

    await withStorage(storage, async () => {
      const state = createMutableItems<KeyedItem>(
        Array.from({ length: 1_000 }, (_, index) => ({
          id: index === 500 ? 'placeholder-500' : `key-${index}`,
          label: `Item ${index}`,
        })),
      );

      const { container } = render(VirtualList, {
        items: state.items,
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (item: unknown) => keyedItemId(item),
        row: keyedRowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
      expect(list.scrollTop).toBe(0);

      await fireEvent.wheel(list);
      list.scrollTop = 300;
      await fireEvent.scroll(list);
      await tick();

      state.replaceAt(500, { id: 'key-500', label: 'Item 500' });
      await tick();
      await tick();

      expect(list.scrollTop).toBe(300);
    });
  });

  test('a same-length mutation before the array ever changed identity does nothing without a pending keyed restore', async () => {
    // Without `scrollRestoration`, the mutation-watch machinery must stay
    // entirely dormant — an in-place mutation is ordinary reactivity, not
    // something this feature should react to.
    const state = createMutableItems<KeyedItem>(
      Array.from({ length: 50 }, (_, index) => ({ id: `key-${index}`, label: `Item ${index}` })),
    );

    const { container } = render(VirtualList, {
      items: state.items,
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      getKey: (item: unknown) => keyedItemId(item),
      row: keyedRowSnippet(),
      'aria-label': 'Plain list',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    state.replaceAt(2, { id: 'key-2-changed', label: 'Changed' });
    await tick();

    expect(renderedRows(container).some((node) => node.dataset['id'] === 'key-2-changed')).toBe(
      true,
    );
  });
});

describe('VirtualList — dynamicSize measurement pass stays O(1) per row', () => {
  afterEach(() => restoreResizeObserver());

  test('an unchanged items array is not walked a second time on repeated measurements', async () => {
    // COR-533 must not add new O(n) work to the measurement-driven path. Under
    // `dynamicSize`, `buildVirtualOffsets` already rebuilds its cumulative
    // offsets table in full — one O(itemCount) walk — on every measurement;
    // that cost is pre-existing, accepted, and not what this test is about.
    // What must stay guarded is the growth-tracking `$effect.pre`'s OWN key
    // walk on top of that: it only runs when `items` itself changed, and
    // nothing this change adds may revisit every item on every measurement
    // either. Counting every numeric-index read of `items` across several
    // ResizeObserver flushes distinguishes "one walk per flush" (expected)
    // from "two or more" (a broken guard) on a list far larger than any
    // bounded window.
    installFakeResizeObserver();
    const itemCount = 5_000;
    const rounds = 5;
    const source = makeItems(itemCount);
    let indexReads = 0;
    const items = new Proxy(source, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) indexReads += 1;
        return Reflect.get(target, property, receiver);
      },
    });

    const { container } = render(VirtualList, {
      items,
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    // The initial mount legitimately walks the array once (there is nothing to
    // short-circuit against yet). Only growth from HERE is under test.
    indexReads = 0;

    for (let round = 0; round < rounds; round += 1) {
      reportRowSizes(new Map([[round, 20 + round]]));
      await tick();
    }

    // Each flush's single, expected offsets-table rebuild costs exactly
    // `itemCount` reads. A SECOND O(n) walk per flush — the regression this
    // guards against — would push this well past double that; a bounded
    // number of rendered rows' worth of extra reads per flush does not.
    expect(indexReads).toBeLessThan(itemCount * rounds * 1.5);
  });
});
