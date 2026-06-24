/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');
const sourcePath = new URL('./data-grid.svelte', import.meta.url).pathname;

type Issue = {
  id: string;
  title: string;
  owner: string;
};

const columns: DataGridColumnDef<Issue>[] = [
  { key: 'title', header: 'Title' },
  { key: 'owner', header: 'Owner' },
];

const rows: Issue[] = [
  { id: 'issue 1', title: 'Keyboard navigation', owner: 'Ada' },
  { id: 'issue 2', title: 'Range selection', owner: 'Grace' },
];

const getIssueId = (row: Issue) => row.id;
const IssueDataGrid = DataGrid as Component<DataGridProps<Issue>>;

describe('DataGrid ARIA', () => {
  test('reports row and column counts from props', () => {
    const { container } = render(IssueDataGrid, {
      rows,
      columns,
      getRowId: getIssueId,
      'aria-label': 'Issues',
    });

    const grid = container.querySelector('[role="grid"]');

    expect(grid?.getAttribute('aria-rowcount')).toBe(String(rows.length + 1));
    expect(grid?.getAttribute('aria-colcount')).toBe(String(columns.length));
  });

  test('announces multiselectable grid behavior before a range is selected', () => {
    const { container } = render(IssueDataGrid, {
      rows,
      columns,
      getRowId: getIssueId,
      'aria-label': 'Issues',
    });

    expect(container.querySelector('[role="grid"]')?.getAttribute('aria-multiselectable')).toBe(
      'true',
    );
  });

  test('assigns one-based row and column indexes', () => {
    const { container } = render(IssueDataGrid, {
      rows,
      columns,
      getRowId: getIssueId,
      'aria-label': 'Issues',
    });

    const headerRow = container.querySelector('[role="row"][aria-rowindex="1"]');
    const dataRows = Array.from(container.querySelectorAll('[role="row"]')).slice(1);
    const firstDataCells = Array.from(dataRows[0]?.querySelectorAll('[role="gridcell"]') ?? []);

    expect(headerRow).not.toBeNull();
    expect(dataRows.map((row) => row.getAttribute('aria-rowindex'))).toEqual(['2', '3']);
    expect(firstDataCells.map((cell) => cell.getAttribute('aria-colindex'))).toEqual(['1', '2']);
  });

  test('renders row-header columns with role=rowheader', () => {
    const { container } = render(IssueDataGrid, {
      rows,
      columns: [
        { key: 'title', header: 'Title', rowHeader: true },
        { key: 'owner', header: 'Owner' },
      ],
      getRowId: getIssueId,
      'aria-label': 'Issues',
    });

    const firstDataRow = container.querySelector('[role="row"][aria-rowindex="2"]');
    const rowHeader = firstDataRow?.querySelector('[role="rowheader"]');
    const gridCells = firstDataRow?.querySelectorAll('[role="gridcell"]');

    expect(rowHeader?.textContent?.trim()).toBe('Keyboard navigation');
    expect(rowHeader?.getAttribute('aria-colindex')).toBe('1');
    expect(gridCells).toHaveLength(1);
    expect(gridCells?.[0]?.textContent?.trim()).toBe('Ada');
  });

  test('wraps body rows in a rowgroup owned by the grid', () => {
    const { container } = render(IssueDataGrid, {
      rows,
      columns,
      getRowId: getIssueId,
      'aria-label': 'Issues',
    });

    const bodyRowGroup = container.querySelector('.cinder-data-grid__body[role="rowgroup"]');

    expect(bodyRowGroup).not.toBeNull();
    expect(bodyRowGroup?.querySelectorAll('[role="row"]').length).toBe(rows.length);
  });

  test('uses active descendant on the root grid and keeps cells out of the tab order', () => {
    const { container } = render(IssueDataGrid, {
      rows,
      columns,
      getRowId: getIssueId,
      'aria-label': 'Issues',
    });

    const grid = container.querySelector('[role="grid"]');
    const firstCell = container.querySelector('[role="gridcell"]');
    const activeId = grid?.getAttribute('aria-activedescendant');

    expect(grid?.getAttribute('tabindex')).toBe('0');
    expect(activeId).toBe(firstCell?.getAttribute('id'));
    expect(firstCell?.getAttribute('tabindex')).toBe('-1');
  });

  test('omits active descendant when there are no data rows', () => {
    const { container } = render(IssueDataGrid, {
      rows: [],
      columns,
      getRowId: getIssueId,
      'aria-label': 'Issues',
    });

    const grid = container.querySelector('[role="grid"]');

    expect(grid?.getAttribute('aria-rowcount')).toBe('1');
    expect(grid?.getAttribute('aria-colcount')).toBe('2');
    expect(grid?.hasAttribute('aria-activedescendant')).toBe(false);
    expect(container.querySelectorAll('[role="gridcell"]').length).toBe(0);
  });

  test('supports aria-labelledby without forcing aria-label', () => {
    const { container } = render(IssueDataGrid, {
      rows,
      columns,
      getRowId: getIssueId,
      'aria-labelledby': 'issues-heading',
    });

    const grid = container.querySelector('[role="grid"]');

    expect(grid?.getAttribute('aria-labelledby')).toBe('issues-heading');
    expect(grid?.hasAttribute('aria-label')).toBe(false);
  });

  test('omits whitespace-only row aria labels', () => {
    const { container } = render(IssueDataGrid, {
      rows,
      columns,
      getRowId: getIssueId,
      getRowAriaLabel: () => '   ',
      'aria-label': 'Issues',
    });

    const firstDataRow = container.querySelector('[role="row"][aria-rowindex="2"]');

    expect(firstDataRow?.hasAttribute('aria-label')).toBe(false);
  });

  test('omits whitespace-only accessible-name attributes and warns', () => {
    const warningMessages: unknown[] = [];
    const warnSpy = mock((message?: unknown) => {
      warningMessages.push(message);
    });
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      const { container } = render(IssueDataGrid, {
        rows,
        columns,
        getRowId: getIssueId,
        'aria-label': '   ',
        'aria-labelledby': '  ',
      });

      const grid = container.querySelector('[role="grid"]');

      expect(grid?.hasAttribute('aria-label')).toBe(false);
      expect(grid?.hasAttribute('aria-labelledby')).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warningMessages[0])).toStartWith('[cinder-data-grid]');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('keeps counts stable through server render and hydration', async () => {
    const result = await renderThenHydrate(IssueDataGrid, sourcePath, {
      rows: [],
      columns,
      getRowId: getIssueId,
      'aria-label': 'Issues',
    });

    try {
      expect(result.ssrHtml).toContain('role="grid"');
      expect(result.ssrHtml).toContain('aria-rowcount="1"');
      expect(result.ssrHtml).toContain('aria-colcount="2"');

      const grid = result.container.querySelector('[role="grid"]');
      expect(grid?.getAttribute('aria-rowcount')).toBe('1');
      expect(grid?.getAttribute('aria-colcount')).toBe('2');
    } finally {
      result.cleanup();
    }
  });
});
