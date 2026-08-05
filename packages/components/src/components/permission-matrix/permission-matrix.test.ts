/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: PermissionMatrix } = await import('./permission-matrix.svelte');

afterEach(() => cleanup());

const rows = [
  { id: 'workflows-admin', label: 'workflows:admin' },
  { id: 'workflows-read', label: 'workflows:read' },
  { id: 'runs-admin', label: 'runs:admin' },
];

const columns = [
  { id: 'cancel', label: 'cancel' },
  { id: 'retry', label: 'retry' },
  { id: 'inspect', label: 'inspect' },
];

function getCellState(row: (typeof rows)[number], column: (typeof columns)[number]) {
  if (row.id === 'workflows-admin' && column.id === 'cancel') return 'granted';
  if (row.id === 'workflows-read' && column.id === 'retry') return 'denied';
  return 'not-applicable';
}

describe('PermissionMatrix', () => {
  test('renders one labeled cell for every row and column with discrete state tokens', () => {
    const { container, getByRole } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
      onCellClick: mock(),
    });

    expect(container.querySelectorAll('.cinder-permission-matrix__cell-control').length).toBe(9);
    const grantedCell = getByRole('button', { name: 'workflows:admin × cancel: granted' });
    const deniedCell = getByRole('button', { name: 'workflows:read × retry: denied' });
    const notApplicableCell = getByRole('button', {
      name: 'runs:admin × inspect: not applicable',
    });

    expect(grantedCell.getAttribute('data-cinder-state')).toBe('granted');
    expect(grantedCell.textContent).toContain('granted');
    expect(grantedCell.querySelector('svg')).not.toBeNull();
    expect(deniedCell.getAttribute('data-cinder-state')).toBe('denied');
    expect(deniedCell.textContent).toContain('denied');
    expect(deniedCell.querySelector('svg')).not.toBeNull();
    expect(notApplicableCell.getAttribute('data-cinder-state')).toBe('not-applicable');
    expect(notApplicableCell.textContent).toContain('not applicable');
    expect(notApplicableCell.querySelector('svg')).not.toBeNull();
  });

  test('renders row and column headers with native table header semantics', () => {
    const { container } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
    });

    const columnHeaders = [...container.querySelectorAll('thead th[scope="col"]')].map((header) =>
      header.textContent?.trim(),
    );
    const rowHeaders = [...container.querySelectorAll('tbody th[scope="row"]')].map((header) =>
      header.textContent?.trim(),
    );

    expect(columnHeaders).toEqual(['Scope', 'cancel', 'retry', 'inspect']);
    expect(rowHeaders).toEqual(['workflows:admin', 'workflows:read', 'runs:admin']);
  });

  test('supports a custom row header label for non-scope matrices', () => {
    const { container } = render(PermissionMatrix, {
      label: 'Role matrix',
      rows,
      columns,
      getCellState,
      rowHeaderLabel: 'Role',
    });

    expect(container.querySelector('thead th[scope="col"]')?.textContent?.trim()).toBe('Role');
  });

  test('clicking a cell invokes the handler with the correct row and column identity', async () => {
    const onCellClick = mock();
    const { getByRole } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
      onCellClick,
    });

    await fireEvent.click(getByRole('button', { name: 'workflows:read × retry: denied' }));

    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick).toHaveBeenCalledWith(rows[1], columns[1], 'denied');
  });

  test('custom state labels update visible and accessible cell text', () => {
    const { getByRole } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
      onCellClick: mock(),
      stateLabels: {
        granted: 'Allowed',
        denied: 'Blocked',
        'not-applicable': 'Unavailable',
      },
    });

    const grantedCell = getByRole('button', { name: 'workflows:admin × cancel: Allowed' });
    const deniedCell = getByRole('button', { name: 'workflows:read × retry: Blocked' });
    const unavailableCell = getByRole('button', {
      name: 'runs:admin × inspect: Unavailable',
    });

    expect(grantedCell.textContent).toContain('Allowed');
    expect(deniedCell.textContent).toContain('Blocked');
    expect(unavailableCell.textContent).toContain('Unavailable');
  });

  test('read-only cells are not focusable buttons when no click handler is provided', () => {
    const { container, getByRole, queryByRole } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
    });

    expect(queryByRole('button', { name: 'workflows:admin × cancel: granted' })).toBeNull();
    expect(getByRole('cell', { name: 'workflows:admin × cancel: granted' })).toBeTruthy();
    expect(container.querySelectorAll('button.cinder-permission-matrix__cell-control').length).toBe(
      0,
    );
  });

  test('td never carries aria-label; the interactive button and read-only span each carry their own', () => {
    const { container: interactiveContainer } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
      onCellClick: mock(),
    });

    // No <td> ever duplicates the label its interactive descendant already carries.
    expect(
      Array.from(interactiveContainer.querySelectorAll('td')).every(
        (cell) => !cell.hasAttribute('aria-label'),
      ),
    ).toBe(true);
    const button = interactiveContainer.querySelector(
      '[data-cinder-row="workflows-admin"][data-cinder-column="cancel"].cinder-permission-matrix__cell-control',
    );
    expect(button?.tagName.toLowerCase()).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('workflows:admin × cancel: granted');

    cleanup();

    const { container: readOnlyContainer } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
    });

    expect(
      Array.from(readOnlyContainer.querySelectorAll('td')).every(
        (cell) => !cell.hasAttribute('aria-label'),
      ),
    ).toBe(true);
    const span = readOnlyContainer.querySelector(
      '[data-cinder-row="workflows-admin"][data-cinder-column="cancel"].cinder-permission-matrix__cell-control',
    );
    expect(span?.tagName.toLowerCase()).toBe('span');
    expect(span?.getAttribute('aria-label')).toBe('workflows:admin × cancel: granted');
  });

  test('renders a 22 by 30 matrix inside a horizontal scroll container', () => {
    const largeRows = Array.from({ length: 22 }, (_, index) => ({
      id: `scope-${index + 1}`,
      label: `scope:${index + 1}`,
    }));
    const largeColumns = Array.from({ length: 30 }, (_, index) => ({
      id: `operation-${index + 1}`,
      label: `operation:${index + 1}`,
    }));

    const { container } = render(PermissionMatrix, {
      label: 'Large scope matrix',
      rows: largeRows,
      columns: largeColumns,
      getCellState: (row: (typeof largeRows)[number], column: (typeof largeColumns)[number]) =>
        row.id === 'scope-22' && column.id === 'operation-30' ? 'granted' : 'not-applicable',
      onCellClick: mock(),
    });

    const grantedCell = container.querySelector(
      '[data-cinder-row="scope-22"][data-cinder-column="operation-30"]',
    );

    expect(container.querySelector('[data-cinder-scroll-container]')).not.toBeNull();
    expect(container.querySelectorAll('.cinder-permission-matrix__cell-control').length).toBe(660);
    expect(grantedCell?.getAttribute('aria-label')).toBe('scope:22 × operation:30: granted');
    expect(grantedCell?.getAttribute('data-cinder-state')).toBe('granted');
    expect(container.querySelector('tbody th[scope="row"]')?.textContent).toContain('scope:1');
    expect(container.querySelector('thead th[scope="col"]:last-child')?.textContent).toContain(
      'operation:30',
    );
  });

  test('each cell exposes an accessible name with row, column, and state', () => {
    const { getByRole } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
      onCellClick: mock(),
    });

    expect(getByRole('button', { name: 'workflows:admin × cancel: granted' })).toBeTruthy();
    expect(getByRole('button', { name: 'workflows:read × retry: denied' })).toBeTruthy();
    expect(getByRole('button', { name: 'runs:admin × inspect: not applicable' })).toBeTruthy();
  });

  test('shows the literal "Loading matrix…" fallback text when loading with no loadingContent snippet', () => {
    const { container } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
      loading: true,
    });

    expect(container.querySelector('.cinder-permission-matrix__state')?.textContent).toBe(
      'Loading matrix…',
    );
    expect(container.querySelector('table')).toBeNull();
  });

  test('shows the literal "No matrix data" fallback text when rows and columns are empty with no empty snippet', () => {
    const { container } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows: [],
      columns: [],
      getCellState,
    });

    expect(container.querySelector('.cinder-permission-matrix__state')?.textContent).toBe(
      'No matrix data',
    );
    expect(container.querySelector('table')).toBeNull();
  });

  test('renders the description paragraph and points the figure aria-describedby at its id', () => {
    const { container } = render(PermissionMatrix, {
      label: 'Scope matrix',
      rows,
      columns,
      getCellState,
      description: 'Row × column access grants for this workspace.',
    });

    const figure = container.querySelector('figure.cinder-permission-matrix');
    const description = container.querySelector('.cinder-permission-matrix__description');

    expect(description?.textContent).toBe('Row × column access grants for this workspace.');
    const describedBy = figure?.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(describedBy).not.toBe('');
    expect(description?.getAttribute('id')).toBe(describedBy);
  });
});
