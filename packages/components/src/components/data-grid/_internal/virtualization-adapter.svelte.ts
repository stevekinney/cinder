import {
  Virtualizer,
  type ScrollToOptions,
  type VirtualItem as VendorVirtualItem,
} from '@tanstack/virtual-core';
import type { Attachment } from 'svelte/attachments';
import { createSubscriber } from 'svelte/reactivity';

const defaultDataGridVirtualRowHeight = 44;

export type DataGridVirtualItem = {
  readonly index: number;
  readonly start: number;
  readonly size: number;
  readonly key: string | number;
};

export type DataGridVirtualWindow = {
  readonly virtualRows: readonly DataGridVirtualItem[];
  readonly virtualColumns: readonly DataGridVirtualItem[];
  readonly totalHeight: number;
  readonly totalWidth: number;
  readonly mountScrollContainer: Attachment<HTMLElement>;
};

export type DataGridVirtualizationAdapterOptions = {
  getScrollElement: () => HTMLElement | null;
  getRowCount: () => number;
  getRowKey: (index: number) => string | number;
  getRowHeight: () => number;
  getColumnCount: () => number;
  getColumnWidth: (index: number) => number;
  getOverscan: () => number;
  getInitialHeight: () => number;
  getScrollPaddingStart: () => number;
};

export class DataGridVirtualizationAdapter implements DataGridVirtualWindow {
  #rowVirtualizer: Virtualizer<HTMLElement, HTMLElement> | null = null;
  #scrollElement: HTMLElement | null = null;
  #update: () => void = () => {};
  #subscribe: () => void;

