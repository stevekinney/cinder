export type DataGridCellCoordinate = {
  rowId: string;
  columnKey: string;
};

export type DataGridCellRange = {
  anchor: DataGridCellCoordinate;
  focus: DataGridCellCoordinate;
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
  rowIndexByRowId: ReadonlyMap<string, number>,
  columnIndexByColumnKey: ReadonlyMap<string, number>,
): DataGridCellRange | null {
  const anchorRowIndex = rowIndexByRowId.get(anchor.rowId);
  const focusRowIndex = rowIndexByRowId.get(focus.rowId);
  const anchorColumnIndex = columnIndexByColumnKey.get(anchor.columnKey);
  const focusColumnIndex = columnIndexByColumnKey.get(focus.columnKey);

  if (
    anchorRowIndex === undefined ||
    focusRowIndex === undefined ||
    anchorColumnIndex === undefined ||
    focusColumnIndex === undefined
  ) {
    return null;
  }

  const startRowIndex = Math.min(anchorRowIndex, focusRowIndex);
  const endRowIndex = Math.max(anchorRowIndex, focusRowIndex);
  const startColumnIndex = Math.min(anchorColumnIndex, focusColumnIndex);
  const endColumnIndex = Math.max(anchorColumnIndex, focusColumnIndex);

  return {
    anchor,
    focus,
    startRowIndex,
    endRowIndex,
    startColumnIndex,
    endColumnIndex,
  };
}

export function isCellInRange(
  rowIndex: number,
  columnIndex: number,
  range: DataGridCellRange | null,
): boolean {
  if (!range) return false;
  return (
    rowIndex >= range.startRowIndex &&
    rowIndex <= range.endRowIndex &&
    columnIndex >= range.startColumnIndex &&
    columnIndex <= range.endColumnIndex
  );
}

export function getCellsInRange(
  range: DataGridCellRange | null,
  rowIds: readonly string[],
  columnKeys: readonly string[],
): DataGridCellCoordinate[] {
  if (!range) return [];
  const rangeRowIds = rowIds.slice(range.startRowIndex, range.endRowIndex + 1);
  const rangeColumnKeys = columnKeys.slice(range.startColumnIndex, range.endColumnIndex + 1);
  return rangeRowIds.flatMap((rowId) =>
    rangeColumnKeys.map((columnKey) => ({
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
