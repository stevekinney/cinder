/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: DataTable } = await import('./data-table.svelte');

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'role', label: 'Role' },
  { key: 'commits', label: 'Commits', sortable: true, align: 'end' as const },
];

const rows = [
  { name: 'Ada Lovelace', role: 'Mathematician', commits: 142 },
  { name: 'Grace Hopper', role: 'Computer Scientist', commits: 98 },
];

describe('DataTable — table structure', () => {
  test('renders a semantic <table> element', () => {
    const { container } = render(DataTable, { columns, rows });
    expect(container.querySelector('table')).not.toBeNull();
  });

  test('renders <thead> and <tbody>', () => {
    const { container } = render(DataTable, { columns, rows });
    expect(container.querySelector('thead')).not.toBeNull();
    expect(container.querySelector('tbody')).not.toBeNull();
  });

  test('renders a <caption> when caption prop is supplied', () => {
    const { container } = render(DataTable, { columns, rows, caption: 'Contributor roster' });
    const caption = container.querySelector('caption');
    expect(caption).not.toBeNull();
    expect(caption?.textContent?.trim()).toBe('Contributor roster');
  });

  test('renders no <caption> when caption prop is omitted', () => {
    const { container } = render(DataTable, { columns, rows });
    expect(container.querySelector('caption')).toBeNull();
  });

  test('renders one <tr> in the header per column set', () => {
    const { container } = render(DataTable, { columns, rows });
    expect(container.querySelectorAll('thead tr').length).toBe(1);
  });

  test('renders one <tr> in the body per row', () => {
    const { container } = render(DataTable, { columns, rows });
    expect(container.querySelectorAll('tbody tr').length).toBe(rows.length);
  });
});

describe('DataTable — column headers', () => {
  test('renders one <th scope="col"> per column in the header', () => {
    const { container } = render(DataTable, { columns, rows });
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    expect(headerCells.length).toBe(columns.length);
    for (const cell of headerCells) {
      expect(cell.getAttribute('scope')).toBe('col');
    }
  });

  test('header cells contain the column labels', () => {
    const { container } = render(DataTable, { columns, rows });
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    expect(headerCells[0]?.textContent?.trim()).toContain('Name');
    expect(headerCells[1]?.textContent?.trim()).toContain('Role');
    expect(headerCells[2]?.textContent?.trim()).toContain('Commits');
  });

  test('sortable header cells contain a sort button', () => {
    const { container } = render(DataTable, { columns, rows });
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    // Name and Commits are sortable
    expect(headerCells[0]?.querySelector('button')).not.toBeNull();
    expect(headerCells[2]?.querySelector('button')).not.toBeNull();
    // Role is not sortable
    expect(headerCells[1]?.querySelector('button')).toBeNull();
  });

  test('sortable header cells default to aria-sort="none"', () => {
    const { container } = render(DataTable, { columns, rows });
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    expect(headerCells[0]?.getAttribute('aria-sort')).toBe('none');
    expect(headerCells[2]?.getAttribute('aria-sort')).toBe('none');
  });

  test('non-sortable header cells have no aria-sort attribute', () => {
    const { container } = render(DataTable, { columns, rows });
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    expect(headerCells[1]?.getAttribute('aria-sort')).toBeNull();
  });

  test('aria-sort reflects the bound sort state for the active column', () => {
    const { container } = render(DataTable, {
      columns,
      rows,
      sort: { column: 'name', direction: 'ascending' },
    });
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    expect(headerCells[0]?.getAttribute('aria-sort')).toBe('ascending');
    expect(headerCells[2]?.getAttribute('aria-sort')).toBe('none');
  });
});

