/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — horizontal', () => {
  test('marks the root with the horizontal orientation attribute', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 40,
      height: '200px',
      horizontal: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    expect(list.getAttribute('data-cinder-orientation')).toBe('horizontal');
  });

  test('leaves the orientation attribute off in the default vertical mode', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 40,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    expect(list.hasAttribute('data-cinder-orientation')).toBe(false);
  });

  test('drives the window from scrollLeft rather than scrollTop', async () => {
    // The axis adapter is the whole point: under `horizontal` the offset comes from
    // the inline axis, so a scrollTop change must not move the window and a
    // scrollLeft change must.
    const { container } = render(VirtualList, {
      items: makeItems(1000),
      itemHeight: 20,
      height: '200px',
      horizontal: true,
      overscan: 2,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    list.scrollTop = 2_000;
    await fireEvent.scroll(list);
    expect(renderedRows(container)[0]?.dataset['index']).toBe('0');

    list.scrollLeft = 2_000;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(renderedRows(container).some((row) => row.dataset['index'] === '100')).toBe(true),
    );
  });

  test('reinterprets itemHeight as the inline size of each row', async () => {
    // `itemHeight` is reinterpreted rather than renamed, per the documented naming
    // decision, so under `horizontal` it must size rows along the inline axis.
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 40,
      height: '200px',
      horizontal: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const firstRow = requiredInstance(
      container.querySelector('[data-cinder-virtual-index]'),
      HTMLElement,
    );
    // Read through CSSStyleDeclaration rather than the raw attribute string, whose
    // whitespace and property order are serialization details that vary by DOM
    // implementation. Assert the PROPERTY, not just the number: `40px` alone passed
    // against the original code, which set a physical `height` in both modes.
    expect(firstRow.style.inlineSize).toBe('40px');
    expect(firstRow.style.blockSize).toBe('');
  });
});
