import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  computeCellRange,
  getCellsInRange,
  isCellInRange,
  type DataGridCellCoordinate,
} from './_internal/geometry.ts';
import { dataGridKeyToAction } from './_internal/keyboard-model.ts';

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
});
