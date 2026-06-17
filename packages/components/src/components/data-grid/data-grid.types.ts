import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type DataGridDensity = 'compact' | 'comfortable' | 'spacious';
export type DataGridColumnPin = 'left' | 'right';
export type DataGridSelectionMode = 'none' | 'single' | 'multiple';
export type DataGridSortDirection = 'ascending' | 'descending';

export type DataGridSortModelItem = {
  key: string;
  direction: DataGridSortDirection;
};

export type DataGridSortModel = readonly DataGridSortModelItem[];

export type DataGridSortComparator<TRow, TValue = unknown> = {
  bivarianceHack(leftValue: TValue, rightValue: TValue, leftRow: TRow, rightRow: TRow): number;
}['bivarianceHack'];

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
  /** Enables header-click sorting for this column. */
  sortable?: boolean;
};

type DataGridSortableColumnDef<TRow, TValue> = DataGridBaseColumnDef<TRow> & {
  /** Custom comparator for this column. Receives cell values and their source rows. */
  sortComparator?: DataGridSortComparator<TRow, TValue>;
};

export type DataGridColumnDef<TRow = Record<string, unknown>> =
  | {
      [TKey in Extract<keyof TRow, string>]: DataGridSortableColumnDef<TRow, TRow[TKey]> & {
        key: TKey;
        /** Reads a value from the row. Defaults to object-key access by `column.key`. */
        getValue?: (row: TRow) => TRow[TKey];
      };
    }[Extract<keyof TRow, string>]
  | (DataGridSortableColumnDef<TRow, unknown> & {
      key: string;
      /** Required for computed columns whose key is not a row property. */
      getValue: (row: TRow) => unknown;
    });

export type DataGridColumnSizing = Record<string, number>;

export type DataGridColumnPinning = {
  left?: readonly string[];
  right?: readonly string[];
};

export type DataGridSelectionModel = readonly string[];

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
  /** Enables fixed-height row virtualization. */
  virtualizeRows?: boolean;
  /** Enables LTR horizontal virtualization for unpinned columns. Pinned columns stay rendered. */
  virtualizeColumns?: boolean;
  /** Fixed body-row pixel height used by row virtualization. Defaults to 44 when omitted or invalid. */
  rowHeight?: number;
  /** Applies a supplied column order. */
  columnOrder?: readonly string[];
  /** Overrides resolved column widths by column key. */
  columnSizing?: DataGridColumnSizing;
  /** Pins supplied column keys to the left or right edge. */
  columnPinning?: DataGridColumnPinning;
  /** Controls row-selection behavior. Cell focus and range selection remain available. */
  selectionMode?: DataGridSelectionMode;
  /** Controlled row-selection ids, keyed by `getRowId`. */
  selectionModel?: DataGridSelectionModel | undefined;
  /** Called when row selection changes through cell interaction. */
  onSelectionModelChange?: (selectionModel: DataGridSelectionModel) => void;
  /** Controls the row sort order used to render rows. */
  sortModel?: DataGridSortModel;
  /** Called after the user changes sort order and DataGrid updates `sortModel`. */
  onSortModelChange?: (sortModel: DataGridSortModel) => void;
  /** Additional class names merged onto the root grid. */
  class?: string;
  /** Additional class names for body rows. */
  rowClass?: string | ((row: TRow, rowIndex: number) => string | undefined);
  /** Optional accessible row label for screen-reader row summaries. */
  getRowAriaLabel?: (row: TRow, rowIndex: number) => string | undefined;
};
