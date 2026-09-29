/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import {
  formatDataGridSearchStatus,
  getDataGridSearchMatches,
  getNextDataGridSearchMatchIndex,
} from './_internal/search-model.ts';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');

afterEach(() => cleanup());

type Order = {
  id: string;
  customer: string;
  note: string;
};

const rows: Order[] = [
  { id: 'ord-1', customer: 'Ada Lovelace', note: 'vip' },
  { id: 'ord-2', customer: 'Grace Hopper', note: 'ada fan' },
  { id: 'ord-3', customer: 'Alan Turing', note: 'n/a' },
];

const getOrderId = (row: Order) => row.id;
const OrderDataGrid = DataGrid as Component<DataGridProps<Order>>;

const columns: DataGridColumnDef<Order>[] = [
  { key: 'customer', header: 'Customer', width: 200 },
  { key: 'note', header: 'Note', width: 160 },
];

function searchInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="search"]');
  if (!input) throw new Error('Expected a search input inside the DataGrid toolbar');
  return input;
}

function matchCells(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('.cinder-data-grid__cell--search-match'),
  );
}

function currentMatchCell(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.cinder-data-grid__cell--search-match-current');
}

function liveRegionText(container: HTMLElement): string | null | undefined {
  return container.querySelector('[role="status"]')?.textContent;
}

