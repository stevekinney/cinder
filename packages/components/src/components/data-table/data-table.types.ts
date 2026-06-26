import type { HTMLAttributes } from 'svelte/elements';

import type { TableDensity, TableSort } from '../table/table.types.ts';

/**
 * A generic record type representing a single data row.
 * Keys are strings; values may be anything renderable.
 */
export type DataTableRow = Record<string, unknown>;

/**
 * Column descriptor for a DataTable.
 *
 * @template Row - The row record type. Defaults to `DataTableRow`.
 */
export type DataTableColumn<Row extends DataTableRow = DataTableRow> = {
  /**
   * The key used to read the cell value from each row object.
   * Should be a key of `Row` when Row is a typed record.
   */
  key: keyof Row & string;
  /** Human-readable column label rendered in the `<th scope="col">` header cell. */
  label: string;
  /**
   * When true, the header cell renders a sort button and reports `aria-sort`.
   * Sort state is controlled by the consumer via the `sort` bindable — DataTable
   * never reorders rows itself.
   */
  sortable?: boolean;
  /**
   * Horizontal alignment for both the header and body cells of this column.
   * - `'start'` maps to left-aligned text (default).
   * - `'center'` maps to centered text.
   * - `'end'` maps to right-aligned text with `font-variant-numeric: tabular-nums`.
   */
  align?: 'start' | 'center' | 'end';
  /**
   * When true, the body cells in this column render as `<th scope="row">` instead
   * of `<td>`, identifying this column as the row-header for assistive technology.
   *
   * At most one column should set `rowHeader: true`. If no column sets it, the
   * first column automatically acts as the row header.
   */
  rowHeader?: boolean;
};

/** Row-selection mode for DataTable. */
export type DataTableSelectionMode = 'none' | 'single' | 'multiple';

/**
 * Props for the DataTable component.
 *
 * DataTable is a data-driven convenience wrapper over the compositional Table family.
 * It accepts an array of column descriptors and row records and renders the correct
 * semantic table markup automatically. For full compositional control, use Table,
 * Table.Header, Table.Body, Table.Row, Table.HeaderCell, and Table.Cell directly.
 *
 * @template Row - The row record type. Defaults to `DataTableRow`.
 */
export type DataTableProps<Row extends DataTableRow = DataTableRow> = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class'
> & {
  /** Column descriptors defining the headers and cell rendering for each column. */
  columns: DataTableColumn<Row>[];
  /** Row data. Each entry is read via `column.key` for each column. */
  rows: Row[];
  /** Visual caption rendered as a `<caption>` element above the table. */
  caption?: string;
  /**
   * Bound sort state. When the user activates a sortable header cell, this prop
   * is updated with the new `{ column, direction }`. The consumer is responsible
   * for reordering `rows` in response — DataTable does not sort internally.
   *
   * Pass `undefined` initially when no column is sorted; the component will never
   * write back `undefined` itself (sort always toggles to a column).
   */
  sort?: TableSort | undefined;
  /**
   * Enables checkbox-based row selection. `"none"` renders no selection controls,
   * `"single"` allows one selected row id, and `"multiple"` allows any number.
   * Selection state is exposed through row checkbox controls; native table rows
   * do not emit `aria-selected`.
   * Defaults to `"none"`.
   */
  selectable?: DataTableSelectionMode;
  /**
   * Bound selected row ids. Arrays stay arrays on update; Sets stay Sets.
   * When omitted, DataTable starts with an empty array.
   */
  selectedRowIds?: string[] | Set<string>;
  /**
   * Resolves the stable row id used for selection. Defaults to `row.id` when it
   * is a string or number, otherwise the row's current positional index.
   */
  getRowId?: (row: Row, index: number) => string;
  /** Returns true when a row should render a disabled selection checkbox. */
  isRowSelectionDisabled?: (row: Row, index: number) => boolean;
  /** Accessible label for the multiple-selection header checkbox. */
  selectAllLabel?: string;
  /** Accessible label for an individual row selection checkbox. */
  rowSelectionLabel?: (row: Row, index: number) => string;
  /** When true, the header sticks to the top of the scrolling container. */
  stickyHeader?: boolean;
  /**
   * Vertical padding density for header and body cells.
   * Defaults to `'comfortable'`.
   */
  density?: TableDensity;
  /**
   * When true, wraps the table in a `.cinder-table-scroll` container that
   * enables horizontal overflow scrolling on small viewports.
   */
  scrollable?: boolean;
  /**
   * When true, renders only the visible `<tbody>` row window plus spacer rows.
   * Requires a fixed row height. This is intended for large, append-only tables
   * such as live logs or event streams.
   */
  virtualized?: boolean;
  /**
   * Fixed body row height in pixels for virtualized mode.
   * This must match the actual rendered body row height, including density
   * padding and any wrapping introduced by the table content.
   * Defaults to 44.
   */
  rowHeight?: number;
  /**
   * Extra body rows rendered before and after the visible virtualized window.
   * Defaults to 5.
   */
  overscan?: number;
  /**
   * CSS block-size for the virtualized native scroll container.
   * Defaults to `"24rem"` when `virtualized` is true.
   */
  height?: string;
  /**
   * When true in virtualized mode, appending rows while scrolled to the bottom
   * keeps the newest row pinned in view. Appending while scrolled up does not
   * change the viewport.
   */
  stickToBottom?: boolean;
  /**
   * Additional class names merged onto DataTable's root wrapper element (the
   * `<div class="cinder-data-table">` that contains the table). To style the
   * `<table>` itself, target `.cinder-data-table table` from this class.
   */
  class?: string;
};
