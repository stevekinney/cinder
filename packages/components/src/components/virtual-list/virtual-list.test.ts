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

  test('starts observing already-mounted rows when dynamicSize flips on at runtime', async () => {
    // `observeRow` is a single stable function reference so rows are not
    // re-observed every render. That only works if Svelte re-runs the attachment
    // when the `dynamicSize` it reads changes — if it does not, flipping the prop
    // would leave every already-mounted row permanently unmeasured.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(view.container).length).toBeGreaterThan(0));
    expect(observedRowElements()).toHaveLength(0);

    await view.rerender({
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(observedRowElements().length).toBe(renderedRows(view.container).length);
  });

  test('stops observing rows when dynamicSize flips back off', async () => {
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(observedRowElements().length).toBeGreaterThan(0));

    await view.rerender({
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: false,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(observedRowElements()).toHaveLength(0);
  });

  test('records a row that measures to zero height instead of discarding it', async () => {
    // A row can legitimately collapse to nothing. Rejecting the measurement would
    // leave the offsets table reserving space it no longer occupies, shifting
    // every later offset and scroll target until it grew again.
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
    expect(spacer.style.blockSize).toBe('2000px');

    reportRowSizes(new Map([[0, 0]]));
    await tick();

    // Row 0 contributed 20px of estimate and now contributes 0.
    expect(spacer.style.blockSize).toBe('1980px');
  });

  test('drops cached measurements for keys that leave the list', async () => {
    // Without pruning, a long-lived feed that filters or rolls over its contents
    // keeps every size it has ever measured, so memory tracks history rather than
    // the current collection.
    installFakeResizeObserver();
    const keyed = (count: number, prefix: string) =>
      Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${index}`,
        label: `${prefix} ${index}`,
      }));
    const getKey = (item: unknown) => (item as KeyedItem).id;

    const view = render(VirtualList, {
      items: keyed(40, 'first'),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      getKey,
      row: keyedRowSnippet(),
      'aria-label': 'Events',
    });

    await waitFor(() => expect(renderedRows(view.container).length).toBeGreaterThan(0));
    reportRowSizes(new Map([[0, 60]]));
    await tick();

    const spacer = view.container.querySelector('.cinder-virtual-list__spacer') as HTMLElement;
    // 40 rows: 39 estimated at 20 plus one measured at 60.
    expect(spacer.style.blockSize).toBe('840px');

    // Replace every item with a fresh key set. The old measurement must not survive.
    await view.rerender({
      items: keyed(40, 'second'),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      getKey,
      row: keyedRowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(spacer.style.blockSize).toBe('800px');
  });

  test('does not yank a scrolled-up reader to the end when dynamicSize flips on during an append', async () => {
    // The pre-append bottom check has to compare against geometry from the mode
    // that was actually active. `previousDynamicTotalSize` stays 0 while fixed mode
    // runs, so evaluating the old position against it would make isAtBottom true
    // for any offset and pin a reader who was nowhere near the bottom.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 200;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({
      items: makeItems(101),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();

    expect(list.scrollTop).toBe(200);
  });

  test('keeps the viewport pinned when an appended row measures taller than the estimate', async () => {
    // The append pin scrolls to the total as currently estimated. A row that then
    // measures taller grows the total without an item-count change, and the anchor
    // correction ignores it because it sits below the anchor — so without a re-pin
    // the viewport ends up short of the bottom.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({
      items: makeItems(51),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();
    await tick();

    // 51 rows x 20px estimate = 1020, minus the 200px viewport.
    expect(list.scrollTop).toBe(820);

    // The newest row turns out to be 80px, not 20px: total becomes 1080.
    reportRowSizes(new Map([[50, 80]]));
    await tick();

    expect(list.scrollTop).toBe(880);
  });

  test('a newer scrollToIndex supersedes an in-flight settle loop', async () => {
    // Two overlapping settle loops write competing targets, and the older one can
    // land last — finishing rapid navigation on the wrong item.
    installFakeResizeObserver();
    let listRef: VirtualListRef | undefined;
    const { container } = render(VirtualList, {
      items: makeItems(500),
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

    listRef?.scrollToIndex(400, { align: 'start' });
    listRef?.scrollToIndex(100, { align: 'start' });

    await tick();
    await tick();

    // The second call wins: index 100 at the 20px estimate.
    expect(list.scrollTop).toBe(2000);
  });

  test('releases the bottom pin while stickToBottom is disabled', async () => {
    // handleScroll only maintains the flag while the option is on, so a pin taken
    // before it was disabled would survive scrolling away — and re-enabling the
    // option would then jump the viewport to the bottom with no append at all.
    installFakeResizeObserver();
    const base = {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, stickToBottom: true });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    // Disable the option, then scroll away from the bottom.
    await view.rerender({ ...base, stickToBottom: false, row: rowSnippet() });
    await tick();
    list.scrollTop = 100;
    await fireEvent.scroll(list);
    await tick();

    // Re-enabling must not treat the stale pin as still valid.
    await view.rerender({ ...base, stickToBottom: true, row: rowSnippet() });
    await tick();
    await tick();

    expect(list.scrollTop).toBe(100);
  });

  test('drops cached measurements when dynamicSize is turned off', async () => {
    // Rows stop being observed in fixed mode, so a row that changes height in the
    // meantime would be rebuilt from its stale cached size the moment dynamic mode
    // came back — and an offscreen row may never be re-observed to correct it.
    installFakeResizeObserver();
    const base = {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, dynamicSize: true, row: rowSnippet() });

    await waitFor(() => expect(renderedRows(view.container).length).toBeGreaterThan(0));
    const spacer = view.container.querySelector('.cinder-virtual-list__spacer') as HTMLElement;

    reportRowSizes(new Map([[0, 60]]));
    await tick();
    expect(spacer.style.blockSize).toBe('2040px');

    await view.rerender({ ...base, dynamicSize: false, row: rowSnippet() });
    await tick();
    expect(spacer.style.blockSize).toBe('2000px');

    // Back on: the stale 60px measurement must be gone, not reused.
    await view.rerender({ ...base, dynamicSize: true, row: rowSnippet() });
    await tick();
    expect(spacer.style.blockSize).toBe('2000px');
  });

  test('keeps the pin for an at-bottom reader when dynamicSize flips on during an append', async () => {
    // The mirror of the scrolled-up case above. Guarding the bottom check on the
    // mode being unchanged fixes the yank but silently drops the pin for a reader
    // who genuinely was at the bottom; carrying the previous run's real total is
    // what makes both directions correct.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    // 50 rows x 20px = 1000, minus a 200px viewport: 800 is the bottom.
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({
      items: makeItems(51),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();
    await tick();

    expect(list.scrollTop).toBe(820);
  });

  test('measures the viewport before computing the append pin target', async () => {
    // Source-shape assertion, deliberately, because a behavioral one cannot
    // distinguish the two orderings in this harness: happy-dom's
    // getBoundingClientRect returns zero, so syncViewport falls through to parsing
    // the `height` prop — and the general viewport effect re-reads that prop on
    // change anyway, refreshing the measurement before the pin runs. In a real
    // browser the ordering is load-bearing: an update that appends AND shrinks
    // `height` computes the bottom from the pre-patch viewport and lands short,
    // with no re-pin effect in fixed mode to rescue it.
    //
    // Pinning the shape here keeps a refactor from silently reintroducing the
    // stale read. The real behavior is browser-verified in the Playwright suite.
    const source = await Bun.file(
      new URL('./virtual-list.svelte', import.meta.url).pathname,
    ).text();

    // Both bounds resolved relative to the guard, not from the top of the file:
    // `isPinnedToBottom = true;` also appears in the mount effect above, and an
    // absolute search would slice backwards into an empty string that trivially
    // "passes" every assertion below.
    const pinStart = source.indexOf('shouldStickAfterAppend || !element) return;');
    const pinBody = source.slice(pinStart, source.indexOf('isPinnedToBottom = true;', pinStart));

    const measureIndex = pinBody.indexOf('syncViewport(element)');
    const writeIndex = pinBody.indexOf('writeScrollOffset(');

    expect(measureIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeGreaterThan(-1);
    // The measurement must come first, and its result — not the derived
    // viewportHeight — must be what the target is computed from.
    expect(measureIndex).toBeLessThan(writeIndex);
    expect(pinBody).toContain('const currentViewportHeight = syncViewport(element);');
    expect(pinBody).toContain('currentViewportHeight,');
  });

  test('lets the bottom pin win over an anchor correction in a mixed measurement batch', async () => {
    // A batch with resizes both above and below the anchor makes the two
    // mechanisms disagree: the pin targets the new total using every delta, the
    // correction only the deltas before the anchor. The correction must yield.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({
      items: makeItems(51),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();
    await tick();
    expect(list.scrollTop).toBe(820);

    // Row 38 sits BEFORE the anchor (index 41 at offset 820) so it queues a real
    // correction, and row 50 is the newest edge. Total becomes 1020 + 20 + 60 =
    // 1100, so the bottom is 900 — while the correction alone would target 840.
    reportRowSizes(
      new Map([
        [38, 40],
        [50, 80],
      ]),
    );
    await tick();
    await tick();

    expect(list.scrollTop).toBe(900);
  });

  test('does not arm the pin when stickToBottom is disabled before the deferred callback runs', async () => {
    // The append pin defers past a tick. If the prop is disabled in between, the
    // disabled-mode effect clears the pin — and arming it again here would leave a
    // stale flag that no later scroll clears, so re-enabling would jump to the end
    // with no append behind it.
    installFakeResizeObserver();
    const base = {
      items: makeItems(51),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    // Append with the option still ON so the deferred callback is scheduled, then
    // disable it before the awaited tick resolves. Deliberately not awaited between
    // the two, which is what puts the disable inside the callback's window.
    void view.rerender({ ...base, stickToBottom: true, row: rowSnippet() });
    void view.rerender({ ...base, stickToBottom: false, row: rowSnippet() });
    await tick();
    await tick();

    list.scrollTop = 100;
    await fireEvent.scroll(list);
    await tick();

    // Re-enable. With a stale pin this jumps to the bottom; correctly, it holds.
    await view.rerender({ ...base, stickToBottom: true, row: rowSnippet() });
    await tick();
    await tick();

    expect(list.scrollTop).toBe(100);
  });

  test('keeps the reader on the same row when the itemHeight estimate changes', async () => {
    // An estimate change re-sizes every unmeasured row at once. No ResizeObserver
    // fires — the rows did not change, the estimate did — so nothing queues a
    // correction, and this mode disables native scroll anchoring. Without
    // re-anchoring, the same scrollTop resolves to a different row entirely.
    installFakeResizeObserver();
    const base = {
      items: makeItems(1000),
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, itemHeight: 20, row: rowSnippet() });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    // At a 20px estimate, offset 10000 puts the reader at index 500.
    list.scrollTop = 10_000;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({ ...base, itemHeight: 40, row: rowSnippet() });
    await tick();
    await tick();

    // Index 500 now starts at 500 * 40 = 20000. Holding scrollTop would have left
    // the reader at index 250 instead.
    expect(list.scrollTop).toBe(20_000);
  });

  test('re-anchors from the rebuilt table when an estimate change and a measurement land together', async () => {
    // The re-anchor is computed from the table AFTER the rebuild, so it already
    // contains this flush's measurement. Adding the correction delta on top would
    // count it twice; letting the correction overwrite the re-anchor would drop the
    // estimate adjustment. Neither is right — the re-anchor alone is.
    installFakeResizeObserver();
    const base = {
      items: makeItems(100),
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, itemHeight: 20, row: rowSnippet() });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 400;
    await fireEvent.scroll(list);
    await tick();

    // Row 15 is mounted and sits above the anchor at index 20.
    reportRowSizes(new Map([[15, 60]]));
    await view.rerender({ ...base, itemHeight: 40, row: rowSnippet() });
    await tick();
    await tick();

    // Rebuilt table: rows 0-14 and 16-19 at the new 40px estimate, row 15 measured
    // at 60. Index 20 therefore starts at 19*40 + 60 = 820, and the reader was
    // exactly at the top of index 20.
    expect(list.scrollTop).toBe(820);
  });

  test('retires the settle generation from input events, not from scroll offsets', async () => {
    // Source-shape for the mechanism, because the harness cannot hold a settle loop
    // in flight: it converges on its first attempt, so a user event never arrives
    // while one is running. What IS pinned here is that takeover is detected from
    // INPUT rather than inferred from offsets — the previous offset-comparison
    // version classified a smooth scroll's own intermediate events as interruption
    // and cancelled the settle pass that smooth scrolling exists to need.
    const source = await Bun.file(
      new URL('./virtual-list.svelte', import.meta.url).pathname,
    ).text();

    // Scrolling is no longer where takeover is decided.
    const scrollHandler = source.slice(
      source.indexOf('function handleScroll('),
      source.indexOf('function retireSettleLoop('),
    );
    expect(scrollHandler).not.toContain('scrollToIndexGeneration');

    // Input events are.
    expect(source).toContain('function retireSettleLoop()');
    for (const handler of [
      'function handleWheel(',
      'function handlePointerDown(',
      'function handleTouchStart(',
      'function handleKeyDown(',
    ]) {
      expect(source).toContain(handler);
    }
    // A letter keypress is not a viewport takeover; only scrolling keys are.
    expect(source).toContain('SCROLLING_KEYS.has(event.key)');
  });

  test('still forwards consumer wheel, pointer, touch, and key handlers', async () => {
    // Four handlers were added to the root to detect takeover. Any of them
    // clobbering a consumer's own handler would be a silent regression, so this is
    // behavioural rather than structural.
    const calls: string[] = [];
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
      onwheel: () => calls.push('wheel'),
      onpointerdown: () => calls.push('pointerdown'),
      ontouchstart: () => calls.push('touchstart'),
      onkeydown: () => calls.push('keydown'),
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    await fireEvent.wheel(list, { deltaY: 100 });
    await fireEvent.pointerDown(list);
    await fireEvent.touchStart(list, { touches: [] });
    await fireEvent.keyDown(list, { key: 'ArrowDown' });

    expect(calls).toEqual(['wheel', 'pointerdown', 'touchstart', 'keydown']);
  });

  test('clamps the re-anchor offset to the rebuilt anchor row', async () => {
    // A reader deep inside a measured tall row would, across a rebuild that replaces
    // it with a small estimate, be placed many rows past the anchor — which then
    // unmounts and can never be remeasured to correct the position.
    installFakeResizeObserver();
    const base = {
      items: makeItems(200),
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, itemHeight: 20, row: rowSnippet() });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 200;
    await fireEvent.scroll(list);
    await tick();

    // Row 10 is mounted and measures 400px, far taller than the estimate.
    reportRowSizes(new Map([[10, 400]]));
    await tick();

    // Sit deep inside that row: it now spans [200, 600).
    list.scrollTop = 560;
    await fireEvent.scroll(list);
    await tick();

    // An estimate change rebuilds row 10 back down to 40px.
    await view.rerender({ ...base, itemHeight: 40, row: rowSnippet() });
    await tick();
    await tick();

    // Row 10 starts at 400 in the rebuilt table and is 400px tall (its measurement
    // survives an estimate change), so a 360px intra-row offset still fits. What
    // matters is that the reader stays within the anchor row rather than being
    // carried past it.
    const anchorStart = 10 * 40;
    expect(list.scrollTop).toBeGreaterThanOrEqual(anchorStart);
    expect(list.scrollTop).toBeLessThanOrEqual(anchorStart + 400);
  });
});

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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

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
    const firstRow = container.querySelector('[data-cinder-virtual-index]') as HTMLElement;
    // Read through CSSStyleDeclaration rather than the raw attribute string, whose
    // whitespace and property order are serialization details that vary by DOM
    // implementation. Assert the PROPERTY, not just the number: `40px` alone passed
    // against the original code, which set a physical `height` in both modes.
    expect(firstRow.style.inlineSize).toBe('40px');
    expect(firstRow.style.blockSize).toBe('');
  });
});

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
    const firstRow = container.querySelector('[data-cinder-virtual-index]') as HTMLElement;
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
    const spacer = container.querySelector('.cinder-virtual-list__spacer') as HTMLElement;
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollLeft = 400;
    await fireEvent.scroll(list);

    const window_ = container.querySelector('.cinder-virtual-list__window') as HTMLElement;
    await waitFor(() => expect(window_.style.insetInlineStart).toBe('400px'));
    expect(window_.style.insetBlockStart).toBe('');
  });
});

describe('VirtualList — reverse', () => {
  test('opens at the end rather than the start', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(500),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      row: rowSnippet(),
      'aria-label': 'Transcript',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '499')).toBe(true),
    );
    expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(false);
  });

  test('pins to the end on append even when the reader has scrolled away', async () => {
    // This is the whole difference from stickToBottom, which would leave a
    // scrolled-up reader where they are.
    const { container, rerender } = render(VirtualList, {
      items: makeItems(500),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: rowSnippet(),
      'aria-label': 'Transcript',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    list.scrollTop = 0;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true),
    );

    await rerender({
      items: makeItems(510),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: rowSnippet(),
      'aria-label': 'Transcript',
    });

    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '509')).toBe(true),
    );
  });

  test('a prepend holds the reader in place instead of pinning to the end', async () => {
    // Loading older history must not yank the reader anywhere. The row they were
    // on keeps its position while ten rows arrive above it, so the rendered
    // indices shift by exactly ten.
    const buildItems = (count: number, offset: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `key-${index - offset}` }));

    const { container, rerender } = render(VirtualList, {
      items: buildItems(500, 0),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      getKey: (item: unknown) => (item as { id: string }).id,
      row: rowSnippet(),
      'aria-label': 'Transcript',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 2_000;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '100')).toBe(true),
    );

    // Ten older rows arrive at the FRONT: same keys, shifted ten places along.
    await rerender({
      items: buildItems(510, 10),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      overscan: 0,
      getKey: (item: unknown) => (item as { id: string }).id,
      row: rowSnippet(),
      'aria-label': 'Transcript',
    });

    // The reader stays on the same key, which now lives ten indexes later.
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '110')).toBe(true),
    );
    // And is emphatically not dragged to the end.
    expect(renderedRows(container).some((node) => node.dataset['index'] === '509')).toBe(false);
  });
});

describe('VirtualList — infinite scroll callbacks', () => {
  test('fires onEndReached once per approach rather than once per scroll event', async () => {
    let endReachedCount = 0;
    const { container } = render(VirtualList, {
      items: makeItems(200),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onEndReached: () => {
        endReachedCount += 1;
      },
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    expect(endReachedCount).toBe(0);

    list.scrollTop = 3_800;
    await fireEvent.scroll(list);
    await waitFor(() => expect(endReachedCount).toBe(1));

    // Several more updates that all remain near the end must not re-fire.
    list.scrollTop = 3_820;
    await fireEvent.scroll(list);
    list.scrollTop = 3_800;
    await fireEvent.scroll(list);
    expect(endReachedCount).toBe(1);
  });

  test('re-arms once the requested items arrive', async () => {
    let endReachedCount = 0;
    const props = (count: number) => ({
      items: makeItems(count),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onEndReached: () => {
        endReachedCount += 1;
      },
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    const { container, rerender } = render(VirtualList, props(200));
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    list.scrollTop = 3_800;
    await fireEvent.scroll(list);
    await waitFor(() => expect(endReachedCount).toBe(1));

    // A page arrives. Without the item-count release the latch would stay set and
    // the list could never request a second page.
    await rerender(props(400));
    list.scrollTop = 7_800;
    await fireEvent.scroll(list);
    await waitFor(() => expect(endReachedCount).toBe(2));
  });

  test('fires onStartReached near the start', async () => {
    let startReachedCount = 0;
    render(VirtualList, {
      items: makeItems(200),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onStartReached: () => {
        startReachedCount += 1;
      },
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    // A list mounted at the top is already at its start edge.
    await waitFor(() => expect(startReachedCount).toBe(1));
  });

  test('a load-more loop terminates once the list overflows the viewport', async () => {
    // The runaway case: every fire appends, every append re-arms the latch. What
    // must stop the loop is proximity going false as the list outgrows the
    // viewport — not the latch, which deliberately releases on a count change.
    let fireCount = 0;
    let itemCount = 5;
    const props = () => ({
      items: makeItems(itemCount),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onEndReached: () => {
        fireCount += 1;
      },
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    const { container, rerender } = render(VirtualList, props());
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    // Stand in for a consumer that appends a page on every call. The guard is the
    // assertion: a list that never stops asking would exhaust it.
    let rounds = 0;
    let previousFireCount = -1;
    while (fireCount !== previousFireCount && rounds < 20) {
      previousFireCount = fireCount;
      itemCount += 5;
      await rerender(props());
      await tick();
      rounds += 1;
    }

    expect(rounds).toBeLessThan(20);
    // And it stopped because the end genuinely left range, not because nothing
    // ever fired.
    expect(fireCount).toBeGreaterThan(0);
  });

  test('neither callback fires for an empty list', async () => {
    // An empty list has no edge to reach, and firing here would ask a source that
    // returned nothing to return nothing again.
    let calls = 0;
    render(VirtualList, {
      items: [],
      itemHeight: 20,
      height: '200px',
      onEndReached: () => {
        calls += 1;
      },
      onStartReached: () => {
        calls += 1;
      },
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await tick();
    await tick();
    expect(calls).toBe(0);
  });
});
