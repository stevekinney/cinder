/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');

type Order = {
  id: string;
  customer: string;
  status: string;
  total: number;
};

const rows: Order[] = [
  { id: 'ord-1', customer: 'Ada Lovelace', status: 'Packed', total: 124 },
  { id: 'ord-2', customer: 'Grace Hopper', status: 'Shipped', total: 256 },
  { id: 'ord-3', customer: 'Katherine Johnson', status: 'Queued', total: 512 },
];

const columns: DataGridColumnDef<Order>[] = [
  { key: 'customer', header: 'Customer' },
  { key: 'status', header: 'Status' },
  { key: 'total', header: 'Total' },
];

const getOrderId = (row: Order) => row.id;
const OrderDataGrid = DataGrid as Component<DataGridProps<Order>>;

function getDataCell(container: HTMLElement, rowIndex: number, columnIndex: number): HTMLElement {
  const row = container.querySelector(`[role="row"][aria-rowindex="${rowIndex + 2}"]`);
  const cell = row?.querySelectorAll<HTMLElement>('[role="gridcell"]')[columnIndex];
  if (!cell) throw new Error(`Missing cell at ${rowIndex}, ${columnIndex}`);
  return cell;
}

describe('DataGrid selection', () => {
  test('clicking a cell sets the active descendant, anchor, and aria-selected state', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector('[role="grid"]');
    const targetCell = getDataCell(container, 1, 1);

    await fireEvent.click(targetCell);

    expect(grid?.getAttribute('aria-activedescendant')).toBe(targetCell.id);
    expect(targetCell.getAttribute('aria-selected')).toBe('true');
    expect(targetCell.getAttribute('data-cinder-anchor')).toBe('true');
    expect(targetCell.getAttribute('data-cinder-active')).toBe('true');
  });

  test('Shift+Arrow extends the selected range while preserving the anchor', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'ArrowRight', shiftKey: true });
    await fireEvent.keyDown(grid!, { key: 'ArrowDown', shiftKey: true });

    const selectedCells = Array.from(
      container.querySelectorAll('[role="gridcell"][aria-selected="true"]'),
    );

    expect(selectedCells).toHaveLength(4);
    expect(getDataCell(container, 0, 0).getAttribute('data-cinder-anchor')).toBe('true');
    expect(grid?.getAttribute('aria-activedescendant')).toBe(getDataCell(container, 1, 1).id);
    expect(grid?.getAttribute('aria-multiselectable')).toBe('true');
  });

  test('Ctrl+A selects every data cell and Escape collapses back to the active cell', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'a', ctrlKey: true });
    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(9);

    await fireEvent.keyDown(grid!, { key: 'Escape' });
    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(1);
  });

  test('Escape collapses row selection to the active row', async () => {
    const onSelectionModelChange = mock();
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      selectionMode: 'multiple',
      onSelectionModelChange,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'ArrowDown' });
    await fireEvent.keyDown(grid!, { key: 'a', ctrlKey: true });
    await fireEvent.keyDown(grid!, { key: 'Escape' });

    expect(onSelectionModelChange).toHaveBeenLastCalledWith(['ord-2']);
    expect(
      container.querySelector('[role="row"][aria-rowindex="3"]')?.getAttribute('aria-selected'),
    ).toBe('true');
    expect(container.querySelectorAll('[role="row"][aria-selected="true"]').length).toBe(1);
  });

  test('Enter selects the active cell while focus stays on the grid', async () => {
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

    await fireEvent.keyDown(grid!, { key: 'ArrowDown' });
    await fireEvent.keyDown(grid!, { key: 'Enter' });

    expect(getDataCell(container, 1, 0).getAttribute('aria-selected')).toBe('true');
    expect(onSelectionModelChange).toHaveBeenLastCalledWith(['ord-2']);
  });

  test('Ctrl+Click toggles non-contiguous cells', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const firstCell = getDataCell(container, 0, 0);
    const lastCell = getDataCell(container, 2, 2);

    await fireEvent.click(firstCell, { ctrlKey: true });
    await fireEvent.click(lastCell, { ctrlKey: true });

    expect(firstCell.getAttribute('aria-selected')).toBe('true');
    expect(lastCell.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(2);

    await fireEvent.click(firstCell, { ctrlKey: true });

    expect(firstCell.hasAttribute('aria-selected')).toBe(false);
    expect(lastCell.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(1);
  });

  test('copies the selected range as tab-delimited text', async () => {
    const writeText = mock(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'ArrowRight', shiftKey: true });
    await fireEvent.keyDown(grid!, { key: 'c', ctrlKey: true });

    expect(writeText).toHaveBeenCalledWith('Ada Lovelace\tPacked');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copied 2 cells');
  });

  test('announces when clipboard copy is unavailable or fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'c', ctrlKey: true });
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Copy is unavailable',
    );

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mock(() => Promise.reject(new Error('denied'))) },
    });

    await fireEvent.keyDown(grid!, { key: 'c', ctrlKey: true });
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copy failed');
  });

  test('reconciles selected cells when rows and columns change', async () => {
    const { container, rerender } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'End', ctrlKey: true, shiftKey: true });
    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(9);

    await rerender({
      rows: [rows[0]!],
      columns: [columns[0]!],
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(1);
    expect(grid?.getAttribute('aria-activedescendant')).toBe(getDataCell(container, 0, 0).id);
  });
});
