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
  behavior?: ScrollBehavior;
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
   * Each item's extent in pixels along the axis being scrolled: its height by
   * default, or its width under `horizontal`. By default every row is assumed to
   * be exactly this size. When `dynamicSize` is true this becomes the initial
   * estimate for rows that have not been measured yet.
   */
  itemHeight: number;
  /**
   * Measure each rendered row with `ResizeObserver` and cache the result,
   * instead of assuming every row is exactly `itemHeight` along the scrolled
   * axis. Use this when rows wrap, contain images, or otherwise vary in size.
   * Composes with `horizontal`, where each row is measured by its width.
   *
   * Defaults to `false`. While false, no row is measured, no size is cached,
   * and no scroll correction runs — the fixed-height path stays the fast path.
   * The component still observes its own scroll container to track viewport
   * size, as it always has; that is independent of this prop.
   */
  dynamicSize?: boolean;
  /**
   * Scrolls and lays rows out along the inline axis instead of the block axis.
   *
   * `itemHeight` and `height` are REINTERPRETED rather than renamed: `itemHeight`
   * becomes each item's width in pixels along the main axis, and `height` becomes
   * the container's inline-size. The `--cinder-virtual-list-height` custom property
   * keeps its name too and switches to driving `inline-size`, so an existing theme
   * override keeps working when this is turned on.
   *
   * Right-to-left is handled: the writing direction is resolved from the container's
   * computed style at mount, and the scroll offset is read from the start (right)
   * edge in that case.
   *
   * Defaults to false.
   */
  horizontal?: boolean;

  /**
   * Extra rows rendered before and after the visible window.
   * Defaults to 5.
   */
  overscan?: number;
  /**
   * CSS extent of the native scroll container across the axis it scrolls: its
   * block-size by default, or its inline-size under `horizontal`.
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
   * Chat-transcript behaviour: the list starts at its end and returns there on
   * every append.
   *
   * Items stay in their natural order — oldest at index 0, newest last. `reverse`
   * names the anchoring, not the ordering, and the array is never flipped.
   *
   * Deliberately distinct from `stickToBottom`, which pins only when the reader is
   * already at the bottom. `reverse` pins on every append regardless of where the
   * reader is. When both are set, `reverse` wins.
   *
   * Prepending — loading a page of older history — never moves the reader: the row
   * they were looking at stays put while the list grows above it.
   *
   * Defaults to false.
   */
  reverse?: boolean;
  /**
   * Called when the reader scrolls within `overscan` items of the end of the list.
   *
   * Fires once per approach, not once per scroll event, and re-arms when the item
   * count changes — so appending in response to it allows the next approach to fire
   * while a source that returns nothing does not spin.
   */
  onEndReached?: () => void;
  /**
   * Called when the reader scrolls within `overscan` items of the start of the
   * list. Pair with `onEndReached` for bi-directional infinite scroll.
   *
   * Latched the same way as `onEndReached`. Prepending in response is safe: the
   * reader's position is preserved rather than jumping to the new start.
   */
  onStartReached?: () => void;
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
