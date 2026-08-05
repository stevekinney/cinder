import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Discriminated union for the select-all trio.
 *
 * - Active branch: supply `allSelected` + `someSelected` + `onSelectAll` together.
 * - Inert branch: supply none of the three — only valid when `Table.selectable` is false.
 *
 * Unlike `TableRowSelectionProps`, there is no third "opt-out" arm — there is no
 * per-header equivalent of `TableRow`'s `selectionDisabled: true` branch.
 *
 * Note: Svelte 5's `$props()` merges discriminated union branches into a flat
 * object at destructuring time. TypeScript cannot narrow the active vs inert
 * branch after destructuring. Runtime validation enforces the contract when
 * `Table.selectable` is true — see the throw in table-header.svelte.
 */
export type TableHeaderSelectionProps =
  | {
      /**
       * Checked state for the select-all checkbox. Required together with
       * `someSelected` and `onSelectAll` when `Table.selectable` is true.
       */
      allSelected: boolean;
      /**
       * When true and `allSelected` is false, the select-all checkbox renders as indeterminate.
       * The browser exposes that as `aria-checked="mixed"` to assistive tech.
       * Required together with `allSelected` and `onSelectAll` when
       * `Table.selectable` is true.
       */
      someSelected: boolean;
      /**
       * Called when the user activates the select-all checkbox. Required
       * together with `allSelected` and `someSelected` when `Table.selectable`
       * is true.
       */
      onSelectAll: (next: boolean) => void;
    }
  | {
      allSelected?: undefined;
      someSelected?: undefined;
      onSelectAll?: undefined;
    };

export type TableHeaderProps = Omit<
  HTMLAttributes<HTMLTableSectionElement>,
  'class' | 'children'
> & {
  /** Additional class names merged with `.cinder-table__header`. */
  class?: string;
  /** TableRow children — typically a single header row. */
  children: Snippet;
  /**
   * Accessible name for the select-all checkbox. Defaults to "Select all rows".
   * When the table contains rows with `selectionDisabled={true}`, pass a more
   * accurate label such as "Select all selectable rows".
   */
  selectAllLabel?: string;
} & TableHeaderSelectionProps;
