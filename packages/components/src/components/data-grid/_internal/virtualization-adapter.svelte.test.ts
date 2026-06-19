/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import {
  DataGridVirtualizationAdapter,
  type DataGridVirtualizationAdapterOptions,
} from './virtualization-adapter.svelte.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: VirtualizerLiveFixture } =
  await import('../../../test/fixtures/virtualizer-live-fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function scrollElement({
  height = 132,
  width = 250,
  scrollTop = 0,
  scrollLeft = 0,
}: {
  height?: number;
  width?: number;
  scrollTop?: number;
  scrollLeft?: number;
} = {}): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: width });
  element.scrollTop = scrollTop;
  element.scrollLeft = scrollLeft;
  element.getBoundingClientRect = () =>
    ({
      width,
      height,
      top: 0,
      right: width,
      bottom: height,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.append(element);
  return element;
}

function createAdapter(
  overrides: Partial<DataGridVirtualizationAdapterOptions> = {},
  element: HTMLElement | null = scrollElement(),
): DataGridVirtualizationAdapter {
  return new DataGridVirtualizationAdapter({
    getScrollElement: () => element,
    getRowCount: () => 100,
    getRowKey: (index) => `row-${index}`,
    getRowHeight: () => 44,
    getColumnCount: () => 6,
    getColumnKey: (index) => `column-${index}`,
    getColumnWidth: (index) => [80, 120, 60][index % 3] ?? 80,
    getOverscan: () => 1,
    getInitialHeight: () => 132,
    getInitialWidth: () => 250,
    getScrollPaddingStart: () => 20,
    getScrollPaddingInlineStart: () => 10,
    getScrollPaddingInlineEnd: () => 15,
    ...overrides,
  });
}

describe('DataGridVirtualizationAdapter', () => {
  test('returns bounded fallback row and column windows from the current scroll offsets', () => {
    const element = scrollElement({ scrollTop: 196, scrollLeft: 180 });
    const adapter = createAdapter({}, element);

    expect(adapter.totalHeight).toBe(4_400);
    expect(adapter.totalWidth).toBe(520);
    expect(adapter.virtualRows.map((row) => row.index)).toEqual([3, 4, 5, 6, 7]);
    expect(adapter.virtualRows[0]).toEqual({
      index: 3,
      start: 132,
      size: 44,
      key: 'row-3',
    });
    expect(adapter.virtualColumns.map((column) => column.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(adapter.virtualColumns[2]).toEqual({
      index: 2,
      start: 200,
      size: 60,
      key: 'column-2',
    });
  });

  test('normalizes invalid dimensions and empty row/column sets', () => {
    const element = scrollElement({ height: 0, width: 0, scrollTop: 8, scrollLeft: 8 });
    const adapter = createAdapter(
      {
        getRowCount: () => 0,
        getColumnCount: () => 0,
        getRowHeight: () => Number.NaN,
        getColumnWidth: () => 0,
        getOverscan: () => -3,
        getScrollPaddingStart: () => Number.POSITIVE_INFINITY,
        getScrollPaddingInlineStart: () => -1,
        getScrollPaddingInlineEnd: () => Number.NaN,
      },
      element,
    );

    expect(adapter.virtualRows).toEqual([]);
    expect(adapter.virtualColumns).toEqual([]);
    expect(adapter.totalHeight).toBe(0);
    expect(adapter.totalWidth).toBe(0);
  });

  test('scrollToRow and scrollToColumn use the native fallback when no live virtualizer is mounted', () => {
    const element = scrollElement({ height: 0, width: 0 });
    const adapter = createAdapter({}, element);
    let scrollEvents = 0;
    element.addEventListener('scroll', () => {
      scrollEvents += 1;
    });

    adapter.scrollToRow(5);
    adapter.scrollToColumn(3);

    expect(element.scrollTop).toBe(240);
    expect(element.scrollLeft).toBe(260);
    expect(scrollEvents).toBe(2);
  });

  test('mountScrollContainer owns and cleans up the attached scroll element', () => {
    const first = scrollElement({ scrollTop: 64, scrollLeft: 120 });
    const second = scrollElement({ scrollTop: 240, scrollLeft: 260 });
    const adapter = createAdapter({ getScrollElement: () => null }, null);

    const cleanupFirst = adapter.mountScrollContainer(first);
    expect(adapter.virtualRows[0]?.index).toBe(0);
    expect(adapter.virtualColumns[0]?.index).toBe(0);

    const cleanupSecond = adapter.mountScrollContainer(second);
    expect(adapter.virtualRows[0]?.index).toBe(4);
    expect(adapter.virtualColumns[0]?.index).toBe(2);

    if (cleanupFirst) cleanupFirst();
    expect(adapter.virtualRows[0]?.index).toBe(4);

    if (cleanupSecond) cleanupSecond();
    expect(adapter.virtualRows[0]?.index).toBe(0);
    expect(adapter.virtualColumns[0]?.index).toBe(0);
  });

  test('SSR accessors avoid DOM virtualization and report fixed aggregate sizes', () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'window');
    try {
      const adapter = createAdapter({ getRowCount: () => 3, getColumnCount: () => 3 }, null);

      expect(adapter.virtualRows).toEqual([]);
      expect(adapter.virtualColumns).toEqual([]);
      expect(adapter.totalHeight).toBe(132);
      expect(adapter.totalWidth).toBe(260);
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
      }
    }
  });

  test('measureElement and refreshMeasurements are safe before a live virtualizer exists', () => {
    const adapter = createAdapter();
    const row = scrollElement({ height: 50 });

    const cleanup = adapter.measureElement(row);
    adapter.refreshMeasurements();

    expect(typeof cleanup).toBe('function');
    if (cleanup) cleanup();
  });

  test('mounted Svelte subscribers keep live row and column windows synchronized with native scrolling', async () => {
    const rendered = render(VirtualizerLiveFixture, {
      props: {
        rowCount: 100,
        columnCount: 8,
        initialGridScrollTop: 196,
        initialGridScrollLeft: 140,
      },
    });
    await tick();

    const scrollContainer = rendered.getByTestId('grid-scroll');
    expect(rendered.getAllByTestId('grid-row').length).toBeLessThan(100);
    expect(rendered.getByTestId('grid-row-indices').textContent).toContain('3');
    expect(rendered.getByTestId('grid-column-indices').textContent).toContain('1');

    scrollContainer.scrollTop = 460;
    scrollContainer.scrollLeft = 260;
    await fireEvent.scroll(scrollContainer);
    await tick();

    expect(rendered.getByTestId('grid-row-indices').textContent).toContain('9');
    expect(rendered.getByTestId('grid-column-indices').textContent).toContain('3');

    await fireEvent.click(rendered.getByTestId('grid-scroll-button'));
    await tick();

    expect(Number(scrollContainer.dataset['scrollToCalls'])).toBeGreaterThanOrEqual(2);
    expect(scrollContainer.dataset['scrollToTop']).toBeDefined();
    expect(scrollContainer.dataset['scrollToLeft']).toBeDefined();

    rendered.unmount();
  });
});
