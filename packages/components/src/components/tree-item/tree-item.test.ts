/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/tree-attach-fixture.svelte');
const { default: TreeItem } = await import('./tree-item.svelte');

describe('TreeItem', () => {
  test('throws when rendered outside a Tree', () => {
    expect(() => render(TreeItem, { props: { id: 'lonely', label: 'Lonely' } })).toThrow(
      /must be used inside a Tree component/,
    );
  });

  test('renders one element with role="treeitem" per item', () => {
    const { container } = render(Wrapper, { ids: ['a', 'b', 'c'] });
    expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(3);
  });

  test('treeitems expose aria-level', () => {
    const { container } = render(Wrapper, { ids: ['a', 'b'] });
    const items = Array.from(container.querySelectorAll('[role="treeitem"]'));
    expect(items.every((item) => item.getAttribute('aria-level') === '1')).toBe(true);
  });

  test('roving tabindex puts exactly one treeitem in the tab order', () => {
    const { container } = render(Wrapper, { ids: ['a', 'b', 'c'] });
    const items = Array.from(container.querySelectorAll('[role="treeitem"]'));
    const focusable = items.filter((item) => item.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
  });
});
