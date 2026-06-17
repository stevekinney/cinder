import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import { calculateChatVirtualWindow, ChatVirtualizer } from './use-chat-virtualizer.svelte.ts';

setupHappyDom();

describe('calculateChatVirtualWindow', () => {
  test('returns an empty window for an empty transcript', () => {
    expect(
      calculateChatVirtualWindow({
        scrollTop: 0,
        containerHeight: 600,
        itemCount: 0,
        itemSize: 80,
        overscan: 3,
      }),
    ).toEqual({ startIndex: 0, endIndex: 0 });
  });

  test('keeps a single message visible', () => {
    expect(
      calculateChatVirtualWindow({
        scrollTop: 0,
        containerHeight: 600,
        itemCount: 1,
        itemSize: 80,
        overscan: 3,
      }),
    ).toEqual({ startIndex: 0, endIndex: 1 });
  });

  test('calculates an overscanned middle window', () => {
    expect(
      calculateChatVirtualWindow({
        scrollTop: 800,
        containerHeight: 320,
        itemCount: 100,
        itemSize: 80,
        overscan: 2,
      }),
    ).toEqual({ startIndex: 8, endIndex: 16 });
  });

  test('clamps invalid inputs and keeps the bottom window populated', () => {
    expect(
      calculateChatVirtualWindow({
        scrollTop: 10_000,
        containerHeight: 320,
        itemCount: 5.8,
        itemSize: -1,
        overscan: -2,
      }),
    ).toEqual({ startIndex: 0, endIndex: 5 });
  });
});

describe('ChatVirtualizer', () => {
  function createVirtualizer(
    overrides: Partial<{ count: number; size: number; overscan: number }> = {},
  ) {
    let count = overrides.count ?? 100;
    const virtualizer = new ChatVirtualizer({
      getScrollElement: () => null,
      getCount: () => count,
      getItemKey: (index) => `message-${index}`,
      getEstimatedSize: () => overrides.size ?? 80,
      getOverscan: () => overrides.overscan ?? 2,
      getInitialHeight: () => 320,
    });

    return {
      virtualizer,
      setCount: (nextCount: number) => {
        count = nextCount;
      },
    };
  }

  function scrollableElement(): HTMLDivElement {
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: 320 });
    element.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      element.scrollTop =
        typeof options === 'number' ? (typeof y === 'number' ? y : options) : (options?.top ?? 0);
    };
    return element;
  }

  test('builds virtual items from the current scroll offset', () => {
    const { virtualizer } = createVirtualizer();
    virtualizer.scrollToOffset(800);

    expect(virtualizer.scrollOffset).toBe(800);
    expect(virtualizer.totalSize).toBe(8000);
    expect(virtualizer.virtualItems.map((item) => item.key)).toEqual([
      'message-8',
      'message-9',
      'message-10',
      'message-11',
      'message-12',
      'message-13',
      'message-14',
      'message-15',
    ]);
  });

  test('attaches to a scroll element and detaches cleanly', () => {
    const { virtualizer } = createVirtualizer();
    const element = scrollableElement();
    const detach = virtualizer.scrollElement(element);

    virtualizer.scrollToIndex(10, { align: 'start', behavior: 'instant' });
    expect(element.scrollTop).toBe(800);
    expect(virtualizer.scrollOffset).toBe(800);

    element.scrollTop = 960;
    element.dispatchEvent(new Event('scroll'));
    expect(virtualizer.virtualItems[0]?.index).toBe(10);

    detach?.();
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
    expect(virtualizer.scrollOffset).toBe(0);
  });

  test('aligns index scrolling to the viewport and ignores empty transcripts', () => {
    const { virtualizer, setCount } = createVirtualizer();

    virtualizer.scrollToIndex(10, { align: 'end' });
    expect(virtualizer.scrollOffset).toBe(560);

    virtualizer.scrollToIndex(10, { align: 'center' });
    expect(virtualizer.scrollOffset).toBe(680);

    setCount(0);
    virtualizer.scrollToIndex(10);
    expect(virtualizer.scrollOffset).toBe(680);
    expect(virtualizer.virtualItems).toEqual([]);
  });

  test('measurement compatibility hooks are stable no-ops', () => {
    const { virtualizer } = createVirtualizer();
    const element = scrollableElement();

    expect(virtualizer.measureElement(element)).toBeUndefined();
    expect(virtualizer.measureElementNode(element)).toBeUndefined();
    expect(virtualizer.measureElementNode(null)).toBeUndefined();
    expect(virtualizer.syncOptions()).toBeUndefined();
    expect(virtualizer.scrollOffset).toBe(0);
  });
});