  constructor(readonly options: DataGridVirtualizationAdapterOptions) {
    this.#subscribe = createSubscriber((update) => {
      if (typeof window === 'undefined') return;

      this.#update = update;
      this.#rowVirtualizer = new Virtualizer(this.#buildRowOptions());
      const cleanup = this.#rowVirtualizer._didMount();
      this.#rowVirtualizer._willUpdate();
      update();

      return () => {
        cleanup();
        this.#rowVirtualizer = null;
      };
    });
  }

  get virtualRows(): readonly DataGridVirtualItem[] {
    if (typeof window === 'undefined') return [];

    this.#subscribe();
    this.#syncOptions();
    const fallbackRows = this.#fallbackRows();
    const virtualRows = this.#rowVirtualizer?.getVirtualItems();
    const rows = this.#shouldUseFallbackRows(virtualRows, fallbackRows)
      ? fallbackRows
      : (virtualRows ?? fallbackRows);
    return rows.map(toDataGridVirtualItem);
  }

  get virtualColumns(): readonly DataGridVirtualItem[] {
    return [];
  }

  get totalHeight(): number {
    if (typeof window === 'undefined') return this.options.getRowCount() * this.#rowHeight();

    this.#subscribe();
    this.#syncOptions();
    return this.#rowVirtualizer?.getTotalSize() ?? this.options.getRowCount() * this.#rowHeight();
  }

  get totalWidth(): number {
    let totalWidth = 0;
    for (let index = 0; index < this.options.getColumnCount(); index += 1) {
      totalWidth += Math.max(1, this.options.getColumnWidth(index));
    }
    return totalWidth;
  }

  mountScrollContainer: Attachment<HTMLElement> = (node) => {
    this.#setScrollElement(node);

    return () => {
      if (this.#scrollElement === node) {
        this.#setScrollElement(null);
      }
    };
  };

  measureElement: Attachment<HTMLElement> = (node) => {
    this.#syncOptions();
    this.#rowVirtualizer?.measureElement(node);
    return () => this.#rowVirtualizer?.measureElement(null);
  };

  refreshMeasurements(): void {
    this.#subscribe();
    this.#syncOptions();
    this.#update();
  }

  scrollToRow(index: number, options: ScrollToOptions = { align: 'auto' }): void {
    this.#subscribe();
    this.#syncOptions();
    const element = this.#getScrollElement();
    const shouldUseFallbackScroll = Boolean(
      element && (!this.#rowVirtualizer || element.clientHeight === 0),
    );

    this.#rowVirtualizer?.scrollToIndex(index, options);
    if (!element || !shouldUseFallbackScroll) return;

    element.scrollTop = this.#scrollPaddingStart() + Math.max(0, index * this.#rowHeight());
    element.dispatchEvent(new Event('scroll'));
  }

  #setScrollElement(element: HTMLElement | null): void {
    if (this.#scrollElement === element) return;

    this.#scrollElement = element;
    this.#syncOptions();
    this.#update();
  }

  #syncOptions(): void {
    if (!this.#rowVirtualizer) return;
    this.#rowVirtualizer.setOptions(this.#buildRowOptions());
    this.#rowVirtualizer._willUpdate();
  }

  #buildRowOptions() {
    return {
      count: this.options.getRowCount(),
      getScrollElement: this.#getScrollElement,
      getItemKey: this.options.getRowKey,
      estimateSize: () => this.#rowHeight(),
      overscan: this.#overscan(),
      initialRect: { width: 0, height: this.options.getInitialHeight() },
      observeElementRect: this.#observeElementRect,
      observeElementOffset: this.#observeElementOffset,
      scrollToFn: this.#scrollToOffset,
      measureElement: this.#measureElement,
      onChange: () => this.#update(),
      indexAttribute: 'data-cinder-virtual-index',
      scrollPaddingStart: this.#scrollPaddingStart(),
    };
  }

  #getScrollElement = (): HTMLElement | null =>
    this.#scrollElement ?? this.options.getScrollElement();

  #scrollToOffset = (
    offset: number,
    { adjustments = 0, behavior }: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Virtualizer<HTMLElement, HTMLElement>,
  ): void => {
    const element = instance.scrollElement;
    if (!element) return;

    const top = this.#scrollPaddingStart() + offset + adjustments;
    if (typeof element.scrollTo === 'function') {
      element.scrollTo(behavior ? { top, behavior } : { top });
      return;
    }

    element.scrollTop = top;
  };

  #observeElementRect = (
    instance: Virtualizer<HTMLElement, HTMLElement>,
    callback: (rect: { width: number; height: number }) => void,
  ): (() => void) => {
    const element = instance.scrollElement;
    if (!element) return () => {};

    const notify = (): void => {
      const rect = element.getBoundingClientRect();
      const scrollPaddingStart = this.#scrollPaddingStart();
      const height = rect.height || element.clientHeight || this.options.getInitialHeight();
      callback({
        width: rect.width || element.clientWidth,
        height: Math.max(0, height - scrollPaddingStart) || this.options.getInitialHeight(),
      });
    };

    notify();
    if (typeof ResizeObserver === 'undefined') return () => {};

    const observer = new ResizeObserver(notify);
    observer.observe(element);
    return () => observer.disconnect();
  };

  #observeElementOffset = (
    instance: Virtualizer<HTMLElement, HTMLElement>,
    callback: (offset: number, isScrolling: boolean) => void,
  ): (() => void) => {
    const element = instance.scrollElement;
    if (!element) return () => {};

    const notify = (): void => {
      callback(this.#scrollOffset(element), true);
      this.#update();
    };
    callback(this.#scrollOffset(element), false);
    element.addEventListener('scroll', notify, { passive: true });
    return () => element.removeEventListener('scroll', notify);
  };

  #measureElement = (element: HTMLElement): number => {
    const rect = element.getBoundingClientRect();
    return rect.height || this.#rowHeight();
  };

  #fallbackRows(): VendorVirtualItem[] {
    const count = this.options.getRowCount();
    if (count === 0) return [];

    const rowHeight = this.#rowHeight();
    const overscan = this.#overscan();
    const scrollTop = this.#scrollOffset(this.#getScrollElement());
    const visibleCount = Math.ceil(this.#viewportHeight() / rowHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const itemCount = Math.min(count - startIndex, visibleCount + overscan * 2);
    return Array.from({ length: itemCount }, (_, offset) => {
      const index = startIndex + offset;
      return {
        key: this.options.getRowKey(index),
        index,
        start: index * rowHeight,
        end: (index + 1) * rowHeight,
        size: rowHeight,
        lane: 0,
      };
    });
  }

  #shouldUseFallbackRows(
    virtualizerRows: readonly VendorVirtualItem[] | undefined,
    fallbackRows: readonly VendorVirtualItem[],
  ): boolean {
    if (!virtualizerRows || fallbackRows.length === 0) return false;
    if (virtualizerRows.length === 0) return true;

    const scrollTop = this.#scrollOffset(this.#getScrollElement());
    if (scrollTop <= 0) return false;

    const firstVirtualizerIndex = virtualizerRows[0]?.index ?? 0;
    const firstFallbackIndex = fallbackRows[0]?.index ?? 0;
    return Math.abs(firstVirtualizerIndex - firstFallbackIndex) > 1;
  }

  #rowHeight(): number {
    const rowHeight = this.options.getRowHeight();
    return Number.isFinite(rowHeight) && rowHeight > 0
      ? rowHeight
      : defaultDataGridVirtualRowHeight;
  }

  #viewportHeight(): number {
    const element = this.#getScrollElement();
    if (!element) return this.options.getInitialHeight();

    const rect = element.getBoundingClientRect();
    const height = rect.height || element.clientHeight || this.options.getInitialHeight();
    return Math.max(0, height - this.#scrollPaddingStart()) || this.options.getInitialHeight();
  }

  #scrollOffset(element: HTMLElement | null): number {
    if (!element) return 0;
    return Math.max(0, element.scrollTop - this.#scrollPaddingStart());
  }

  #scrollPaddingStart(): number {
    const value = this.options.getScrollPaddingStart();
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  #overscan(): number {
    return Math.max(0, this.options.getOverscan());
  }
}

function toDataGridVirtualItem(item: VendorVirtualItem): DataGridVirtualItem {
  return {
    index: item.index,
    start: item.start,
    size: item.size,
    key: typeof item.key === 'number' || typeof item.key === 'string' ? item.key : String(item.key),
  };
}
