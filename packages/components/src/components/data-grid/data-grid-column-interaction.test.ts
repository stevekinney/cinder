/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');

afterEach(() => {
  cleanup();
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
];

const getOrderId = (row: Order) => row.id;
const OrderDataGrid = DataGrid as Component<DataGridProps<Order>>;

const columns: DataGridColumnDef<Order>[] = [
  { key: 'customer', header: 'Customer', width: 180, sortable: true },
  { key: 'status', header: 'Status', width: 120 },
  { key: 'total', header: 'Total', width: 100, getValue: (row) => `$${row.total}` },
];

function rectWithLeft(left: number, width: number): DOMRect {
  return {
    bottom: 32,
    height: 32,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  };
}

/** Stubs header-cell rects left-to-right at fixed widths, keyed by column key. */
function measureHeaderCells(widths: Record<string, number>): () => void {
  const original = HTMLElement.prototype.getBoundingClientRect;
  const keysInOrder = Object.keys(widths);
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const key = this.dataset?.['cinderColumnKey'];
    if (key !== undefined && key in widths) {
      let left = 0;
      for (const candidate of keysInOrder) {
        if (candidate === key) break;
        left += widths[candidate] ?? 0;
      }
      return rectWithLeft(left, widths[key] ?? 0);
    }
    return original.call(this);
  };
  return () => {
    HTMLElement.prototype.getBoundingClientRect = original;
  };
}

function stubPointerCapture(...elements: Element[]): void {
  for (const element of elements) {
    (element as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  }
}

function headerCell(container: HTMLElement, key: string): HTMLElement {
  const cell = container.querySelector<HTMLElement>(`[data-cinder-column-key="${key}"]`);
  if (!cell) throw new Error(`Expected a header cell for column ${key}`);
  return cell;
}

function resizeHandle(container: HTMLElement, key: string): HTMLElement {
  const handle = headerCell(container, key).querySelector<HTMLElement>(
    '[data-cinder-resize-handle]',
  );
  if (!handle) throw new Error(`Expected a resize handle for column ${key}`);
  return handle;
}

describe('DataGrid column resizing (COR-1131)', () => {
  test('renders no resize handles when resizableColumns is not set (opt-in default)', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(container.querySelector('[data-cinder-resize-handle]')).toBeNull();
  });

  test('renders a role=separator resize handle on each resizable header', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const handle = resizeHandle(container, 'customer');
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Resize Customer column');
    expect(handle.getAttribute('aria-valuenow')).toBe('180');
    expect(handle.style.cursor || getComputedStyle(handle).cursor).toBeDefined();
  });

  test('a column with resizable: false renders no handle even when resizableColumns is on', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: [{ ...columns[0]!, resizable: false }, columns[1]!, columns[2]!],
      resizableColumns: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(resizeHandleOrNull(container, 'customer')).toBeNull();
    expect(resizeHandle(container, 'status')).not.toBeNull();
  });

  function resizeHandleOrNull(container: HTMLElement, key: string): HTMLElement | null {
    return headerCell(container, key).querySelector<HTMLElement>('[data-cinder-resize-handle]');
  }

  test('pointer drag live-updates width and commits on pointerup, clamped to minWidth/maxWidth', async () => {
    const onColumnSizingChange = mock((_next: Record<string, number>) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns: [{ ...columns[0]!, minWidth: 80, maxWidth: 260 }, columns[1]!, columns[2]!],
      resizableColumns: true,
      onColumnSizingChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const handle = resizeHandle(container, 'customer');
    stubPointerCapture(handle);

    await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100 });
    await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 140 });

    // Live width updates before commit; onColumnSizingChange has not fired yet.
    expect(headerCell(container, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 220px',
    );
    expect(onColumnSizingChange).not.toHaveBeenCalled();

    await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 140 });

    expect(onColumnSizingChange).toHaveBeenCalledTimes(1);
    expect(onColumnSizingChange.mock.calls[0]?.[0]).toEqual({ customer: 220 });
    expect(headerCell(container, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 220px',
    );

    // Dragging far past maxWidth clamps the committed value.
    await fireEvent.pointerDown(handle, { pointerId: 2, clientX: 0 });
    await fireEvent.pointerMove(handle, { pointerId: 2, clientX: 10_000 });
    await fireEvent.pointerUp(handle, { pointerId: 2, clientX: 10_000 });
    expect(onColumnSizingChange.mock.calls[1]?.[0]).toEqual({ customer: 260 });

    // Dragging far below minWidth clamps the committed value.
    await fireEvent.pointerDown(handle, { pointerId: 3, clientX: 0 });
    await fireEvent.pointerMove(handle, { pointerId: 3, clientX: -10_000 });
    await fireEvent.pointerUp(handle, { pointerId: 3, clientX: -10_000 });
    expect(onColumnSizingChange.mock.calls[2]?.[0]).toEqual({ customer: 80 });
  });

  // COR-1145: a pointer-only resize (no prior click/focus anywhere in the
  // grid) must still leave the grid root holding real DOM focus once it
  // sets `aria-activedescendant` to the header — otherwise that
  // relationship is inert for assistive tech (activedescendant only means
  // anything while its host has focus) and the very next keydown would go
  // nowhere.
  test('a pointer-only resize (no prior focus) leaves the grid holding real DOM focus', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    expect(document.activeElement).not.toBe(grid);

    const handle = resizeHandle(container, 'customer');
    stubPointerCapture(handle);
    await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100 });
    await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 140 });
    await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 140 });

    expect(document.activeElement).toBe(grid);
    expect(grid.getAttribute('aria-activedescendant')).toBe(headerCell(container, 'customer').id);
  });

  test('dragging the resize handle on a sortable column does not trigger a sort', async () => {
    const onSortModelChange = mock((_next: unknown) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      onSortModelChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const handle = resizeHandle(container, 'customer');
    stubPointerCapture(handle);

    await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0 });
    await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 30 });
    await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 30 });
    await fireEvent.click(handle);

    expect(onSortModelChange).not.toHaveBeenCalled();
  });
});

