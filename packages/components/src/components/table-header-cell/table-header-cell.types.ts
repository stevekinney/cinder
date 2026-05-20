import type { Snippet } from 'svelte';
export type TableHeaderCellProps = {
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
  /** Additional class names merged with `.cinder-table__header-cell`. */
  class?: string;
  /** Cell content (column label). */
  children: Snippet;
};
