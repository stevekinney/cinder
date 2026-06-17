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
  { key: 'total', header: 'Total', sortable: true },
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
    expect(compareDataGridValues(new Date('2026-01-01'), new Date('2026-02-01'))).toBeLessThan(0);
    expect(compareDataGridValues('item 2', 'item 10')).toBeLessThan(0);
    expect(compareDataGridValues(undefined, 'value')).toBeGreaterThan(0);
  });

  test('toggles single and multi-sort models without mutating the current model', () => {
    const original: DataGridSortModel = [{ key: 'customer', direction: 'ascending' }];
    const descending = getNextDataGridSortModel(original, 'customer', false);
    const multi = getNextDataGridSortModel(descending, 'total', true);

    expect(original).toEqual([{ key: 'customer', direction: 'ascending' }]);
    expect(descending).toEqual([{ key: 'customer', direction: 'descending' }]);
    expect(multi).toEqual([
      { key: 'customer', direction: 'descending' },
      { key: 'total', direction: 'ascending' },
    ]);
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
    const sortedIndices = getSortedDataGridRowIndices(
      rows,
      [
        {
          key: 'customer',
          header: 'Customer',
          sortable: true,
          sortComparator: (leftValue, rightValue) =>
            String(leftValue).length - String(rightValue).length,
        },
      ],
      [{ key: 'customer', direction: 'ascending' }],
    );

    expect(sortedIndices).toEqual([2, 0, 1]);
  });
});

describe('DataGrid sort rendering', () => {
  test('sorts rows and cycles aria-sort from header clicks', async () => {
    const changes: DataGridSortModel[] = [];
    const onSortModelChange = mock((nextSortModel: DataGridSortModel) => {
      changes.push(nextSortModel);
    });
    const { container } = render(OrderDataGrid, {
      rows,
      columns,
      getRowId: getOrderId,
      onSortModelChange,
      'aria-label': 'Orders',
    });

    const customerHeader = container.querySelector<HTMLElement>(
      '[role="columnheader"][aria-colindex="1"]',
    );
    const customerButton = customerHeader?.querySelector('button');

    expect(customerHeader?.getAttribute('aria-sort')).toBe('none');
    expect(getColumnText(container, 1)).toEqual(['Grace Hopper', 'Ada Lovelace', 'Alan Turing']);

    await fireEvent.click(customerButton!);
    expect(customerHeader?.getAttribute('aria-sort')).toBe('ascending');
    expect(getColumnText(container, 1)).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);

    await fireEvent.click(customerButton!);
    expect(customerHeader?.getAttribute('aria-sort')).toBe('descending');
    expect(getColumnText(container, 1)).toEqual(['Grace Hopper', 'Alan Turing', 'Ada Lovelace']);

    await fireEvent.click(customerButton!);
    expect(customerHeader?.getAttribute('aria-sort')).toBe('none');
    expect(getColumnText(container, 1)).toEqual(['Grace Hopper', 'Ada Lovelace', 'Alan Turing']);
    expect(changes).toEqual([
      [{ key: 'customer', direction: 'ascending' }],
      [{ key: 'customer', direction: 'descending' }],
      [],
    ]);
  });

  test('supports shift-click multi-sort priority and omits aria-sort on non-sortable columns', async () => {
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
    expect(customerHeader?.getAttribute('aria-sort')).toBe('ascending');
    expect(identifierHeader?.hasAttribute('aria-sort')).toBe(false);
    expect(totalHeader?.textContent).toContain('1');
    expect(customerHeader?.textContent).toContain('2');
    expect(getColumnText(container, 1)).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);
    expect(getColumnText(container, 2)).toEqual(['124', '124', '256']);
  });
});
