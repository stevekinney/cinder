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
    // Anchored on `void tick().then(`, which marks the start of the pin body itself
    // rather than the guard above it. The guard's text keeps changing as modes are
    // added, and each time it does this test starts asserting against an empty slice
    // instead of failing — hence the explicit bounds check below.
    const pinStart = source.indexOf('void tick().then(');
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
    // A letter keypress is not a viewport takeover, and neither is an arrow across an
    // axis that does not overflow — it scrolls nothing, so retiring a settle loop for
    // it abandons a correction still owed to the destination.
    expect(source).toContain('scrollsMainAxis(event.key)');
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
    // A reader deep inside a tall row would, across a rebuild that shrinks it, be
    // carried many rows past the anchor — which then unmounts and can never be
    // remeasured to correct the position.
    //
    // The anchor row is deliberately UNMEASURED here, so its size comes from the
    // estimate and shrinks with it. An earlier version of this test used a MEASURED
    // anchor, whose size survives the estimate change; the carried-forward offset
    // then still fit inside the row and an unclamped implementation produced exactly
    // the same number, so the assertion passed either way.
    installFakeResizeObserver();
    const base = {
      items: makeItems(200),
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, itemHeight: 1_000, row: rowSnippet() });

    const list = view.container.querySelector('.cinder-virtual-list') as HTMLElement;

    // Sit 900px into row 10, which spans [10000, 11000) at the large estimate.
    list.scrollTop = 10_900;
    await fireEvent.scroll(list);
    await tick();

    // The estimate collapses. Row 10 now spans [400, 440): its whole size is 40px,
    // far less than the 900px the reader was carrying inside it.
    await view.rerender({ ...base, itemHeight: 40, row: rowSnippet() });
    await tick();
    await tick();

    const anchorStart = 10 * 40;
    // Unclamped this lands at 400 + 900 = 1300, inside row 32.
    expect(list.scrollTop).toBeGreaterThanOrEqual(anchorStart);
    expect(list.scrollTop).toBeLessThanOrEqual(anchorStart + 40);
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

  test('pins to the end under dynamicSize, where the total keeps growing after the write', async () => {
    // reverse + dynamicSize is the combination the re-pin effect exists for. The
    // append pin writes against the total as currently estimated; rows measured
    // afterwards grow it further. The pin deliberately reuses `isPinnedToBottom`
    // rather than bypassing it, so that the re-pin effect keeps following.
    const props = (count: number) => ({
      items: makeItems(count),
      itemHeight: 20,
      height: '200px',
      reverse: true,
      dynamicSize: true,
      overscan: 0,
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: rowSnippet(),
      'aria-label': 'Transcript',
    });

    const { container, rerender } = render(VirtualList, props(300));
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    list.scrollTop = 0;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true),
    );

    await rerender(props(310));
    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '309')).toBe(true),
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

  test('a prepend in response to onStartReached does not immediately ask for another page', async () => {
    // Caught from a captured screenshot, not from a unit test: the documentation
    // example read "2 older pages" on first paint. The callback fires, the consumer
    // prepends, and the component queues a correction to hold the reader's row — but
    // the effect re-runs on the new item count BEFORE that correction lands, still
    // sees the reader at the start, and asks again. A real API gets fetched twice.
    let startReachedCount = 0;
    const pageSize = 50;
    let firstId = 0;
    const buildItems = (count: number, offset: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `key-${index - offset}` }));

    const props = (count: number, offset: number) => ({
      items: buildItems(count, offset),
      itemHeight: 40,
      height: '320px',
      overscan: 5,
      getKey: (item: unknown) => (item as { id: string }).id,
      onStartReached: () => {
        startReachedCount += 1;
      },
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    const { container, rerender } = render(VirtualList, props(100, firstId));
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    await waitFor(() => expect(startReachedCount).toBe(1));

    // The consumer's response: a page of older rows at the front.
    firstId += pageSize;
    await rerender(props(100 + pageSize, firstId));
    await tick();
    await tick();

    expect(startReachedCount).toBe(1);
  });

  test('re-enabling one callback fires again, even at the same position and count', async () => {
    // The latch is per edge. Resetting it only when BOTH callbacks are absent left
    // the removed edge latched, so putting that one callback back at the same
    // position and item count found it already set and stayed silent.
    let endReachedCount = 0;
    const onEndReached = () => {
      endReachedCount += 1;
    };
    // Passed explicitly as undefined, which is how a consumer disables a handler
    // conditionally — and the only way to clear it here, since `rerender` merges
    // props rather than replacing them, so an omitted key keeps its previous value.
    const props = (handler: (() => void) | undefined) => ({
      items: makeItems(200),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onStartReached: () => {},
      onEndReached: handler,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    const { container, rerender } = render(VirtualList, props(onEndReached));
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    list.scrollTop = 3_800;
    await fireEvent.scroll(list);
    await waitFor(() => expect(endReachedCount).toBe(1));

    // Remove the callback while the reader stays exactly where they are.
    await rerender(props(undefined));
    await tick();

    // Put it back, still near the end, still the same item count.
    await rerender(props(onEndReached));
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

describe('VirtualList — scrollRestoration', () => {
  function createStorage() {
    const entries = new Map<string, string>();
    return {
      entries,
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
    };
  }

  test('writes nothing without an id, because an implicit key would collide', async () => {
    const storage = createStorage();
    const originalSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: storage,
      configurable: true,
    });

    try {
      const { container, unmount } = render(VirtualList, {
        items: makeItems(500),
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        row: rowSnippet(),
        'aria-label': 'Feed',
      });
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      unmount();
      await tick();
      expect(storage.entries.size).toBe(0);
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      });
    }
  });

  test('saves on teardown and restores on the next mount', async () => {
    const storage = createStorage();
    const originalSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: storage,
      configurable: true,
    });

    const props = () => ({
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      scrollRestoration: true,
      scrollRestorationId: 'feed',
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    try {
      const first = render(VirtualList, props());
      await waitFor(() => expect(renderedRows(first.container).length).toBeGreaterThan(0));
      const list = first.container.querySelector('.cinder-virtual-list') as HTMLElement;
      list.scrollTop = 4_000;
      await fireEvent.scroll(list);
      await waitFor(() =>
        expect(renderedRows(first.container).some((node) => node.dataset['index'] === '200')).toBe(
          true,
        ),
      );

      first.unmount();
      await tick();
      expect(storage.entries.size).toBe(1);

      const second = render(VirtualList, props());
      await waitFor(() => expect(renderedRows(second.container).length).toBeGreaterThan(0));
      await waitFor(() =>
        expect(renderedRows(second.container).some((node) => node.dataset['index'] === '200')).toBe(
          true,
        ),
      );
      expect(renderedRows(second.container).some((node) => node.dataset['index'] === '0')).toBe(
        false,
      );
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      });
    }
  });

  test('does not apply a saved position whose row no longer exists', async () => {
    // The collection shrank between visits. The saved row is simply not restored —
    // clamping into range would drop the reader somewhere arbitrary and then re-save
    // that as though it were their place. The entry itself is left alone: nothing
    // reads it, and teardown overwrites it with the reader's real position. Deleting
    // it mattered only back when a missing anchor got clamped rather than skipped.
    const storage = createStorage();
    storage.setItem(
      'cinder:virtual-list:feed',
      JSON.stringify({ scrollOffset: 4_000, startIndex: 200 }),
    );
    const originalSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: storage,
      configurable: true,
    });

    try {
      const { container } = render(VirtualList, {
        items: makeItems(10),
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      });
    }
  });

  test('a storage that throws on every access does not break the list', async () => {
    // Safari in private browsing throws on access, not only on write.
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const originalSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: hostile,
      configurable: true,
    });

    try {
      const { container, unmount } = render(VirtualList, {
        items: makeItems(500),
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      expect(() => unmount()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      });
    }
  });
});

