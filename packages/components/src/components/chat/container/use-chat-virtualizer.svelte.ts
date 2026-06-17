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

  constructor(readonly options: ChatVirtualizerOptions) {}

  get virtualItems(): VirtualItem[] {
    return this.#virtualItems();
  }

  get totalSize(): number {
    return this.options.getCount() * Math.max(1, this.options.getEstimatedSize());
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

  measureElement: Attachment<HTMLElement> = () => {};

  measureElementNode(_node: HTMLElement | null): void {}

  syncOptions(): void {}

  scrollToIndex(index: number, options: ChatScrollToOptions = { align: 'auto' }): void {
    const itemSize = Math.max(1, this.options.getEstimatedSize());
    const count = this.options.getCount();
    if (count === 0) return;

    const clampedIndex = Math.max(0, Math.min(Math.trunc(index), count - 1));
    const viewportHeight = this.#containerHeight();
    let offset = clampedIndex * itemSize;

    if (options.align === 'end') {
      offset = (clampedIndex + 1) * itemSize - viewportHeight;
    } else if (options.align === 'center') {
      offset = clampedIndex * itemSize - (viewportHeight - itemSize) / 2;
    }

    this.scrollToOffset(offset, options);
  }

  scrollToOffset(offset: number, options?: ChatScrollToOptions): void {
    const element = this.#getScrollElement();
    const top = Math.max(0, offset);
    this.#scrollOffset = top;

    if (element) {
      if (typeof element.scrollTo === 'function') {
        const behavior = options?.behavior === 'instant' ? 'auto' : options?.behavior;
        element.scrollTo(behavior ? { top, behavior } : { top });
      } else {
        element.scrollTop = top;
      }
      element.dispatchEvent(new Event('scroll'));
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

  #virtualItems(): VirtualItem[] {
    const count = this.options.getCount();
    if (count === 0) return [];

    const size = Math.max(1, this.options.getEstimatedSize());
    const { startIndex, endIndex } = calculateChatVirtualWindow({
      scrollTop: this.scrollOffset,
      containerHeight: this.#containerHeight(),
      itemCount: count,
      itemSize: size,
      overscan: this.options.getOverscan(),
    });

    return Array.from({ length: endIndex - startIndex }, (_, offset) => {
      const index = startIndex + offset;
      return {
        key: this.options.getItemKey(index),
        index,
        start: index * size,
        end: (index + 1) * size,
        size,
        lane: 0,
      };
    });
  }
}
