/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/table-fixture.svelte');

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'age', label: 'Age' },
];
const rows = [{ id: '1', cells: ['Alice', '30'] }];

describe('TableHeader', () => {
  test('renders a semantic <thead> with the cinder header class', () => {
    const { container } = render(Wrapper, { columns, rows });
    const head = container.querySelector('thead');
    expect(head).not.toBeNull();
    expect(head?.classList.contains('cinder-table__header')).toBe(true);
  });

  test('renders the header row with one cell per column', () => {
    const { container } = render(Wrapper, { columns, rows });
    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells.length).toBeGreaterThanOrEqual(2);
  });

  test('renders a leading select-all header cell when the table is selectable', () => {
    const { container } = render(Wrapper, { columns, rows, selectable: true });
    const selectionCell = container.querySelector('thead .cinder-table__header-cell--selection');
    expect(selectionCell).not.toBeNull();
    expect(selectionCell?.querySelector<HTMLInputElement>('input[type="checkbox"]')).not.toBeNull();
  });

  test('throws when selection is enabled but required selection props are absent', () => {
    expect(() =>
      render(Wrapper, {
        columns,
        rows,
        selectable: true,
        includeHeaderSelectionState: false,
        includeHeaderSelectionHandler: false,
      }),
    ).toThrow(/required when Table.selectable is true/);
  });
});
