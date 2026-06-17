import type { Attachment } from 'svelte/attachments';
import type { VirtualItem } from '../../../_internal/virtual-item.ts';

type ChatScrollBehavior = ScrollBehavior | 'instant';

type ChatScrollToOptions = {
  align?: 'auto' | 'start' | 'center' | 'end';
  behavior?: ChatScrollBehavior;
};

export type ChatVirtualizerOptions = {
  getScrollElement: () => HTMLElement | null;
  getCount: () => number;
  getItemKey: (index: number) => string | number;
  getEstimatedSize: () => number;
  getOverscan: () => number;
  getInitialHeight: () => number;
  getScrollPaddingStart?: () => number;
};

export type ChatVirtualWindowInput = {
  scrollTop: number;
  containerHeight: number;
  itemCount: number;
  itemSize: number;
  overscan: number;
};

export type ChatVirtualWindow = {
  startIndex: number;
  endIndex: number;
};

export function calculateChatVirtualWindow(input: ChatVirtualWindowInput): ChatVirtualWindow {
  const itemCount = Math.max(0, Math.trunc(input.itemCount));
  if (itemCount === 0) return { startIndex: 0, endIndex: 0 };

  const itemSize = Math.max(1, input.itemSize);
  const overscan = Math.max(0, Math.trunc(input.overscan));
  const scrollTop = Math.max(0, input.scrollTop);
  const containerHeight = Math.max(0, input.containerHeight);
  const visibleCount = Math.max(1, Math.ceil(containerHeight / itemSize));
  const maxStartIndex = Math.max(0, itemCount - visibleCount);
  const startIndex = Math.min(
    maxStartIndex,
    Math.max(0, Math.floor(scrollTop / itemSize) - overscan),
  );
  const endIndex = Math.min(itemCount, startIndex + visibleCount + overscan * 2);

  return { startIndex, endIndex };
}

export class ChatVirtualizer {
  #scrollElement: HTMLElement | null = null;
  #scrollOffset = $state(0);
  #measurementVersion = $state(0);
  #offsetsCache: number[] | null = null;
  #offsetsCacheCount = -1;
  #offsetsCacheMeasurementVersion = -1;
  #measuredSizes = new Map<string | number, number>();

  constructor(readonly options: ChatVirtualizerOptions) {}

  get virtualItems(): VirtualItem[] {
    return this.#virtualItems();
  }

  get totalSize(): number {
    const offsets = this.#offsets();
    return offsets[offsets.length - 1] ?? 0;
  }

  get scrollPaddingStart(): number {
    return this.#scrollPaddingStart();
  }

  get scrollSize(): number {
    return this.scrollPaddingStart + this.totalSize;
  }

  get scrollOffset(): number {
    return this.#scrollOffset;
  }

  setScrollElement(element: HTMLElement | null): void {
    if (this.#scrollElement === element) return;

    this.#scrollElement?.removeEventListener('scroll', this.#handleScroll);
    this.#scrollElement = element;
    this.#scrollOffset = element?.scrollTop ?? 0;
    this.#scrollElement?.addEventListener('scroll', this.#handleScroll, { passive: true });
  }

  scrollElement: Attachment<HTMLElement> = (node) => {
    this.setScrollElement(node);

    return () => {
      if (this.#scrollElement === node) {
        this.setScrollElement(null);
      }
    };
  };

  measureElement: Attachment<HTMLElement> = (node) => {
    this.measureElementNode(node);
    if (typeof ResizeObserver !== 'function') return undefined;

    const resizeObserver = new ResizeObserver(() => {
      this.measureElementNode(node);
    });
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  };

  measureElementNode(node: HTMLElement | null): void {
    if (!node) return;

    this.#measureNode(node);
  }

  syncOptions(): void {
    const count = this.options.getCount();
    const currentKeys = new Set<string | number>();
    for (let index = 0; index < count; index += 1) {
      currentKeys.add(this.options.getItemKey(index));
    }

    let changed = false;
    for (const key of this.#measuredSizes.keys()) {
      if (!currentKeys.has(key)) {
        this.#measuredSizes.delete(key);
        changed = true;
      }
    }
    if (changed) this.#measurementVersion += 1;
  }

  scrollToIndex(index: number, options: ChatScrollToOptions = { align: 'auto' }): void {
    const count = this.options.getCount();
    if (count === 0) return;

    const clampedIndex = Math.max(0, Math.min(Math.trunc(index), count - 1));
    const offsets = this.#offsets();
    const itemStart = offsets[clampedIndex] ?? 0;
    const itemEnd = offsets[clampedIndex + 1] ?? itemStart + this.#estimatedSize();
    const itemSize = itemEnd - itemStart;
    const viewportHeight = this.#containerHeight();
    const paddingStart = this.#scrollPaddingStart();
    const viewportStart = Math.max(0, this.scrollOffset - paddingStart);
    const viewportEnd = viewportStart + viewportHeight;
    let offset = itemStart + paddingStart;

    if (options.align === 'end') {
      offset = itemEnd + paddingStart - viewportHeight;
    } else if (options.align === 'center') {
      offset = itemStart + paddingStart - (viewportHeight - itemSize) / 2;
    } else if (options.align === 'auto') {
      if (itemStart >= viewportStart && itemEnd <= viewportEnd) return;
      offset =
        itemStart < viewportStart
          ? itemStart + paddingStart
          : itemEnd + paddingStart - viewportHeight;
    }

    this.scrollToOffset(offset, options);
  }

  getVirtualItem(index: number): VirtualItem | null {
    const count = this.options.getCount();
    if (count === 0) return null;

    const clampedIndex = Math.max(0, Math.min(Math.trunc(index), count - 1));
    return this.#virtualItemAt(clampedIndex, this.#offsets());
  }

  scrollToOffset(offset: number, options?: ChatScrollToOptions): void {
    const element = this.#getScrollElement();
    const maximumOffset = Math.max(0, this.scrollSize - this.#containerHeight());
    const top = Math.min(maximumOffset, Math.max(0, offset));
    this.#scrollOffset = top;

    if (element) {
      const behavior = options?.behavior === 'instant' ? 'auto' : options?.behavior;
      if (typeof element.scrollTo === 'function' && behavior && behavior !== 'auto') {
        element.scrollTo({ top, behavior });
        return;
      }
      element.scrollTop = top;
      return;
    }
  }

  #handleScroll = (): void => {
    this.#scrollOffset = this.#scrollElement?.scrollTop ?? 0;
  };

  #getScrollElement(): HTMLElement | null {
    return this.#scrollElement ?? this.options.getScrollElement();
  }

