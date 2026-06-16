import { Virtualizer, type ScrollToOptions, type VirtualItem } from '@tanstack/virtual-core';
import type { Attachment } from 'svelte/attachments';
import { createSubscriber } from 'svelte/reactivity';

export type TreeVirtualizerOptions = {
  getScrollElement: () => HTMLElement | null;
  getCount: () => number;
  getItemKey: (index: number) => string | number;
  getEstimatedSize: () => number;
  getOverscan: () => number;
  getInitialHeight: () => number;
};

export class TreeVirtualizer {
  #virtualizer: Virtualizer<HTMLElement, HTMLElement> | null = null;
  #scrollElement: HTMLElement | null = null;
  #update: () => void = () => {};
  #subscribe: () => void;

  constructor(readonly options: TreeVirtualizerOptions) {
    this.#subscribe = createSubscriber((update) => {
      if (typeof window === 'undefined') return;

      this.#update = update;
      this.#virtualizer = new Virtualizer(this.#buildOptions());
      const cleanup = this.#virtualizer._didMount();
      this.#virtualizer._willUpdate();
      update();

      return () => {
        cleanup();
        this.#virtualizer = null;
      };
    });
  }

  get virtualItems(): VirtualItem[] {
    this.#subscribe();
    this.#syncOptions();
    const fallbackItems = this.#fallbackVirtualItems();
    const virtualizerItems = this.#virtualizer?.getVirtualItems();
    const items = this.#shouldUseFallbackVirtualItems(virtualizerItems, fallbackItems)
      ? fallbackItems
      : (virtualizerItems ?? fallbackItems);
    return items.map((item) => ({ ...item }));
  }

  get totalSize(): number {
    this.#subscribe();
    this.#syncOptions();
    return (
      this.#virtualizer?.getTotalSize() ?? this.options.getCount() * this.options.getEstimatedSize()
    );
  }

  setScrollElement(element: HTMLElement | null): void {
    if (this.#scrollElement === element) return;

    this.#scrollElement = element;
    this.#syncOptions();
    this.#update();
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
    this.#syncOptions();
    this.#virtualizer?.measureElement(node);
    return () => this.#virtualizer?.measureElement(null);
  };

  scrollToIndex(index: number, options: ScrollToOptions = { align: 'auto' }): void {
    this.#subscribe();
    this.#syncOptions();
    this.#virtualizer?.scrollToIndex(index, options);
    const element = this.options.getScrollElement();
    if (element) {
      if (!this.#virtualizer || element.clientHeight === 0) {
        element.scrollTop = Math.max(0, index * Math.max(1, this.options.getEstimatedSize()));
      }
      element.dispatchEvent(new Event('scroll'));
    }
  }

  #syncOptions(): void {
    if (!this.#virtualizer) return;
    this.#virtualizer.setOptions(this.#buildOptions());
    this.#virtualizer._willUpdate();
  }

  #getScrollElement = (): HTMLElement | null =>
    this.#scrollElement ?? this.options.getScrollElement();

  #buildOptions() {
    return {
      count: this.options.getCount(),
      getScrollElement: this.#getScrollElement,
      getItemKey: this.options.getItemKey,
      estimateSize: () => this.options.getEstimatedSize(),
      overscan: this.#overscan(),
      initialRect: { width: 0, height: this.options.getInitialHeight() },
      observeElementRect: this.#observeElementRect,
      observeElementOffset: this.#observeElementOffset,
      scrollToFn: this.#scrollToOffset,
      measureElement: this.#measureElement,
      onChange: () => this.#update(),
      indexAttribute: 'data-cinder-virtual-index',
    };
  }

  #scrollToOffset = (
    offset: number,
    { adjustments = 0, behavior }: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Virtualizer<HTMLElement, HTMLElement>,
  ): void => {
    const element = instance.scrollElement;
    if (!element) return;

    const top = offset + adjustments;
    if (behavior === 'smooth' && typeof element.scrollTo === 'function') {
      element.scrollTo({ top, behavior });
      return;
    }

    element.scrollTop = top;
    if (typeof element.scrollTo === 'function') {
      element.scrollTo(behavior ? { top, behavior } : { top });
    }
  };

  #observeElementRect = (
    instance: Virtualizer<HTMLElement, HTMLElement>,
    callback: (rect: { width: number; height: number }) => void,
  ): (() => void) => {
    const element = instance.scrollElement;
    if (!element) return () => {};

    const notify = (): void => {
      const rect = element.getBoundingClientRect();
      callback({
        width: rect.width,
        height: rect.height || element.clientHeight || this.options.getInitialHeight(),
      });
    };

    notify();
    if (typeof ResizeObserver === 'undefined') return () => {};

    const observer = new ResizeObserver(notify);
    observer.observe(element);
    return () => observer.disconnect();
  };

  #measureElement = (element: HTMLElement): number => {
    const rect = element.getBoundingClientRect();
    return rect.height || this.options.getEstimatedSize();
  };

  #fallbackVirtualItems(): VirtualItem[] {
    const count = this.options.getCount();
    if (count === 0) return [];

    const size = Math.max(1, this.options.getEstimatedSize());
    const overscan = this.#overscan();
    const scrollTop = this.#getScrollElement()?.scrollTop ?? 0;
    const visibleCount = Math.ceil(this.options.getInitialHeight() / size);
    const startIndex = Math.max(0, Math.floor(scrollTop / size) - overscan);
    const itemCount = Math.min(count - startIndex, visibleCount + overscan * 2);
    return Array.from({ length: itemCount }, (_, offset) => {
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

  #shouldUseFallbackVirtualItems(
    virtualizerItems: readonly VirtualItem[] | undefined,
    fallbackItems: readonly VirtualItem[],
  ): boolean {
    if (!virtualizerItems || fallbackItems.length === 0) {
      return false;
    }

    if (virtualizerItems.length === 0) return true;

    const scrollTop = this.#getScrollElement()?.scrollTop ?? 0;
    if (scrollTop <= 0) return false;

    const firstVirtualizerIndex = virtualizerItems[0]?.index ?? 0;
    const firstFallbackIndex = fallbackItems[0]?.index ?? 0;
    return Math.abs(firstVirtualizerIndex - firstFallbackIndex) > 1;
  }

  #overscan(): number {
    return Math.max(0, this.options.getOverscan());
  }

  #observeElementOffset = (
    instance: Virtualizer<HTMLElement, HTMLElement>,
    callback: (offset: number, isScrolling: boolean) => void,
  ): (() => void) => {
    const element = instance.scrollElement;
    if (!element) return () => {};

    const notify = (): void => {
      callback(element.scrollTop, true);
      this.#update();
    };
    callback(element.scrollTop, false);
    element.addEventListener('scroll', notify, { passive: true });
    return () => element.removeEventListener('scroll', notify);
  };
}
