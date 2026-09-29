/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — stickyItems', () => {
  test('keeps a sticky row mounted after the reader scrolls past it', async () => {
    // A pinned header whose index leaves the window would be unmounted by plain
    // virtualization, so the heading would vanish exactly when it is meant to show.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);

    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
    );
    const sticky = container.querySelector<HTMLElement>('[data-cinder-virtual-index="0"]');
    expect(sticky).not.toBeNull();
    expect(sticky?.getAttribute('data-cinder-sticky')).toBe('true');
    expect(sticky?.getAttribute('data-cinder-sticky-active')).toBe('true');
  });

  test('renders the pinned row in index order, since it is read by assistive technology', async () => {
    // Ordering costs nothing visually — the row is absolutely positioned, so it does
    // not lay out among its siblings, and it stays above them by the sticky rule's
    // `z-index` rather than by coming last. What ordering buys is reading order: this
    // element is exposed to assistive technology, so it belongs where the row does.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-sticky-pinned="true"]')).not.toBeNull(),
    );

    const indexes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-cinder-virtual-index]'),
    ).map((node) => Number(node.dataset['cinderVirtualIndex']));
    expect(indexes[0]).toBe(0);
    expect(indexes).toEqual([...indexes].toSorted((left, right) => left - right));
  });

  test('keeps the pinned row absolutely positioned despite the sticky rule matching it too', async () => {
    // Both rules match a pinned row at equal specificity, so source order alone
    // decided the winner — and `position: sticky` took it back, putting the row into
    // flow and displacing every row after it. The selector carries both attributes so
    // the outcome does not depend on which rule is written first.
    const source = await Bun.file(new URL('./virtual-list.css', import.meta.url).pathname).text();
    expect(source).toContain("[data-cinder-sticky='true'][data-cinder-sticky-pinned='true']");
  });

  test('keeps the very same DOM node as a sticky row crosses the window boundary', async () => {
    // The reason the pinned row stays in the keyed each rather than moving to an
    // element of its own: Svelte cannot carry identity across that boundary, so a row
    // holding local state or a focused control would be destroyed and rebuilt every
    // time it crossed.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const before = container.querySelector('[data-cinder-virtual-index="0"]');
    expect(before).not.toBeNull();

    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-sticky-pinned="true"]')).not.toBeNull(),
    );

    const after = container.querySelector('[data-cinder-virtual-index="0"]');
    expect(after).toBe(before);
  });

  test('leaves the sticky attributes off when no sticky items are configured', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    expect(container.querySelector('[data-cinder-sticky]')).toBeNull();
  });
});
