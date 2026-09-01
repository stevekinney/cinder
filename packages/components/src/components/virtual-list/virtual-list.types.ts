import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { VirtualListKey } from '../../utilities/fixed-virtual-window.ts';
import type { VirtualListScrollAlign } from './_internal/measurement-window.ts';

export type { VirtualListScrollAlign };

export type VirtualListRowContext = {
  /** Zero-based index of the item in the full items array. */
  index: number;
  /** Stable key used for the rendered row. */
  key: VirtualListKey;
  /** Pixel offset from the top of the full virtual list. */
  start: number;
  /** Pixel height of this row: the measured size under `dynamicSize`, otherwise `itemHeight`. */
  size: number;
};

/** Options for `VirtualListRef.scrollToIndex`. */
export type VirtualListScrollToIndexOptions = {
  /**
   * Where the target row lands in the viewport. Defaults to `'auto'`, which
   * leaves the scroll position alone when the row is already fully visible.
   */
  align?: VirtualListScrollAlign;
  /** Scroll behavior. Defaults to `'auto'`. */
  behavior?: 'auto' | 'smooth';
};

/**
 * Programmatic VirtualList handle exposed through `bind:ref`.
 */
export type VirtualListRef = {
  /**
   * Scrolls the item at `index` into view. Under `dynamicSize` this accounts for
   * the measured size of every row before the target, and re-settles if rows
   * above it are measured for the first time mid-scroll. Out-of-range indexes
   * are clamped to the list's bounds.
   */
  scrollToIndex: (index: number, options?: VirtualListScrollToIndexOptions) => void;
};

export type VirtualListProps<Item = unknown> = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'tabindex'
> & {
  /** Items in full logical order. Only the visible window is mounted. */
  items: readonly Item[];
  /**
   * Row height in pixels. By default every row is assumed to be exactly this
   * tall. When `dynamicSize` is true this becomes the initial estimate for rows
   * that have not been measured yet.
   */
  itemHeight: number;
  /**
   * Measure each rendered row with `ResizeObserver` and cache the result,
   * instead of assuming every row is exactly `itemHeight` tall. Use this when
   * rows wrap, contain images, or otherwise vary in height.
   *
   * Defaults to `false`. While false, no measurement, caching, scroll
   * correction, or `ResizeObserver` construction happens anywhere in the
   * component — the fixed-height path stays the fast path.
   */
  dynamicSize?: boolean;
  /**
   * Extra rows rendered before and after the visible window.
   * Defaults to 5.
   */
  overscan?: number;
  /**
   * CSS block-size for the native scroll container.
   * Defaults to `"20rem"`.
   */
  height?: string;
  /**
   * When true, appending items while the viewport is already at the bottom
   * keeps the newest item pinned in view. Appending while scrolled up leaves the
   * scroll position unchanged.
   */
  stickToBottom?: boolean;
  /**
   * Override the default focus behavior. The component sets `tabindex="0"`
   * by default so keyboard users can reach the native scroll container for
   * arrow-key scrolling. Pass `tabindex={-1}` when the viewport should be
   * programmatically focusable without entering the tab order.
   */
  tabindex?: number;
  /**
   * Stable key extractor. Omit only when items are append-only and never
   * reordered; the component will fall back to full-array indexes.
   *
   * Required in practice under `dynamicSize`: measured sizes are cached by key,
   * so index-derived keys will mis-attribute cached sizes if items ever reorder.
   */
  getKey?: (item: Item, index: number) => VirtualListKey;
  /** Rendered row snippet. Receives the item and its virtual row context. */
  row: Snippet<[Item, VirtualListRowContext]>;
  /** Additional class names merged with `.cinder-virtual-list`. */
  class?: string;
  /** Typed programmatic handle. Use `bind:ref` to receive it. */
  ref?: VirtualListRef | undefined;
};
