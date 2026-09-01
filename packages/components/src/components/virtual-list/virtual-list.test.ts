/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import type { Snippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { VirtualListRef, VirtualListRowContext } from './virtual-list.types.ts';

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

type KeyedItem = { id: string; label: string };

function keyedRowSnippet(): Snippet<[unknown, VirtualListRowContext]> {
  // createRawSnippet receives getter functions at runtime. `Item` is inferred as
  // `unknown` at these render() call sites (see `rowSnippet()` above), so the
  // getter is cast back to `KeyedItem` here where we know the real shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRawSnippet<[unknown, VirtualListRowContext]>((getItem: any) => ({
    render: () => {
      const item = getItem() as KeyedItem;
      return `<div data-testid="virtual-row" data-id="${item.id}">${item.label}</div>`;
    },
  }));
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

  test('an empty items array marks the spacer as aria-hidden', () => {
    const { container } = render(VirtualList, {
      items: [],
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const spacer = container.querySelector('.cinder-virtual-list__spacer');
    expect(spacer?.getAttribute('aria-hidden')).toBe('true');
  });

  test('a custom getKey preserves DOM node identity for an item across a reorder', async () => {
    const items: KeyedItem[] = [
      { id: 'alpha', label: 'Alpha' },
      { id: 'bravo', label: 'Bravo' },
      { id: 'charlie', label: 'Charlie' },
      { id: 'delta', label: 'Delta' },
    ];
    const row = keyedRowSnippet();
    const getKey = (item: unknown) => (item as KeyedItem).id;

    const view = render(VirtualList, {
      items,
      itemHeight: 20,
      height: '200px',
      row,
      getKey,
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(view.container).length).toBe(4));

    // Capture by DOM POSITION, not by content selector — a content-based
    // selector can't distinguish "moved the real node" from "left a stale
    // node with the old content sitting at the old position", since the raw
    // row snippet has no reactive `setup` and never re-renders its own text.
    const rowsBefore = renderedRows(view.container);
    const bravoNodeBefore = rowsBefore[1];
    expect(bravoNodeBefore?.getAttribute('data-id')).toBe('bravo');

    // Swap bravo and charlie — same length, same set of ids, only order changes.
    const reordered: KeyedItem[] = [items[0]!, items[2]!, items[1]!, items[3]!];

    await view.rerender({
      items: reordered,
      itemHeight: 20,
      height: '200px',
      row,
      getKey,
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(view.container).length).toBe(4));

    // Bravo is now at array index 2. A correct getKey-driven keyed each MOVES
    // bravo's original DOM node to that new position rather than recreating
    // it — so the node found there must be the exact object captured above.
    const rowsAfter = renderedRows(view.container);
    expect(rowsAfter[2]).toBe(bravoNodeBefore);
    expect(rowsAfter[2]?.isConnected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dynamicSize (CIN-186, 187, 188, 189, 190, 202)
// ---------------------------------------------------------------------------

type FakeResizeObserverRecord = {
  readonly callback: ResizeObserverCallback;
  readonly observed: HTMLElement[];
};

const fakeResizeObservers: FakeResizeObserverRecord[] = [];
const originalResizeObserver = globalThis.ResizeObserver;

/**
 * happy-dom ships a ResizeObserver that constructs but never fires, because
 * nothing in a non-painting DOM ever resizes. This fake keeps the same shape and
 * lets a test deliver a measurement on demand, which is the only way to exercise
 * the measure -> cache -> correct pipeline without a real browser.
 */
class FakeResizeObserver {
  readonly #record: FakeResizeObserverRecord;

  constructor(callback: ResizeObserverCallback) {
    this.#record = { callback, observed: [] };
    fakeResizeObservers.push(this.#record);
  }

  observe(target: Element): void {
    this.#record.observed.push(target as HTMLElement);
  }

  unobserve(target: Element): void {
    const index = this.#record.observed.indexOf(target as HTMLElement);
    if (index !== -1) this.#record.observed.splice(index, 1);
  }

  disconnect(): void {
    this.#record.observed.length = 0;
  }
}

function installFakeResizeObserver(): void {
  fakeResizeObservers.length = 0;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
}

function restoreResizeObserver(): void {
  globalThis.ResizeObserver = originalResizeObserver;
  fakeResizeObservers.length = 0;
}

/** Every element any fake observer is currently watching that is a virtual row. */
function observedRowElements(): HTMLElement[] {
  return fakeResizeObservers.flatMap((record) =>
    record.observed.filter((element) => element.dataset['cinderVirtualIndex'] !== undefined),
  );
}

/**
 * Delivers a border-box measurement for each requested row index, batched into a
 * single observer callback so the whole batch lands inside one reactive flush.
 */
function reportRowSizes(sizesByIndex: ReadonlyMap<number, number>): void {
  for (const record of fakeResizeObservers) {
    const entries = record.observed
      .filter((element) => {
        const raw = element.dataset['cinderVirtualIndex'];
        return raw !== undefined && sizesByIndex.has(Number.parseInt(raw, 10));
      })
      .map((element) => {
        const index = Number.parseInt(element.dataset['cinderVirtualIndex'] ?? '0', 10);
        const blockSize = sizesByIndex.get(index) ?? 0;
        return {
          target: element,
          borderBoxSize: [{ blockSize, inlineSize: 100 }],
          contentBoxSize: [{ blockSize, inlineSize: 100 }],
          devicePixelContentBoxSize: [{ blockSize, inlineSize: 100 }],
          contentRect: { height: blockSize, width: 100 } as DOMRectReadOnly,
        } as unknown as ResizeObserverEntry;
      });
    if (entries.length > 0) {
      record.callback(entries, undefined as unknown as ResizeObserver);
    }
  }
}

/** Replaces scrollTop with a counting accessor so writes can be counted, not just observed. */
function instrumentScrollTop(element: HTMLElement): { writes: () => number; value: () => number } {
  let value = element.scrollTop;
  let writes = 0;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => value,
    set: (next: number) => {
      value = next;
      writes += 1;
    },
  });
  return { writes: () => writes, value: () => value };
}

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

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
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
    const firstRow = container.querySelector('[data-cinder-virtual-index]') as HTMLElement;
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
    const spacer = container.querySelector('.cinder-virtual-list__spacer') as HTMLElement;
    expect(spacer.style.height).toBe('2000px');

    // Row 0 is really 60px tall, not the 20px estimate: +40px of total size.
    reportRowSizes(new Map([[0, 60]]));
    await tick();

    expect(spacer.style.height).toBe('2040px');
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    const measured = new Map<number, number>();
    for (let index = 0; index < 10; index += 1) measured.set(index, 40);
    reportRowSizes(measured);
    await tick();

    expect(listRef).toBeDefined();
    listRef?.scrollToIndex(30, { align: 'start' });
    await tick();

    expect(list.scrollTop).toBe(800);
  });

  test('ref.scrollToIndex clamps an out-of-range index to the list bounds', async () => {
    let listRef: VirtualListRef | undefined;
    const { container } = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    listRef?.scrollToIndex(9999, { align: 'start' });
    await tick();

    // 50 rows x 20px = 1000px of content in a 200px viewport: 800px is the max.
    expect(list.scrollTop).toBe(800);
  });

  test('exposes the ref while mounted and releases it on unmount', async () => {
    let listRef: VirtualListRef | undefined;
    const view = render(VirtualList, {
      items: makeItems(10),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
      get ref() {
        return listRef;
      },
      set ref(next: VirtualListRef | undefined) {
        listRef = next;
      },
    });

    await waitFor(() => expect(listRef).toBeDefined());
    expect(typeof listRef?.scrollToIndex).toBe('function');

    view.unmount();
    await tick();
    expect(listRef).toBeUndefined();
  });
});