async function flushLiveRegion(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function typeAndSettle(container: HTMLElement, value: string): Promise<void> {
  await fireEvent.input(searchInput(container), { target: { value } });
  await waitFor(() => expect(matchCells(container).length).toBeGreaterThan(0));
  await flushLiveRegion();
}

describe('DataGrid search — match highlighting outranks selection styling', () => {
  test('search-match background/ring beat, not just tie, the selected-cell styling in both themes and forced-colors', async () => {
    const css = await Bun.file(new URL('./data-grid.css', import.meta.url)).text();

    // A bare `.cinder-data-grid__cell--search-match` (specificity 0,1,0)
    // loses outright to `.cinder-data-grid__cell[data-cinder-selected]`
    // (0,2,0) — which is exactly what the active/anchor cell a search
    // navigation just landed on always also is — silently hiding the
    // match highlight on the one cell a searching user is looking at. The
    // doubled compound below matches that specificity so declaration
    // order (asserted below) decides the tie instead.
    expect(css).toContain('.cinder-data-grid__cell.cinder-data-grid__cell--search-match {');
    expect(css).toContain('.cinder-data-grid__cell.cinder-data-grid__cell--search-match-current {');

    const selectedIndex = css.indexOf('.cinder-data-grid__cell[data-cinder-selected] {');
    const searchMatchIndex = css.indexOf(
      '.cinder-data-grid__cell.cinder-data-grid__cell--search-match {',
    );
    expect(selectedIndex).toBeGreaterThan(-1);
    expect(searchMatchIndex).toBeGreaterThan(selectedIndex);

    const forcedColorsSelectedIndex = css.lastIndexOf(
      '.cinder-data-grid__cell[data-cinder-selected] {',
    );
    const forcedColorsSearchMatchIndex = css.lastIndexOf(
      '.cinder-data-grid__cell.cinder-data-grid__cell--search-match {',
    );
    expect(forcedColorsSelectedIndex).toBeGreaterThan(selectedIndex);
    expect(forcedColorsSearchMatchIndex).toBeGreaterThan(forcedColorsSelectedIndex);
  });
});

describe('DataGrid search — pure helpers', () => {
  test('matches every column value case-insensitively, in sorted row × rendered column order', () => {
    const entries = rows.map((row) => ({ row, rowDomId: row.id }));
    const matches = getDataGridSearchMatches(entries, columns, 'ADA');

    expect(matches).toEqual([
      { rowId: 'ord-1', columnKey: 'customer', rowIndex: 0, columnIndex: 0 },
      { rowId: 'ord-2', columnKey: 'note', rowIndex: 1, columnIndex: 1 },
    ]);
  });

  test('an empty or whitespace-only query matches nothing', () => {
    const entries = rows.map((row) => ({ row, rowDomId: row.id }));
    expect(getDataGridSearchMatches(entries, columns, '')).toEqual([]);
    expect(getDataGridSearchMatches(entries, columns, '   ')).toEqual([]);
  });

  test('wraps forward and backward around both ends', () => {
    expect(getNextDataGridSearchMatchIndex(undefined, 3, 1)).toBe(0);
    expect(getNextDataGridSearchMatchIndex(undefined, 3, -1)).toBe(2);
    expect(getNextDataGridSearchMatchIndex(2, 3, 1)).toBe(0);
    expect(getNextDataGridSearchMatchIndex(0, 3, -1)).toBe(2);
    expect(getNextDataGridSearchMatchIndex(0, 0, 1)).toBeUndefined();
  });

  test('formats match-position status text', () => {
    expect(formatDataGridSearchStatus(undefined, 0)).toBe('No matches');
    expect(formatDataGridSearchStatus(2, 12)).toBe('Match 3 of 12');
    expect(formatDataGridSearchStatus(undefined, 1)).toBe('1 match');
  });

  test('matches non-string cell values by the same string form the cell renders (numbers, dates)', () => {
    type Shipment = { id: string; total: number; shippedAt: Date };
    const shipments: Shipment[] = [
      { id: 's-1', total: 1250, shippedAt: new Date('2026-01-15T00:00:00.000Z') },
      { id: 's-2', total: 40, shippedAt: new Date('2020-01-01T00:00:00.000Z') },
    ];
    const shipmentColumns: DataGridColumnDef<Shipment>[] = [
      { key: 'total', header: 'Total' },
      { key: 'shippedAt', header: 'Shipped' },
    ];
    const entries = shipments.map((row) => ({ row, rowDomId: row.id }));

    expect(getDataGridSearchMatches(entries, shipmentColumns, '1250')).toEqual([
      { rowId: 's-1', columnKey: 'total', rowIndex: 0, columnIndex: 0 },
    ]);
    expect(getDataGridSearchMatches(entries, shipmentColumns, '2026-01-15')).toEqual([
      { rowId: 's-1', columnKey: 'shippedAt', rowIndex: 0, columnIndex: 1 },
    ]);
  });
});

describe('DataGrid search — opt-in toolbar (COR-1134)', () => {
  test('search is off by default: no toolbar, no search input', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(container.querySelector('[role="toolbar"]')).toBeNull();
    expect(container.querySelector('.cinder-data-grid__toolbar')).toBeNull();
    expect(container.querySelector('input[type="search"]')).toBeNull();
  });

  test('search renders a toolbar outside role="grid" with a named, grid-controlling search field', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    const toolbar = container.querySelector('[role="toolbar"]');
    const grid = container.querySelector('[role="grid"]');
    expect(toolbar).not.toBeNull();
    expect(grid).not.toBeNull();
    // The toolbar is a sibling that precedes the grid, not a descendant of it.
    expect(grid?.contains(toolbar as Node)).toBe(false);
    expect(toolbar?.contains(grid as Node)).toBe(false);

    const input = searchInput(container);
    expect(input.getAttribute('aria-label')).toBe('Search Orders');
    expect(input.getAttribute('aria-controls')).toBe(grid?.id ?? null);
  });
});

