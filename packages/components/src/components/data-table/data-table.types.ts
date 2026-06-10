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
export type DataTableProps<Row extends DataTableRow = DataTableRow> = {
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
   * Additional class names merged onto DataTable's root wrapper element (the
   * `<div class="cinder-data-table">` that contains the table). To style the
   * `<table>` itself, target `.cinder-data-table table` from this class.
   */
  class?: string;
};
