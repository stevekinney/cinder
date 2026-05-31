/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/table-fixture.svelte');

const columns = [{ key: 'name', label: 'Name' }];
const rows = [
  { id: '1', cells: ['Alice'] },
  { id: '2', cells: ['Bob'] },
];

describe('TableBody', () => {
  test('renders a semantic <tbody> element', () => {
    const { container } = render(Wrapper, { columns, rows });
    const body = container.querySelector('tbody');
    expect(body).not.toBeNull();
    expect(body?.classList.contains('cinder-table__body')).toBe(true);
  });

  test('renders one body row per data row inside the <tbody>', () => {
    const { container } = render(Wrapper, { columns, rows });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  test('renders without errors when there are no rows', () => {
    const { container } = render(Wrapper, { columns, rows: [] });
    expect(container.querySelector('tbody')).not.toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
  });
});
