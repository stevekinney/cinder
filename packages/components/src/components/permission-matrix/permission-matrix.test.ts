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

  test('renders a 22 by 30 matrix inside a horizontal scroll container', () => {
    const largeRows = Array.from({ length: 22 }, (_, index) => ({
      id: `scope-${index + 1}`,
      label: `scope:${index + 1}`,
    }));
    const largeColumns = Array.from({ length: 30 }, (_, index) => ({
      id: `operation-${index + 1}`,
      label: `operation:${index + 1}`,
    }));

    const { container, getByRole } = render(PermissionMatrix, {
      label: 'Large scope matrix',
      rows: largeRows,
      columns: largeColumns,
      getCellState: (row: (typeof largeRows)[number], column: (typeof largeColumns)[number]) =>
        row.id === 'scope-22' && column.id === 'operation-30' ? 'granted' : 'not-applicable',
      onCellClick: mock(),
    });

    expect(container.querySelector('[data-cinder-scroll-container]')).not.toBeNull();
    expect(container.querySelectorAll('.cinder-permission-matrix__cell-control').length).toBe(660);
    expect(getByRole('button', { name: 'scope:22 × operation:30: granted' })).toBeTruthy();
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
});
