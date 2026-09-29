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
  compare(leftValue: TValue, rightValue: TValue, leftRow: TRow, rightRow: TRow): number;
}['compare'];

/**
 * Input `type` used for an editable column's edit surface. See
 * `DataGridColumnDef.editType`.
 */
export type DataGridEditType = 'text' | 'number';

export type DataGridCellContext<TRow, TValue = unknown> = {
  row: TRow;
  value: TValue;
  /**
   * `true` exactly for the single cell currently in edit mode (see
   * `DataGridColumnDef.editable`); `false` for every other cell, including
   * every cell in a non-editable column.
   */
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
   * Custom body cell renderer. `editing` is `true` while this exact cell is
   * in edit mode and `false` otherwise (see `editable`). DataGrid's
   * built-in edit surface (Cinder's Input) only replaces the default
   * formatted-value rendering; a column that supplies `cell` is
   * responsible for its own edit UI when `editing` is `true`.
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
  /**
   * Render body cells in this column as row headers (`role="rowheader"`).
   * Use this for the column that uniquely identifies each row, such as the
   * value returned by `getRowId`.
   */
  rowHeader?: boolean;
  /** Enables header-click sorting for this column. */
  sortable?: boolean;
  /**
   * Overrides the grid-level `resizableColumns` for this column. Set
   * `false` to prevent this column from resizing even when the grid enables
   * resizing. Has no effect when `resizableColumns` is `false`. Defaults to
   * `true`.
   */
  resizable?: boolean;
  /**
   * Enables inline editing for this column. Editable cells enter edit mode
   * on Enter, double-click, or by typing a printable character while the
   * cell is focused (not yet editing). Defaults to `false`.
   */
  editable?: boolean;
  /**
   * Input `type` for this column's edit surface (Cinder's Input). Defaults
   * to `'number'` when the cell's current value is a `number`, otherwise
   * `'text'`. Only meaningful when `editable` is `true`.
   */
  editType?: DataGridEditType;
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
  /**
   * Enables a pointer- and keyboard-driven resize handle on resizable
   * header cells. Off by default so existing grids render unchanged. A
   * column opts out individually with `resizable: false`.
   */
  resizableColumns?: boolean;
  /**
   * Enables pointer drag and keyboard reordering of header cells. Off by
   * default so existing grids render unchanged. A column can only be
   * reordered among columns that share its `pin` value — reordering never
   * moves a column across the left-pinned, unpinned, or right-pinned
   * groups.
   */
  reorderableColumns?: boolean;
  /**
   * Applies a supplied column order. `$bindable` — DataGrid assigns it
   * directly after a pointer or keyboard reorder (see `reorderableColumns`),
   * in addition to calling `onColumnOrderChange`, mirroring `sortModel`.
   */
  columnOrder?: readonly string[];
  /** Called after the user reorders a column and DataGrid updates `columnOrder`. */
  onColumnOrderChange?: (columnOrder: readonly string[]) => void;
  /**
   * Overrides resolved column widths by column key. `$bindable` — DataGrid
   * assigns it directly after a pointer or keyboard resize (see
   * `resizableColumns`), in addition to calling `onColumnSizingChange`,
   * mirroring `sortModel`.
   */
  columnSizing?: DataGridColumnSizing;
  /** Called after the user resizes a column and DataGrid updates `columnSizing`. */
  onColumnSizingChange?: (columnSizing: DataGridColumnSizing) => void;
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
  /**
   * Called after an in-grid cell edit commits (Enter, Tab, or blurring the
   * edit input) on an editable column. `value` is typed for the column's
   * resolved `editType`: a `number` column emits a `number`, or `undefined`
   * for an empty draft — never `NaN` — and leaves the original value
   * uncommitted for a draft that fails to parse as a number; every other
   * column emits the edited `string`. DataGrid never mutates the `rows`
   * prop — apply `value` to your own data from this callback.
   */
  onCellEdit?: (row: TRow, columnKey: string, value: unknown) => void;
  /** Additional class names merged onto the root grid. */
  class?: string;
  /** Additional class names for body rows. */
  rowClass?: string | ((row: TRow, rowIndex: number) => string | undefined);
  /** Optional accessible row label for screen-reader row summaries. */
  getRowAriaLabel?: (row: TRow, rowIndex: number) => string | undefined;
  /**
   * Renders a toolbar above the grid (outside `role="grid"`) with a search
   * field plus next/previous match controls. Matching is case-insensitive,
   * checks every column's resolved value (via `getValue` when supplied) as
   * a string, runs 300ms after the user stops typing, and covers every row
   * and column regardless of virtualization. Off by default: a grid that
   * doesn't opt in renders no toolbar, computes no matches, and starts no
   * timers.
   */
  search?: boolean;
  /**
   * Multiplies row height, header height, column width, and cell text size
   * by `zoom / 100`. `$bindable` — DataGrid assigns it directly after a
   * zoom-control interaction (see `zoomControls`), in addition to calling
   * `onZoomChange`, mirroring `sortModel`. Defaults to `100`. Clamped to
   * `[50, 200]`; a non-finite value (e.g. `NaN`) is ignored and falls back
   * to `100` with the same dev-warn pattern `rowHeight` uses.
   *
   * `columnSizing` always stays in unscaled base pixels regardless of
   * `zoom` — only the rendered, on-screen size is scaled — so a resize
   * (`resizableColumns`) keeps reporting the same base width whatever the
   * current zoom level is.
   */
  zoom?: number;
  /** Called after a zoom-control interaction and DataGrid updates `zoom`. */
  onZoomChange?: (zoom: number) => void;
  /**
   * Renders a toolbar group (in the same toolbar `search` uses) with the
   * current row count, the current visible column count, and zoom in/out
   * controls for `zoom`. Off by default: a grid that doesn't opt in renders
   * no extra toolbar DOM. Renders in the same `<Toolbar>` as `search` when
   * both are enabled; with neither enabled, DataGrid renders no toolbar at
   * all.
   */
  zoomControls?: boolean;
};
