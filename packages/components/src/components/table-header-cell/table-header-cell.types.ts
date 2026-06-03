import type { Snippet } from 'svelte';
import type { HTMLThAttributes } from 'svelte/elements';

// `aria-sort` is owned by the component (computed from the parent Table's sort state
// and emitted after the attribute spread), so it's Omit-ted — a consumer value would
// be silently dropped at runtime.
export type TableHeaderCellProps = Omit<
  HTMLThAttributes,
  'class' | 'align' | 'scope' | 'aria-sort'
> & {
  /**
   * Column key. Required when `sortable=true` so the parent Table can
   * track which column the user activated.
   */
  column?: string;
  /**
   * When true, render a button inside the `<th>` and dispatch sort intents
   * to the parent Table. The cell's `aria-sort` reflects the current sort
   * direction (`ascending`, `descending`, or `none`).
   */
  sortable?: boolean;
  /** When set, hint to assistive tech that the column groups multiple rows. */
  scope?: 'col' | 'colgroup';
  /** Horizontal alignment for the header cell content. Defaults to `'left'`. */
  align?: 'left' | 'center' | 'right';
  /** Additional class names merged with `.cinder-table__header-cell`. */
  class?: string;
  /** Cell content (column label). */
  children: Snippet;
};
