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
});
