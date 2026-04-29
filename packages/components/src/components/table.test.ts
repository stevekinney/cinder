/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../test/fixtures/table-fixture.svelte');

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'age', label: 'Age', sortable: true },
  { key: 'role', label: 'Role' },
];
const rows = [
  { id: '1', cells: ['Alice', '30', 'Engineer'] },
  { id: '2', cells: ['Bob', '25', 'Designer'] },
];

describe('Table semantics', () => {
  test('renders semantic <table>, <thead>, <tbody> elements', () => {
    const { container } = render(Wrapper, { columns, rows });
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('thead')).not.toBeNull();
    expect(container.querySelector('tbody')).not.toBeNull();
  });

  test('renders a <caption> when the caption prop is supplied', () => {
    const { container } = render(Wrapper, { columns, rows, caption: 'Team' });
    const caption = container.querySelector('caption');
    expect(caption).not.toBeNull();
    expect(caption?.textContent?.trim()).toBe('Team');
  });

  test('renders one row per data row plus a header row', () => {
    const { container } = render(Wrapper, { columns, rows });
    const headerRows = container.querySelectorAll('thead tr');
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(headerRows.length).toBe(1);
    expect(bodyRows.length).toBe(2);
  });

  test('non-sortable header cells render plain text without an inner button', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cells = Array.from(container.querySelectorAll('thead th'));
    const roleCell = cells[2];
    expect(roleCell?.querySelector('button')).toBeNull();
    expect(roleCell?.getAttribute('aria-sort')).toBeNull();
  });
});

describe('Table sort behavior', () => {
  test('sortable header cells render a button inside the th', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.querySelector('button')).not.toBeNull();
    expect(cells[1]?.querySelector('button')).not.toBeNull();
  });

  test('sortable header cells default to aria-sort="none"', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('none');
    expect(cells[1]?.getAttribute('aria-sort')).toBe('none');
  });

  test('aria-sort reflects the bound sort state', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      sort: { column: 'name', direction: 'ascending' },
    });
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('ascending');
    expect(cells[1]?.getAttribute('aria-sort')).toBe('none');
  });

  test('clicking a sortable header sets sort to ascending for that column', async () => {
    const { container } = render(Wrapper, { columns, rows });
    const button = container.querySelector('thead th button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    await fireEvent.click(button);
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('ascending');
  });

  test('clicking the same header again toggles to descending', async () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      sort: { column: 'name', direction: 'ascending' },
    });
    const button = container.querySelector('thead th button') as HTMLButtonElement;
    await fireEvent.click(button);
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('descending');
  });

  test('clicking a different sortable header switches column with ascending', async () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      sort: { column: 'name', direction: 'descending' },
    });
    const buttons = Array.from(container.querySelectorAll('thead th button'));
    await fireEvent.click(buttons[1] as HTMLButtonElement);
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('none');
    expect(cells[1]?.getAttribute('aria-sort')).toBe('ascending');
  });
});

describe('Table sticky header', () => {
  test('stickyHeader=true sets the data attribute on the table', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: true });
    expect(container.querySelector('table')?.hasAttribute('data-cinder-sticky-header')).toBe(true);
  });

  test('stickyHeader=false omits the data attribute', () => {
    const { container } = render(Wrapper, { columns, rows });
    expect(container.querySelector('table')?.hasAttribute('data-cinder-sticky-header')).toBe(false);
  });
});