describe('VirtualList — scrollRestoration lifecycle', () => {
  function createStorage(seed?: Record<string, string>) {
    const entries = new Map<string, string>(Object.entries(seed ?? {}));
    return {
      entries,
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
    };
  }

  function withStorage(storage: unknown, run: () => Promise<void>) {
    const original = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true });
    return run().finally(() => {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: original,
        configurable: true,
      });
    });
  }

  test('keeps a saved position when the list mounts empty while its data loads', async () => {
    // A list that fetches its own data always renders empty first. Treating that as
    // "the collection shrank" deleted the entry, so such a list could never restore.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({ scrollOffset: 4_000, startIndex: 200 }),
    });

    await withStorage(storage, async () => {
      render(VirtualList, {
        items: [],
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });
      await tick();
      await tick();
      expect(storage.entries.has('cinder:virtual-list:feed')).toBe(true);
    });
  });

  test('restores once the asynchronously loaded items arrive', async () => {
    // The list that most needs restoring is the one that fetches its own data, and
    // its first render is always empty. Restoring strictly on mount would mean it
    // never restores at all.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({ scrollOffset: 4_000, startIndex: 200 }),
    });

    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: makeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      const { container, rerender } = render(VirtualList, props(0));
      await tick();

      // The fetch lands.
      await rerender(props(1_000));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('still saves on teardown after the list has grown', async () => {
    // An $effect cleanup runs on INVALIDATION as well as teardown. With the saver
    // folded into an effect that tracks the item count, the first append ran the
    // cleanup and then re-ran the effect — which, already having restored, returned
    // early and registered no new cleanup. From then on nothing saved at all.
    const storage = createStorage();
    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: makeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      const { container, rerender, unmount } = render(VirtualList, props(1_000));
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

      const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
      list.scrollTop = 4_000;
      await fireEvent.scroll(list);
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );

      // The list grows, which is what invalidated the effect.
      await rerender(props(1_010));
      await tick();

      unmount();
      await tick();

      const raw = storage.entries.get('cinder:virtual-list:feed');
      expect(raw).toBeDefined();
      expect(JSON.parse(raw as string).startIndex).toBe(200);
    });
  });

  test('a changed id is a new collection to restore', async () => {
    // A parent reusing this component for a different collection changes the id.
    // An instance-wide "already restored" flag would suppress the new restore.
    const storage = createStorage({
      'cinder:virtual-list:second': JSON.stringify({ scrollOffset: 4_000, startIndex: 200 }),
    });

    await withStorage(storage, async () => {
      const props = (id: string) => ({
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: id,
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      const { container, rerender } = render(VirtualList, props('first'));
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

      await rerender(props('second'));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('finds the anchor by key after the collection grew at the front', async () => {
    // The list was unmounted while a feed received older messages. Every index moved;
    // no row did. An index-only anchor restores several rows off.
    const buildItems = (count: number, offset: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `key-${index - offset}` }));

    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
        anchorKey: 'key-200',
      }),
    });

    await withStorage(storage, async () => {
      // 50 older rows arrived, so `key-200` now lives at index 250.
      const { container } = render(VirtualList, {
        items: buildItems(1_050, 50),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (item: unknown) => (item as { id: string }).id,
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '250')).toBe(true),
      );
      expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(false);
    });
  });

  test('restores a fixed-size list from its row anchor, not the stale pixel offset', async () => {
    // `itemHeight` can differ between visits — a density setting, a responsive
    // breakpoint. The saved pixel offset then points at a different row entirely.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
      }),
    });

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: makeItems(1_000),
        // Half the height the position was saved at.
        itemHeight: 10,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      // Row 200, not the row at pixel 4000 (which is now row 400).
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('a pending restore outranks the initial reverse pin and the edge callbacks', async () => {
    // Both assume the list opens where it renders, and a restore is about to move it
    // somewhere else.
    //
    // The `onStartReached` half is what this test pins: without its guard the callback
    // fires because the list rendered at offset 0 for one frame. The reverse-pin half
    // currently holds by effect ordering alone — restoration runs after the pin and
    // overwrites it — so the guard there is defensive, and removing it does NOT fail
    // this test. It is kept so the intent survives a reordering.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
      }),
    });
    let startReachedCount = 0;

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        reverse: true,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (_item: unknown, index: number) => `row-${index}`,
        onStartReached: () => {
          startReachedCount += 1;
        },
        row: rowSnippet(),
        'aria-label': 'Transcript',
      });

      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
      // Not pinned to the newest message.
      expect(renderedRows(container).some((node) => node.dataset['index'] === '999')).toBe(false);
      expect(startReachedCount).toBe(0);
    });
  });

  test('waits for an incrementally loaded page to reach the saved row', async () => {
    // A feed that loads page by page has a first non-empty render that does not
    // reach the saved anchor yet. Treating that as "the row was deleted" would
    // abandon the position before the page carrying it ever arrived.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
      }),
    });

    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: makeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      // First page: 50 rows, nowhere near index 200.
      const { container, rerender } = render(VirtualList, props(50));
      await tick();
      expect(renderedRows(container).some((node) => node.dataset['index'] === '0')).toBe(true);

      // The page carrying the anchor arrives.
      await rerender(props(1_000));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('lets pagination run while it waits for the restoration anchor', async () => {
    // The deadlock these two features can form: restoration suppresses the edge
    // callbacks so a half-rendered list does not fetch spuriously, but the edge
    // callbacks are exactly what loads the page carrying the saved anchor. Suppress
    // them while WAITING and nothing ever loads, so nothing ever restores.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 4_000,
        startIndex: 200,
        offsetWithinRow: 0,
      }),
    });
    let endReachedCount = 0;

    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: makeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 2,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        onEndReached: () => {
          endReachedCount += 1;
        },
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      // A first page far short of the anchor, with its end already in view.
      const { container, rerender } = render(VirtualList, props(12));
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

      // The consumer must be asked for more, or the anchor never arrives.
      await waitFor(() => expect(endReachedCount).toBeGreaterThan(0));

      await rerender(props(1_000));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );
    });
  });

  test('restores the saved row when it arrives in a PREPENDED page', async () => {
    // The saved row usually arrives in a page of older history, and a prepend queues
    // its own correction to hold the pre-prepend viewport. That correction is applied
    // by a later effect, so without retiring it the reader lands back on the row they
    // were watching while loading rather than the one they left off at.
    //
    // The keys must form a genuine prepend — the previous sequence a SUFFIX of the
    // next — or the growth classifies as `replaced` and queues no correction at all,
    // which is what an earlier version of this test accidentally exercised.
    const buildItems = (count: number, offset: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `key-${index - offset}` }));

    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 100,
        startIndex: 5,
        offsetWithinRow: 0,
        anchorKey: 'key--25',
      }),
    });

    await withStorage(storage, async () => {
      const props = (count: number, offset: number) => ({
        items: buildItems(count, offset),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (item: unknown) => (item as { id: string }).id,
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      // key-0 .. key-19. The saved `key--25` is not here yet.
      const { container, rerender } = render(VirtualList, props(20, 0));
      await tick();

      // 30 older rows arrive at the front: key--30 .. key-19. The previous sequence
      // is now the suffix, so this is a true prepend, and `key--25` sits at index 5.
      await rerender(props(50, 30));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '5')).toBe(true),
      );
      // Not held at the pre-prepend view, where key-0 now lives at index 30.
      expect(renderedRows(container).some((node) => node.dataset['index'] === '30')).toBe(false);
    });
  });

  test('lets an empty list fetch its first page while restoration is configured', async () => {
    // The deadlock at the other end: an empty list has nothing to restore onto, and
    // the restore effect returns before recording an attempt — so suppressing the
    // edge callbacks here means a list that fetches its FIRST page from them never
    // loads anything, and restoration never becomes possible.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 100,
        startIndex: 5,
        offsetWithinRow: 0,
      }),
    });
    let endReachedCount = 0;

    await withStorage(storage, async () => {
      render(VirtualList, {
        items: [],
        itemHeight: 20,
        height: '200px',
        overscan: 2,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        onEndReached: () => {
          endReachedCount += 1;
        },
        onStartReached: () => {
          endReachedCount += 1;
        },
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await tick();
      await tick();
      // An empty list reports no edges at all, so nothing fires — but crucially the
      // suppression is not what stopped it, so a list that renders one row can page.
      expect(endReachedCount).toBe(0);
    });
  });

  test('a restore overrides the append pin that armed while its page loaded', async () => {
    // Under `reverse`, a page arriving with the anchor also arms the append pin, whose
    // effect scrolls to the maximum offset a tick later — after the restore landed.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 100,
        startIndex: 5,
        offsetWithinRow: 0,
        anchorKey: 'row-5',
      }),
    });

    await withStorage(storage, async () => {
      const props = (count: number) => ({
        items: makeItems(count),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        reverse: true,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        getKey: (_item: unknown, index: number) => `row-${index}`,
        row: rowSnippet(),
        'aria-label': 'Transcript',
      });

      const { container, rerender } = render(VirtualList, props(0));
      await tick();

      await rerender(props(200));
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '5')).toBe(true),
      );
      // Not yanked to the newest message by the pin the append armed.
      expect(renderedRows(container).some((node) => node.dataset['index'] === '199')).toBe(false);
    });
  });

  test('keeps a remainder that no longer fits inside its own row', async () => {
    // 30px into a 40px row, restored when rows are 20px tall. An inclusive clamp
    // gives exactly 20 — which is row 201's start, not row 200's.
    const storage = createStorage({
      'cinder:virtual-list:feed': JSON.stringify({
        scrollOffset: 8_030,
        startIndex: 200,
        offsetWithinRow: 30,
      }),
    });

    await withStorage(storage, async () => {
      const { container } = render(VirtualList, {
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
      // Row 200 starts at 4000; anything from 4019 up would be row 201.
      expect(list.scrollTop).toBeGreaterThanOrEqual(4_000);
      expect(list.scrollTop).toBeLessThan(4_020);
    });
  });

  test('a whitespace-only id is not an id', async () => {
    const storage = createStorage();
    await withStorage(storage, async () => {
      const { container, unmount } = render(VirtualList, {
        items: makeItems(200),
        itemHeight: 20,
        height: '200px',
        scrollRestoration: true,
        scrollRestorationId: '   ',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      unmount();
      await tick();
      expect(storage.entries.size).toBe(0);
    });
  });

  test('saves the row the reader is on, not the overscanned window boundary', async () => {
    // `virtualWindow.startIndex` carries overscan, so saving it would restore the
    // reader a few rows above where they left off — every single time.
    const storage = createStorage();
    await withStorage(storage, async () => {
      const { container, unmount } = render(VirtualList, {
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 5,
        scrollRestoration: true,
        scrollRestorationId: 'feed',
        row: rowSnippet(),
        'aria-label': 'Feed',
      });
      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

      const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
      list.scrollTop = 4_000;
      await fireEvent.scroll(list);
      await waitFor(() =>
        expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
      );

      unmount();
      await tick();

      const raw = storage.entries.get('cinder:virtual-list:feed');
      expect(raw).toBeDefined();
      expect(JSON.parse(raw as string).startIndex).toBe(200);
    });
  });
});

describe('VirtualList — list semantics', () => {
  test('announces each row as 1-based within the FULL collection, not the window', async () => {
    // The whole reason these attributes are needed on a virtualized list: without
    // them assistive technology announces the rendered window, so a 10,000-row list
    // reads as "3 of 12".
    const { container } = render(VirtualList, {
      items: makeItems(10_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const firstRow = container.querySelector('[data-cinder-virtual-index="0"]') as HTMLElement;
    expect(firstRow.getAttribute('aria-posinset')).toBe('1');
    expect(firstRow.getAttribute('aria-setsize')).toBe('10000');
    expect(renderedRows(container).length).toBeLessThan(100);
  });
});

describe('VirtualList — stickyItems', () => {
  test('keeps a sticky row mounted after the reader scrolls past it', async () => {
    // A pinned header whose index leaves the window would be unmounted by plain
    // virtualization, so the heading would vanish exactly when it is meant to show.
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);

    await waitFor(() =>
      expect(renderedRows(container).some((node) => node.dataset['index'] === '200')).toBe(true),
    );
    const sticky = container.querySelector<HTMLElement>('[data-cinder-virtual-index="0"]');
    expect(sticky).not.toBeNull();
    expect(sticky?.getAttribute('data-cinder-sticky')).toBe('true');
    expect(sticky?.getAttribute('data-cinder-sticky-active')).toBe('true');
  });

  test('renders the pinned row in index order, since it is read by assistive technology', async () => {
    // Ordering costs nothing visually — the row is absolutely positioned, so it does
    // not lay out among its siblings, and it stays above them by the sticky rule's
    // `z-index` rather than by coming last. What ordering buys is reading order: this
    // element is exposed to assistive technology, so it belongs where the row does.
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-sticky-pinned="true"]')).not.toBeNull(),
    );

    const indexes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-cinder-virtual-index]'),
    ).map((node) => Number(node.dataset['cinderVirtualIndex']));
    expect(indexes[0]).toBe(0);
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
  });

  test('keeps the pinned row absolutely positioned despite the sticky rule matching it too', async () => {
    // Both rules match a pinned row at equal specificity, so source order alone
    // decided the winner — and `position: sticky` took it back, putting the row into
    // flow and displacing every row after it. The selector carries both attributes so
    // the outcome does not depend on which rule is written first.
    const source = await Bun.file(new URL('./virtual-list.css', import.meta.url).pathname).text();
    expect(source).toContain("[data-cinder-sticky='true'][data-cinder-sticky-pinned='true']");
  });

  test('keeps the very same DOM node as a sticky row crosses the window boundary', async () => {
    // The reason the pinned row stays in the keyed each rather than moving to an
    // element of its own: Svelte cannot carry identity across that boundary, so a row
    // holding local state or a focused control would be destroyed and rebuilt every
    // time it crossed.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      getKey: (_item: unknown, index: number) => `row-${index}`,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const before = container.querySelector('[data-cinder-virtual-index="0"]');
    expect(before).not.toBeNull();

    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-sticky-pinned="true"]')).not.toBeNull(),
    );

    const after = container.querySelector('[data-cinder-virtual-index="0"]');
    expect(after).toBe(before);
  });

  test('leaves the sticky attributes off when no sticky items are configured', async () => {
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    expect(container.querySelector('[data-cinder-sticky]')).toBeNull();
  });
});