describe('DataGrid search — pays nothing when off (COR-1136)', () => {
  test('mounting with search off never calls a column getValue beyond ordinary cell rendering', () => {
    const getCustomerValue = mock((row: Order) => row.customer);
    const spiedColumns: DataGridColumnDef<Order>[] = [
      { key: 'customer', header: 'Customer', getValue: getCustomerValue },
      { key: 'note', header: 'Note' },
    ];

    const { container } = render(OrderDataGrid, {
      rows,
      columns: spiedColumns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    expect(container.querySelector('[role="toolbar"]')).toBeNull();
    // Exactly one getValue call per rendered cell in that column (one per
    // row) — if the search-matching scan had run too, this would double.
    expect(getCustomerValue).toHaveBeenCalledTimes(rows.length);
  });

  test('mounting with search on but no query typed yet calls getValue no more than rendering already does', () => {
    const getCustomerValue = mock((row: Order) => row.customer);
    const spiedColumns: DataGridColumnDef<Order>[] = [
      { key: 'customer', header: 'Customer', getValue: getCustomerValue },
      { key: 'note', header: 'Note' },
    ];

    render(OrderDataGrid, {
      rows,
      columns: spiedColumns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    expect(getCustomerValue).toHaveBeenCalledTimes(rows.length);
  });
});

describe('DataGrid search — matching and highlighting (COR-1138)', () => {
  test('debounces 300ms: no highlight immediately after typing, highlight once settled', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await fireEvent.input(searchInput(container), { target: { value: 'ada' } });
    expect(matchCells(container)).toHaveLength(0);

    await waitFor(() => expect(matchCells(container)).toHaveLength(2));
  });

  test('matches case-insensitively across every column, including a not-explicitly-getValue column', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ADA');

    const matchedTexts = matchCells(container)
      .map((cell) => cell.textContent?.trim())
      .toSorted();
    expect(matchedTexts).toEqual(['Ada Lovelace', 'ada fan']);
  });

  test('clearing the query removes every highlight after the debounce settles', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ada');
    await fireEvent.input(searchInput(container), { target: { value: '' } });

    await waitFor(() => expect(matchCells(container)).toHaveLength(0));
  });
});

describe('DataGrid search — next/previous navigation (COR-1137)', () => {
  test('typing settles on the first match as the current match', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ada');

    const current = currentMatchCell(container);
    expect(current?.textContent?.trim()).toBe('Ada Lovelace');
    expect(current?.getAttribute('data-cinder-active')).toBe('true');
  });

  test('the next button steps forward and wraps around to the first match', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ada');
    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next match"]',
    );
    if (!nextButton) throw new Error('Expected a "Next match" button');

    await fireEvent.click(nextButton);
    expect(currentMatchCell(container)?.textContent?.trim()).toBe('ada fan');

    await fireEvent.click(nextButton);
    expect(currentMatchCell(container)?.textContent?.trim()).toBe('Ada Lovelace');
  });

  test('the previous button steps backward and wraps around to the last match', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ada');
    const previousButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Previous match"]',
    );
    if (!previousButton) throw new Error('Expected a "Previous match" button');

    await fireEvent.click(previousButton);
    expect(currentMatchCell(container)?.textContent?.trim()).toBe('ada fan');
  });

  test('Enter and Shift+Enter in the search field step forward and backward', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ada');
    const input = searchInput(container);

    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(currentMatchCell(container)?.textContent?.trim()).toBe('ada fan');

    await fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(currentMatchCell(container)?.textContent?.trim()).toBe('Ada Lovelace');
  });

  test('next/previous are disabled when there are no matches', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await fireEvent.input(searchInput(container), { target: { value: 'zzz-no-match' } });
    await waitFor(() => expect(liveRegionText(container)).toContain('No matches'));

    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next match"]',
    );
    const previousButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Previous match"]',
    );
    expect(nextButton?.disabled).toBe(true);
    expect(previousButton?.disabled).toBe(true);
  });

  test('stepping to a match scrolls it into the rendered window under row virtualization', async () => {
    const manyRows: Order[] = Array.from({ length: 200 }, (_, index) => ({
      id: `row-${index}`,
      customer: `Customer ${index}`,
      note: index === 150 ? 'needle' : 'hay',
    }));

    const { container } = render(OrderDataGrid, {
      rows: manyRows,
      columns,
      getRowId: (row: Order) => row.id,
      search: true,
      virtualizeRows: true,
      rowHeight: 20,
      'aria-label': 'Haystack',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) throw new Error('Expected DataGrid root');

    await typeAndSettle(container, 'needle');

    await waitFor(() =>
      expect(
        Array.from(container.querySelectorAll('.cinder-data-grid__body [role="row"]')).some((row) =>
          row.textContent?.includes('Customer 150'),
        ),
      ).toBe(true),
    );
    expect(currentMatchCell(container)?.textContent?.trim()).toBe('needle');
  });
});

describe('DataGrid search — announcements (COR-1135)', () => {
  test('announces match position and "No matches" through the existing live region', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ada');
    expect(liveRegionText(container)).toContain('Match 1 of 2');

    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next match"]',
    );
    if (!nextButton) throw new Error('Expected a "Next match" button');
    await fireEvent.click(nextButton);
    await flushLiveRegion();
    expect(liveRegionText(container)).toContain('Match 2 of 2');

    await fireEvent.input(searchInput(container), { target: { value: 'no-such-value' } });
    await waitFor(() => expect(liveRegionText(container)).toContain('No matches'));
  });
});