describe('DataGrid column reordering (COR-1132)', () => {
  test('renders without reorder wiring conflicts when reorderableColumns is not set', async () => {
    const onColumnOrderChange = mock((_next: readonly string[]) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      onColumnOrderChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const restore = measureHeaderCells({ customer: 180, status: 120, total: 100 });
    const source = headerCell(container, 'customer');
    stubPointerCapture(source);
    await fireEvent.pointerDown(source, { pointerId: 1, clientX: 90, clientY: 10 });
    await fireEvent.pointerMove(source, { pointerId: 1, clientX: 300, clientY: 10 });
    await fireEvent.pointerUp(source, { pointerId: 1, clientX: 300, clientY: 10 });
    restore();

    expect(onColumnOrderChange).not.toHaveBeenCalled();
  });

  test('dragging a header past a sibling updates columnOrder on drop', async () => {
    const onColumnOrderChange = mock((_next: readonly string[]) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      reorderableColumns: true,
      onColumnOrderChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const restore = measureHeaderCells({ customer: 180, status: 120, total: 100 });
    const source = headerCell(container, 'customer');
    stubPointerCapture(source);

    await fireEvent.pointerDown(source, { pointerId: 1, clientX: 90, clientY: 10 });
    // Cross the drag threshold, then land past the midpoint of "status" (180 + 60 = 240).
    await fireEvent.pointerMove(source, { pointerId: 1, clientX: 260, clientY: 10 });
    await fireEvent.pointerUp(source, { pointerId: 1, clientX: 260, clientY: 10 });
    restore();

    expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
    expect(onColumnOrderChange.mock.calls[0]?.[0]).toEqual(['status', 'customer', 'total']);
  });

  // COR-1145: same real-focus requirement as the pointer-resize regression
  // above, for a pointer-only reorder drop.
  test('a pointer-only reorder (no prior focus) leaves the grid holding real DOM focus', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      reorderableColumns: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    expect(document.activeElement).not.toBe(grid);

    const restore = measureHeaderCells({ customer: 180, status: 120, total: 100 });
    const source = headerCell(container, 'customer');
    stubPointerCapture(source);
    await fireEvent.pointerDown(source, { pointerId: 1, clientX: 90, clientY: 10 });
    await fireEvent.pointerMove(source, { pointerId: 1, clientX: 260, clientY: 10 });
    await fireEvent.pointerUp(source, { pointerId: 1, clientX: 260, clientY: 10 });
    restore();

    expect(document.activeElement).toBe(grid);
    expect(grid.getAttribute('aria-activedescendant')).toBe(headerCell(container, 'customer').id);
  });

  test('COR-1132 regression: a right-to-left drag drops on the side the pointer is actually over', async () => {
    // In RTL, columns render right-to-left, so the physical left-to-right
    // layout is the reverse of `columnOrder`: total, status, customer.
    // Dragging "status" toward the physical left (toward "total") should
    // move it later in `columnOrder`, landing after "total" — the mirror
    // image of the LTR case, the same way pointer-resize already inverts
    // its delta for RTL.
    const onColumnOrderChange = mock((_next: readonly string[]) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      reorderableColumns: true,
      onColumnOrderChange,
      getRowId: getOrderId,
      style: 'direction: rtl;',
      'aria-label': 'Orders',
    });

    const restore = measureHeaderCells({ total: 100, status: 120, customer: 180 });
    const source = headerCell(container, 'status');
    stubPointerCapture(source);

    await fireEvent.pointerDown(source, { pointerId: 1, clientX: 160, clientY: 10 });
    // Cross the drag threshold moving toward "total" (physical left in RTL).
    await fireEvent.pointerMove(source, { pointerId: 1, clientX: 20, clientY: 10 });
    await fireEvent.pointerUp(source, { pointerId: 1, clientX: 20, clientY: 10 });
    restore();

    expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
    expect(onColumnOrderChange.mock.calls[0]?.[0]).toEqual(['customer', 'total', 'status']);
  });

  test('a small pointer movement below the drag threshold still allows the sort click through', async () => {
    const onSortModelChange = mock((_next: unknown) => {});
    const onColumnOrderChange = mock((_next: readonly string[]) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      reorderableColumns: true,
      onSortModelChange,
      onColumnOrderChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const sortButton = container.querySelector<HTMLElement>('.cinder-data-grid__sort-button');
    if (!sortButton) throw new Error('Expected the sortable Customer header button');

    await fireEvent.pointerDown(sortButton, { pointerId: 1, clientX: 90, clientY: 10 });
    await fireEvent.pointerMove(sortButton, { pointerId: 1, clientX: 91, clientY: 10 });
    await fireEvent.pointerUp(sortButton, { pointerId: 1, clientX: 91, clientY: 10 });
    await fireEvent.click(sortButton);

    expect(onColumnOrderChange).not.toHaveBeenCalled();
    expect(onSortModelChange).toHaveBeenCalledTimes(1);
  });
});

describe('DataGrid header keyboard resize and reorder (COR-1133)', () => {
  function getGrid(container: HTMLElement): HTMLElement {
    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) throw new Error('Expected DataGrid root');
    return grid;
  }

  async function focusFirstCustomerCell(container: HTMLElement): Promise<HTMLElement> {
    const grid = getGrid(container);
    const firstCell = container.querySelector<HTMLElement>('[role="gridcell"]');
    if (!firstCell) throw new Error('Expected a gridcell');
    await fireEvent.click(firstCell);
    return grid;
  }

  test('ArrowUp from the top row moves aria-activedescendant to the column header', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });

    const headerId = headerCell(container, 'customer').id;
    expect(grid.getAttribute('aria-activedescendant')).toBe(headerId);
  });

  test('opt-out grids leave ArrowUp at the top row a no-op, as before', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    const before = grid.getAttribute('aria-activedescendant');
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(grid.getAttribute('aria-activedescendant')).toBe(before);
    expect(container.querySelector('[data-cinder-header-active]')).toBeNull();
  });

  test('Shift+ArrowRight resizes the focused header column by 10px and announces it', async () => {
    const onColumnSizingChange = mock((_next: Record<string, number>) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      onColumnSizingChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });

    expect(onColumnSizingChange).toHaveBeenCalledWith({ customer: 190 });
    expect(headerCell(container, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 190px',
    );

    const liveRegion = container.querySelector('[role="status"]');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(liveRegion?.textContent).toContain('Customer column resized to 190 pixels');
  });

  test('Shift+ArrowLeft narrows the focused header column, clamped to minWidth', async () => {
    const onColumnSizingChange = mock((_next: Record<string, number>) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns: [{ ...columns[0]!, width: 65, minWidth: 60 }, columns[1]!, columns[2]!],
      resizableColumns: true,
      onColumnSizingChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'ArrowLeft', shiftKey: true });

    expect(onColumnSizingChange).toHaveBeenCalledWith({ customer: 60 });
  });

  test('Ctrl+Shift+ArrowRight moves the focused header column one position and announces it', async () => {
    const onColumnOrderChange = mock((_next: readonly string[]) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      reorderableColumns: true,
      onColumnOrderChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true, ctrlKey: true });

    expect(onColumnOrderChange).toHaveBeenCalledWith(['status', 'customer', 'total']);

    const liveRegion = container.querySelector('[role="status"]');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(liveRegion?.textContent).toContain('Customer column moved to position 2');
  });

  test('Meta+Shift+ArrowLeft (Cmd) also moves the focused header column', async () => {
    const onColumnOrderChange = mock((_next: readonly string[]) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      columnOrder: ['status', 'customer', 'total'],
      reorderableColumns: true,
      onColumnOrderChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    // Focus the "customer" header directly by entering header focus over the
    // first body cell under its rendered position (index 1 after reorder).
    const grid = getGrid(container);
    const cells = container.querySelectorAll<HTMLElement>('[role="gridcell"]');
    const customerCell = cells[1];
    if (!customerCell) throw new Error('Expected the reordered Customer cell');
    await fireEvent.click(customerCell);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'ArrowLeft', shiftKey: true, metaKey: true });

    expect(onColumnOrderChange).toHaveBeenCalledWith(['customer', 'status', 'total']);
  });

  test('plain ArrowLeft/ArrowRight in header focus move between headers without resizing or reordering', async () => {
    const onColumnSizingChange = mock((_next: Record<string, number>) => {});
    const onColumnOrderChange = mock((_next: readonly string[]) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      reorderableColumns: true,
      onColumnSizingChange,
      onColumnOrderChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'ArrowRight' });

    expect(grid.getAttribute('aria-activedescendant')).toBe(headerCell(container, 'status').id);
    expect(onColumnSizingChange).not.toHaveBeenCalled();
    expect(onColumnOrderChange).not.toHaveBeenCalled();
  });

  test('ArrowDown and Escape both return focus from the header to the grid cell', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(container.querySelector('[data-cinder-header-active]')).not.toBeNull();

    await fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(container.querySelector('[data-cinder-header-active]')).toBeNull();

    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'Escape' });
    expect(container.querySelector('[data-cinder-header-active]')).toBeNull();
  });

  test('Shift+ArrowLeft/Right on a body cell (not header-focused) still extends range selection', async () => {
    // Regression guard: COR-1133's Shift+Arrow resize must never engage
    // outside header focus, since Shift+Arrow on a body cell means
    // "extend the cell selection range" (pre-existing behavior).
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      selectionMode: 'multiple',
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    await fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });

    const cells = container.querySelectorAll('[role="gridcell"]');
    expect(cells[0]?.getAttribute('data-cinder-selected')).toBe('');
    expect(cells[1]?.getAttribute('data-cinder-selected')).toBe('');
    expect(headerCell(container, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 180px',
    );
  });
});
