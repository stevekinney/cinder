import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type DataGridDensity = 'compact' | 'comfortable' | 'spacious';
export type DataGridColumnPin = 'left' | 'right';

export type DataGridCellContext<TRow, TValue = unknown> = {
  row: TRow;
  value: TValue;
  editing: boolean;
};

type DataGridBaseColumnDef<TRow> = {
  /**
   * Stable column identity used for ARIA cell ids and column state.
   */
  key: string;
  /** Header content rendered in the columnheader cell. */
  header: string | Snippet;
  /**
   * Custom body cell renderer. The `editing` flag is currently always false
   * because DataGrid renders read-only cells.
   */
  cell?: Snippet<[DataGridCellContext<TRow>]>;
  /** Initial pixel width. Defaults to 150. */
  width?: number;
  /** Minimum pixel width used by sizing resolution. Defaults to 60. */
  minWidth?: number;
  /** Maximum pixel width used by sizing resolution. */
  maxWidth?: number;
  /** Pin this column to the left or right edge of the horizontal scroller. */
  pin?: DataGridColumnPin;
};

export type DataGridColumnDef<TRow = Record<string, unknown>> =
  | (DataGridBaseColumnDef<TRow> & {
      key: Extract<keyof TRow, string>;
      /** Reads a value from the row. Defaults to object-key access by `column.key`. */
      getValue?: (row: TRow) => TRow[Extract<keyof TRow, string>];
    })
  | (DataGridBaseColumnDef<TRow> & {
      key: string;
      /** Required for computed columns whose key is not a row property. */
      getValue: (row: TRow) => unknown;
    });

export type DataGridColumnSizing = Record<string, number>;

export type DataGridColumnPinning = {
  left?: readonly string[];
  right?: readonly string[];
};

export type DataGridProps<TRow = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'role'
> & {
  rows: readonly TRow[];
  columns: readonly DataGridColumnDef<TRow>[];
  /** Stable row identity used for ARIA ids and row-scoped state. */
  getRowId: (row: TRow) => string;
  /** Controls body row padding density. Defaults to `'comfortable'`. */
  density?: DataGridDensity;
  /** Keeps the column header row pinned to the top edge while scrolling. Defaults to `true`. */
  stickyHeader?: boolean;
  /** Applies a supplied column order. */
  columnOrder?: readonly string[];
  /** Overrides resolved column widths by column key. */
  columnSizing?: DataGridColumnSizing;
  /** Pins supplied column keys to the left or right edge. */
  columnPinning?: DataGridColumnPinning;
  /** Additional class names merged onto the root grid. */
  class?: string;
  /** Additional class names for body rows. */
  rowClass?: string | ((row: TRow, rowIndex: number) => string | undefined);
  /** Optional accessible row label for screen-reader row summaries. */
  getRowAriaLabel?: (row: TRow, rowIndex: number) => string | undefined;
};
