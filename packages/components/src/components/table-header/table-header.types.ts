import type { Snippet } from 'svelte';
export type TableHeaderProps = {
  /** Additional class names merged with `.cinder-table__header`. */
  class?: string;
  /** TableRow children — typically a single header row. */
  children: Snippet;
  /** Checked state for the select-all checkbox. Required when `Table.selectable` is true. */
  allSelected?: boolean;
  /**
   * When true and `allSelected` is false, the select-all checkbox renders as indeterminate.
   * The browser exposes that as `aria-checked="mixed"` to assistive tech.
   * Required (alongside `allSelected` and `onSelectAll`) when `Table.selectable`
   * is true for accurate checkbox state.
   */
  someSelected?: boolean;
  /** Called when the user activates the select-all checkbox. Required when `Table.selectable` is true. */
  onSelectAll?: (next: boolean) => void;
  /**
   * Accessible name for the select-all checkbox. Defaults to "Select all rows".
   * When the table contains rows with `selectionDisabled={true}`, pass a more
   * accurate label such as "Select all selectable rows".
   */
  selectAllLabel?: string;
};
