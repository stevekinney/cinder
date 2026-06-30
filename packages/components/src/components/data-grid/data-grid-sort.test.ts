/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  compareDataGridValues,
  getNextDataGridSortModel,
  getSortedDataGridRowIndices,
} from './_internal/sort-model.ts';
import type { DataGridColumnDef, DataGridProps, DataGridSortModel } from './data-grid.types.ts';

setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');

type Order = {
  id: string;
  customer: string;
  total: number;
  createdAt: Date;
};

const rows: Order[] = [
  { id: 'ord-1', customer: 'Grace Hopper', total: 256, createdAt: new Date('2026-02-01') },
  { id: 'ord-2', customer: 'Ada Lovelace', total: 124, createdAt: new Date('2026-01-01') },
  { id: 'ord-3', customer: 'Alan Turing', total: 124, createdAt: new Date('2026-03-01') },
];

const columns: DataGridColumnDef<Order>[] = [
  { key: 'customer', header: 'Customer', sortable: true },
  {
    key: 'total',
    header: 'Total',
    sortable: true,
    sortComparator: (left: number, right: number) => left - right,
  },
  { key: 'createdAt', header: 'Created', sortable: true },
  { key: 'id', header: 'Identifier' },
];

const getOrderId = (row: Order) => row.id;
const OrderDataGrid = DataGrid as Component<DataGridProps<Order>>;

function getColumnText(container: HTMLElement, columnIndex: number): string[] {
  return Array.from(
    container.querySelectorAll(
      `[role="row"][aria-rowindex]:not([aria-rowindex="1"]) [role="gridcell"][aria-colindex="${columnIndex}"]`,
    ),
  ).map((cell) => cell.textContent?.trim() ?? '');
}

describe('DataGrid sort model', () => {
  test('compares numbers, dates, and strings with nullish values last', () => {
    expect(compareDataGridValues(2, 10)).toBeLessThan(0);
    expect(compareDataGridValues(2, 10, 'descending')).toBeGreaterThan(0);
    expect(compareDataGridValues(new Date('2026-01-01'), new Date('2026-02-01'))).toBeLessThan(0);
    expect(compareDataGridValues('item 2', 'item 10')).toBeLessThan(0);
    expect(compareDataGridValues(true, false)).toBeGreaterThan(0);
    expect(compareDataGridValues(1n, 2n)).toBeLessThan(0);
    expect(compareDataGridValues(Symbol('alpha'), Symbol('beta'))).toBeLessThan(0);
    expect(compareDataGridValues({}, [])).toBeGreaterThan(0);
    expect(compareDataGridValues(Number.NaN, 'value')).toBeLessThan(0);
    expect(compareDataGridValues(undefined, 'value')).toBeGreaterThan(0);
    expect(compareDataGridValues(undefined, 'value', 'descending')).toBeGreaterThan(0);
    expect(compareDataGridValues(new Date('invalid'), new Date('2026-01-01'))).toBeGreaterThan(0);
    expect(compareDataGridValues(null, undefined)).toBe(0);
    expect(compareDataGridValues(new Date('invalid'), new Date('invalid'))).toBe(0);
  });

  test('toggles single and multi-sort models without mutating or reordering the current model', () => {
    const original: DataGridSortModel = [{ key: 'customer', direction: 'ascending' }];
    const descending = getNextDataGridSortModel(original, 'customer', false);
    const multi = getNextDataGridSortModel(descending, 'total', true);
    const toggledMulti = getNextDataGridSortModel(multi, 'total', true);

    expect(original).toEqual([{ key: 'customer', direction: 'ascending' }]);
    expect(descending).toEqual([{ key: 'customer', direction: 'descending' }]);
    expect(multi).toEqual([
      { key: 'customer', direction: 'descending' },
      { key: 'total', direction: 'ascending' },
    ]);
    expect(toggledMulti).toEqual([
      { key: 'customer', direction: 'descending' },
      { key: 'total', direction: 'descending' },
    ]);
    expect(getNextDataGridSortModel(toggledMulti, 'total', true)).toEqual([
      { key: 'customer', direction: 'descending' },
    ]);
    expect(
      getNextDataGridSortModel([{ key: 'customer', direction: 'descending' }], 'customer', false),
    ).toEqual([]);
  });

  test('sorts row indices stably without mutating rows', () => {
    const sortedIndices = getSortedDataGridRowIndices(rows, columns, [
      { key: 'total', direction: 'ascending' },
      { key: 'customer', direction: 'ascending' },
    ]);

    expect(sortedIndices).toEqual([1, 2, 0]);
    expect(rows.map((row) => row.id)).toEqual(['ord-1', 'ord-2', 'ord-3']);
  });

  test('uses column comparators when supplied', () => {
    const comparatorColumns: DataGridColumnDef<Order>[] = [
      {
        key: 'customer',
        header: 'Customer',
        sortable: true,
        sortComparator: (leftValue: string, rightValue: string) =>
          leftValue.length - rightValue.length,
      },
    ];

    const sortedIndices = getSortedDataGridRowIndices(rows, comparatorColumns, [
      { key: 'customer', direction: 'ascending' },
    ]);

    expect(sortedIndices).toEqual([2, 0, 1]);
  });

  test('keeps nullish values last when sorting descending', () => {
    const nullableRows: Array<{ id: string; total: number | null }> = [
      { id: 'a', total: null },
      { id: 'b', total: 10 },
      { id: 'c', total: 20 },
    ];
    const nullableColumns: DataGridColumnDef<(typeof nullableRows)[number]>[] = [
      { key: 'total', header: 'Total', sortable: true },
    ];

    const sortedIndices = getSortedDataGridRowIndices(nullableRows, nullableColumns, [
      { key: 'total', direction: 'descending' },
    ]);

    expect(sortedIndices).toEqual([2, 1, 0]);
  });

  test('keeps nullish values last before applying custom comparators', () => {
    const nullableRows: Array<{ id: string; total: number | null }> = [
      { id: 'a', total: null },
      { id: 'b', total: 10 },
      { id: 'c', total: 20 },
    ];
    const nullableColumns: DataGridColumnDef<(typeof nullableRows)[number]>[] = [
      {
        key: 'total',
        header: 'Total',
        sortable: true,
        sortComparator: (left: number | null, right: number | null) =>
          (left ?? Number.NEGATIVE_INFINITY) - (right ?? 0),
      },
    ];

    expect(
      getSortedDataGridRowIndices(nullableRows, nullableColumns, [
        { key: 'total', direction: 'ascending' },
      ]),
    ).toEqual([1, 2, 0]);
    expect(
      getSortedDataGridRowIndices(nullableRows, nullableColumns, [
        { key: 'total', direction: 'descending' },
      ]),
    ).toEqual([2, 1, 0]);
  });

  test('falls through to the next sort item when both compared values are nullish', () => {
    const nullableRows: Array<{ id: string; total: number | null; label: string }> = [
      { id: 'a', total: null, label: 'Beta' },
      { id: 'b', total: null, label: 'Alpha' },
      { id: 'c', total: 10, label: 'Gamma' },
    ];
    const nullableColumns: DataGridColumnDef<(typeof nullableRows)[number]>[] = [
      { key: 'total', header: 'Total', sortable: true },
      { key: 'label', header: 'Label', sortable: true },
    ];

    expect(
      getSortedDataGridRowIndices(nullableRows, nullableColumns, [
        { key: 'total', direction: 'ascending' },
        { key: 'label', direction: 'ascending' },
      ]),
    ).toEqual([2, 1, 0]);
  });
});

