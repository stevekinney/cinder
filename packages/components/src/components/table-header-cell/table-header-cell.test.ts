/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/table-header-cell-fixture.svelte');

describe('TableHeaderCell', () => {
  test('align defaults to left', () => {
    const { container } = render(Fixture, {});
    expect(container.querySelector('th')?.getAttribute('data-cinder-align')).toBe('left');
  });

  test('align="right" reflects on the header cell', () => {
    const { container } = render(Fixture, { align: 'right' });
    expect(container.querySelector('th')?.getAttribute('data-cinder-align')).toBe('right');
  });

  test('align="right" reflects on sortable header cells', () => {
    const { container } = render(Fixture, { align: 'right', sortable: true });
    const headerCell = container.querySelector('th');
    expect(headerCell?.getAttribute('data-cinder-align')).toBe('right');
    expect(headerCell?.querySelector('.cinder-table__sort-button')).not.toBeNull();
  });

  test('forwards native th attributes (colspan, id, data-*) to the rendered <th>', () => {
    const { container } = render(Fixture, {
      headerCellProps: { colspan: 2, id: 'header-1', 'data-testid': 'my-header' },
    });
    const headerCell = container.querySelector('th');
    expect(headerCell?.getAttribute('colspan')).toBe('2');
    expect(headerCell?.getAttribute('id')).toBe('header-1');
    expect(headerCell?.getAttribute('data-testid')).toBe('my-header');
  });

  test('component-computed aria-sort cannot be clobbered by rest spread', () => {
    // aria-sort is a derived value computed from table context — it is placed AFTER
    // the {...rest} spread on the <th>, so the component's value always wins.
    const { container } = render(Fixture, {
      sortable: true,
      // `aria-sort` is Omit-ted from the prop type (component-owned), so the props
      // object is cast to inject it the way an untyped JS consumer could.
      headerCellProps: {
        // Attempt to override the computed aria-sort via rest
        'aria-sort': 'descending',
      } as never,
    });
    const headerCell = container.querySelector('th');
    // aria-sort is computed from table context (no sort active → 'none' for a sortable col).
    // The component's explicit binding comes after the spread, so it cannot be overridden.
    expect(headerCell?.getAttribute('aria-sort')).toBe('none');
    // The cinder class must always be present.
    expect(headerCell?.classList.contains('cinder-table__header-cell')).toBe(true);
  });
});
