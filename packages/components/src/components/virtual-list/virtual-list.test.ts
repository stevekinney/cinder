/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import type { Snippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { VirtualListRowContext } from './virtual-list.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { createRawSnippet, tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

function makeItems(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Item ${index}`);
}

function rowSnippet(): Snippet<[unknown, VirtualListRowContext]> {
  // createRawSnippet receives getter functions at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRawSnippet<[unknown, VirtualListRowContext]>((getItem: any, getContext: any) => ({
    render: () =>
      `<div data-testid="virtual-row" data-index="${getContext().index}">${String(getItem())}</div>`,
  }));
}

function renderedRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="virtual-row"]'));
}

describe('VirtualList', () => {
  test('renders a bounded row window for a 10,000 item list', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(10_000),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    expect(renderedRows(container).length).toBeLessThan(10_000 / 10);
    expect(renderedRows(container).length).toBeLessThanOrEqual(14);
    expect(renderedRows(container)[0]?.textContent).toBe('Item 0');
  });

  test('makes the native scroll container keyboard-focusable by default', () => {
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    expect(container.querySelector('.cinder-virtual-list')?.getAttribute('tabindex')).toBe('0');
  });

  test('allows consumers to override the scroll container tabindex', () => {
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      tabindex: -1,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    expect(container.querySelector('.cinder-virtual-list')?.getAttribute('tabindex')).toBe('-1');
  });

  test('scrolling to an arbitrary offset renders the matching item window', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(10_000),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = container.querySelector<HTMLElement>('.cinder-virtual-list');
    if (!list) throw new Error('Expected virtual list root');

    list.scrollTop = 2_000;
    await fireEvent.scroll(list);

    await waitFor(() =>
      expect(renderedRows(container).some((row) => row.textContent === 'Item 100')).toBe(true),
    );
    expect(renderedRows(container)[0]?.dataset['index']).toBe('98');
  });

  test('scrolling composes consumer onscroll with the internal window update', async () => {
    let scrollCallCount = 0;
    const { container } = render(VirtualList, {
      items: makeItems(10_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      row: rowSnippet(),
      'aria-label': 'Events',
      onscroll: () => {
        scrollCallCount += 1;
      },
    });

    const list = container.querySelector<HTMLElement>('.cinder-virtual-list');
    if (!list) throw new Error('Expected virtual list root');

    list.scrollTop = 2_000;
    await fireEvent.scroll(list);

    expect(scrollCallCount).toBe(1);
    await waitFor(() => expect(renderedRows(container)[0]?.textContent).toBe('Item 100'));
  });

  test('appending at the bottom keeps the viewport pinned when stickToBottom is true', async () => {
    const view = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    const list = view.container.querySelector<HTMLElement>('.cinder-virtual-list');
    if (!list) throw new Error('Expected virtual list root');

    list.scrollTop = 1_800;
    await fireEvent.scroll(list);
    await view.rerender({
      items: makeItems(101),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    await waitFor(() => expect(list.scrollTop).toBe(1_820));
    expect(renderedRows(view.container).at(-1)?.textContent).toBe('Item 100');
  });

  test('appending while scrolled up does not jump the viewport', async () => {
    const view = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    const list = view.container.querySelector<HTMLElement>('.cinder-virtual-list');
    if (!list) throw new Error('Expected virtual list root');

    list.scrollTop = 400;
    await fireEvent.scroll(list);
    await view.rerender({
      items: makeItems(101),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(list.scrollTop).toBe(400);
    expect(renderedRows(view.container).some((row) => row.textContent === 'Item 20')).toBe(true);
  });
});
