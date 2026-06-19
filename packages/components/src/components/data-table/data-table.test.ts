/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: DataTable } = await import('./data-table.svelte');

afterEach(() => cleanup());

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'role', label: 'Role' },
  { key: 'commits', label: 'Commits', sortable: true, align: 'end' as const },
];

const rows = [
  { name: 'Ada Lovelace', role: 'Mathematician', commits: 142 },
  { name: 'Grace Hopper', role: 'Computer Scientist', commits: 98 },
];

function makeRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Person ${index}`,
    role: `Role ${index % 5}`,
    commits: index,
  }));
}

function bodyDataRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('tbody tr:not([aria-hidden="true"])'));
}

function rectWithHeight(height: number): DOMRect {
  return {
    bottom: height,
    height,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

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

describe('DataTable — virtualized rows', () => {
  test('windows <tbody> rows while preserving table and header semantics', async () => {
    const manyRows = makeRows(10_000);
    const { container } = render(DataTable, {
      columns,
      rows: manyRows,
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 2,
    });

    await waitFor(() => expect(bodyDataRows(container).length).toBeGreaterThan(0));

    const table = container.querySelector('table');
    expect(table?.getAttribute('aria-rowcount')).toBe('10001');
    expect(container.querySelectorAll('thead th[scope="col"]')).toHaveLength(columns.length);
    expect(bodyDataRows(container).length).toBeLessThan(10_000 / 10);
    expect(bodyDataRows(container).length).toBeLessThanOrEqual(14);
    expect(bodyDataRows(container)[0]?.getAttribute('aria-rowindex')).toBe('2');
    expect(bodyDataRows(container)[0]?.querySelector('th[scope="row"]')?.textContent).toContain(
      'Person 0',
    );
  });

  test('scrolling renders the expected row window with full-dataset row indexes', async () => {
    const { container } = render(DataTable, {
      columns,
      rows: makeRows(1_000),
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 2,
    });

    const wrapper = container.querySelector<HTMLElement>('.cinder-data-table');
    if (!wrapper) throw new Error('Expected DataTable wrapper');

    wrapper.scrollTop = 1_000;
    await fireEvent.scroll(wrapper);

    await waitFor(() =>
      expect(bodyDataRows(container).some((row) => row.textContent?.includes('Person 50'))).toBe(
        true,
      ),
    );
    const row = bodyDataRows(container).find((element) =>
      element.textContent?.includes('Person 50'),
    );

    expect(row?.getAttribute('aria-rowindex')).toBe('52');
    expect(container.querySelector('table')?.getAttribute('aria-rowcount')).toBe('1001');
  });

  test('sticky virtualized headers map scroll offsets directly to the body window', async () => {
    const { container } = render(DataTable, {
      columns,
      rows: makeRows(1_000),
      stickyHeader: true,
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 0,
    });

    const wrapper = container.querySelector<HTMLElement>('.cinder-data-table');
    const header = container.querySelector<HTMLElement>('thead');
    if (!wrapper || !header) throw new Error('Expected DataTable wrapper and header');

    header.getBoundingClientRect = () => rectWithHeight(40);
    wrapper.scrollTop = 1_000;
    await fireEvent.scroll(wrapper);

    await waitFor(() => expect(bodyDataRows(container)[0]?.textContent).toContain('Person 50'));
    expect(bodyDataRows(container)[0]?.getAttribute('aria-rowindex')).toBe('52');
  });

  test('captioned virtualized tables subtract caption and header before windowing body rows', async () => {
    const { container } = render(DataTable, {
      columns,
      rows: makeRows(1_000),
      caption: 'Workflow log tail',
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 0,
    });

    const wrapper = container.querySelector<HTMLElement>('.cinder-data-table');
    const caption = container.querySelector<HTMLElement>('caption');
    const header = container.querySelector<HTMLElement>('thead');
    if (!wrapper || !caption || !header) {
      throw new Error('Expected DataTable wrapper, caption, and header');
    }

    caption.getBoundingClientRect = () => rectWithHeight(40);
    header.getBoundingClientRect = () => rectWithHeight(40);
    wrapper.scrollTop = 1_000;
    await fireEvent.scroll(wrapper);

    await waitFor(() => expect(bodyDataRows(container)[0]?.textContent).toContain('Person 46'));
    expect(bodyDataRows(container)[0]?.getAttribute('aria-rowindex')).toBe('48');
  });

  test('sticky captioned virtualized tables subtract caption but not the sticky header', async () => {
    const { container } = render(DataTable, {
      columns,
      rows: makeRows(1_000),
      caption: 'Workflow log tail',
      stickyHeader: true,
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 0,
    });

    const wrapper = container.querySelector<HTMLElement>('.cinder-data-table');
    const caption = container.querySelector<HTMLElement>('caption');
    const header = container.querySelector<HTMLElement>('thead');
    if (!wrapper || !caption || !header) {
      throw new Error('Expected DataTable wrapper, caption, and header');
    }

    caption.getBoundingClientRect = () => rectWithHeight(40);
    header.getBoundingClientRect = () => rectWithHeight(40);
    wrapper.scrollTop = 1_000;
    await fireEvent.scroll(wrapper);

    await waitFor(() => expect(bodyDataRows(container)[0]?.textContent).toContain('Person 48'));
    expect(bodyDataRows(container)[0]?.getAttribute('aria-rowindex')).toBe('50');
  });

  test('captioned virtualized tables keep stickToBottom pinned after append', async () => {
    const view = render(DataTable, {
      columns,
      rows: makeRows(100),
      caption: 'Workflow log tail',
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 0,
      stickToBottom: true,
    });

    const wrapper = view.container.querySelector<HTMLElement>('.cinder-data-table');
    const caption = view.container.querySelector<HTMLElement>('caption');
    const header = view.container.querySelector<HTMLElement>('thead');
    if (!wrapper || !caption || !header) {
      throw new Error('Expected DataTable wrapper, caption, and header');
    }

    caption.getBoundingClientRect = () => rectWithHeight(40);
    header.getBoundingClientRect = () => rectWithHeight(40);
    wrapper.scrollTop = 1_880;
    await fireEvent.scroll(wrapper);

    await view.rerender({
      columns,
      rows: makeRows(101),
      caption: 'Workflow log tail',
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 0,
      stickToBottom: true,
    });
    await tick();

    await waitFor(() => expect(wrapper.scrollTop).toBe(1_900));
    expect(bodyDataRows(view.container).at(-1)?.textContent).toContain('Person 100');
  });

  test('virtualized scrolling composes consumer onscroll with the internal window update', async () => {
    let scrollCallCount = 0;
    const { container } = render(DataTable, {
      columns,
      rows: makeRows(1_000),
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 0,
      onscroll: () => {
        scrollCallCount += 1;
      },
    });

    const wrapper = container.querySelector<HTMLElement>('.cinder-data-table');
    if (!wrapper) throw new Error('Expected DataTable wrapper');

    wrapper.scrollTop = 1_000;
    await fireEvent.scroll(wrapper);

    expect(scrollCallCount).toBe(1);
    await waitFor(() => expect(bodyDataRows(container)[0]?.textContent).toContain('Person 50'));
  });

  test('keyboard navigation scrolls an off-window row into view and keeps it reachable', async () => {
    const { container } = render(DataTable, {
      columns,
      rows: makeRows(200),
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 2,
    });

    const firstRow = bodyDataRows(container)[0];
    if (!firstRow) throw new Error('Expected first rendered data row');
    firstRow.focus();
    expect(document.activeElement).toBe(firstRow);

    await fireEvent.keyDown(firstRow, { key: 'End' });

    await waitFor(() =>
      expect(bodyDataRows(container).some((row) => row.textContent?.includes('Person 199'))).toBe(
        true,
      ),
    );
    const lastRow = bodyDataRows(container).find((row) => row.textContent?.includes('Person 199'));
    if (!lastRow) throw new Error('Expected last rendered data row');
    expect(lastRow?.getAttribute('aria-rowindex')).toBe('201');
    expect(lastRow?.getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(lastRow);

    const wrapper = container.querySelector<HTMLElement>('.cinder-data-table');
    if (!wrapper) throw new Error('Expected DataTable wrapper');
    wrapper.scrollTop = 0;
    await fireEvent.scroll(wrapper);
    await waitFor(() =>
      expect(bodyDataRows(container).some((row) => row.textContent?.includes('Person 0'))).toBe(
        true,
      ),
    );
    expect(bodyDataRows(container)[0]?.getAttribute('tabindex')).toBe('0');

    wrapper.scrollTop = 3_800;
    await fireEvent.scroll(wrapper);
    await waitFor(() =>
      expect(bodyDataRows(container).some((row) => row.textContent?.includes('Person 199'))).toBe(
        true,
      ),
    );
    const restoredLastRow = bodyDataRows(container).find((row) =>
      row.textContent?.includes('Person 199'),
    );
    expect(restoredLastRow?.getAttribute('tabindex')).toBe('0');
  });

  test('Home returns a virtualized table to the top of the native scroll container', async () => {
    const { container } = render(DataTable, {
      columns,
      rows: makeRows(200),
      virtualized: true,
      rowHeight: 20,
      height: '200px',
      overscan: 0,
    });

    const wrapper = container.querySelector<HTMLElement>('.cinder-data-table');
    const header = container.querySelector<HTMLElement>('thead');
    const firstRow = bodyDataRows(container)[0];
    if (!wrapper || !header || !firstRow) {
      throw new Error('Expected DataTable wrapper, header, and first rendered row');
    }

    header.getBoundingClientRect = () => rectWithHeight(40);
    wrapper.scrollTop = 1_000;
    await fireEvent.scroll(wrapper);

    await waitFor(() =>
      expect(bodyDataRows(container).some((row) => row.textContent?.includes('Person 48'))).toBe(
        true,
      ),
    );
    const scrolledRow = bodyDataRows(container)[0];
    if (!scrolledRow) throw new Error('Expected scrolled rendered data row');

    scrolledRow.focus();
    await fireEvent.keyDown(scrolledRow, { key: 'Home' });

    await waitFor(() =>
      expect(bodyDataRows(container).some((row) => row.textContent?.includes('Person 0'))).toBe(
        true,
      ),
    );
    expect(wrapper.scrollTop).toBe(0);
    expect(bodyDataRows(container)[0]?.getAttribute('tabindex')).toBe('0');
  });
});
