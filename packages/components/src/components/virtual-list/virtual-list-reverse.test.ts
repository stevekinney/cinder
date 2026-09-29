/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { itemId, makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — reverse', () => {
  const localRowSnippet = rowSnippet;
  const localMakeItems = makeItems;
  const localScopeMarker = true;

  test('opens at the end rather than the start', async () => {
    const { container } = render(VirtualList, {
      items: localMakeItems(500),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      row: localRowSnippet(),
      'aria-label': 'Transcript',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '499')).toBe(true),
    );
    expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(false);
  });

  test('pins to the end on append even when the reader has scrolled away', async () => {
    // This is the whole difference from stickToBottom, which would leave a
    // scrolled-up reader where they are.
    const { container, rerender } = render(VirtualList, {
      items: localMakeItems(500),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: localRowSnippet(),
      'aria-label': 'Transcript',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    list.scrollTop = 0;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true),
    );

    await rerender({
      items: localMakeItems(510),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: localRowSnippet(),
      'aria-label': 'Transcript',
    });

    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '509')).toBe(true),
    );
  });

  test('pins to the end under dynamicSize, where the total keeps growing after the write', async () => {
    // reverse + dynamicSize is the combination the re-pin effect exists for. The
    // append pin writes against the total as currently estimated; rows measured
    // afterwards grow it further. The pin deliberately reuses `isPinnedToBottom`
    // rather than bypassing it, so that the re-pin effect keeps following.
    const props = (count: number) => ({
      items: localMakeItems(count),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      dynamicSize: true,
      overscan: 0,
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: localRowSnippet(),
      'aria-label': 'Transcript',
    });

    const { container, rerender } = render(VirtualList, props(300));
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    list.scrollTop = 0;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true),
    );

    await rerender(props(310));
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '309')).toBe(true),
    );
  });

  test('a prepend holds the reader in place instead of pinning to the end', async () => {
    // Loading older history must not yank the reader anywhere. The row they were
    // on keeps its position while ten rows arrive above it, so the rendered
    // indices shift by exactly ten.
    const buildItems = (count: number, offset: number) => {
      if (!localScopeMarker) return [];
      return Array.from({ length: count }, (_, index) => ({ id: `key-${index - offset}` }));
    };

    const { container, rerender } = render(VirtualList, {
      items: buildItems(500, 0),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      getKey: (item: unknown) => itemId(item),
      row: localRowSnippet(),
      'aria-label': 'Transcript',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 2_000;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '100')).toBe(true),
    );

    // Ten older rows arrive at the FRONT: same keys, shifted ten places along.
    await rerender({
      items: buildItems(510, 10),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      getKey: (item: unknown) => itemId(item),
      row: localRowSnippet(),
      'aria-label': 'Transcript',
    });

    // The reader stays on the same key, which now lives ten indexes later.
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '110')).toBe(true),
    );
    // And is emphatically not dragged to the end.
    expect(renderedRows(container).some((node) => node.dataset['index'] === '509')).toBe(false);
  });
});
