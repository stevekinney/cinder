/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/table-fixture.svelte');

const columns = [{ key: 'name', label: 'Name' }];
const rows = [{ id: '1', cells: ['Alice'] }];

describe('TableRow', () => {
  test('renders a semantic <tr> with the cinder row class', () => {
    const { container } = render(Wrapper, { columns, rows });
    const bodyRow = container.querySelector('tbody tr');
    expect(bodyRow).not.toBeNull();
    expect(bodyRow?.classList.contains('cinder-table__row')).toBe(true);
  });

  test('renders its cell children inside the row', () => {
    const { container } = render(Wrapper, { columns, rows });
    const bodyRow = container.querySelector('tbody tr');
    expect(bodyRow?.querySelector('td')?.textContent).toContain('Alice');
  });

  test('selectable body rows render a per-row selection checkbox with an accessible name', () => {
    const { container } = render(Wrapper, { columns, rows, selectable: true });
    const bodyRow = container.querySelector('tbody tr');
    const checkbox = bodyRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.getAttribute('aria-label')).toBe('Select Alice');
  });

  test('a selection-disabled row renders a disabled checkbox cell instead of an active control', () => {
    const { container } = render(Wrapper, {
      columns,
      rows: [{ id: '1', cells: ['Alice'], selectionDisabled: true }],
      selectable: true,
    });
    const bodyRow = container.querySelector('tbody tr');
    const checkbox = bodyRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.disabled).toBe(true);
  });
});
