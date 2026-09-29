/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import {
  installFakeResizeObserver,
  keyedItemId,
  keyedRowSnippet,
  makeItems,
  observedRowElements,
  renderedRows,
  reportRowSizes,
  restoreResizeObserver,
  rowSnippet,
} from './virtual-list-test-helpers.ts';

import type { VirtualListRef } from './virtual-list.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — dynamicSize', () => {
  const localRowSnippet = rowSnippet;
  const localMakeItems = makeItems;
  const localScopeMarker = true;

  afterEach(() => restoreResizeObserver());

  test('ref.scrollToIndex clamps an out-of-range index to the list bounds', async () => {
    let listRef: VirtualListRef | undefined;
    const { container } = render(VirtualList, {
      items: localMakeItems(50),
      itemHeight: 20,
      height: '200px',
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

    listRef?.scrollToIndex(9999, { align: 'start' });
    await tick();

    // 50 rows x 20px = 1000px of content in a 200px viewport: 800px is the max.
    expect(list.scrollTop).toBe(800);
  });

  test('exposes the ref while mounted and releases it on unmount', async () => {
    let listRef: VirtualListRef | undefined;
    const view = render(VirtualList, {
      items: localMakeItems(10),
      itemHeight: 20,
      height: '200px',
      row: localRowSnippet(),
      'aria-label': 'Events',
      get ref() {
        return listRef;
      },
      set ref(next: VirtualListRef | undefined) {
        listRef = next;
      },
    });

    await waitFor(() => expect(listRef).toBeDefined());
    expect(typeof listRef?.scrollToIndex).toBe('function');

    view.unmount();
    await tick();
    expect(listRef).toBeUndefined();
  });

  test('starts observing already-mounted rows when dynamicSize flips on at runtime', async () => {
    // `observeRow` is a single stable function reference so rows are not
    // re-observed every render. That only works if Svelte re-runs the attachment
    // when the `dynamicSize` it reads changes — if it does not, flipping the prop
    // would leave every already-mounted row permanently unmeasured.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: localMakeItems(100),
      itemHeight: 20,
      height: '200px',
      row: localRowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(view.container).length).toBeGreaterThan(0));
    expect(observedRowElements()).toHaveLength(0);

    await view.rerender({
      items: localMakeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: localRowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(observedRowElements().length).toBe(renderedRows(view.container).length);
  });

  test('stops observing rows when dynamicSize flips back off', async () => {
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: localMakeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: localRowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(observedRowElements().length).toBeGreaterThan(0));

    await view.rerender({
      items: localMakeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: false,
      row: localRowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(observedRowElements()).toHaveLength(0);
  });

  test('records a row that measures to zero height instead of discarding it', async () => {
    // A row can legitimately collapse to nothing. Rejecting the measurement would
    // leave the offsets table reserving space it no longer occupies, shifting
    // every later offset and scroll target until it grew again.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: localMakeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: localRowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const spacer = requiredInstance(
      container.querySelector('.cinder-virtual-list__spacer'),
      HTMLElement,
    );
    expect(spacer.style.blockSize).toBe('2000px');

    reportRowSizes(new Map([[0, 0]]));
    await tick();

    // Row 0 contributed 20px of estimate and now contributes 0.
    expect(spacer.style.blockSize).toBe('1980px');
  });

  test('drops cached measurements for keys that leave the list', async () => {
    // Without pruning, a long-lived feed that filters or rolls over its contents
    // keeps every size it has ever measured, so memory tracks history rather than
    // the current collection.
    installFakeResizeObserver();
    const keyed = (count: number, prefix: string) =>
      localScopeMarker
        ? Array.from({ length: count }, (_, index) => ({
            id: `${prefix}-${index}`,
            label: `${prefix} ${index}`,
          }))
        : [];
    const getKey = (item: unknown) => (localScopeMarker ? keyedItemId(item) : '');

    const view = render(VirtualList, {
      items: keyed(40, 'first'),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      getKey,
      row: keyedRowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(view.container).length).toBeGreaterThan(0));
    reportRowSizes(new Map([[0, 60]]));
    await tick();

    const spacer = requiredInstance(
      view.container.querySelector('.cinder-virtual-list__spacer'),
      HTMLElement,
    );
    // 40 rows: 39 estimated at 20 plus one measured at 60.
    expect(spacer.style.blockSize).toBe('840px');

    // Replace every item with a fresh key set. The old measurement must not survive.
    await view.rerender({
      items: keyed(40, 'second'),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      getKey,
      row: keyedRowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(spacer.style.blockSize).toBe('800px');
  });

  test('does not yank a scrolled-up reader to the end when dynamicSize flips on during an append', async () => {
    // The pre-append bottom check has to compare against geometry from the mode
    // that was actually active. `previousDynamicTotalSize` stays 0 while fixed mode
    // runs, so evaluating the old position against it would make isAtBottom true
    // for any offset and pin a reader who was nowhere near the bottom.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: localMakeItems(100),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      row: localRowSnippet(),
      'aria-label': 'Events',
    });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    list.scrollTop = 200;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({
      items: localMakeItems(101),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: localRowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(list.scrollTop).toBe(200);
  });

  test('keeps the viewport pinned when an appended row measures taller than the estimate', async () => {
    // The append pin scrolls to the total as currently estimated. A row that then
    // measures taller grows the total without an item-count change, and the anchor
    // correction ignores it because it sits below the anchor — so without a re-pin
    // the viewport ends up short of the bottom.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: localMakeItems(50),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: localRowSnippet(),
      'aria-label': 'Events',
    });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({
      items: localMakeItems(51),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: localRowSnippet(),
      'aria-label': 'Events',
    });
    await tick();
    await tick();

    // 51 rows x 20px estimate = 1020, minus the 200px viewport.
    expect(list.scrollTop).toBe(820);

    // The newest row turns out to be 80px, not 20px: total becomes 1080.
    reportRowSizes(new Map([[50, 80]]));
    await tick();

    expect(list.scrollTop).toBe(880);
  });
});