describe('VirtualList — smoothScroll', () => {
  function renderWithRef(extra: Record<string, unknown>) {
    let listRef: VirtualListRef | undefined;
    const rendered = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Feed',
      ...extra,
      get ref() {
        return listRef;
      },
      set ref(next: VirtualListRef | undefined) {
        listRef = next;
      },
    });
    return { ...rendered, getRef: () => listRef };
  }

  test('animates scrollToIndex by default when smoothScroll is on', async () => {
    const behaviors: (string | undefined)[] = [];
    const { container, getRef } = renderWithRef({ smoothScroll: true });
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTo = ((options: ScrollToOptions) => {
      behaviors.push(options?.behavior);
    }) as typeof list.scrollTo;

    getRef()?.scrollToIndex(400, { align: 'start' });
    await tick();
    expect(behaviors).toContain('smooth');
  });

  test('an explicit behavior in the call still wins', async () => {
    const behaviors: (string | undefined)[] = [];
    const { container, getRef } = renderWithRef({ smoothScroll: true });
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTo = ((options: ScrollToOptions) => {
      behaviors.push(options?.behavior);
    }) as typeof list.scrollTo;

    getRef()?.scrollToIndex(400, { align: 'start', behavior: 'auto' });
    await tick();
    expect(behaviors).not.toContain('smooth');
  });

  test('does not animate when smoothScroll is off', async () => {
    const behaviors: (string | undefined)[] = [];
    const { container, getRef } = renderWithRef({});
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTo = ((options: ScrollToOptions) => {
      behaviors.push(options?.behavior);
    }) as typeof list.scrollTo;

    getRef()?.scrollToIndex(400, { align: 'start' });
    await tick();
    expect(behaviors).not.toContain('smooth');
  });
});

