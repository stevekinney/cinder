import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  clampCellCoordinate,
  computeCellRange,
  getCellsInRange,
  isCellInRange,
  type DataGridCellCoordinate,
} from './_internal/geometry.ts';
import { dataGridKeyToAction } from './_internal/keyboard-model.ts';
import { createReactiveIdList } from './_internal/selection-model-test-support.svelte.ts';
import { areCellsEqual, DataGridSelectionModel } from './_internal/selection-model.svelte.ts';

setupHappyDom();

const rowIds = ['row-1', 'row-2', 'row-3', 'row-4'];
const columnKeys = ['customer', 'status', 'total', 'owner'];
const rowIndexByRowId = new Map(rowIds.map((id, index) => [id, index]));
const columnIndexByColumnKey = new Map(columnKeys.map((key, index) => [key, index]));

function createModel(
  initialRowIds: readonly string[] = rowIds,
  initialColumnKeys: readonly string[] = columnKeys,
) {
  const rowSource = createReactiveIdList(initialRowIds);
  const columnSource = createReactiveIdList(initialColumnKeys);
  const model = new DataGridSelectionModel({
    rowIds: rowSource.get,
    columnKeys: columnSource.get,
  });
  return { model, rowSource, columnSource };
}

describe('DataGrid range geometry', () => {
  test('computes a rectangular range regardless of drag direction', () => {
    const anchor: DataGridCellCoordinate = { rowId: 'row-3', columnKey: 'total' };
    const focus: DataGridCellCoordinate = { rowId: 'row-1', columnKey: 'customer' };

    const range = computeCellRange(anchor, focus, rowIndexByRowId, columnIndexByColumnKey);

    expect(range).toEqual({
      anchor,
      focus,
      startRowIndex: 0,
      endRowIndex: 2,
      startColumnIndex: 0,
      endColumnIndex: 2,
    });
    expect(getCellsInRange(range, rowIds, columnKeys)).toHaveLength(9);
    expect(isCellInRange(rowIds.indexOf('row-2'), columnKeys.indexOf('status'), range)).toBe(true);
    expect(isCellInRange(rowIds.indexOf('row-4'), columnKeys.indexOf('owner'), range)).toBe(false);
  });

  test('returns null when an endpoint references an unknown row', () => {
    const range = computeCellRange(
      { rowId: 'row-1', columnKey: 'customer' },
      { rowId: 'missing', columnKey: 'status' },
      rowIndexByRowId,
      columnIndexByColumnKey,
    );

    expect(range).toBeNull();
  });

  test('returns null when an endpoint references an unknown column', () => {
    const range = computeCellRange(
      { rowId: 'row-1', columnKey: 'missing' },
      { rowId: 'row-2', columnKey: 'status' },
      rowIndexByRowId,
      columnIndexByColumnKey,
    );

    expect(range).toBeNull();
  });

  test('does not clamp missing cell coordinates to the first cell', () => {
    expect(
      clampCellCoordinate({ rowId: 'missing', columnKey: 'customer' }, rowIds, columnKeys),
    ).toBeUndefined();
    expect(
      clampCellCoordinate({ rowId: 'row-1', columnKey: 'missing' }, rowIds, columnKeys),
    ).toBeUndefined();
    expect(
      clampCellCoordinate({ rowId: 'row-2', columnKey: 'status' }, rowIds, columnKeys),
    ).toEqual({
      rowId: 'row-2',
      columnKey: 'status',
    });
  });
});