  #containerHeight(): number {
    const element = this.#getScrollElement();
    return element?.clientHeight || this.options.getInitialHeight();
  }

  #scrollPaddingStart(): number {
    return Math.max(0, this.options.getScrollPaddingStart?.() ?? 0);
  }

  #estimatedSize(): number {
    return Math.max(1, this.options.getEstimatedSize());
  }

  #itemSize(index: number): number {
    const key = this.options.getItemKey(index);
    return this.#measuredSizes.get(key) ?? this.#estimatedSize();
  }

  #offsets(): number[] {
    const count = this.options.getCount();
    const measurementVersion = this.#measurementVersion;
    if (
      this.#offsetsCache &&
      this.#offsetsCacheCount === count &&
      this.#offsetsCacheMeasurementVersion === measurementVersion
    ) {
      return this.#offsetsCache;
    }

    const offsets = Array.from<number>({ length: count + 1 });
    let offset = 0;
    offsets[0] = 0;

    for (let index = 0; index < count; index += 1) {
      offset += this.#itemSize(index);
      offsets[index + 1] = offset;
    }

    this.#offsetsCache = offsets;
    this.#offsetsCacheCount = count;
    this.#offsetsCacheMeasurementVersion = measurementVersion;
    return offsets;
  }

  #readElementSize(node: HTMLElement): number {
    const rectHeight = node.getBoundingClientRect().height;
    return Math.ceil(rectHeight || node.scrollHeight || node.offsetHeight || 0);
  }

  #measureNode(node: HTMLElement): void {
    const index = Number(node.dataset['cinderVirtualIndex']);
    if (!Number.isInteger(index) || index < 0 || index >= this.options.getCount()) return;

    const measuredSize = this.#readElementSize(node);
    if (measuredSize <= 0) return;

    const key = this.options.getItemKey(index);
    if (this.#measuredSizes.get(key) === measuredSize) return;

    this.#measuredSizes.set(key, measuredSize);
    this.#measurementVersion += 1;
  }

  #startIndex(offsets: readonly number[], scrollTop: number): number {
    const count = Math.max(0, offsets.length - 1);
    let low = 0;
    let high = count;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if ((offsets[mid + 1] ?? 0) <= scrollTop) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  #endIndex(offsets: readonly number[], viewportEnd: number): number {
    const count = Math.max(0, offsets.length - 1);
    let low = 0;
    let high = count;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if ((offsets[mid] ?? 0) < viewportEnd) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  #virtualItemAt(index: number, offsets: readonly number[]): VirtualItem {
    const start = offsets[index] ?? 0;
    const end = offsets[index + 1] ?? start + this.#estimatedSize();
    return {
      key: this.options.getItemKey(index),
      index,
      start,
      end,
      size: end - start,
      lane: 0,
    };
  }

  #virtualItems(): VirtualItem[] {
    const count = this.options.getCount();
    if (count === 0) return [];

    const offsets = this.#offsets();
    const overscan = Math.max(0, Math.trunc(this.options.getOverscan()));
    const scrollTop = Math.max(0, this.scrollOffset - this.#scrollPaddingStart());
    const viewportEnd = scrollTop + Math.max(0, this.#containerHeight());
    const visibleStartIndex = this.#startIndex(offsets, scrollTop);
    const visibleEndIndex = Math.max(visibleStartIndex + 1, this.#endIndex(offsets, viewportEnd));
    const startIndex = Math.max(0, visibleStartIndex - overscan);
    const endIndex = Math.min(count, visibleEndIndex + overscan);

    return Array.from({ length: endIndex - startIndex }, (_, offset) => {
      const index = startIndex + offset;
      return this.#virtualItemAt(index, offsets);
    });
  }
}
