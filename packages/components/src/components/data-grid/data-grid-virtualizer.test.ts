/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Component } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';
import type { DataGridColumnDef, DataGridProps } from './data-grid.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: DataGrid } = await import('./data-grid.svelte');
const sourcePath = new URL('./data-grid.svelte', import.meta.url).pathname;

afterEach(() => cleanup());

type LogRow = {
  id: string;
  message: string;
  owner: string;
};

const columns: DataGridColumnDef<LogRow>[] = [
  { key: 'message', header: 'Message', width: 180 },
  { key: 'owner', header: 'Owner', width: 120 },
];

const getLogRowId = (row: LogRow) => row.id;
const LogDataGrid = DataGrid as Component<DataGridProps<LogRow>>;

function makeRows(count: number): LogRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    message: `Message ${index}`,
    owner: `Owner ${index % 5}`,
  }));
}

function dataRows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('.cinder-data-grid__body [role="row"]'),
  );
}

describe('DataGrid row virtualization', () => {
  test('renders only a row window while aria counts reflect the full dataset', async () => {
    const rows = makeRows(1_000);
    const { container } = render(LogDataGrid, {
      rows,
      columns,
      getRowId: getLogRowId,
      virtualizeRows: true,
      rowHeight: 20,
      'aria-label': 'Logs',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    await waitFor(() => expect(dataRows(container).length).toBeGreaterThan(0));

    expect(grid?.getAttribute('aria-rowcount')).toBe('1001');
    expect(grid?.getAttribute('aria-colcount')).toBe('2');
    expect(dataRows(container).length).toBeLessThan(1_000);
    expect(dataRows(container).length).toBeLessThanOrEqual(25);
    expect(dataRows(container)[0]?.getAttribute('aria-rowindex')).toBe('2');
  });

  test('scrolling shifts rendered rows while aria-rowindex stays full-dataset based', async () => {
    const rows = makeRows(1_000);
    const { container } = render(LogDataGrid, {
      rows,
      columns,
      getRowId: getLogRowId,
      virtualizeRows: true,
      rowHeight: 20,
      'aria-label': 'Logs',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) throw new Error('Expected DataGrid root');

    grid.scrollTop = 1_000;
    await fireEvent.scroll(grid);

    await waitFor(() =>
      expect(dataRows(container).some((row) => row.textContent?.includes('Message 50'))).toBe(true),
    );
    const row = dataRows(container).find((element) => element.textContent?.includes('Message 50'));

    expect(row?.getAttribute('aria-rowindex')).toBe('52');
    expect(grid.getAttribute('aria-rowcount')).toBe('1001');
    expect(
      dataRows(container).every((element) => Number(element.getAttribute('aria-rowindex')) > 40),
    ).toBe(true);
  });

  test('keyboard navigation scrolls an off-window active row into the rendered window', async () => {
    const rows = makeRows(100);
    const { container } = render(LogDataGrid, {
      rows,
      columns,
      getRowId: getLogRowId,
      virtualizeRows: true,
      rowHeight: 20,
      'aria-label': 'Logs',
    });

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) throw new Error('Expected DataGrid root');

    await fireEvent.keyDown(grid, { key: 'End', ctrlKey: true });

    await waitFor(() =>
      expect(
        container.querySelector(`#${grid.getAttribute('aria-activedescendant')}`),
      ).not.toBeNull(),
    );
    expect(grid.getAttribute('aria-activedescendant')).toContain('72_6f_77_2d_39_39');
    expect(dataRows(container).some((row) => row.textContent?.includes('Message 99'))).toBe(true);
  });

  test('warns and falls back when row virtualization omits fixed rowHeight', () => {
    const warnings: unknown[] = [];
    const warnSpy = mock((message?: unknown) => {
      warnings.push(message);
    });
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      const { container } = render(LogDataGrid, {
        rows: makeRows(100),
        columns,
        getRowId: getLogRowId,
        virtualizeRows: true,
        'aria-label': 'Logs',
      });

      expect(dataRows(container).length).toBeGreaterThan(0);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnings[0])).toContain('rowHeight');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('keeps full ARIA counts through server render and hydration', async () => {
    const result = await renderThenHydrate(LogDataGrid, sourcePath, {
      rows: makeRows(100),
      columns,
      getRowId: getLogRowId,
      virtualizeRows: true,
      rowHeight: 20,
      'aria-label': 'Logs',
    });

    try {
      expect(result.ssrHtml).toContain('role="grid"');
      expect(result.ssrHtml).toContain('aria-rowcount="101"');
      expect(result.ssrHtml).toContain('aria-colcount="2"');
      expect(result.ssrHtml).not.toContain('role="gridcell"');

      const grid = result.container.querySelector('[role="grid"]');
      expect(grid?.getAttribute('aria-rowcount')).toBe('101');
      expect(grid?.getAttribute('aria-colcount')).toBe('2');
    } finally {
      result.cleanup();
    }
  });
});
