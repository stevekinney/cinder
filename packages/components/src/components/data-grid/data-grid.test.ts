/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { getDataGridColumnValue } from './_internal/column-model.svelte.ts';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { createRawSnippet, tick } = await import('svelte');
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
  { key: 'customer', header: 'Customer', width: 180, pin: 'left' as const },
  { key: 'status', header: 'Status', width: 120 },
  { key: 'total', header: 'Total', width: 100, getValue: (row: Order) => `$${row.total}` },
];

describe('DataGrid', () => {
  test('renders a static ARIA grid from rows and columns', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector('[role="grid"]');
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute('aria-label')).toBe('Orders');
    expect(grid?.getAttribute('aria-rowcount')).toBe('3');
    expect(grid?.getAttribute('aria-colcount')).toBe('3');
    expect(grid?.textContent).toContain('Ada Lovelace');
    expect(grid?.textContent).toContain('$256');
  });

  test('uses custom header and cell snippets without enabling editing', () => {
    const header = createRawSnippet(() => ({
      render: () => '<span data-testid="header">Amount</span>',
    }));
    const cell = createRawSnippet((context: () => { value: unknown; editing: boolean }) => ({
      render: () => {
        const { value, editing } = context();
        return `<span data-testid="cell">${String(value)}:${String(editing)}</span>`;
      },
    }));

    const { container } = render(OrderDataGrid, {
      rows,
      columns: [
        {
          key: 'total',
          header,
          cell,
          getValue: (row: Order) => row.total,
        },
      ],
      getRowId: getOrderId,
      'aria-label': 'Order totals',
    });

    expect(container.querySelector('[data-testid="header"]')?.textContent).toBe('Amount');
    expect(container.querySelector('[data-testid="cell"]')?.textContent).toBe('124:false');
  });

  test('keeps focus on interactive custom cell content after click', async () => {
    const cell = createRawSnippet(() => ({
      render: () => '<input data-testid="cell-input" value="Ada Lovelace" />',
    }));
    const { container } = render(OrderDataGrid, {
      rows,
      columns: [{ key: 'customer', header: 'Customer', cell }],
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const input = container.querySelector<HTMLInputElement>('[data-testid="cell-input"]');
    if (!input) throw new Error('Expected custom cell input to render');

    input.focus();
    await fireEvent.click(input);

    expect(document.activeElement).toBe(input);
  });

  test('lets interactive custom cell content handle bubbled shortcuts', () => {
    const onselectionmodelchange = mock();
    const cell = createRawSnippet(() => ({
      render: () => '<input data-testid="cell-input" value="Ada Lovelace" />',
    }));
    const { container } = render(OrderDataGrid, {
      rows,
      columns: [{ key: 'customer', header: 'Customer', cell }],
      getRowId: getOrderId,
      selectionMode: 'multiple',
      onselectionmodelchange,
      'aria-label': 'Orders',
    });

    const input = container.querySelector<HTMLInputElement>('[data-testid="cell-input"]');
    if (!input) throw new Error('Expected custom cell input to render');

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(onselectionmodelchange).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[role="row"][aria-selected="true"]')).toHaveLength(0);
  });

  test('moves the active descendant with keyboard navigation', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const firstRowCells = Array.from(
      container.querySelectorAll('[role="row"][aria-rowindex="2"] [role="gridcell"]'),
    );
    const secondRowCells = Array.from(
      container.querySelectorAll('[role="row"][aria-rowindex="3"] [role="gridcell"]'),
    );

    expect(grid?.getAttribute('aria-activedescendant')).toBe(firstRowCells[0]?.getAttribute('id'));

    await fireEvent.keyDown(grid!, { key: 'ArrowRight' });
    expect(grid?.getAttribute('aria-activedescendant')).toBe(firstRowCells[1]?.getAttribute('id'));

    await fireEvent.keyDown(grid!, { key: 'ArrowDown' });
    expect(grid?.getAttribute('aria-activedescendant')).toBe(secondRowCells[1]?.getAttribute('id'));
  });

  test('scrolls the active descendant into view after keyboard navigation', async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollCalls: Array<{ id: string; options: ScrollIntoViewOptions | boolean | undefined }> =
      [];
    Element.prototype.scrollIntoView = function scrollIntoView(
      options?: ScrollIntoViewOptions | boolean,
    ) {
      scrollCalls.push({ id: (this as HTMLElement).id, options });
    };

    try {
      const { container } = render(OrderDataGrid, {
        rows,
        columns,
        getRowId: getOrderId,
        'aria-label': 'Orders',
      });
      const grid = container.querySelector<HTMLElement>('[role="grid"]');
      const firstRowCells = Array.from(
        container.querySelectorAll('[role="row"][aria-rowindex="2"] [role="gridcell"]'),
      );

      await tick();
      expect(scrollCalls).toEqual([]);

      await fireEvent.keyDown(grid!, { key: 'ArrowRight' });
      await tick();

      expect(scrollCalls).toEqual([
        { id: firstRowCells[1]?.id ?? '', options: { block: 'nearest', inline: 'nearest' } },
      ]);
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  test('composes consumer keydown handlers with grid keyboard navigation', async () => {
    const consumerKeydown = mock((event: KeyboardEvent) => {
      expect(event.key).toBe('ArrowRight');
    });
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
      onkeydown: consumerKeydown,
    });
    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const firstRowCells = Array.from(
      container.querySelectorAll('[role="row"][aria-rowindex="2"] [role="gridcell"]'),
    );

    await fireEvent.keyDown(grid!, { key: 'ArrowRight' });

    expect(consumerKeydown).toHaveBeenCalledTimes(1);
    expect(grid?.getAttribute('aria-activedescendant')).toBe(firstRowCells[1]?.id);
  });

  test('lets consumer keydown cancellation block grid keyboard navigation', async () => {
    const consumerKeydown = mock((event: KeyboardEvent) => {
      event.preventDefault();
    });
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
      onkeydown: consumerKeydown,
    });
    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const firstRowCells = Array.from(
      container.querySelectorAll('[role="row"][aria-rowindex="2"] [role="gridcell"]'),
    );

    await fireEvent.keyDown(grid!, { key: 'ArrowRight' });

    expect(consumerKeydown).toHaveBeenCalledTimes(1);
    expect(grid?.getAttribute('aria-activedescendant')).toBe(firstRowCells[0]?.id);
  });

  test('generates unique cell ids for multiple grid instances', () => {
    const first = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'First orders',
    });
    const second = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Second orders',
    });

    const ids = [
      ...Array.from(first.container.querySelectorAll('[role="gridcell"]')),
      ...Array.from(second.container.querySelectorAll('[role="gridcell"]')),
    ].map((cell) => cell.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test('generates deterministic cell ids for astral-plane characters', () => {
    const { container } = render(OrderDataGrid, {
      rows: [{ id: 'ord 😃', customer: 'Katherine Johnson', status: 'Queued', total: 512 }],
      columns: [{ key: 'emoji 💰', header: 'Emoji', getValue: () => 'value' }],
      getRowId: getOrderId,
      'aria-label': 'Emoji orders',
    });

    const cell = container.querySelector('[role="gridcell"]');

    expect(cell?.id).toContain('1f603');
    expect(cell?.id).toContain('1f4b0');
    expect(cell?.id).not.toContain('-de03-');
  });

  test('generates unique cell ids for hyphenated row and column keys', () => {
    const { container } = render(OrderDataGrid, {
      rows: [
        { id: 'a', customer: 'First', status: 'Queued', total: 1 },
        { id: 'a-b', customer: 'Second', status: 'Queued', total: 2 },
      ],
      columns: [
        { key: 'b-c', header: 'First', getValue: (row: Order) => row.customer },
        { key: 'c', header: 'Second', getValue: (row: Order) => row.status },
      ],
      getRowId: getOrderId,
      'aria-label': 'Hyphenated orders',
    });

    const cellIds = Array.from(container.querySelectorAll('[role="gridcell"]')).map(
      (cell) => cell.id,
    );

    expect(new Set(cellIds).size).toBe(cellIds.length);
  });

  test('keeps the active descendant for empty row and column ids', () => {
    const { container } = render(OrderDataGrid, {
      rows: [{ id: '', customer: 'Empty Identifier', status: 'Queued', total: 0 }],
      columns: [{ key: '', header: 'Empty key', getValue: (row: Order) => row.customer }],
      getRowId: getOrderId,
      'aria-label': 'Empty id orders',
    });

    const grid = container.querySelector('[role="grid"]');
    const cell = container.querySelector('[role="gridcell"]');

    expect(cell?.id.endsWith('-cell-r-empty-c-empty')).toBe(true);
    expect(grid?.getAttribute('aria-activedescendant')).toBe(cell?.id);
    expect(cell?.getAttribute('data-cinder-active')).toBe('true');
  });

  test('warns about duplicate row ids and keeps generated cell ids unique', () => {
    const warningMessages: unknown[] = [];
    const warnSpy = mock((message?: unknown) => {
      warningMessages.push(message);
    });
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      const { container } = render(OrderDataGrid, {
        rows: [
          { id: 'duplicate', customer: 'First', status: 'Queued', total: 1 },
          { id: 'duplicate', customer: 'Second', status: 'Queued', total: 2 },
        ],
        columns: [{ key: 'customer', header: 'Customer' }],
        getRowId: getOrderId,
        'aria-label': 'Duplicate id orders',
      });

      const cellIds = Array.from(container.querySelectorAll('[role="gridcell"]')).map(
        (cell) => cell.id,
      );

      expect(new Set(cellIds).size).toBe(cellIds.length);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warningMessages[0])).toContain('duplicate row ids');
      expect(String(warningMessages[0])).toContain('"duplicate"');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('renders dates with deterministic ISO strings', () => {
    const { container } = render(OrderDataGrid, {
      rows: [{ id: 'ord-3', customer: 'Alan Turing', status: 'Queued', total: 88 }],
      columns: [
        {
          key: 'createdAt',
          header: 'Created',
          getValue: () => new Date('2026-06-16T12:00:00.000Z'),
        },
      ],
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(container.querySelector('[role="gridcell"]')?.textContent).toBe(
      '2026-06-16T12:00:00.000Z',
    );
  });

  test('ignores inherited row properties when getValue is omitted', () => {
    const row = { id: 'ord-4' } as Record<string, unknown>;
    const inheritedColumn: DataGridColumnDef = {
      key: 'toString',
      header: 'String',
    };
    const ownPropertyRow = { toString: 'owned value' } as Record<string, unknown>;

    expect(getDataGridColumnValue(row, inheritedColumn)).toBeUndefined();
    expect(getDataGridColumnValue(ownPropertyRow, inheritedColumn)).toBe('owned value');
  });

  test('throws a clear error for duplicate column keys', () => {
    expect(() =>
      render(OrderDataGrid, {
        rows,
        columns: [
          { key: 'customer', header: 'Customer' },
          { key: 'customer', header: 'Customer duplicate' },
        ],
        getRowId: getOrderId,
        'aria-label': 'Orders',
      }),
    ).toThrow('Duplicate column key: "customer"');
  });

  test('applies density, row class, column order, sizing, and pinning metadata', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      columnOrder: ['total', 'customer', 'status'],
      columnSizing: { total: 96 },
      columnPinning: { right: ['total'] },
      density: 'compact',
      rowClass: (row: Order) => `order-${row.id}`,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector('[role="grid"]');
    const headers = Array.from(container.querySelectorAll('[role="columnheader"]'));
    const firstDataRow = container.querySelector('[role="row"][aria-rowindex="2"]');
    const firstDataCells = Array.from(firstDataRow?.querySelectorAll('[role="gridcell"]') ?? []);

    expect(grid?.getAttribute('data-cinder-density')).toBe('compact');
    expect(firstDataRow?.classList.contains('order-ord-1')).toBe(true);
    expect(headers.map((headerCell) => headerCell.textContent?.trim())).toEqual([
      'Customer',
      'Status',
      'Total',
    ]);
    expect(headers[2]?.getAttribute('data-cinder-pin')).toBe('right');
    expect(firstDataCells.map((cell) => cell.getAttribute('aria-colindex'))).toEqual([
      '2',
      '3',
      '1',
    ]);
    expect(firstDataCells[2]?.getAttribute('style')).toContain(
      '--_cinder-data-grid-column-width: 96px',
    );
  });

  test('groups non-contiguous pinned columns at scroll edges with true ARIA indexes', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      columnPinning: { left: ['total', 'customer'], right: ['status'] },
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const headers = Array.from(container.querySelectorAll('[role="columnheader"]'));
    const firstDataRow = container.querySelector('[role="row"][aria-rowindex="2"]');
    const firstDataCells = Array.from(firstDataRow?.querySelectorAll('[role="gridcell"]') ?? []);

    expect(headers.map((headerCell) => headerCell.textContent?.trim())).toEqual([
      'Customer',
      'Total',
      'Status',
    ]);
    expect(firstDataCells.map((cell) => cell.getAttribute('aria-colindex'))).toEqual([
      '1',
      '3',
      '2',
    ]);
    expect(firstDataCells[0]?.getAttribute('style')).toContain(
      '--_cinder-data-grid-pin-left-offset: 0px',
    );
    expect(firstDataCells[1]?.getAttribute('style')).toContain(
      '--_cinder-data-grid-pin-left-offset: 180px',
    );
    expect(firstDataCells[2]?.getAttribute('style')).toContain(
      '--_cinder-data-grid-pin-right-offset: 0px',
    );
  });

  test('normalizes non-finite sizing values before rendering widths', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns: [
        {
          key: 'customer',
          header: 'Customer',
          width: Number.NaN,
          minWidth: Number.NaN,
          maxWidth: Number.NaN,
        },
        { key: 'status', header: 'Status', width: 40, minWidth: 80, maxWidth: 60 },
      ],
      columnSizing: { customer: Number.NaN },
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const cells = Array.from(container.querySelectorAll('[role="gridcell"]'));

    expect(cells[0]?.getAttribute('style')).toContain('--_cinder-data-grid-column-width: 150px');
    expect(cells[1]?.getAttribute('style')).toContain('--_cinder-data-grid-column-width: 80px');
    expect(container.innerHTML).not.toContain('NaNpx');
  });
});
