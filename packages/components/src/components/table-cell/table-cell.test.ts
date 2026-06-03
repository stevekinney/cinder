/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/table-fixture.svelte');
const { default: EmptyTableCellFixture } =
  await import('../../test/fixtures/empty-table-cell-fixture.svelte');

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

  test('forwards native td attributes (colspan, id, data-*) to the rendered <td>', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      cellProps: { colspan: 2, id: 'cell-1', 'data-testid': 'my-cell' },
    });
    const cell = container.querySelector('tbody td');
    expect(cell?.getAttribute('colspan')).toBe('2');
    expect(cell?.getAttribute('id')).toBe('cell-1');
    expect(cell?.getAttribute('data-testid')).toBe('my-cell');
  });

  test('bespoke align prop controls data-cinder-align and the cinder class is always present', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      cellProps: { align: 'right' },
    });
    const cell = container.querySelector('tbody td');
    expect(cell?.getAttribute('data-cinder-align')).toBe('right');
    expect(cell?.classList.contains('cinder-table__cell')).toBe(true);
  });

  test('component-owned data-cinder-align cannot be clobbered via the rest spread', () => {
    // `{...rest}` is spread BEFORE the explicit data-cinder-align binding, so the
    // component's value (derived from `align`, default 'left') always wins — even
    // though `data-cinder-align` is a raw data-* attribute the type can't exclude.
    const { container } = render(Wrapper, {
      columns,
      rows,
      cellProps: { 'data-cinder-align': 'right' } as never,
    });
    const cell = container.querySelector('tbody td');
    expect(cell?.getAttribute('data-cinder-align')).toBe('left');
  });
});

describe('TableCell — empty children', () => {
  test('renders an empty <td> without throwing when no children are provided', () => {
    // children is now optional (children?: Snippet) so empty <td> cells used in
    // spanning layouts are a valid, non-throwing state. The optional-chain guard
    // at the render site ({@render children?.()}) ensures undefined children is a
    // safe no-op rather than a runtime throw.
    const { container } = render(EmptyTableCellFixture, {});
    const cell = container.querySelector('tbody td');
    expect(cell).not.toBeNull();
    expect(cell?.classList.contains('cinder-table__cell')).toBe(true);
    expect(cell?.textContent?.trim()).toBe('');
  });
});
