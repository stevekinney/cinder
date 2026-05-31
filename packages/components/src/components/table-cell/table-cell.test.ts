/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/table-fixture.svelte');

const columns = [{ key: 'name', label: 'Name' }];
const rows = [{ id: '1', cells: ['Alice'] }];

describe('TableCell', () => {
  test('renders a semantic <td> with the cinder cell class', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cell = container.querySelector('tbody td');
    expect(cell).not.toBeNull();
    expect(cell?.classList.contains('cinder-table__cell')).toBe(true);
  });

  test('renders the provided cell content', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cell = container.querySelector('tbody td');
    expect(cell?.textContent).toContain('Alice');
  });

  test('default alignment is reflected via the data-cinder-align attribute', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cell = container.querySelector('tbody td');
    expect(cell?.getAttribute('data-cinder-align')).toBe('left');
  });
});
