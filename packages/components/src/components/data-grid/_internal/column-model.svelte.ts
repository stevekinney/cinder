import type {
  DataGridColumnDef,
  DataGridColumnPin,
  DataGridColumnPinning,
  DataGridColumnSizing,
} from '../data-grid.types.ts';

export const DEFAULT_DATA_GRID_COLUMN_WIDTH = 150;
export const DEFAULT_DATA_GRID_COLUMN_MIN_WIDTH = 60;

export type ResolvedDataGridColumn<TRow> = DataGridColumnDef<TRow> & {
  key: string;
  width: number;
  minWidth: number;
  colIndex: number;
  pin?: DataGridColumnPin;
  pinOffset: number;
};

type DataGridColumnModelOptions<TRow> = {
  columns: () => readonly DataGridColumnDef<TRow>[];
  columnOrder: () => readonly string[] | undefined;
  columnSizing: () => DataGridColumnSizing | undefined;
  columnPinning: () => DataGridColumnPinning | undefined;
};

export class DataGridColumnModel<TRow> {
  readonly columns: () => readonly DataGridColumnDef<TRow>[];
  readonly columnOrder: () => readonly string[] | undefined;
  readonly columnSizing: () => DataGridColumnSizing | undefined;
  readonly columnPinning: () => DataGridColumnPinning | undefined;

  constructor(options: DataGridColumnModelOptions<TRow>) {
    this.columns = options.columns;
    this.columnOrder = options.columnOrder;
    this.columnSizing = options.columnSizing;
    this.columnPinning = options.columnPinning;
  }

  readonly orderedColumns = $derived.by(() =>
    orderColumns(this.columns(), this.columnOrder()).map((column, index) =>
      resolveColumn(column, index, this.columnSizing(), this.columnPinning()),
    ),
  );

  readonly leftPinnedColumns = $derived.by(() =>
    withPinOffsets(
      this.orderedColumns.filter((column) => column.pin === 'left'),
      'left',
    ),
  );

  readonly rightPinnedColumns = $derived.by(() =>
    withPinOffsets(
      this.orderedColumns.filter((column) => column.pin === 'right'),
      'right',
    ),
  );

  readonly unpinnedColumns = $derived.by(() =>
    this.orderedColumns.filter((column) => column.pin === undefined),
  );

  readonly renderColumns = $derived.by(() => {
    return withRenderColIndexes([
      ...this.leftPinnedColumns,
      ...this.unpinnedColumns,
      ...this.rightPinnedColumns,
    ]);
  });
}

function orderColumns<TRow>(
  columns: readonly DataGridColumnDef<TRow>[],
  columnOrder: readonly string[] | undefined,
): readonly DataGridColumnDef<TRow>[] {
  assertUniqueColumnKeys(columns);
  if (!columnOrder || columnOrder.length === 0) return columns;

  const byKey = new Map(columns.map((column) => [column.key, column]));
  const ordered = columnOrder.flatMap((key) => {
    const column = byKey.get(key);
    if (!column) return [];
    byKey.delete(key);
    return [column];
  });

  return [...ordered, ...byKey.values()];
}

function assertUniqueColumnKeys<TRow>(columns: readonly DataGridColumnDef<TRow>[]): void {
  const seenColumnKeys = new Set<string>();
  for (const column of columns) {
    if (seenColumnKeys.has(column.key)) {
      throw new Error(
        `[cinder-data-grid] DataGrid column keys must be unique. Duplicate column key: ${JSON.stringify(column.key)}.`,
      );
    }
    seenColumnKeys.add(column.key);
  }
}

function resolveColumn<TRow>(
  column: DataGridColumnDef<TRow>,
  index: number,
  columnSizing: DataGridColumnSizing | undefined,
  columnPinning: DataGridColumnPinning | undefined,
): ResolvedDataGridColumn<TRow> {
  const minWidth = Math.max(
    0,
    finiteNumberOrFallback(column.minWidth, DEFAULT_DATA_GRID_COLUMN_MIN_WIDTH),
  );
  const baseWidth = finiteNumberOrFallback(
    columnSizing?.[column.key] ?? column.width,
    DEFAULT_DATA_GRID_COLUMN_WIDTH,
  );
  const maxWidth = Math.max(
    minWidth,
    finiteNumberOrFallback(column.maxWidth, Number.POSITIVE_INFINITY),
  );
  const pin = resolveColumnPin(column, columnPinning);

  const resolvedColumn = {
    ...column,
    minWidth,
    width: Math.min(Math.max(baseWidth, minWidth), maxWidth),
    colIndex: index + 1,
    pinOffset: 0,
  };

  if (pin !== undefined) return { ...resolvedColumn, pin };

  const { pin: _pin, ...unpinnedColumn } = resolvedColumn;
  return unpinnedColumn;
}

function finiteNumberOrFallback(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function resolveColumnPin<TRow>(
  column: DataGridColumnDef<TRow>,
  columnPinning: DataGridColumnPinning | undefined,
): DataGridColumnPin | undefined {
  if (columnPinning?.left?.includes(column.key)) return 'left';
  if (columnPinning?.right?.includes(column.key)) return 'right';
  return column.pin;
}

function withPinOffsets<TRow>(
  columns: readonly ResolvedDataGridColumn<TRow>[],
  pin: DataGridColumnPin,
): ResolvedDataGridColumn<TRow>[] {
  if (pin === 'left') {
    let offset = 0;
    return columns.map((column) => {
      const nextColumn = { ...column, pinOffset: offset };
      offset += column.width;
      return nextColumn;
    });
  }

  let offset = 0;
  const columnsWithOffsets: ResolvedDataGridColumn<TRow>[] = [];
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const column = columns[index];
    if (!column) continue;
    columnsWithOffsets.unshift({ ...column, pinOffset: offset });
    offset += column.width;
  }
  return columnsWithOffsets;
}

function withRenderColIndexes<TRow>(
  columns: readonly ResolvedDataGridColumn<TRow>[],
): ResolvedDataGridColumn<TRow>[] {
  return columns.map((column, index) => ({ ...column, colIndex: index + 1 }));
}

export function getDataGridColumnValue<TRow>(row: TRow, column: DataGridColumnDef<TRow>): unknown {
  if (column.getValue) return column.getValue(row);
  if (row !== null && typeof row === 'object' && Object.hasOwn(row, column.key)) {
    const value: unknown = Reflect.get(row, column.key);
    return value;
  }
  return undefined;
}
