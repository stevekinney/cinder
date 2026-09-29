/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — horizontal with dynamicSize', () => {
  test('leaves the row unsized on the inline axis so it can be measured', async () => {
    // Under dynamicSize the row's main-axis size comes from the ResizeObserver, not
    // from the component. Writing an inline-size here would pin every column to the
    // estimate and the measurement would only ever confirm the value it was given.
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 40,
      height: '200px',
      horizontal: true,
      dynamicSize: true,
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const firstRow = requiredInstance(
      container.querySelector('[data-cinder-virtual-index]'),
      HTMLElement,
    );
    expect(firstRow.getAttribute('style')).toBeNull();
  });

  test('sizes the spacer along the inline axis, not the block axis', async () => {
    // The spacer is what creates the scrollable extent. On the wrong axis the
    // container never overflows and the list cannot be scrolled at all.
    const { container } = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 40,
      height: '200px',
      horizontal: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const spacer = requiredInstance(
      container.querySelector('.cinder-virtual-list__spacer'),
      HTMLElement,
    );
    expect(spacer.style.inlineSize).toBe('2000px');
    expect(spacer.style.blockSize).toBe('');
  });

  test('offsets the window along the inline axis', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 40,
      height: '200px',
      horizontal: true,
      overscan: 0,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollLeft = 400;
    await fireEvent.scroll(list);

    const windowElement = requiredInstance(
      container.querySelector('.cinder-virtual-list__window'),
      HTMLElement,
    );
    await waitFor(() => expect(windowElement.style.insetInlineStart).toBe('400px'));
    expect(windowElement.style.insetBlockStart).toBe('');
  });
});
