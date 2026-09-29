/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import {
  resolveDataGridEditCommitValue,
  resolveDataGridEditType,
} from './_internal/edit-model.svelte.ts';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');

afterEach(() => cleanup());

type Order = {
  id: string;
  customer: string;
  total: number;
};

const rows: Order[] = [
  { id: 'ord-1', customer: 'Ada Lovelace', total: 124 },
  { id: 'ord-2', customer: 'Grace Hopper', total: 256 },
  { id: 'ord-3', customer: 'Katherine Johnson', total: 512 },
];

const getOrderId = (row: Order) => row.id;
const OrderDataGrid = DataGrid as Component<DataGridProps<Order>>;

const editableColumns: DataGridColumnDef<Order>[] = [
  { key: 'customer', header: 'Customer', editable: true },
  { key: 'total', header: 'Total', editable: true },
];

function getDataCell(container: HTMLElement, rowIndex: number, columnIndex: number): HTMLElement {
  const row = container.querySelector(`[role="row"][aria-rowindex="${rowIndex + 2}"]`);
  const cell = row?.querySelectorAll<HTMLElement>('[role="gridcell"]')[columnIndex];
  if (!cell) throw new Error(`Missing cell at ${rowIndex}, ${columnIndex}`);
  return cell;
}

function getCellInput(cell: HTMLElement): HTMLInputElement {
  const input = cell.querySelector<HTMLInputElement>('input');
  if (!input) throw new Error('Expected an editing Input in the cell');
  return input;
}

describe('DataGrid editing — pure helpers', () => {
  test('resolveDataGridEditType prefers an explicit editType, then falls back by value typeof', () => {
    expect(resolveDataGridEditType('text', 42)).toBe('text');
    expect(resolveDataGridEditType(undefined, 42)).toBe('number');
    expect(resolveDataGridEditType(undefined, 'hello')).toBe('text');
    expect(resolveDataGridEditType(undefined, undefined)).toBe('text');
  });

  test('resolveDataGridEditCommitValue commits text drafts as-is', () => {
    expect(resolveDataGridEditCommitValue('text', 'hello')).toEqual({
      committed: true,
      value: 'hello',
    });
    expect(resolveDataGridEditCommitValue('text', '')).toEqual({ committed: true, value: '' });
  });

  test('resolveDataGridEditCommitValue parses a number draft to a finite number', () => {
    expect(resolveDataGridEditCommitValue('number', '42')).toEqual({
      committed: true,
      value: 42,
    });
    expect(resolveDataGridEditCommitValue('number', ' -3.5 ')).toEqual({
      committed: true,
      value: -3.5,
    });
  });

  test('resolveDataGridEditCommitValue treats an empty number draft as a cleared value, not NaN', () => {
    const result = resolveDataGridEditCommitValue('number', '   ');
    expect(result).toEqual({ committed: true, value: undefined });
    if (result.committed) expect(Number.isNaN(result.value)).toBe(false);
  });

  test('resolveDataGridEditCommitValue rejects an unparsable number draft instead of producing NaN', () => {
    const result = resolveDataGridEditCommitValue('number', 'abc');
    expect(result).toEqual({ committed: false });
  });
});