describe('DataGrid search — coexists with editing and sorting', () => {
  test('committing an edit that creates a new match highlights it once matches recompute', async () => {
    const editableColumns: DataGridColumnDef<Order>[] = [
      { key: 'customer', header: 'Customer', editable: true },
      { key: 'note', header: 'Note' },
    ];
    const onCellEdit = mock((_row: Order, _columnKey: string, _value: unknown) => {});

    const { container, rerender } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      search: true,
      onCellEdit,
      'aria-label': 'Orders',
    });

    await fireEvent.input(searchInput(container), { target: { value: 'needle' } });
    await waitFor(() => expect(liveRegionText(container)).toContain('No matches'));
    expect(matchCells(container)).toHaveLength(0);

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) throw new Error('Expected DataGrid root');
    // Third column-less row: focus the (0,0) customer cell and retype it.
    await fireEvent.keyDown(grid, { key: 'Enter' });
    const input = container.querySelector<HTMLInputElement>('.cinder-data-grid__cell-editor-input');
    if (!input) throw new Error('Expected an editing Input');
    await fireEvent.input(input, { target: { value: 'needle found' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellEdit).toHaveBeenCalledWith(rows[0], 'customer', 'needle found');

    const editedRows = rows.map((row, index) =>
      index === 0 ? { ...row, customer: 'needle found' } : row,
    );
    await rerender({
      rows: editedRows,
      columns: editableColumns,
      getRowId: getOrderId,
      search: true,
      onCellEdit,
      'aria-label': 'Orders',
    });

    await waitFor(() => expect(matchCells(container)).toHaveLength(1));
    expect(matchCells(container)[0]?.textContent?.trim()).toBe('needle found');
  });

  test('re-sorting keeps the search match highlight on the same underlying row', async () => {
    const sortableColumns: DataGridColumnDef<Order>[] = [
      { key: 'customer', header: 'Customer', sortable: true },
      { key: 'note', header: 'Note' },
    ];

    const { container, rerender } = render(OrderDataGrid, {
      rows,
      columns: sortableColumns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ada');
    expect(
      matchCells(container)
        .map((cell) => cell.textContent?.trim())
        .toSorted(),
    ).toEqual(['Ada Lovelace', 'ada fan']);

    await rerender({
      rows,
      columns: sortableColumns,
      getRowId: getOrderId,
      search: true,
      sortModel: [{ key: 'customer', direction: 'descending' }],
      'aria-label': 'Orders',
    });

    await waitFor(() =>
      expect(
        matchCells(container)
          .map((cell) => cell.textContent?.trim())
          .toSorted(),
      ).toEqual(['Ada Lovelace', 'ada fan']),
    );
  });

  test('an unrelated re-render does not reset the user’s position among matches', async () => {
    const editableColumns: DataGridColumnDef<Order>[] = [
      { key: 'customer', header: 'Customer' },
      { key: 'note', header: 'Note', editable: true },
    ];

    const { container, rerender } = render(OrderDataGrid, {
      rows,
      columns: editableColumns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await typeAndSettle(container, 'ada');
    expect(currentMatchCell(container)?.textContent?.trim()).toBe('Ada Lovelace');

    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next match"]',
    );
    if (!nextButton) throw new Error('Expected a "Next match" button');
    await fireEvent.click(nextButton);
    await waitFor(() => expect(currentMatchCell(container)?.textContent?.trim()).toBe('ada fan'));
    await flushLiveRegion();
    expect(liveRegionText(container)).toContain('Match 2 of 2');

    // A re-render caused by something unrelated to the search — a new
    // `rows` array from committing an edit on a row that has nothing to do
    // with the "ada" query — must not silently snap the user back to the
    // first match or move the active cell out from under them.
    const unrelatedRows = rows.map((row, index) =>
      index === 2 ? { ...row, note: 'updated' } : row,
    );
    await rerender({
      rows: unrelatedRows,
      columns: editableColumns,
      getRowId: getOrderId,
      search: true,
      'aria-label': 'Orders',
    });

    await flushLiveRegion();
    expect(currentMatchCell(container)?.textContent?.trim()).toBe('ada fan');
    expect(liveRegionText(container)).toContain('Match 2 of 2');
  });
});
