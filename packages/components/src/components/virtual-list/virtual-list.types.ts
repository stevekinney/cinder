import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { VirtualListKey } from '../../utilities/fixed-virtual-window.ts';

export type VirtualListRowContext = {
  /** Zero-based index of the item in the full items array. */
  index: number;
  /** Stable key used for the rendered row. */
  key: VirtualListKey;
  /** Pixel offset from the top of the full virtual list. */
  start: number;
  /** Pixel height of this fixed-height row. */
  size: number;
};

export type VirtualListProps<Item = unknown> = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'tabindex'
> & {
  /** Items in full logical order. Only the visible window is mounted. */
  items: readonly Item[];
  /**
   * Fixed row height in pixels. Variable and measured row heights are out of
   * scope for v1; pass the known or estimated fixed height for every row.
   */
  itemHeight: number;
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
   */
  getKey?: (item: Item, index: number) => VirtualListKey;
  /** Rendered row snippet. Receives the item and its virtual row context. */
  row: Snippet<[Item, VirtualListRowContext]>;
  /** Additional class names merged with `.cinder-virtual-list`. */
  class?: string;
};
