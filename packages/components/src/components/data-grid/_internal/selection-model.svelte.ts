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
  toggledCellKeys = $state.raw<readonly string[]>([]);

  constructor(options: DataGridSelectionModelOptions) {
    this.rowIds = options.rowIds;
    this.columnKeys = options.columnKeys;
  }

  readonly range: DataGridCellRange | undefined = $derived.by(() => {
    if (!this.anchorCell || !this.activeCell) return undefined;
    return computeCellRange(this.anchorCell, this.activeCell, this.rowIds(), this.columnKeys());
  });

  readonly selectedCells = $derived.by(() => {
    const keys = new Set(this.toggledCellKeys);
    for (const cell of getCellsInRange(this.range)) keys.add(getCellCoordinateKey(cell));
    return keys;
  });

  readonly selectedCellCount = $derived(this.selectedCells.size);

  setActiveCell(
    cell: DataGridCellCoordinate,
    options: { extend?: boolean; toggle?: boolean } = {},
  ): void {
    if (options.toggle) {
      this.toggleCell(cell);
      this.activeCell = cell;
      this.anchorCell = undefined;
      return;
    }

    if (!options.extend || !this.anchorCell) {
      this.anchorCell = cell;
      this.toggledCellKeys = [];
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
    this.toggledCellKeys = [];
  }

  collapseToActiveCell(): void {
    if (!this.activeCell) return;
    this.anchorCell = this.activeCell;
    this.toggledCellKeys = [];
  }

  isCellSelected(cell: DataGridCellCoordinate): boolean {
    return this.selectedCells.has(getCellCoordinateKey(cell));
  }

  isAnchorCell(cell: DataGridCellCoordinate): boolean {
    if (!this.anchorCell) return false;
    return getCellCoordinateKey(this.anchorCell) === getCellCoordinateKey(cell);
  }

  reconcile(fallbackCell: DataGridCellCoordinate | undefined): void {
    const rowIds = this.rowIds();
    const columnKeys = this.columnKeys();

    if (rowIds.length === 0 || columnKeys.length === 0) {
      this.activeCell = undefined;
      this.anchorCell = undefined;
      this.toggledCellKeys = [];
      return;
    }

    const hadActiveCell = this.activeCell !== undefined;
    const nextActiveCell =
      (this.activeCell && clampCellCoordinate(this.activeCell, rowIds, columnKeys)) ?? fallbackCell;
    if (!areCellsEqual(this.activeCell, nextActiveCell)) this.activeCell = nextActiveCell;

    const nextAnchorCell =
      (this.anchorCell && clampCellCoordinate(this.anchorCell, rowIds, columnKeys)) ??
      (!hadActiveCell ? nextActiveCell : undefined);
    if (!areCellsEqual(this.anchorCell, nextAnchorCell)) this.anchorCell = nextAnchorCell;

    const validCellKeys = new Set(
      rowIds.flatMap((rowId) =>
        columnKeys.map((columnKey) => getCellCoordinateKey({ rowId, columnKey })),
      ),
    );
    const nextToggledCellKeys = this.toggledCellKeys.filter((key) => validCellKeys.has(key));
    if (nextToggledCellKeys.length !== this.toggledCellKeys.length) {
      this.toggledCellKeys = nextToggledCellKeys;
    }
  }

  private toggleCell(cell: DataGridCellCoordinate): void {
    const key = getCellCoordinateKey(cell);
    const keys = new Set(this.toggledCellKeys);
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    this.toggledCellKeys = [...keys];
  }
}

function areCellsEqual(
  left: DataGridCellCoordinate | undefined,
  right: DataGridCellCoordinate | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.rowId === right.rowId && left.columnKey === right.columnKey;
}
