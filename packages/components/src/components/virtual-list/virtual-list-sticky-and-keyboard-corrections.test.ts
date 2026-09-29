/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — sticky and keyboard corrections', () => {
  test('pins an out-of-window sticky row without displacing the window', async () => {
    // Left in flow, a non-contiguous row lays out ahead of the rows around the reader
    // and pushes every one of them down by its own height.
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

    // The offset is relative to the WINDOW, which already carries its own leading
    // translation — so it is the difference between them, not the raw scroll offset.
    // Asserting the literal number I happened to write was how a compounded offset
    // that put the header 4000px below the viewport passed for two rounds.
    const windowElement = container.querySelector<HTMLElement>('.cinder-virtual-list__window');
    const pinned = container.querySelector<HTMLElement>('[data-cinder-sticky-pinned="true"]');
    const leading = Number.parseFloat(windowElement?.style.insetBlockStart ?? '0');
    const pinnedOffset = Number.parseFloat(pinned?.style.insetBlockStart ?? '');
    expect(leading + pinnedOffset).toBe(4_000);

    // And those rows still begin where the window's leading offset says. Queried from
    // the row WRAPPERS: `renderedRows` returns the snippet's own element, which does
    // not carry the component's data attributes.
    const flowIndexes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-cinder-virtual-index]'),
    )
      .filter((node) => node.dataset['cinderStickyPinned'] !== 'true')
      .map((node) => Number(node.dataset['cinderVirtualIndex']));
    expect(flowIndexes[0]).toBe(200);
    expect(flowIndexes).toEqual([...flowIndexes].toSorted((left, right) => left - right));
  });

  test('activates the sticky row for the VISIBLE row, not the overscanned edge', async () => {
    // With overscan the rendered edge sits several rows above the viewport, so using
    // it activated the next section's header early.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 5,
      stickyItems: [0, 100],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    // Row 98 is at the top; the rendered edge is 93. Section 100 has NOT been reached.
    list.scrollTop = 1_960;
    await fireEvent.scroll(list);
    await tick();

    const pinned = container.querySelector<HTMLElement>('[data-cinder-sticky-pinned="true"]');
    expect(pinned?.dataset['cinderVirtualIndex']).toBe('0');
  });

  test('leaves arrow keys to a control inside a row', async () => {
    // A row with a text input or slider uses these keys itself.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    const rowElement = requiredInstance(
      container.querySelector('[data-cinder-virtual-index]'),
      HTMLElement,
    );

    const bubbled = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    rowElement.dispatchEvent(bubbled);
    expect(bubbled.defaultPrevented).toBe(false);

    // Aimed at the container itself, it is claimed.
    const direct = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    list.dispatchEvent(direct);
    expect(direct.defaultPrevented).toBe(true);
  });

  test('omits set-position semantics when the consumer owns the role', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      role: 'presentation',
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const firstRow = requiredInstance(
      container.querySelector('[data-cinder-virtual-index]'),
      HTMLElement,
    );
    expect(firstRow.hasAttribute('aria-posinset')).toBe(false);
    expect(firstRow.hasAttribute('aria-setsize')).toBe(false);
  });
});
