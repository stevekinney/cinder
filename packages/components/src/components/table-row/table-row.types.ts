import type { Snippet } from 'svelte';

/**
 * Discriminated union for row selection props.
 *
 * - Active branch: supply `selected` + `onSelectedChange` + `selectionLabel`.
 * - Opt-out branch: supply `selectionDisabled: true` — renders an empty alignment cell.
 * - Inert branch: supply nothing — only valid when `Table.selectable` is false or
 *   the row is inside `TableHeader`.
 *
 * Note: Svelte 5's `$props()` merges discriminated union branches into a flat
 * object at destructuring time. TypeScript cannot narrow the active vs inert
 * branch after destructuring. Runtime validation enforces the contract when
 * `Table.selectable` is true — both `selected` and `selectionLabel` are
 * required together and `onSelectedChange` must be present.
 */
export type TableRowSelectionProps =
  | {
      selected: boolean;
      onSelectedChange: (next: boolean) => void;
      selectionLabel: string;
      selectionDisabled?: false;
    }
  | {
      selectionDisabled: true;
      selected?: undefined;
      onSelectedChange?: undefined;
      /**
       * Accessible name for the disabled selection checkbox. Provide a localised
       * string to override the English default ("Selection not allowed for this
       * row"). The library cannot localise on the consumer's behalf, so this is
       * the seam for non-English applications or custom phrasing.
       */
      selectionLabel?: string;
    }
  | {
      selected?: undefined;
      onSelectedChange?: undefined;
      selectionLabel?: undefined;
      selectionDisabled?: undefined;
    };

export type TableRowProps = {
  /** Additional class names merged with `.cinder-table__row`. */
  class?: string;
  /** Cell children (TableCell or TableHeaderCell). */
  children: Snippet;
} & TableRowSelectionProps;