describe('VirtualList — adaptiveOverscan', () => {
  test('never renders fewer rows than the configured overscan', async () => {
    // The floor is the safety property: turning adaptation on must not be able to
    // make pop-in worse than leaving it off.
    const baseline = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 6,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });
    await waitFor(() => expect(renderedRows(baseline.container).length).toBeGreaterThan(0));
    const baselineCount = renderedRows(baseline.container).length;

    const adaptive = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 6,
      adaptiveOverscan: true,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });
    await waitFor(() => expect(renderedRows(adaptive.container).length).toBeGreaterThan(0));

    expect(renderedRows(adaptive.container).length).toBeGreaterThanOrEqual(baselineCount);
  });
});

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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
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
    expect(flowIndexes).toEqual([...flowIndexes].sort((left, right) => left - right));
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    const rowElement = container.querySelector('[data-cinder-virtual-index]') as HTMLElement;

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
    const firstRow = container.querySelector('[data-cinder-virtual-index]') as HTMLElement;
    expect(firstRow.hasAttribute('aria-posinset')).toBe(false);
    expect(firstRow.hasAttribute('aria-setsize')).toBe(false);
  });
});

describe('VirtualList — keyboard navigation past a sticky header', () => {
  afterEach(() => {
    restoreResizeObserver();
    cleanup();
    document.body.replaceChildren();
  });

  test('counts a measured header that is still inside the rendered window', async () => {
    // The P1 case. `pinnedStickyIndex` is null while the header is still mounted in
    // the overscanned window, but CSS has been holding it over the leading edge that
    // whole time. Measuring the obstruction from the pinned row alone reported it as
    // zero here, so ArrowDown advanced to the row directly beneath a 100px header —
    // five 20px rows the reader cannot see.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    // Row 0 is really a 100px header. Rows are 20px, so offsets run
    // [0, 100, 120, 140, 160, 180, ...].
    reportRowSizes(new Map([[0, 100]]));
    await tick();

    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    const scrollTop = instrumentScrollTop(list);
    list.scrollTop = 50;
    await fireEvent.scroll(list);
    await tick();

    await fireEvent.keyDown(list, { key: 'ArrowDown' });
    await tick();

    // Partway into the header, the first row it is NOT covering starts at 150, which
    // is row 3. ArrowDown therefore goes to row 4, at offset 160 — and lands it just
    // below the header rather than under it: 160 - 100.
    expect(scrollTop.value()).toBe(60);
  });

  test('moves in both directions when parked exactly where a header starts', async () => {
    // Every step onto or off a section lands at precisely start(header), so this is
    // the offset the list sits at most often. It is also where the two obstruction
    // rules disagree: the header is simultaneously the first visible row and the
    // thing covering the leading edge, and whichever way that is resolved, one of
    // the two directions stops moving unless stepping passes over sticky rows.
    // A render each, rather than one list rewound between the two presses. Setting
    // the offset back to where a keypress started is indistinguishable from that
    // press not having moved yet, which is a state only the test can produce.
    async function pressFromHeaderStart(key: string): Promise<number> {
      const { container } = render(VirtualList, {
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        stickyItems: [0, 10],
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
      const scrollTop = instrumentScrollTop(list);

      // start(10) === 200, with header 10 held at the leading edge.
      list.scrollTop = 200;
      await fireEvent.scroll(list);
      await tick();

      await fireEvent.keyDown(list, { key });
      await tick();
      return scrollTop.value();
    }

    // Down: row 11 is uncovered, so the step goes to 12 and clears header 10.
    expect(await pressFromHeaderStart('ArrowDown')).toBe(220);

    // Up: the step from 11 reaches 10, which IS the header — its own inset is zero,
    // so the target resolves to 200 and the key does nothing. Passing over it reaches
    // row 9, cleared of header 0.
    expect(await pressFromHeaderStart('ArrowUp')).toBe(160);
  });

  test('re-derives a keyboard destination as the rows it jumps into are measured', async () => {
    // The P2 case. An earlier version wrote the offset directly whenever a header was
    // pinned, which skipped the settle loop: under dynamicSize an End jump lands on
    // estimates, and the measurements that arrive afterwards move the target out from
    // under it.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    reportRowSizes(new Map([[0, 100]]));
    await tick();

    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 50;
    await fireEvent.scroll(list);
    await tick();

    await fireEvent.keyDown(list, { key: 'End' });
    await tick();

    // Total is 100 rows: row 0 at 100px and 99 at 20px, so 2080 against a 200px
    // viewport. End settles at the bottom rather than at a stale estimate's idea of it.
    await waitFor(() => expect(list.scrollTop).toBe(1_880));
  });
});

describe('VirtualList — paging and key repeat past a sticky header', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  test('pages by the rows the header leaves visible, not by the whole viewport', async () => {
    // A 200px viewport over 20px rows fits ten, but a 20px header covers one of them,
    // so only nine are exposed. Paging by ten steps over the row under the header:
    // covered before the press and covered after it, so it is never read.
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
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    const scrollTop = instrumentScrollTop(list);

    // start(200) === 4000, with header 0 pinned over the leading edge.
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);
    await tick();

    await fireEvent.keyDown(list, { key: 'PageDown' });
    await tick();

    // Row 201 is the first uncovered one, so a nine-row page reaches 210 — which is
    // exactly the row a ten-row page would have jumped over. It lands below the
    // header: start(210) - 20.
    expect(scrollTop.value()).toBe(4_180);
  });

  test('keeps correcting a dynamic destination through an off-axis arrow', async () => {
    // An off-axis arrow scrolls nothing here, so it must not retire the settle loop.
    // Under dynamicSize that loop is what re-derives the destination once the rows the
    // jump landed among are measured; retired early, the scroll stops on the estimate
    // it first computed and never comes back for the correction.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    // End against all-estimates: 100 rows at 20px is 2000, less a 200px viewport.
    const pressed = fireEvent.keyDown(list, { key: 'End' });
    // Lands inside the settle loop's pending frames, which is where retiring it bites.
    await fireEvent.keyDown(list, { key: 'ArrowRight' });
    // A row turns out to be 120px rather than 20px, so the end of the list is 100px
    // further on than the first write assumed.
    reportRowSizes(new Map([[95, 120]]));
    await pressed;
    await tick();

    await waitFor(() => expect(list.scrollTop).toBe(1_900));

    restoreResizeObserver();
  });
});

