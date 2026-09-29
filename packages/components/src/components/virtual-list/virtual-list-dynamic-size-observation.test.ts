/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import {
  installFakeResizeObserver,
  instrumentScrollTop,
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
  afterEach(() => restoreResizeObserver());

  test('never observes a row when dynamicSize is off, across render, scroll, and append', async () => {
    // The component always observes its own scroll CONTAINER for viewport size —
    // that is pre-existing behavior and not what CIN-190 is about. What must never
    // happen on the fixed path is a ROW being measured, so the assertion is scoped
    // to row elements rather than to observer construction as a whole.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(500),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(view.container).length).toBeGreaterThan(0));
    expect(observedRowElements()).toHaveLength(0);

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    list.scrollTop = 400;
    await fireEvent.scroll(list);
    expect(observedRowElements()).toHaveLength(0);

    await view.rerender({
      items: makeItems(520),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();
    expect(observedRowElements()).toHaveLength(0);
  });

  test('observes every mounted row when dynamicSize is on', async () => {
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(500),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    expect(observedRowElements().length).toBe(renderedRows(container).length);
  });

  test('does not pin an inline row height when dynamicSize is on', async () => {
    // A pinned height would make each row measure back as exactly the estimate,
    // so the measurement pass could never observe a row's real size.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const firstRow = requiredInstance(
      container.querySelector('[data-cinder-virtual-index]'),
      HTMLElement,
    );
    expect(firstRow.getAttribute('style') ?? '').not.toContain('height');
  });

  test('a measured row larger than the estimate grows the total scrollable size', async () => {
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const spacer = requiredInstance(
      container.querySelector('.cinder-virtual-list__spacer'),
      HTMLElement,
    );
    expect(spacer.style.blockSize).toBe('2000px');

    // Row 0 is really 60px tall, not the 20px estimate: +40px of total size.
    reportRowSizes(new Map([[0, 60]]));
    await tick();

    expect(spacer.style.blockSize).toBe('2040px');
  });

  test('corrects the scroll offset against pre-mutation offsets when a row above the anchor grows', async () => {
    // This is the CIN-188 regression. `offsets` is derived off the same version
    // counter `record()` bumps, so by correction time it has ALREADY rebuilt to
    // include the new measurement. Resolving the anchor against that rebuilt table
    // finds the wrong item; only the pre-mutation snapshot gives the right one.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    // Anchor at offset 400 => index 20 in the all-estimates table.
    list.scrollTop = 400;
    await fireEvent.scroll(list);
    await tick();

    const scrollTop = instrumentScrollTop(list);

    // Row 15 is mounted, sits above the anchor, and is really 40px not 20px.
    reportRowSizes(new Map([[15, 40]]));
    await tick();

    // +20px of content above the anchor must be added back so the anchor row
    // stays visually stationary.
    expect(scrollTop.value()).toBe(420);
  });

  test('a measurement below the anchor does not move the scroll offset', async () => {
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 400;
    await fireEvent.scroll(list);
    await tick();

    const scrollTop = instrumentScrollTop(list);

    // Row 25 is below the anchor: growing it shifts only content the reader has
    // not reached yet, so the offset must be left alone.
    reportRowSizes(new Map([[25, 40]]));
    await tick();

    expect(scrollTop.writes()).toBe(0);
  });

  test('coalesces several measurements in one flush into a single scroll write', async () => {
    // CIN-202: reads are folded into one correction and written once, rather than
    // producing a layout-forcing write per measurement.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 400;
    await fireEvent.scroll(list);
    await tick();

    const scrollTop = instrumentScrollTop(list);

    // Three rows above the anchor all grow by 10px in the same batch.
    reportRowSizes(
      new Map([
        [15, 30],
        [16, 30],
        [17, 30],
      ]),
    );
    await tick();

    expect(scrollTop.writes()).toBe(1);
    expect(scrollTop.value()).toBe(430);
  });

  test('re-reporting an unchanged size neither corrects nor rewrites the scroll offset', async () => {
    // The measurement store no-ops on an unchanged rounded size. Without that, a
    // correction write would re-lay-out rows, which report the same size back, and
    // the component would loop.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 400;
    await fireEvent.scroll(list);
    await tick();

    reportRowSizes(new Map([[15, 40]]));
    await tick();

    const scrollTop = instrumentScrollTop(list);
    reportRowSizes(new Map([[15, 40]]));
    await tick();

    expect(scrollTop.writes()).toBe(0);
  });

  test('ref.scrollToIndex lands on the measured offset, not the estimated one', async () => {
    // CIN-189: with rows 0-9 measured at 40px instead of the 20px estimate, index 30
    // starts at 10*40 + 20*20 = 800, not the 600 an estimate-only table would give.
    installFakeResizeObserver();
    let listRef: VirtualListRef | undefined;
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
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

    const measured = new Map<number, number>();
    for (let index = 0; index < 10; index += 1) measured.set(index, 40);
    reportRowSizes(measured);
    await tick();

    expect(listRef).toBeDefined();
    listRef?.scrollToIndex(30, { align: 'start' });
    await tick();

    expect(list.scrollTop).toBe(800);
  });
});
