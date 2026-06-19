/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';
import { TreeVirtualizer, type TreeVirtualizerOptions } from './use-virtualizer.svelte.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: VirtualizerLiveFixture } =
  await import('../test/fixtures/virtualizer-live-fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function scrollElement({
  height = 120,
  scrollTop = 0,
}: {
  height?: number;
  scrollTop?: number;
} = {}): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: height });
  element.scrollTop = scrollTop;
  element.getBoundingClientRect = () =>
    ({
      width: 320,
      height,
      top: 0,
      right: 320,
      bottom: height,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.append(element);
  return element;
}

function createVirtualizer(
  overrides: Partial<TreeVirtualizerOptions> = {},
  element: HTMLElement | null = scrollElement(),
): TreeVirtualizer {
  return new TreeVirtualizer({
    getScrollElement: () => element,
    getCount: () => 100,
    getItemKey: (index) => `item-${index}`,
    getEstimatedSize: () => 20,
    getOverscan: () => 1,
    getInitialHeight: () => 120,
    ...overrides,
  });
}

describe('TreeVirtualizer', () => {
  test('returns a bounded fallback window from the current scroll offset', () => {
    const element = scrollElement({ scrollTop: 80 });
    const virtualizer = createVirtualizer({}, element);

    expect(virtualizer.totalSize).toBe(2_000);
    expect(virtualizer.virtualItems.map((item) => item.index)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(virtualizer.virtualItems[0]).toMatchObject({
      key: 'item-3',
      start: 60,
      end: 80,
      size: 20,
    });
  });

  test('normalizes empty, invalid, and negative fallback inputs', () => {
    const element = scrollElement({ height: 0, scrollTop: 2 });
    const emptyVirtualizer = createVirtualizer({ getCount: () => 0 }, element);
    const invalidVirtualizer = createVirtualizer(
      {
        getCount: () => 3,
        getEstimatedSize: () => 0,
        getOverscan: () => -4,
        getInitialHeight: () => 2,
      },
      element,
    );

    expect(emptyVirtualizer.virtualItems).toEqual([]);
    expect(invalidVirtualizer.totalSize).toBe(0);
    expect(invalidVirtualizer.virtualItems.map((item) => item.index)).toEqual([2]);
    expect(invalidVirtualizer.virtualItems[0]?.size).toBe(1);
  });

  test('scrollToIndex uses the native scroll element fallback when no live virtualizer is mounted', () => {
    const element = scrollElement({ height: 0 });
    const virtualizer = createVirtualizer({}, element);
    let scrollEvents = 0;
    element.addEventListener('scroll', () => {
      scrollEvents += 1;
    });

    virtualizer.scrollToIndex(12);

    expect(element.scrollTop).toBe(240);
    expect(scrollEvents).toBe(1);
  });

  test('attachment ownership can mount, replace, and clean up the scroll element', () => {
    const first = scrollElement({ scrollTop: 40 });
    const second = scrollElement({ scrollTop: 100 });
    const virtualizer = createVirtualizer({ getScrollElement: () => null }, null);

    const cleanupFirst = virtualizer.scrollElement(first);
    expect(virtualizer.virtualItems[0]?.index).toBe(1);

    const cleanupSecond = virtualizer.scrollElement(second);
    expect(virtualizer.virtualItems[0]?.index).toBe(4);

    if (cleanupFirst) cleanupFirst();
    expect(virtualizer.virtualItems[0]?.index).toBe(4);

    if (cleanupSecond) cleanupSecond();
    expect(virtualizer.virtualItems[0]?.index).toBe(0);
  });

  test('measureElement attachment is safe before a live virtualizer exists', () => {
    const row = scrollElement({ height: 36 });
    const virtualizer = createVirtualizer();

    const cleanup = virtualizer.measureElement(row);

    expect(typeof cleanup).toBe('function');
    if (cleanup) cleanup();
  });

  test('mounted Svelte subscribers keep a live window synchronized with native scrolling', async () => {
    const rendered = render(VirtualizerLiveFixture, {
      props: {
        rowCount: 100,
        initialTreeScrollTop: 80,
      },
    });
    await tick();

    const scrollContainer = rendered.getByTestId('tree-scroll');
    expect(rendered.getAllByTestId('tree-item').length).toBeLessThan(100);
    expect(rendered.getByTestId('tree-indices').textContent).toContain('3');

    scrollContainer.scrollTop = 360;
    await fireEvent.scroll(scrollContainer);
    await tick();

    expect(rendered.getByTestId('tree-indices').textContent).toContain('17');

    await fireEvent.click(rendered.getByTestId('tree-scroll-button'));
    await tick();

    expect(Number(scrollContainer.dataset['scrollToCalls'])).toBeGreaterThanOrEqual(1);
    expect(scrollContainer.dataset['scrollToTop']).toBeDefined();

    rendered.unmount();
  });
});