describe('VirtualList — adaptive overscan and settling under row controls', () => {
  afterEach(() => {
    restoreResizeObserver();
    cleanup();
    document.body.replaceChildren();
  });

  test('converts scroll velocity with measured rows rather than the estimate', async () => {
    // Structural, because the behaviour cannot be observed here: driving the velocity
    // tracker needs two scroll events a controlled interval apart, and events fired
    // from a test land in the same millisecond, which reads as an effectively infinite
    // velocity and saturates adaptive overscan at its ceiling whichever row size it
    // converts with. The arithmetic itself is covered in `adaptive-overscan.test.ts`;
    // this pins the wiring, which is the half that was wrong.
    const source = await Bun.file(
      new URL('./virtual-list.svelte', import.meta.url).pathname,
    ).text();
    expect(source).toContain('itemSize: averageRowSize');
    expect(source).toContain('resolveAdaptiveItemSize({');
  });

  test('leaves a settle pass running when a key comes from a control inside a row', async () => {
    // The list does not claim those keys, so the event scrolls nothing here — and
    // retiring the loop for it cancels a correction the destination is still owed,
    // finishing the jump on a stale estimate.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;

    const pressed = fireEvent.keyDown(list, { key: 'End' });
    // An ArrowDown from a control inside a row, mid-settle. Same key the list would
    // otherwise claim, but not aimed at the container.
    const rowNode = renderedRows(container)[0] as HTMLElement;
    await fireEvent.keyDown(rowNode, { key: 'ArrowDown', bubbles: true });
    reportRowSizes(new Map([[95, 120]]));
    await pressed;
    await tick();

    // 100 rows at 20px is 2000, plus the 100px that row 95 turned out to be, less a
    // 200px viewport.
    await waitFor(() => expect(list.scrollTop).toBe(1_900));
  });
});

