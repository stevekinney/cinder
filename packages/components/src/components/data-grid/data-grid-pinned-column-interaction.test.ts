/// <reference lib="dom" />
// COR-1143: pinned columns must be inert to resize/reorder targeting the
// unpinned columns around them — both when driven by controlled prop
// updates and when driven by the pointer/keyboard gestures from COR-1131,
// COR-1132, and COR-1133.
import { afterEach, describe, expect, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');

afterEach(() => {
  cleanup();
});

type Widget = {
  id: string;
  'left-1': string;
  'left-2': string;
  'mid-1': string;
  'mid-2': string;
  'right-1': string;
};
const rows: Widget[] = [
  { id: 'row-1', 'left-1': 'a', 'left-2': 'b', 'mid-1': 'c', 'mid-2': 'd', 'right-1': 'e' },
];
const getWidgetId = (row: Widget) => row.id;
const WidgetDataGrid = DataGrid as Component<DataGridProps<Widget>>;

// Five columns: two pinned left, one pinned right, two unpinned — the exact
// shape COR-1143 asks for.
const columns: DataGridColumnDef<Widget>[] = [
  { key: 'left-1', header: 'Left 1', width: 100, pin: 'left' },
  { key: 'left-2', header: 'Left 2', width: 110, pin: 'left' },
  { key: 'mid-1', header: 'Mid 1', width: 120 },
  { key: 'mid-2', header: 'Mid 2', width: 130 },
  { key: 'right-1', header: 'Right 1', width: 140, pin: 'right' },
];
const columnKeys = columns.map((column) => column.key);

type ColumnSnapshot = {
  key: string;
  pin: string | null;
  colIndex: string | null;
  width: string | null;
};

function snapshotColumns(container: HTMLElement): ColumnSnapshot[] {
  const headers = Array.from(container.querySelectorAll<HTMLElement>('[role="columnheader"]'));
  return headers.map((header) => ({
    key: header.getAttribute('data-cinder-column-key') ?? '',
    pin: header.getAttribute('data-cinder-pin'),
    colIndex: header.getAttribute('aria-colindex'),
    width: header.style.getPropertyValue('--_cinder-data-grid-column-width'),
  }));
}

function domOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="columnheader"]')).map(
    (header) => header.getAttribute('data-cinder-column-key') ?? '',
  );
}

function assertPinnedColumnsUnchanged(before: ColumnSnapshot[], after: ColumnSnapshot[]): void {
  for (const key of ['left-1', 'left-2', 'right-1']) {
    const beforeSnapshot = before.find((column) => column.key === key);
    const afterSnapshot = after.find((column) => column.key === key);
    expect(afterSnapshot).toEqual(beforeSnapshot);
  }
}

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