describe('DataGrid selection model', () => {
  test('compares absent and present cell coordinates without forcing reconciliation churn', () => {
    const cell: DataGridCellCoordinate = { rowId: 'row-1', columnKey: 'customer' };

    expect(areCellsEqual(undefined, undefined)).toBe(true);
    expect(areCellsEqual(undefined, cell)).toBe(false);
    expect(areCellsEqual(cell, undefined)).toBe(false);
    expect(areCellsEqual(cell, { rowId: 'row-1', columnKey: 'customer' })).toBe(true);
    expect(areCellsEqual(cell, { rowId: 'row-1', columnKey: 'status' })).toBe(false);
  });

  test('checks cell membership without enumerating the full selected range', () => {
    const { model } = createModel();

    model.setActiveCell({ rowId: 'row-1', columnKey: 'customer' });
    model.setActiveCell({ rowId: 'row-3', columnKey: 'total' }, { extend: true });

    Object.defineProperty(model, 'selectedCellCoordinates', {
      configurable: true,
      get(): never {
        throw new Error('isCellSelected must not read selectedCellCoordinates');
      },
    });

    // Inside the range.
    expect(model.isCellSelected({ rowId: 'row-2', columnKey: 'status' })).toBe(true);
    // On the range's edge.
    expect(model.isCellSelected({ rowId: 'row-3', columnKey: 'total' })).toBe(true);
    // Outside the range.
    expect(model.isCellSelected({ rowId: 'row-4', columnKey: 'owner' })).toBe(false);
  });

  test('rebuilds the memoized row/column index maps when the underlying collections change', () => {
    const { model, rowSource, columnSource } = createModel();

    model.setActiveCell({ rowId: 'row-1', columnKey: 'customer' });
    model.setActiveCell({ rowId: 'row-3', columnKey: 'total' }, { extend: true });
    expect(model.isCellSelected({ rowId: 'row-3', columnKey: 'total' })).toBe(true);

    rowSource.set(['row-5', 'row-6', 'row-7', 'row-8']);
    columnSource.set(['alpha', 'beta', 'gamma', 'delta']);

    // A coordinate that resolved under the old arrays no longer exists in the
    // current ones, so it must stop reporting as selected — proving
    // `isCellSelected` consults rebuilt index maps, not a stale cache.
    expect(model.isCellSelected({ rowId: 'row-3', columnKey: 'total' })).toBe(false);

    model.setActiveCell({ rowId: 'row-5', columnKey: 'alpha' });
    model.setActiveCell({ rowId: 'row-7', columnKey: 'gamma' }, { extend: true });

    // A coordinate that only exists under the new arrays is now selected,
    // proving the index maps were rebuilt from the current row/column ids.
    expect(model.isCellSelected({ rowId: 'row-6', columnKey: 'beta' })).toBe(true);
  });

  test('orders clipboard-copy coordinates range-first, row-major, then deduplicated toggled cells', () => {
    const { model } = createModel();

    model.setActiveCell({ rowId: 'row-1', columnKey: 'customer' });
    model.setActiveCell({ rowId: 'row-2', columnKey: 'status' }, { extend: true });
    // Ctrl+Click a cell outside the range: materializes the current range into
    // toggled cells, then toggles the new cell on.
    model.setActiveCell({ rowId: 'row-4', columnKey: 'owner' }, { toggle: true });
    // Shift-extend a new range from the just-toggled active cell.
    model.setActiveCell({ rowId: 'row-3', columnKey: 'total' }, { extend: true });

    expect(model.selectedCellCoordinates).toEqual([
      { rowId: 'row-3', columnKey: 'total' },
      { rowId: 'row-3', columnKey: 'owner' },
      { rowId: 'row-4', columnKey: 'total' },
      { rowId: 'row-4', columnKey: 'owner' },
      { rowId: 'row-1', columnKey: 'customer' },
      { rowId: 'row-1', columnKey: 'status' },
      { rowId: 'row-2', columnKey: 'customer' },
      { rowId: 'row-2', columnKey: 'status' },
    ]);
  });

  test('toggle-after-range preserves every prior range cell except the one toggled off', () => {
    const { model } = createModel();

    model.setActiveCell({ rowId: 'row-1', columnKey: 'customer' });
    model.setActiveCell({ rowId: 'row-2', columnKey: 'status' }, { extend: true });
    // Ctrl+Click one of the four cells already inside the range to toggle it off.
    model.setActiveCell({ rowId: 'row-2', columnKey: 'status' }, { toggle: true });

    expect(model.toggledCells).toEqual([
      { rowId: 'row-1', columnKey: 'customer' },
      { rowId: 'row-1', columnKey: 'status' },
      { rowId: 'row-2', columnKey: 'customer' },
    ]);
    expect(model.isCellSelected({ rowId: 'row-1', columnKey: 'customer' })).toBe(true);
    expect(model.isCellSelected({ rowId: 'row-1', columnKey: 'status' })).toBe(true);
    expect(model.isCellSelected({ rowId: 'row-2', columnKey: 'customer' })).toBe(true);
    expect(model.isCellSelected({ rowId: 'row-2', columnKey: 'status' })).toBe(false);
  });
});

