export type DataGridCellCoordinate = {
  rowId: string;
  columnKey: string;
};

export type DataGridCellRange = {
  anchor: DataGridCellCoordinate;
  focus: DataGridCellCoordinate;
  rowIds: readonly string[];
  columnKeys: readonly string[];
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
};

export function getCellCoordinateKey(cell: DataGridCellCoordinate): string {
  return `${cell.rowId}\u0000${cell.columnKey}`;
}

export function computeCellRange(
  anchor: DataGridCellCoordinate,
  focus: DataGridCellCoordinate,
  rowIds: readonly string[],
  columnKeys: readonly string[],
): DataGridCellRange | undefined {
  const anchorRowIndex = rowIds.indexOf(anchor.rowId);
  const focusRowIndex = rowIds.indexOf(focus.rowId);
  const anchorColumnIndex = columnKeys.indexOf(anchor.columnKey);
  const focusColumnIndex = columnKeys.indexOf(focus.columnKey);

  if (anchorRowIndex < 0 || focusRowIndex < 0 || anchorColumnIndex < 0 || focusColumnIndex < 0) {
    return undefined;
  }

  const startRowIndex = Math.min(anchorRowIndex, focusRowIndex);
  const endRowIndex = Math.max(anchorRowIndex, focusRowIndex);
  const startColumnIndex = Math.min(anchorColumnIndex, focusColumnIndex);
  const endColumnIndex = Math.max(anchorColumnIndex, focusColumnIndex);

  return {
    anchor,
    focus,
    rowIds: rowIds.slice(startRowIndex, endRowIndex + 1),
    columnKeys: columnKeys.slice(startColumnIndex, endColumnIndex + 1),
    startRowIndex,
    endRowIndex,
    startColumnIndex,
    endColumnIndex,
  };
}

export function isCellInRange(
  cell: DataGridCellCoordinate,
  range: DataGridCellRange | undefined,
): boolean {
  if (!range) return false;
  return range.rowIds.includes(cell.rowId) && range.columnKeys.includes(cell.columnKey);
}

export function getCellsInRange(range: DataGridCellRange | undefined): DataGridCellCoordinate[] {
  if (!range) return [];
  return range.rowIds.flatMap((rowId) =>
    range.columnKeys.map((columnKey) => ({
      rowId,
      columnKey,
    })),
  );
}

export function clampCellCoordinate(
  cell: DataGridCellCoordinate,
  rowIds: readonly string[],
  columnKeys: readonly string[],
): DataGridCellCoordinate | undefined {
  if (rowIds.length === 0 || columnKeys.length === 0) return undefined;

  const rowIndex = rowIds.indexOf(cell.rowId);
  const columnIndex = columnKeys.indexOf(cell.columnKey);
  if (rowIndex < 0 || columnIndex < 0) return undefined;

  return {
    rowId: rowIds[Math.min(Math.max(rowIndex, 0), rowIds.length - 1)] ?? rowIds[0]!,
    columnKey:
      columnKeys[Math.min(Math.max(columnIndex, 0), columnKeys.length - 1)] ?? columnKeys[0]!,
  };
}

export function columnOffsetForWindow(
  windowStart: number,
  columnWidths: readonly number[],
  pinnedLeftCount: number,
): number {
  const firstScrollableIndex = clampInteger(pinnedLeftCount, 0, columnWidths.length);
  const startIndex = clampInteger(windowStart, firstScrollableIndex, columnWidths.length);
  let offset = 0;

  for (let index = firstScrollableIndex; index < startIndex; index += 1) {
    const width = columnWidths[index] ?? 0;
    if (Number.isFinite(width) && width > 0) offset += width;
  }

  return offset;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