describe('DataGrid editing — entering edit mode', () => {
  test('Enter on an editable, focused, non-editing cell enters edit mode with a text Input', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const cell = getDataCell(container, 0, 0);

    await fireEvent.keyDown(grid!, { key: 'Enter' });

    expect(cell.getAttribute('data-cinder-editing')).toBe('true');
    const input = getCellInput(cell);
    expect(input.type).toBe('text');
    expect(input.value).toBe('Ada Lovelace');
  });

  test('Enter on a number-valued editable cell renders a number Input', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'ArrowRight' });
    await fireEvent.keyDown(grid!, { key: 'Enter' });

    const input = getCellInput(getDataCell(container, 0, 1));
    expect(input.type).toBe('number');
    expect(input.value).toBe('124');
  });

  test('an explicit editType overrides the value-typeof inference', async () => {
    const columns: DataGridColumnDef<Order>[] = [
      { key: 'total', header: 'Total', editable: true, editType: 'text' },
    ];
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });

    expect(getCellInput(getDataCell(container, 0, 0)).type).toBe('text');
  });

  test('Enter does not enter edit mode on a non-editable cell and keeps existing select behavior', async () => {
    const columns: DataGridColumnDef<Order>[] = [
      { key: 'customer', header: 'Customer' },
      { key: 'total', header: 'Total' },
    ];
    const onSelectionModelChange = mock();
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      selectionMode: 'single',
      onSelectionModelChange,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });

    expect(getDataCell(container, 0, 0).getAttribute('data-cinder-editing')).toBeNull();
    expect(onSelectionModelChange).toHaveBeenLastCalledWith(['ord-1']);
  });

  test('typing a printable character on a focused editable cell enters edit mode with that character as the draft', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'G' });

    const input = getCellInput(getDataCell(container, 0, 0));
    expect(input.value).toBe('G');
  });

  test('a modified single-character keydown does not enter edit mode', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'g', ctrlKey: true });

    expect(getDataCell(container, 0, 0).getAttribute('data-cinder-editing')).toBeNull();
  });

  test('double-click on an editable cell enters edit mode', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const cell = getDataCell(container, 1, 0);
    await fireEvent.dblClick(cell);

    expect(cell.getAttribute('data-cinder-editing')).toBe('true');
    expect(getCellInput(cell).value).toBe('Grace Hopper');
  });

  // COR-1145: entering edit mode must move real DOM focus into the editing
  // Input (documented in data-grid.a11y.md's editing focus-management
  // section) — not just render it — for both the keyboard (Enter) and
  // pointer (double-click) entry paths, and the cursor lands at the end of
  // the prefilled text rather than the browser default of selecting it all.
  test('Enter moves DOM focus into the editing Input with the cursor at the end of the value', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });

    const input = getCellInput(getDataCell(container, 0, 0));
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  test('double-click moves DOM focus into the editing Input', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const cell = getDataCell(container, 1, 0);
    await fireEvent.dblClick(cell);

    expect(document.activeElement).toBe(getCellInput(cell));
  });
});

