import type { Snippet } from 'svelte';
import type { HTMLTableAttributes } from 'svelte/elements';
/** Sort direction. */
export type SortDirection = 'ascending' | 'descending';
/** Bound sort state shape. */
export type TableSort = {
  /** Column key currently sorted by. */
  column: string;
  /** Direction of the active sort. */
  direction: SortDirection;
};
/** Vertical padding density for all cells in the table. */
export type TableDensity = 'comfortable' | 'condensed' | 'spacious';
/** Section context value — set by TableHeader and TableBody, read by TableRow. */
export type TableSectionContext = 'header' | 'body';
/**
 * Context set by TableHeader with select-all state, read by the header TableRow
 * to render the leading select-all checkbox cell.
 */
export type TableHeaderSelectionContext = {
  readonly allSelected: boolean;
  readonly someSelected: boolean;
  readonly onSelectAll: (next: boolean) => void;
  readonly selectAllLabel: string;
  claimSelectionHeaderCell: () => void;
};
/**
 * Shape of the table context provided to child components. Header cells call
 * `onSortChange` with their column key when activated; the table propagates
 * the new sort state to its bindable `sort` prop. Children read
 * `selectionEnabled` to render the leading selection cell.
 *
 * @internal This type describes the context object produced by Table. It is
 * not intended to be implemented or constructed by consumers — use `getContext`
 * to read it, not `setContext` to provide it.
 */
export type TableContext = {
  readonly sort: TableSort | undefined;
  onSortChange: (column: string) => void;
  /** Mirror of Table.selectable. Set synchronously at construction time. */
  readonly selectionEnabled?: boolean;
};
/**
 * Props for the Table component.
 *
 * Cinder's Table is **deliberately small**: semantic markup, controlled sort
 * state, optional sticky header, optional density, optional row selection.
 * It does NOT virtualize, sort, paginate, edit cells, pin columns, resize
 * columns, or aggregate. The consumer owns data ordering and dispatches sort
 * intents through the `sort` bindable.
 */
export type TableProps = Omit<HTMLTableAttributes, 'class'> & {
  /**
   * Bound sort state. When the user activates a sortable header, this prop
   * is updated to reflect the new column / direction.
   *
   * Pass `undefined` initially when no column is sorted; the component will
   * never write back `undefined` itself (sort always toggles to a column).
   */
  sort?: TableSort | undefined;
  /** Visual caption rendered as a `<caption>` element. */
  caption?: string;
  /** When true, the header sticks to the top of the scrolling container. */
  stickyHeader?: boolean;
  /**
   * Vertical padding density for header and body cells.
   * Defaults to `'comfortable'`.
   */
  density?: TableDensity;
  /**
   * Enables the leading selection column on the entire table. When true:
   * - The single `TableRow` inside `TableHeader` renders a leading `<th>`
   *   with a select-all checkbox sourced from the header's props.
   * - Every `TableRow` inside `TableBody` renders a leading selection cell.
   * Selection is strictly controlled — the consumer owns all selection state.
   */
  selectable?: boolean;
  /** Additional class names merged with `.cinder-table`. */
  class?: string;
  /** TableHeader, TableBody, etc. */
  children: Snippet;
};
