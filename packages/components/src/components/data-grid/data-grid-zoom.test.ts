/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');

afterEach(() => cleanup());

type Order = {
  id: string;
  customer: string;
  status: string;
};

const rows: Order[] = [
  { id: 'ord-1', customer: 'Ada Lovelace', status: 'Packed' },
  { id: 'ord-2', customer: 'Grace Hopper', status: 'Shipped' },
  { id: 'ord-3', customer: 'Alan Turing', status: 'Queued' },
];

const getOrderId = (row: Order) => row.id;
const OrderDataGrid = DataGrid as Component<DataGridProps<Order>>;

const columns: DataGridColumnDef<Order>[] = [
  { key: 'customer', header: 'Customer', width: 200 },
  { key: 'status', header: 'Status', width: 100 },
];

function getGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector<HTMLElement>('[role="grid"]');
  if (!grid) throw new Error('Expected DataGrid root');
  return grid;
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

function stubPointerCapture(...elements: Element[]): void {
  for (const element of elements) {
    (element as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  }
}

async function focusFirstCustomerCell(container: HTMLElement): Promise<HTMLElement> {
  const grid = getGrid(container);
  const firstCell = container.querySelector<HTMLElement>('[role="gridcell"]');
  if (!firstCell) throw new Error('Expected a gridcell');
  await fireEvent.click(firstCell);
  return grid;
}

function liveRegionText(container: HTMLElement): string | null | undefined {
  return container.querySelector('[role="status"]')?.textContent;
}

async function flushLiveRegion(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('DataGrid zoom — scaling (COR-1139)', () => {
  test('zoom defaults to 100 and renders column width exactly as an unzoomed grid would', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(headerCell(container, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 200px',
    );
    expect(container.querySelector('.cinder-data-grid')?.getAttribute('style')).toContain(
      '--_cinder-data-grid-zoom-scale: 1;',
    );
  });

  test('zoom scales rendered column width by zoom / 100', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      zoom: 150,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(headerCell(container, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 300px',
    );
    const cell = container.querySelector<HTMLElement>('[role="gridcell"]');
    expect(cell?.getAttribute('style')).toContain('--_cinder-data-grid-column-width: 300px');
  });

  test('sets the --_cinder-data-grid-zoom-scale custom property used to scale header height and cell text', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      zoom: 200,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(container.querySelector('.cinder-data-grid')?.getAttribute('style')).toContain(
      '--_cinder-data-grid-zoom-scale: 2;',
    );
  });

  test('the stylesheet scales cell text size and header row height by the zoom-scale custom property', async () => {
    const css = await Bun.file(new URL('./data-grid.css', import.meta.url)).text();

    expect(css).toContain(
      'font-size: calc(var(--cinder-text-sm) * var(--_cinder-data-grid-zoom-scale));',
    );
    expect(css).toContain('min-block-size: calc(2.3125rem * var(--_cinder-data-grid-zoom-scale));');
  });

  test('virtualization adapter uses the scaled row height for total-height calculations', () => {
    const bigRows: Order[] = Array.from({ length: 100 }, (_, index) => ({
      id: `ord-${index}`,
      customer: `Customer ${index}`,
      status: 'Packed',
    }));

    const { container } = render(OrderDataGrid, {
      rows: bigRows,
      columns,
      virtualizeRows: true,
      rowHeight: 20,
      zoom: 200,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    // 100 rows * (20px base rowHeight * 2.0 zoom scale) = 4000px.
    expect(
      container
        .querySelector<HTMLElement>('.cinder-data-grid__body')
        ?.style.getPropertyValue('height'),
    ).toBe('4000px');
  });

  test('a virtualized row is rendered at the scaled row height', () => {
    const bigRows: Order[] = Array.from({ length: 100 }, (_, index) => ({
      id: `ord-${index}`,
      customer: `Customer ${index}`,
      status: 'Packed',
    }));

    const { container } = render(OrderDataGrid, {
      rows: bigRows,
      columns,
      virtualizeRows: true,
      rowHeight: 20,
      zoom: 150,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const row = container.querySelector<HTMLElement>('.cinder-data-grid__body [role="row"]');
    expect(row?.getAttribute('style')).toContain('--_cinder-data-grid-row-height: 30px');
  });

  test('non-finite zoom is ignored, falls back to 100, and warns once in development', () => {
    const warnings: unknown[] = [];
    const warnSpy = mock((message?: unknown) => {
      warnings.push(message);
    });
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      const { container } = render(OrderDataGrid, {
        rows,
        columns,
        zoom: Number.NaN,
        getRowId: getOrderId,
        'aria-label': 'Orders',
      });

      expect(headerCell(container, 'customer').getAttribute('style')).toContain(
        '--_cinder-data-grid-column-width: 200px',
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnings[0])).toContain('zoom must be a finite number');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('an out-of-range finite zoom is clamped to [50, 200], not rejected', () => {
    const { container: high } = render(OrderDataGrid, {
      rows,
      columns,
      zoom: 9_999,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });
    expect(headerCell(high, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 400px',
    );
    cleanup();

    const { container: low } = render(OrderDataGrid, {
      rows,
      columns,
      zoom: 1,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });
    expect(headerCell(low, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 100px',
    );
  });

  test('pointer resize under zoom converts the screen-pixel drag into a base-pixel width, tracking the cursor', async () => {
    const onColumnSizingChange = mock((_next: Record<string, number>) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      zoom: 200,
      onColumnSizingChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const handle = resizeHandle(container, 'customer');
    stubPointerCapture(handle);

    // At 200% zoom the rendered column is twice as wide on screen per base
    // px, so a 100 screen-px drag must resolve to a 50 base-px width change
    // (200 + 50 = 250) for the handle to track the pointer 1:1 — not a
    // 100px change (which a zoom-naive delta would produce).
    await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100 });
    await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 200 });
    await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 200 });

    expect(onColumnSizingChange).toHaveBeenCalledTimes(1);
    expect(onColumnSizingChange.mock.calls[0]?.[0]).toEqual({ customer: 250 });
    // The committed base width (250) renders scaled by zoom (× 2 → 500px).
    expect(headerCell(container, 'customer').getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 500px',
    );
  });

  test('keyboard resize under zoom still steps by exactly 10 unscaled base pixels', async () => {
    const onColumnSizingChange = mock((_next: Record<string, number>) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      resizableColumns: true,
      zoom: 200,
      onColumnSizingChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = await focusFirstCustomerCell(container);
    await fireEvent.keyDown(grid, { key: 'ArrowUp' });
    await fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });

    // Base width 200 + the fixed 10px keyboard step = 210, unaffected by
    // zoom — `columnSizing` always stays in unscaled base pixels.
    expect(onColumnSizingChange).toHaveBeenCalledWith({ customer: 210 });
    expect(headerCell(container, 'customer').getAttribute('style')).toContain(
      // Rendered at 2x zoom: 210 * 2 = 420px on screen.
      '--_cinder-data-grid-column-width: 420px',
    );
  });
});

describe('DataGrid toolbar counts and zoom controls (COR-1140)', () => {
  test('neither search nor zoomControls: no toolbar DOM at all (opt-out unchanged)', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(container.querySelector('[role="toolbar"]')).toBeNull();
    expect(container.querySelector('.cinder-data-grid__toolbar')).toBeNull();
  });

  test('zoomControls alone renders a toolbar with counts and zoom controls but no search field', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      zoomControls: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
    expect(container.querySelector('input[type="search"]')).toBeNull();
    expect(container.querySelector('.cinder-data-grid__toolbar-counts')?.textContent).toContain(
      '3 rows',
    );
    expect(container.querySelector('.cinder-data-grid__toolbar-counts')?.textContent).toContain(
      '2 columns',
    );
    expect(container.querySelector('button[aria-label="Zoom in"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Zoom out"]')).not.toBeNull();
    expect(container.querySelector('.cinder-data-grid__zoom-level')?.textContent).toBe('100%');
  });

  test('search and zoomControls together render inside a single shared toolbar', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      search: true,
      zoomControls: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const toolbars = container.querySelectorAll('[role="toolbar"]');
    expect(toolbars.length).toBe(1);
    expect(toolbars[0]?.querySelector('input[type="search"]')).not.toBeNull();
    expect(toolbars[0]?.querySelector('button[aria-label="Zoom in"]')).not.toBeNull();
  });

  test('clicking Zoom in steps zoom by 10, calls onZoomChange, and announces the new level', async () => {
    const onZoomChange = mock((_next: number) => {});
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      zoomControls: true,
      onZoomChange,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const zoomInButton = container.querySelector<HTMLElement>('button[aria-label="Zoom in"]');
    if (!zoomInButton) throw new Error('Expected a "Zoom in" button');

    await fireEvent.click(zoomInButton);

    expect(onZoomChange).toHaveBeenCalledWith(110);
    expect(container.querySelector('.cinder-data-grid__zoom-level')?.textContent).toBe('110%');
    await flushLiveRegion();
    expect(liveRegionText(container)).toContain('Zoom 110%');
  });

  test('Zoom out/in buttons disable at the [50, 200] bounds', () => {
    const { container: atMin } = render(OrderDataGrid, {
      rows,
      columns,
      zoomControls: true,
      zoom: 50,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });
    expect(atMin.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]')?.disabled).toBe(
      true,
    );
    expect(atMin.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')?.disabled).toBe(
      false,
    );
    cleanup();

    const { container: atMax } = render(OrderDataGrid, {
      rows,
      columns,
      zoomControls: true,
      zoom: 200,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });
    expect(atMax.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')?.disabled).toBe(
      true,
    );
    expect(atMax.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]')?.disabled).toBe(
      false,
    );
  });

  test('DataGrid assigns zoom directly (not just the callback) — two clicks compound to +20', async () => {
    // Mirrors the sortModel/columnSizing controlled-prop contract: DataGrid
    // assigns `zoom` directly in addition to calling `onZoomChange`. If it
    // only called the callback without updating its own internal state, a
    // second click would still start from the original 100 instead of 110.
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      zoomControls: true,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const zoomInButton = container.querySelector<HTMLElement>('button[aria-label="Zoom in"]');
    if (!zoomInButton) throw new Error('Expected a "Zoom in" button');

    await fireEvent.click(zoomInButton);
    await fireEvent.click(zoomInButton);

    expect(container.querySelector('.cinder-data-grid__zoom-level')?.textContent).toBe('120%');
  });
});