describe('DataGrid editing — commit and cancel', () => {
  test('Enter while editing commits the value, moves to the same column in the next row, and returns focus to the grid', async () => {
    const onCellEdit = mock();
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      onCellEdit,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });
    const input = getCellInput(getDataCell(container, 0, 0));
    await fireEvent.input(input, { target: { value: 'Ada Byron' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(onCellEdit).toHaveBeenLastCalledWith(rows[0], 'customer', 'Ada Byron');
    expect(getDataCell(container, 0, 0).getAttribute('data-cinder-editing')).toBeNull();
    expect(document.activeElement).toBe(grid);
    expect(grid?.getAttribute('aria-activedescendant')).toBe(getDataCell(container, 1, 0).id);
  });

  test('Escape while editing cancels without calling onCellEdit and restores the original value', async () => {
    const onCellEdit = mock();
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      onCellEdit,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });
    const input = getCellInput(getDataCell(container, 0, 0));
    await fireEvent.input(input, { target: { value: 'Someone Else' } });
    await fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCellEdit).not.toHaveBeenCalled();
    const cell = getDataCell(container, 0, 0);
    expect(cell.getAttribute('data-cinder-editing')).toBeNull();
    expect(cell.textContent).toBe('Ada Lovelace');
    expect(document.activeElement).toBe(grid);
    expect(grid?.getAttribute('aria-activedescendant')).toBe(cell.id);
  });

  test('Tab while editing commits and moves to the next cell; Shift+Tab moves to the previous cell', async () => {
    const onCellEdit = mock();
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      onCellEdit,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });
    let input = getCellInput(getDataCell(container, 0, 0));
    await fireEvent.input(input, { target: { value: 'Ada Byron' } });
    await fireEvent.keyDown(input, { key: 'Tab' });

    expect(onCellEdit).toHaveBeenLastCalledWith(rows[0], 'customer', 'Ada Byron');
    expect(grid?.getAttribute('aria-activedescendant')).toBe(getDataCell(container, 0, 1).id);

    await fireEvent.keyDown(grid!, { key: 'Enter' });
    input = getCellInput(getDataCell(container, 0, 1));
    await fireEvent.input(input, { target: { value: '999' } });
    await fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });

    expect(onCellEdit).toHaveBeenLastCalledWith(rows[0], 'total', 999);
    expect(grid?.getAttribute('aria-activedescendant')).toBe(getDataCell(container, 0, 0).id);
  });

  test('blurring the editing input commits the value', async () => {
    const onCellEdit = mock();
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      onCellEdit,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });
    const input = getCellInput(getDataCell(container, 0, 0));
    await fireEvent.input(input, { target: { value: 'Ada Byron' } });
    await fireEvent.blur(input);

    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(onCellEdit).toHaveBeenLastCalledWith(rows[0], 'customer', 'Ada Byron');
    expect(getDataCell(container, 0, 0).getAttribute('data-cinder-editing')).toBeNull();
  });

  test('an empty number draft commits undefined rather than NaN', async () => {
    const onCellEdit = mock();
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      onCellEdit,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'ArrowRight' });
    await fireEvent.keyDown(grid!, { key: 'Enter' });
    const input = getCellInput(getDataCell(container, 0, 1));
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(onCellEdit).toHaveBeenLastCalledWith(rows[0], 'total', undefined);
  });

  test('arrow keys and Home/End reach the editing Input instead of moving the active cell', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });
    const cell = getDataCell(container, 0, 0);
    const input = getCellInput(cell);

    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      const event = await fireEvent.keyDown(input, { key });
      expect(event).toBe(true); // fireEvent returns false when preventDefault() was called
    }

    expect(cell.getAttribute('data-cinder-editing')).toBe('true');
    expect(grid?.getAttribute('aria-activedescendant')).toBe(cell.id);
  });

  test('never mutates the rows prop', async () => {
    const originalRows = rows.map((row) => ({ ...row }));
    const onCellEdit = mock();
    const { container } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      onCellEdit,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });
    const input = getCellInput(getDataCell(container, 0, 0));
    await fireEvent.input(input, { target: { value: 'Someone New' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(rows).toEqual(originalRows);
    expect(rows[0]).toBe(rows[0]);
    expect(rows[0]?.customer).toBe('Ada Lovelace');
  });
});

describe('DataGrid editing — DataGridCellContext.editing', () => {
  test('is true only for the cell currently in edit mode when a column supplies a custom cell snippet', async () => {
    const { default: DataGridCellEditingFixture } =
      await import('./data-grid-cell-editing-fixture.svelte');
    const { container } = render(DataGridCellEditingFixture);

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const cells = () => Array.from(container.querySelectorAll('[data-testid="cell"]'));

    expect(cells().every((node) => node.textContent?.endsWith(':false'))).toBe(true);

    await fireEvent.keyDown(grid!, { key: 'Enter' });

    const rendered = cells();
    expect(rendered[0]?.textContent).toBe('Ada Lovelace:true');
    expect(rendered[1]?.textContent).toBe('Grace Hopper:false');
  });
});

describe('DataGrid editing — virtualized rows', () => {
  test('editing works with virtualizeRows enabled and tracks the edited row by row key', async () => {
    const manyRows: Order[] = Array.from({ length: 200 }, (_, index) => ({
      id: `ord-${index}`,
      customer: `Customer ${index}`,
      total: index,
    }));
    const onCellEdit = mock();

    const { container } = render(OrderDataGrid, {
      rows: manyRows,
      columns: editableColumns,
      getRowId: getOrderId,
      onCellEdit,
      virtualizeRows: true,
      rowHeight: 32,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await fireEvent.keyDown(grid!, { key: 'Enter' });

    const cell = getDataCell(container, 0, 0);
    expect(cell.getAttribute('data-cinder-editing')).toBe('true');
    const input = getCellInput(cell);
    await fireEvent.input(input, { target: { value: 'Renamed' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(onCellEdit).toHaveBeenLastCalledWith(manyRows[0], 'customer', 'Renamed');
  });
});