describe('DataTable — sort interaction', () => {
  test('clicking a sortable header updates aria-sort to ascending', async () => {
    const { container } = render(DataTable, { columns, rows });
    const button = container.querySelector('thead th button') as HTMLButtonElement;
    await fireEvent.click(button);
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    expect(headerCells[0]?.getAttribute('aria-sort')).toBe('ascending');
  });

  test('clicking an ascending column header toggles to descending', async () => {
    const { container } = render(DataTable, {
      columns,
      rows,
      sort: { column: 'name', direction: 'ascending' },
    });
    const button = container.querySelector('thead th button') as HTMLButtonElement;
    await fireEvent.click(button);
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    expect(headerCells[0]?.getAttribute('aria-sort')).toBe('descending');
  });

  test('never reorders rows itself — clicking a sort header leaves body order unchanged', async () => {
    // DataTable is controlled: it reports sort intent via the bindable `sort`
    // prop but the consumer owns row ordering. Clicking a sortable header must
    // NOT reorder the DOM rows — only the caller re-sorting `rows` does that.
    const { container } = render(DataTable, { columns, rows });
    const rowHeaderText = () =>
      Array.from(container.querySelectorAll('tbody tr th[scope="row"]')).map(
        (cell) => cell.textContent,
      );
    const before = rowHeaderText();
    expect(before).toEqual(['Ada Lovelace', 'Grace Hopper']);
    // 'commits' is sortable and would, if the component sorted internally,
    // reorder Grace (98) above Ada (142) on ascending.
    const commitsButton = container.querySelectorAll('thead th button')[1] as HTMLButtonElement;
    await fireEvent.click(commitsButton);
    expect(rowHeaderText()).toEqual(before);
  });
});

describe('DataTable — row header cells (scope="row")', () => {
  test('first column body cells are <th scope="row"> by default', () => {
    const simpleColumns = [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
    ];
    const simpleRows = [{ name: 'Ada Lovelace', role: 'Mathematician' }];
    const { container } = render(DataTable, { columns: simpleColumns, rows: simpleRows });
    const bodyRows = container.querySelectorAll('tbody tr');
    const firstCell = bodyRows[0]?.querySelector('th');
    expect(firstCell).not.toBeNull();
    expect(firstCell?.getAttribute('scope')).toBe('row');
  });

  test('non-rowHeader columns render as <td>', () => {
    const simpleColumns = [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
    ];
    const simpleRows = [{ name: 'Ada Lovelace', role: 'Mathematician' }];
    const { container } = render(DataTable, { columns: simpleColumns, rows: simpleRows });
    const bodyRows = container.querySelectorAll('tbody tr');
    const cells = Array.from(bodyRows[0]?.querySelectorAll('td') ?? []);
    expect(cells.length).toBe(1); // only 'role' is <td>
    expect(cells[0]?.textContent?.trim()).toBe('Mathematician');
  });

  test('explicit rowHeader: true on a non-first column makes that column the row header', () => {
    const customColumns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', rowHeader: true },
      { key: 'role', label: 'Role' },
    ];
    const customRows = [{ id: '1', name: 'Ada Lovelace', role: 'Mathematician' }];
    const { container } = render(DataTable, { columns: customColumns, rows: customRows });
    const bodyRows = container.querySelectorAll('tbody tr');
    const cells = Array.from(bodyRows[0]?.querySelectorAll('th, td') ?? []);
    // id → td, name → th scope=row, role → td
    expect(cells[0]?.tagName.toLowerCase()).toBe('td');
    expect(cells[1]?.tagName.toLowerCase()).toBe('th');
    expect(cells[1]?.getAttribute('scope')).toBe('row');
    expect(cells[2]?.tagName.toLowerCase()).toBe('td');
  });

  test('row header cell contains the correct value', () => {
    const { container } = render(DataTable, { columns, rows });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const firstRowHeader = bodyRows[0]?.querySelector('th[scope="row"]');
    expect(firstRowHeader?.textContent?.trim()).toBe('Ada Lovelace');
  });
});