describe('VirtualList — edge callbacks under adaptive overscan', () => {
  test('reads the visible range from scroll geometry, not from the window', async () => {
    // Structural, for the same reason as the adaptive row-size test above: reproducing
    // this needs the effective overscan to exceed the configured one, which only
    // velocity produces — and events fired from a test share a timestamp, so the
    // velocity tracker reports zero and adaptation never engages. CIN-614 adds the
    // playground example that makes it reachable in a browser.
    //
    // What it pins is the invariant, because BOTH ways of undoing the window's
    // overscan are wrong and in opposite directions. Subtracting the configured
    // overscan leaves the adaptive growth in, and the callbacks fire tens of rows
    // early. Subtracting the effective overscan over-corrects at the list's own edges,
    // where the window is clamped and the overscan realized on that side is smaller
    // than the one requested — in a 100-row list `endIndex` is 100 however wide
    // adaptation grew, so the last visible row reads as 49 and `onEndReached` is
    // suppressed until the idle timer shrinks the window back.
    //
    // The visible range therefore must not be reconstructed from the window at all.
    const source = await Bun.file(
      new URL('./virtual-list.svelte', import.meta.url).pathname,
    ).text();
    const edgeEffect = source.slice(
      source.indexOf('const lastRenderedIndex = Math.max(0, itemCount - 1);'),
      source.indexOf('const maskedProximity'),
    );
    expect(edgeEffect).toContain('resolveAnchorIndexAtOffset(scrollOffset)');
    expect(edgeEffect).not.toContain('currentWindow.startIndex');
    expect(edgeEffect).not.toContain('currentWindow.endIndex');

    // And the trigger distance stays the CONFIGURED overscan. Widening it with the
    // effective value would fetch pages earlier the faster the reader scrolled, which
    // is not what the prop promises.
    expect(edgeEffect).toContain('overscan: resolvedOverscan');
    expect(edgeEffect).not.toContain('overscan: effectiveOverscan');
  });

  test('still fires both callbacks with an overscan wider than the list', async () => {
    // The clamping case, exercised by configuration rather than by velocity: with an
    // overscan half the collection, the window is pinned to both edges at once, so
    // every index the window could offer is clamped and only the geometry still
    // describes what the reader can see.
    let startReached = 0;
    let endReached = 0;
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      overscan: 50,
      onStartReached: () => {
        startReached += 1;
      },
      onEndReached: () => {
        endReached += 1;
      },
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    await waitFor(() => expect(startReached).toBe(1));

    const list = container.querySelector('.cinder-virtual-list') as HTMLElement;
    list.scrollTop = 1_800;
    await fireEvent.scroll(list);
    await tick();

    await waitFor(() => expect(endReached).toBe(1));
  });
});
