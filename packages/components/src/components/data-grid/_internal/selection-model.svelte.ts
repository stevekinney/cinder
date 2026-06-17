import {
  clampCellCoordinate,
  computeCellRange,
  getCellCoordinateKey,
  getCellsInRange,
  type DataGridCellCoordinate,
  type DataGridCellRange,
} from './geometry.ts';

export type DataGridSelectionModelOptions = {
  rowIds: () => readonly string[];
  columnKeys: () => readonly string[];
};

export class DataGridSelectionModel {
  readonly rowIds: () => readonly string[];
  readonly columnKeys: () => readonly string[];

  activeCell = $state<DataGridCellCoordinate | undefined>();
  anchorCell = $state<DataGridCellCoordinate | undefined>();
  toggledCells = $state.raw<readonly DataGridCellCoordinate[]>([]);

  constructor(options: DataGridSelectionModelOptions) {
    this.rowIds = options.rowIds;
    this.columnKeys = options.columnKeys;
  }

  readonly range: DataGridCellRange | undefined = $derived.by(() => {
    if (!this.anchorCell || !this.activeCell) return undefined;
    return computeCellRange(this.anchorCell, this.activeCell, this.rowIds(), this.columnKeys());
  });

  readonly selectedCellCoordinates = $derived.by(() => {
    const cellsByKey = new Map<string, DataGridCellCoordinate>();
    for (const cell of getCellsInRange(this.range))
      cellsByKey.set(getCellCoordinateKey(cell), cell);
    for (const cell of this.toggledCells) {
      if (clampCellCoordinate(cell, this.rowIds(), this.columnKeys())) {
        cellsByKey.set(getCellCoordinateKey(cell), cell);
      }
    }
    return [...cellsByKey.values()];
  });

  readonly selectedCells = $derived.by(() => {
    const keys = new Set<string>();
    for (const cell of this.selectedCellCoordinates) keys.add(getCellCoordinateKey(cell));
    return keys;
  });

  readonly selectedCellCount = $derived(this.selectedCells.size);

  setActiveCell(
    cell: DataGridCellCoordinate,
    options: { extend?: boolean; toggle?: boolean } = {},
  ): void {
    if (options.toggle) {
      this.materializeRangeSelection();
      this.toggleCell(cell);
      this.activeCell = cell;
      this.anchorCell = undefined;
      return;
    }

    if (options.extend) {
      if (!this.anchorCell) this.anchorCell = this.activeCell ?? cell;
      this.activeCell = cell;
      return;
    }

    if (!options.extend || !this.anchorCell) {
      this.anchorCell = cell;
      this.toggledCells = [];
    }

    this.activeCell = cell;
  }

  selectAll(): void {
    const firstRowId = this.rowIds()[0];
    const lastRowId = this.rowIds().at(-1);
    const firstColumnKey = this.columnKeys()[0];
    const lastColumnKey = this.columnKeys().at(-1);
    if (
      firstRowId === undefined ||
      lastRowId === undefined ||
      firstColumnKey === undefined ||
      lastColumnKey === undefined
    ) {
      return;
    }
    this.anchorCell = { rowId: firstRowId, columnKey: firstColumnKey };
    this.activeCell = { rowId: lastRowId, columnKey: lastColumnKey };
    this.toggledCells = [];
  }

  collapseToActiveCell(): void {
    if (!this.activeCell) return;
    this.anchorCell = this.activeCell;
    this.toggledCells = [];
  }

  isCellSelected(cell: DataGridCellCoordinate): boolean {
    return this.selectedCells.has(getCellCoordinateKey(cell));
  }

  isAnchorCell(cell: DataGridCellCoordinate): boolean {
    if (!this.anchorCell) return false;
    return getCellCoordinateKey(this.anchorCell) === getCellCoordinateKey(cell);
  }

  reconcile(
    fallbackCell: DataGridCellCoordinate | undefined,
    options: { preferFallback?: boolean } = {},
  ): void {
    const rowIds = this.rowIds();
    const columnKeys = this.columnKeys();

    if (rowIds.length === 0 || columnKeys.length === 0) {
      this.activeCell = undefined;
      this.anchorCell = undefined;
      this.toggledCells = [];
      return;
    }

    const hadActiveCell = this.activeCell !== undefined;
    const hadAnchorCell = this.anchorCell !== undefined;
    const reconciledActiveCell =
      this.activeCell && clampCellCoordinate(this.activeCell, rowIds, columnKeys);
    const nextActiveCell = options.preferFallback
      ? (fallbackCell ?? reconciledActiveCell)
      : (reconciledActiveCell ?? fallbackCell);
    if (!areCellsEqual(this.activeCell, nextActiveCell)) this.activeCell = nextActiveCell;

    const nextAnchorCell =
      (this.anchorCell && clampCellCoordinate(this.anchorCell, rowIds, columnKeys)) ??
      (hadAnchorCell || !hadActiveCell ? nextActiveCell : undefined);
    if (!areCellsEqual(this.anchorCell, nextAnchorCell)) this.anchorCell = nextAnchorCell;

    const nextToggledCells = this.toggledCells.filter((cell) =>
      clampCellCoordinate(cell, rowIds, columnKeys),
    );
    if (nextToggledCells.length !== this.toggledCells.length) {
      this.toggledCells = nextToggledCells;
    }
  }

  private materializeRangeSelection(): void {
    const rangeCells = getCellsInRange(this.range);
    if (rangeCells.length <= 1) return;

    const cellsByKey = new Map(
      this.toggledCells.map((toggledCell) => [getCellCoordinateKey(toggledCell), toggledCell]),
    );
    for (const cell of rangeCells) cellsByKey.set(getCellCoordinateKey(cell), cell);
    this.toggledCells = [...cellsByKey.values()];
  }

  private toggleCell(cell: DataGridCellCoordinate): void {
    const key = getCellCoordinateKey(cell);
    const cellsByKey = new Map(
      this.toggledCells.map((toggledCell) => [getCellCoordinateKey(toggledCell), toggledCell]),
    );
    if (cellsByKey.has(key)) cellsByKey.delete(key);
    else cellsByKey.set(key, cell);
    this.toggledCells = [...cellsByKey.values()];
  }
}

export function areCellsEqual(
  left: DataGridCellCoordinate | undefined,
  right: DataGridCellCoordinate | undefined,
): boolean {
  if (left === undefined && right === undefined) return true;
  if (!left || !right) return false;
  return left.rowId === right.rowId && left.columnKey === right.columnKey;
}