function stubPointerCapture(element: Element): void {
  (element as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
}

function headerCell(container: HTMLElement, key: string): HTMLElement {
  const cell = container.querySelector<HTMLElement>(`[data-cinder-column-key="${key}"]`);
  if (!cell) throw new Error(`Expected a header cell for column ${key}`);
  return cell;
}

describe('COR-1143 — pinned columns stay inert to controlled prop updates', () => {
  test('a controlled columnSizing update leaves pinned baselines unchanged and only resizes the targeted unpinned column', async () => {
    const { container, rerender } = render(WidgetDataGrid, {
      rows,
      columns,
      getRowId: getWidgetId,
      'aria-label': 'Widgets',
    });

    const before = snapshotColumns(container);
    expect(before.map((column) => column.key)).toEqual(columnKeys);

    await rerender({
      rows,
      columns,
      columnSizing: { 'mid-1': 260 },
      getRowId: getWidgetId,
      'aria-label': 'Widgets',
    });

    const after = snapshotColumns(container);
    assertPinnedColumnsUnchanged(before, after);

    // Positive control: the targeted unpinned column actually changed.
    expect(before.find((column) => column.key === 'mid-1')?.width).toContain('120px');
    expect(after.find((column) => column.key === 'mid-1')?.width).toContain('260px');
    // The other unpinned column was left alone.
    expect(after.find((column) => column.key === 'mid-2')?.width).toBe(
      before.find((column) => column.key === 'mid-2')?.width,
    );
  });

  test('a controlled columnOrder update leaves pinned baselines unchanged and only reorders the unpinned columns', async () => {
    const { container, rerender } = render(WidgetDataGrid, {
      rows,
      columns,
      getRowId: getWidgetId,
      'aria-label': 'Widgets',
    });

    const before = snapshotColumns(container);

    await rerender({
      rows,
      columns,
      columnOrder: ['left-1', 'left-2', 'mid-2', 'mid-1', 'right-1'],
      getRowId: getWidgetId,
      'aria-label': 'Widgets',
    });

    const after = snapshotColumns(container);
    assertPinnedColumnsUnchanged(before, after);

    // Positive control: DOM order actually changed for the unpinned pair.
    expect(domOrder(container)).toEqual(['left-1', 'left-2', 'mid-2', 'mid-1', 'right-1']);
    expect(domOrder(container)).not.toEqual(columnKeys);
  });
});

describe('COR-1143 — pinned columns stay inert to the pointer/keyboard gestures', () => {
  test('a pointer resize drag on an unpinned column leaves pinned baselines unchanged', async () => {
    const { container } = render(WidgetDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      getRowId: getWidgetId,
      'aria-label': 'Widgets',
    });

    const before = snapshotColumns(container);

    const handle = headerCell(container, 'mid-1').querySelector<HTMLElement>(
      '[data-cinder-resize-handle]',
    );
    if (!handle) throw new Error('Expected a resize handle on mid-1');
    stubPointerCapture(handle);

    await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0 });
    await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 50 });
    await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 50 });

    const after = snapshotColumns(container);
    assertPinnedColumnsUnchanged(before, after);
    expect(after.find((column) => column.key === 'mid-1')?.width).toContain('170px');
  });

  test('a pointer reorder drag between the two unpinned columns leaves pinned baselines unchanged', async () => {
    const { container } = render(WidgetDataGrid, {
      rows,
      columns,
      reorderableColumns: true,
      getRowId: getWidgetId,
      'aria-label': 'Widgets',
    });

    const before = snapshotColumns(container);

    const restore = measureHeaderCells({
      'left-1': 100,
      'left-2': 110,
      'mid-1': 120,
      'mid-2': 130,
      'right-1': 140,
    });
    const source = headerCell(container, 'mid-2');
    stubPointerCapture(source);
    await fireEvent.pointerDown(source, { pointerId: 1, clientX: 400, clientY: 10 });
    // Move left, past the midpoint of mid-1 (210 + 60 = 270).
    await fireEvent.pointerMove(source, { pointerId: 1, clientX: 260, clientY: 10 });
    await fireEvent.pointerUp(source, { pointerId: 1, clientX: 260, clientY: 10 });
    restore();

    const after = snapshotColumns(container);
    assertPinnedColumnsUnchanged(before, after);
    expect(domOrder(container)).toEqual(['left-1', 'left-2', 'mid-2', 'mid-1', 'right-1']);
  });

  test('keyboard resize (Shift+ArrowRight) on an unpinned header leaves pinned baselines unchanged', async () => {
    const { container } = render(WidgetDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      getRowId: getWidgetId,
      'aria-label': 'Widgets',
    });

    const before = snapshotColumns(container);
    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) throw new Error('Expected DataGrid root');

    // The active cell starts at the first render column, "left-1"; move
    // right twice to reach the first unpinned cell ("mid-1").
    const gridCells = container.querySelectorAll<HTMLElement>('[role="gridcell"]');
    const midCell = gridCells[2];
    if (!midCell) throw new Error('Expected the mid-1 gridcell');
    await fireEvent.click(midCell);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });

    const after = snapshotColumns(container);
    assertPinnedColumnsUnchanged(before, after);
    expect(after.find((column) => column.key === 'mid-1')?.width).toContain('130px');
  });

  test('keyboard reorder (Ctrl+Shift+ArrowRight) on an unpinned header leaves pinned baselines unchanged', async () => {
    const { container } = render(WidgetDataGrid, {
      rows,
      columns,
      reorderableColumns: true,
      getRowId: getWidgetId,
      'aria-label': 'Widgets',
    });

    const before = snapshotColumns(container);
    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) throw new Error('Expected DataGrid root');

    const gridCells = container.querySelectorAll<HTMLElement>('[role="gridcell"]');
    const midCell = gridCells[2];
    if (!midCell) throw new Error('Expected the mid-1 gridcell');
    await fireEvent.click(midCell);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true, ctrlKey: true });

    const after = snapshotColumns(container);
    assertPinnedColumnsUnchanged(before, after);
    expect(domOrder(container)).toEqual(['left-1', 'left-2', 'mid-2', 'mid-1', 'right-1']);
  });
});
