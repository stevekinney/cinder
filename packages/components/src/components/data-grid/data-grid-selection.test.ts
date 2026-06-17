/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');
const { default: DataGridSelectionBindFixture } =
  await import('./data-grid-selection-bind-fixture.svelte');
const { getObservedSelectionModel, resetObservedSelectionModel } =
  await import('./data-grid-selection-bind-probe.ts');

type ClipboardLike = { writeText: (text: string) => Promise<void> };
type ExecCommandLike = (commandId: string) => boolean;

const originalClipboard = globalThis.navigator.clipboard as unknown;
const originalExecCommand = document.execCommand as unknown;

afterEach(() => {
  cleanup();
  resetObservedSelectionModel();
  restoreNavigatorClipboard();
  restoreDocumentExecCommand();
});

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

function restoreNavigatorClipboard(): void {
  if (originalClipboard === undefined) {
    delete (globalThis.navigator as unknown as { clipboard?: ClipboardLike }).clipboard;
    return;
  }
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
}

function restoreDocumentExecCommand(): void {
  if (originalExecCommand === undefined) {
    delete (document as unknown as { execCommand?: ExecCommandLike }).execCommand;
    return;
  }
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: originalExecCommand,
  });
}

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

  test('Ctrl+A keeps row selection singular in single selection mode', async () => {
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
    await fireEvent.keyDown(grid!, { key: 'a', ctrlKey: true });

    expect(onSelectionModelChange).toHaveBeenLastCalledWith(['ord-2']);
    expect(container.querySelectorAll('[role="row"][aria-selected="true"]').length).toBe(1);
    expect(
      container.querySelector('[role="row"][aria-rowindex="3"]')?.getAttribute('aria-selected'),
    ).toBe('true');
  });

  test('selectionMode none ignores controlled row selection state', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      selectionMode: 'none',
      selectionModel: ['ord-2'],
      'aria-label': 'Orders',
    });

    expect(container.querySelectorAll('[role="row"][aria-selected="true"]').length).toBe(0);
    expect(container.querySelectorAll('[role="row"][data-cinder-selected]').length).toBe(0);
  });

  test('explicit undefined controlled selection clears selected rows', async () => {
    const { container, rerender } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      selectionMode: 'multiple',
      selectionModel: ['ord-1'],
      'aria-label': 'Orders',
    });

    expect(
      container.querySelector('[role="row"][aria-rowindex="2"]')?.getAttribute('aria-selected'),
    ).toBe('true');

    await rerender({
      rows,
      columns,
      getRowId: getOrderId,
      selectionMode: 'multiple',
      selectionModel: undefined,
      'aria-label': 'Orders',
    });

    expect(container.querySelectorAll('[role="row"][aria-selected="true"]')).toHaveLength(0);
  });

  test('bind:selectionModel updates when the bound value starts undefined', async () => {
    const { container } = render(DataGridSelectionBindFixture);
    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    expect(getObservedSelectionModel()).toBeUndefined();

    await fireEvent.keyDown(grid!, { key: 'a', ctrlKey: true });

    expect(getObservedSelectionModel()).toEqual(['ord-1', 'ord-2']);
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

  test('cell Enter handling does not bubble into duplicate grid selection handling', async () => {
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
    const firstCell = getDataCell(container, 0, 0);

    firstCell.focus();
    await fireEvent.keyDown(firstCell, { key: 'Enter' });

    expect(onSelectionModelChange).toHaveBeenCalledTimes(1);
    expect(onSelectionModelChange).toHaveBeenLastCalledWith(['ord-1']);
    expect(document.activeElement).toBe(grid);
  });

  test('Shift+Arrow range extension keeps multiple row selection intact', async () => {
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

    await fireEvent.keyDown(grid!, { key: 'a', ctrlKey: true });
    await fireEvent.keyDown(grid!, { key: 'ArrowRight', shiftKey: true });

    expect(onSelectionModelChange).toHaveBeenCalledTimes(1);
    expect(onSelectionModelChange).toHaveBeenLastCalledWith(['ord-1', 'ord-2', 'ord-3']);
    expect(container.querySelectorAll('[role="row"][aria-selected="true"]').length).toBe(3);
  });

  test('Shift+Click range extension keeps multiple row selection intact', async () => {
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

    await fireEvent.keyDown(grid!, { key: 'a', ctrlKey: true });
    await fireEvent.click(getDataCell(container, 1, 1), { shiftKey: true });

    expect(onSelectionModelChange).toHaveBeenCalledTimes(1);
    expect(onSelectionModelChange).toHaveBeenLastCalledWith(['ord-1', 'ord-2', 'ord-3']);
    expect(container.querySelectorAll('[role="row"][aria-selected="true"]').length).toBe(3);
  });

  test('Shift+Enter range extension keeps multiple row selection intact', async () => {
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

    await fireEvent.keyDown(grid!, { key: 'a', ctrlKey: true });
    await fireEvent.keyDown(grid!, { key: 'ArrowDown' });
    await fireEvent.keyDown(grid!, { key: 'Enter', shiftKey: true });

    expect(onSelectionModelChange).toHaveBeenCalledTimes(1);
    expect(onSelectionModelChange).toHaveBeenLastCalledWith(['ord-1', 'ord-2', 'ord-3']);
    expect(container.querySelectorAll('[role="row"][aria-selected="true"]').length).toBe(3);
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

  test('click selection returns focus to the grid host', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const firstCell = getDataCell(container, 0, 0);

    firstCell.focus();
    await fireEvent.click(firstCell);

    expect(document.activeElement).toBe(grid);
  });

  test('Ctrl+Click preserves an existing range as part of a multi-selection', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const lastCell = getDataCell(container, 2, 2);

    await fireEvent.keyDown(grid!, { key: 'ArrowRight', shiftKey: true });
    await fireEvent.keyDown(grid!, { key: 'ArrowDown', shiftKey: true });
    await fireEvent.click(lastCell, { ctrlKey: true });

    expect(getDataCell(container, 0, 0).getAttribute('aria-selected')).toBe('true');
    expect(getDataCell(container, 0, 1).getAttribute('aria-selected')).toBe('true');
    expect(getDataCell(container, 1, 0).getAttribute('aria-selected')).toBe('true');
    expect(getDataCell(container, 1, 1).getAttribute('aria-selected')).toBe('true');
    expect(lastCell.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(5);
  });

  test('Shift extension after Ctrl+Click keeps prior toggled cells selected', async () => {
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
    await fireEvent.keyDown(container.querySelector<HTMLElement>('[role="grid"]')!, {
      key: 'ArrowLeft',
      shiftKey: true,
    });

    expect(firstCell.getAttribute('aria-selected')).toBe('true');
    expect(lastCell.getAttribute('aria-selected')).toBe('true');
    expect(getDataCell(container, 2, 1).getAttribute('aria-selected')).toBe('true');
    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(3);
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
    await waitFor(() =>
      expect(container.querySelector('[role="status"]')?.textContent).toBe('Copied 2 cells'),
    );
  });

  test('copies non-contiguous selected cells without filling the bounding box', async () => {
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

    await fireEvent.click(getDataCell(container, 0, 0), { ctrlKey: true });
    await fireEvent.click(getDataCell(container, 2, 2), { ctrlKey: true });
    await fireEvent.keyDown(container.querySelector<HTMLElement>('[role="grid"]')!, {
      key: 'c',
      ctrlKey: true,
    });

    expect(writeText).toHaveBeenCalledWith('Ada Lovelace\n512');
    await waitFor(() =>
      expect(container.querySelector('[role="status"]')?.textContent).toBe('Copied 2 cells'),
    );
  });

  test('re-announces repeated copy feedback', async () => {
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
    const liveRegion = () => container.querySelector('[role="status"]');

    await fireEvent.keyDown(grid!, { key: 'c', ctrlKey: true });
    await waitFor(() => expect(liveRegion()?.textContent).toBe('Copied 1 cell'));

    await fireEvent.keyDown(grid!, { key: 'c', ctrlKey: true });
    expect(liveRegion()?.textContent).toBe('');
    await waitFor(() => expect(liveRegion()?.textContent).toBe('Copied 1 cell'));
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  test('copies through the shared clipboard fallback when navigator clipboard is unavailable', async () => {
    const execCommand = mock(() => true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'c', ctrlKey: true });
    expect(execCommand).toHaveBeenCalledWith('copy');
    await waitFor(() =>
      expect(container.querySelector('[role="status"]')?.textContent).toBe('Copied 1 cell'),
    );
  });

  test('announces when clipboard copy fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mock(() => Promise.reject(new Error('denied'))) },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: mock(() => false),
    });

    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'c', ctrlKey: true });
    await waitFor(() =>
      expect(container.querySelector('[role="status"]')?.textContent).toBe('Copy failed'),
    );
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

  test('keeps selection on the active cell when reconciliation drops the old anchor', async () => {
    const { container, rerender } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');

    await fireEvent.keyDown(grid!, { key: 'End', ctrlKey: true, shiftKey: true });

    await rerender({
      rows: [rows[2]!],
      columns: [columns[2]!],
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const remainingCell = getDataCell(container, 0, 0);
    expect(container.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(1);
    expect(remainingCell.getAttribute('data-cinder-anchor')).toBe('true');
    expect(grid?.getAttribute('aria-activedescendant')).toBe(remainingCell.id);
  });
});