describe('DataTable — data values', () => {
  test('all column values are rendered in each body row', () => {
    const { container } = render(DataTable, { columns, rows });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const firstRowCells = Array.from(bodyRows[0]?.querySelectorAll('th, td') ?? []);
    const texts = firstRowCells.map((cell) => cell.textContent?.trim());
    expect(texts).toContain('Ada Lovelace');
    expect(texts).toContain('Mathematician');
    expect(texts).toContain('142');
  });

  test('second row renders distinct values', () => {
    const { container } = render(DataTable, { columns, rows });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const secondRowCells = Array.from(bodyRows[1]?.querySelectorAll('th, td') ?? []);
    const texts = secondRowCells.map((cell) => cell.textContent?.trim());
    expect(texts).toContain('Grace Hopper');
    expect(texts).toContain('Computer Scientist');
    expect(texts).toContain('98');
  });

  test('column count matches between header and body rows', () => {
    const { container } = render(DataTable, { columns, rows });
    const headerCellCount = container.querySelectorAll('thead th').length;
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    for (const row of bodyRows) {
      const cellCount = row.querySelectorAll('th, td').length;
      expect(cellCount).toBe(headerCellCount);
    }
  });
});

describe('DataTable — scrollable', () => {
  test('scrollable=false does not add cinder-table-scroll class', () => {
    const { container } = render(DataTable, { columns, rows });
    expect(container.querySelector('.cinder-table-scroll')).toBeNull();
  });

  test('scrollable=true wraps the table in a .cinder-table-scroll container', () => {
    const { container } = render(DataTable, { columns, rows, scrollable: true });
    const wrapper = container.querySelector('.cinder-table-scroll');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('table')).not.toBeNull();
  });
});

describe('DataTable — rest props', () => {
  test('forwards arbitrary HTML attributes to the root wrapper <div>', () => {
    const { container } = render(DataTable, {
      columns,
      rows,
      id: 'contributors',
      'data-testid': 'roster',
    });
    const wrapper = container.querySelector('.cinder-data-table');
    expect(wrapper?.getAttribute('id')).toBe('contributors');
    expect(wrapper?.getAttribute('data-testid')).toBe('roster');
    // The component's own class survives alongside the forwarded attributes.
    expect(wrapper?.classList.contains('cinder-data-table')).toBe(true);
  });

  test('forwards arbitrary HTML attributes to the scrollable wrapper <div>', () => {
    const { container } = render(DataTable, {
      columns,
      rows,
      scrollable: true,
      id: 'contributors',
    });
    const wrapper = container.querySelector('.cinder-table-scroll');
    expect(wrapper?.classList.contains('cinder-data-table')).toBe(true);
    expect(wrapper?.getAttribute('id')).toBe('contributors');
  });
});

describe('DataTable — density', () => {
  test('density prop is forwarded to the table element', () => {
    const { container } = render(DataTable, { columns, rows, density: 'condensed' });
    expect(container.querySelector('table')?.getAttribute('data-cinder-density')).toBe('condensed');
  });

  test('density defaults to comfortable', () => {
    const { container } = render(DataTable, { columns, rows });
    expect(container.querySelector('table')?.getAttribute('data-cinder-density')).toBe(
      'comfortable',
    );
  });
});

describe('DataTable — align mapping', () => {
  test('align="end" column header and body cell carry data-cinder-align="right"', () => {
    const { container } = render(DataTable, { columns, rows });
    // 'commits' column has align='end' → should map to 'right'
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    expect(headerCells[2]?.getAttribute('data-cinder-align')).toBe('right');
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const commitsCells = bodyRows.map((row) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      return cells[2];
    });
    for (const cell of commitsCells) {
      expect(cell?.getAttribute('data-cinder-align')).toBe('right');
    }
  });

  test('align="start" column header and body cell carry data-cinder-align="left"', () => {
    const startColumns = [{ key: 'name', label: 'Name', align: 'start' as const }];
    const startRows = [{ name: 'Ada' }];
    const { container } = render(DataTable, { columns: startColumns, rows: startRows });
    const headerCell = container.querySelector('thead th');
    expect(headerCell?.getAttribute('data-cinder-align')).toBe('left');
  });
});
