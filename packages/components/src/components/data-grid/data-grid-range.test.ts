import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  clampCellCoordinate,
  columnOffsetForWindow,
  computeCellRange,
  getCellsInRange,
  isCellInRange,
  type DataGridCellCoordinate,
} from './_internal/geometry.ts';
import { dataGridKeyToAction } from './_internal/keyboard-model.ts';
import { areCellsEqual } from './_internal/selection-model.svelte.ts';

setupHappyDom();

const rowIds = ['row-1', 'row-2', 'row-3', 'row-4'];
const columnKeys = ['customer', 'status', 'total', 'owner'];

describe('DataGrid range geometry', () => {
  test('computes a rectangular range regardless of drag direction', () => {
    const anchor: DataGridCellCoordinate = { rowId: 'row-3', columnKey: 'total' };
    const focus: DataGridCellCoordinate = { rowId: 'row-1', columnKey: 'customer' };

    const range = computeCellRange(anchor, focus, rowIds, columnKeys);

    expect(range?.rowIds).toEqual(['row-1', 'row-2', 'row-3']);
    expect(range?.columnKeys).toEqual(['customer', 'status', 'total']);
    expect(getCellsInRange(range)).toHaveLength(9);
    expect(isCellInRange({ rowId: 'row-2', columnKey: 'status' }, range)).toBe(true);
    expect(isCellInRange({ rowId: 'row-4', columnKey: 'owner' }, range)).toBe(false);
  });

  test('omits ranges whose endpoints are outside the current row or column space', () => {
    expect(
      computeCellRange(
        { rowId: 'row-1', columnKey: 'customer' },
        { rowId: 'missing', columnKey: 'status' },
        rowIds,
        columnKeys,
      ),
    ).toBeUndefined();
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

  test('computes scroll-column offsets after pinned left columns', () => {
    expect(columnOffsetForWindow(0, [80, 120, 160, 200], 1)).toBe(0);
    expect(columnOffsetForWindow(1, [80, 120, 160, 200], 1)).toBe(0);
    expect(columnOffsetForWindow(3, [80, 120, 160, 200], 1)).toBe(280);
    expect(columnOffsetForWindow(Number.NaN, [80, 120], 1)).toBe(0);
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
});

describe('DataGrid keyboard model', () => {
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
});