describe('DataGrid keyboard model', () => {
  test('returns no action when the grid has no navigable cells', () => {
    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'ArrowRight' }), {
        activeRowIndex: 0,
        activeColumnIndex: 0,
        rowCount: 0,
        columnCount: 4,
      }),
    ).toBeUndefined();
  });

  test('maps command shortcuts and selection keys', () => {
    const context = {
      activeRowIndex: 1,
      activeColumnIndex: 1,
      rowCount: 4,
      columnCount: 4,
    };

    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'a', metaKey: true }), context),
    ).toEqual({ type: 'select-all' });
    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'C', ctrlKey: true }), context),
    ).toEqual({ type: 'copy-selection' });
    expect(dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'Escape' }), context)).toEqual({
      type: 'collapse-selection',
    });
    expect(dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'Enter' }), context)).toEqual({
      type: 'select-active-cell',
    });
    expect(dataGridKeyToAction(new KeyboardEvent('keydown', { key: ' ' }), context)).toEqual({
      type: 'select-active-cell',
    });
  });

  test('maps arrow keys to neighboring cell movement', () => {
    const context = {
      activeRowIndex: 1,
      activeColumnIndex: 1,
      rowCount: 4,
      columnCount: 4,
    };

    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'ArrowRight' }), context),
    ).toEqual({ type: 'move-cell', rowIndex: 1, columnIndex: 2, extend: false });
    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'ArrowLeft' }), context),
    ).toEqual({ type: 'move-cell', rowIndex: 1, columnIndex: 0, extend: false });
    expect(
      dataGridKeyToAction(
        new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }),
        context,
      ),
    ).toEqual({ type: 'move-cell', rowIndex: 2, columnIndex: 1, extend: true });
    expect(dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'ArrowUp' }), context)).toEqual({
      type: 'move-cell',
      rowIndex: 0,
      columnIndex: 1,
      extend: false,
    });
  });

  test('maps spreadsheet keys to clamped movement actions', () => {
    const action = dataGridKeyToAction(
      new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, shiftKey: true }),
      { activeRowIndex: 1, activeColumnIndex: 1, rowCount: 4, columnCount: 4 },
    );

    expect(action).toEqual({
      type: 'move-cell',
      rowIndex: 3,
      columnIndex: 3,
      extend: true,
    });
  });

  test('maps home, end, and page keys to grid movement', () => {
    const context = {
      activeRowIndex: 2,
      activeColumnIndex: 1,
      rowCount: 5,
      columnCount: 4,
      pageSize: 2,
    };

    expect(dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'Home' }), context)).toEqual({
      type: 'move-cell',
      rowIndex: 2,
      columnIndex: 0,
      extend: false,
    });
    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true }), context),
    ).toEqual({ type: 'move-cell', rowIndex: 0, columnIndex: 0, extend: false });
    expect(dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'End' }), context)).toEqual({
      type: 'move-cell',
      rowIndex: 2,
      columnIndex: 3,
      extend: false,
    });
    expect(dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'PageDown' }), context)).toEqual(
      { type: 'move-cell', rowIndex: 4, columnIndex: 1, extend: false },
    );
    expect(dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'PageUp' }), context)).toEqual({
      type: 'move-cell',
      rowIndex: 0,
      columnIndex: 1,
      extend: false,
    });
  });

  test('maps Tab to wrapped cell movement', () => {
    const action = dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'Tab' }), {
      activeRowIndex: 0,
      activeColumnIndex: 3,
      rowCount: 4,
      columnCount: 4,
    });

    expect(action).toEqual({
      type: 'move-cell',
      rowIndex: 1,
      columnIndex: 0,
      extend: false,
    });
  });

  test('lets Tab leave the grid at the first and last cells', () => {
    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }), {
        activeRowIndex: 0,
        activeColumnIndex: 0,
        rowCount: 4,
        columnCount: 4,
      }),
    ).toBeUndefined();

    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'Tab' }), {
        activeRowIndex: 3,
        activeColumnIndex: 3,
        rowCount: 4,
        columnCount: 4,
      }),
    ).toBeUndefined();
  });

  test('returns no action for unrelated keys', () => {
    expect(
      dataGridKeyToAction(new KeyboardEvent('keydown', { key: 'x' }), {
        activeRowIndex: 0,
        activeColumnIndex: 0,
        rowCount: 4,
        columnCount: 4,
      }),
    ).toBeUndefined();
  });
});
