/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Tree } = await import('../tree/tree.svelte');
const { default: TreeItem } = await import('../tree-item/tree-item.svelte');
const { default: TreeSelectAll } = await import('./tree-select-all.svelte');

/**
 * Render TreeSelectAll inside a multi-select Tree's `selectionControls` slot,
 * which is the only context in which it is valid. Returns the Tree container.
 */
function renderSelectAll(captured: { selectedIds: string[] }) {
  const selectionControls = createRawSnippet(() => ({
    render: () => `<div class="controls"></div>`,
    setup: (node: Element) => {
      const instance = mount(TreeSelectAll, { target: node, props: { parentId: null } });
      return () => unmount(instance);
    },
  }));

  const children = createRawSnippet(() => ({
    render: () => `<div class="items"></div>`,
    setup: (node: Element) => {
      const a = mount(TreeItem, { target: node, props: { id: 'a', label: 'A' } });
      const b = mount(TreeItem, { target: node, props: { id: 'b', label: 'B' } });
      return () => {
        unmount(a);
        unmount(b);
      };
    },
  }));

  return render(Tree, {
    props: {
      'aria-label': 'Files',
      selectionMode: 'multiple',
      get selectedIds() {
        return captured.selectedIds;
      },
      set selectedIds(value: string[]) {
        captured.selectedIds = value;
      },
      selectionControls,
      children,
    },
  });
}

describe('TreeSelectAll', () => {
  test('renders select and clear buttons with accessible names', () => {
    const captured = { selectedIds: [] as string[] };
    const { container } = renderSelectAll(captured);
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    expect(buttons).toHaveLength(2);
    // Default labels: "Select all: Tree selection" / "Select none: Tree selection".
    expect(buttons[0]?.getAttribute('aria-label')).toContain('Select all');
    expect(buttons[1]?.getAttribute('aria-label')).toContain('Select none');
  });

  test('the select button selects every registered id at the level', async () => {
    const captured = { selectedIds: [] as string[] };
    const { container } = renderSelectAll(captured);
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    await fireEvent.click(buttons[0]!);
    expect(captured.selectedIds).toEqual(['a', 'b']);
  });

  test('the clear button removes the level ids from the selection', async () => {
    const captured = { selectedIds: ['a', 'b'] };
    const { container } = renderSelectAll(captured);
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    await fireEvent.click(buttons[1]!);
    expect(captured.selectedIds).toEqual([]);
  });
});