describe('DataGrid sort rendering', () => {
  test('sorts rows and cycles aria-sort from header clicks', async () => {
    const changes: DataGridSortModel[] = [];
    const onsortmodelchange = mock((nextSortModel: DataGridSortModel) => {
      changes.push(nextSortModel);
    });
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      onsortmodelchange,
      'aria-label': 'Orders',
    });

    const customerHeader = container.querySelector<HTMLElement>(
      '[role="columnheader"][aria-colindex="1"]',
    );
    const customerButton = customerHeader?.querySelector('button');

    expect(customerHeader?.hasAttribute('aria-sort')).toBe(false);
    expect(getColumnText(container, 1)).toEqual(['Grace Hopper', 'Ada Lovelace', 'Alan Turing']);

    await fireEvent.click(customerButton!);
    expect(customerHeader?.getAttribute('aria-sort')).toBe('ascending');
    expect(getColumnText(container, 1)).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);

    await fireEvent.click(customerButton!);
    expect(customerHeader?.getAttribute('aria-sort')).toBe('descending');
    expect(getColumnText(container, 1)).toEqual(['Grace Hopper', 'Alan Turing', 'Ada Lovelace']);

    await fireEvent.click(customerButton!);
    expect(customerHeader?.hasAttribute('aria-sort')).toBe(false);
    expect(getColumnText(container, 1)).toEqual(['Grace Hopper', 'Ada Lovelace', 'Alan Turing']);
    expect(changes).toEqual([
      [{ key: 'customer', direction: 'ascending' }],
      [{ key: 'customer', direction: 'descending' }],
      [],
    ]);
  });

  test('supports shift-click multi-sort priority with one active aria-sort column', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const totalHeader = container.querySelector<HTMLElement>(
      '[role="columnheader"][aria-colindex="2"]',
    );
    const customerHeader = container.querySelector<HTMLElement>(
      '[role="columnheader"][aria-colindex="1"]',
    );
    const identifierHeader = container.querySelector<HTMLElement>(
      '[role="columnheader"][aria-colindex="4"]',
    );

    await fireEvent.click(totalHeader!.querySelector('button')!);
    await fireEvent.click(customerHeader!.querySelector('button')!, { shiftKey: true });

    expect(totalHeader?.getAttribute('aria-sort')).toBe('ascending');
    expect(customerHeader?.hasAttribute('aria-sort')).toBe(false);
    expect(identifierHeader?.hasAttribute('aria-sort')).toBe(false);
    expect(
      container.querySelectorAll(
        '[role="columnheader"][aria-sort="ascending"], [role="columnheader"][aria-sort="descending"]',
      ).length,
    ).toBe(1);
    expect(totalHeader?.textContent).toContain('1');
    expect(customerHeader?.textContent).toContain('2');
    expect(getColumnText(container, 1)).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);
    expect(getColumnText(container, 2)).toEqual(['124', '124', '256']);
  });

  test('renders an initial controlled sort model', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      sortModel: [{ key: 'total', direction: 'descending' }],
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const totalHeader = container.querySelector<HTMLElement>(
      '[role="columnheader"][aria-colindex="2"]',
    );

    expect(totalHeader?.getAttribute('aria-sort')).toBe('descending');
    expect(getColumnText(container, 2)).toEqual(['256', '124', '124']);
  });

  test('keeps active descendant on the same row id after sorting', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const customerHeader = container.querySelector<HTMLElement>(
      '[role="columnheader"][aria-colindex="1"]',
    );

    await fireEvent.click(customerHeader!.querySelector('button')!);

    const secondSortedRowCells = Array.from(
      container.querySelectorAll('[role="row"][aria-rowindex="3"] [role="gridcell"]'),
    );
    const thirdSortedRowCells = Array.from(
      container.querySelectorAll('[role="row"][aria-rowindex="4"] [role="gridcell"]'),
    );

    expect(grid?.getAttribute('aria-activedescendant')).toBe(
      thirdSortedRowCells[0]?.getAttribute('id'),
    );
    expect(thirdSortedRowCells[0]?.textContent?.trim()).toBe('Grace Hopper');
    expect(thirdSortedRowCells[0]?.getAttribute('data-cinder-active')).toBe('true');
    expect(thirdSortedRowCells[0]?.getAttribute('aria-selected')).toBe('true');

    await fireEvent.keyDown(grid!, { key: 'ArrowUp' });

    expect(grid?.getAttribute('aria-activedescendant')).toBe(
      secondSortedRowCells[0]?.getAttribute('id'),
    );
    expect(secondSortedRowCells[0]?.textContent?.trim()).toBe('Alan Turing');
    expect(secondSortedRowCells[0]?.getAttribute('data-cinder-active')).toBe('true');
    expect(secondSortedRowCells[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('header button arrow keys do not move the grid active descendant', async () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });
    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const totalButton = container.querySelector<HTMLElement>(
      '[role="columnheader"][aria-colindex="2"] button',
    );
    const initialActiveCellId = grid?.getAttribute('aria-activedescendant');

    await fireEvent.keyDown(totalButton!, { key: 'ArrowDown' });

    expect(grid?.getAttribute('aria-activedescendant')).toBe(initialActiveCellId);
  });

  test('row callbacks receive the sorted visual row index', () => {
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      sortModel: [{ key: 'customer', direction: 'ascending' }],
      getRowId: getOrderId,
      rowClass: (_row, rowIndex) => `visual-row-${rowIndex}`,
      getRowAriaLabel: (row, rowIndex) => `Visual row ${rowIndex + 1}: ${row.customer}`,
      'aria-label': 'Orders',
    });

    const firstSortedRow = container.querySelector<HTMLElement>('[role="row"][aria-rowindex="2"]');
    const secondSortedRow = container.querySelector<HTMLElement>('[role="row"][aria-rowindex="3"]');

    expect(firstSortedRow?.classList.contains('visual-row-0')).toBe(true);
    expect(firstSortedRow?.getAttribute('aria-label')).toBe('Visual row 1: Ada Lovelace');
    expect(secondSortedRow?.classList.contains('visual-row-1')).toBe(true);
    expect(secondSortedRow?.getAttribute('aria-label')).toBe('Visual row 2: Alan Turing');
  });

  test('sorts duplicate row ids without reusing keyed DOM rows', () => {
    const { container } = render(OrderDataGrid, {
      rows: [
        {
          id: 'duplicate',
          customer: 'Grace Hopper',
          total: 256,
          createdAt: new Date('2026-02-01'),
        },
        {
          id: 'duplicate',
          customer: 'Ada Lovelace',
          total: 124,
          createdAt: new Date('2026-01-01'),
        },
      ],
      columns,
      sortModel: [{ key: 'customer', direction: 'ascending' }],
      getRowId: getOrderId,
      'aria-label': 'Orders',
    });

    const cells = Array.from(container.querySelectorAll('[role="gridcell"][aria-colindex="1"]'));
    const cellIds = cells.map((cell) => cell.id);

    expect(cells.map((cell) => cell.textContent?.trim())).toEqual(['Ada Lovelace', 'Grace Hopper']);
    expect(new Set(cellIds).size).toBe(cellIds.length);
  });
});
