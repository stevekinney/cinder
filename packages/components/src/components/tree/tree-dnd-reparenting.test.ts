/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Snippet } from 'svelte';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { TreeReorderTarget } from '../../_internal/tree-drag-controller.svelte.ts';
import type { TreeItemProps } from '../tree-item/tree-item.types.ts';
import type { TreeSelectionMode } from './tree.types.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');
const { default: TreeItem } = await import('../tree-item/tree-item.svelte');

afterEach(() => cleanup());

type Item = {
  id: string;
  label: string;
  reorderHandleVisible?: boolean;
  disabled?: boolean;
  branch?: boolean;
  children?: Item[];
  onRename?: TreeItemProps['onRename'];
};

function treeItemsSnippet(items: Item[]): Snippet {
  return createRawSnippet(() => ({
    render: () => '<div></div>',
    setup: (node: Element) => {
      const instances: ReturnType<typeof mount>[] = [];
      for (const item of items) {
        const children = item.children ? treeItemsSnippet(item.children) : undefined;
        const props: TreeItemProps = {
          id: item.id,
          label: item.label,
        };
        if (item.reorderHandleVisible !== undefined)
          props.reorderHandleVisible = item.reorderHandleVisible;
        if (item.disabled !== undefined) props.disabled = item.disabled;
        if (item.branch !== undefined) props.branch = item.branch;
        if (item.onRename !== undefined) props.onRename = item.onRename;
        if (children !== undefined) props.children = children;
        instances.push(
          mount(TreeItem, {
            target: node,
            props,
          }),
        );
      }
      return () => {
        for (const instance of instances) unmount(instance);
      };
    },
  }));
}

function treeItem(container: HTMLElement, label: string): HTMLElement {
  const labelElement = [...container.querySelectorAll<HTMLElement>('.cinder-sr-only')].find(
    (element) => element.textContent === label,
  );
  if (!labelElement?.id) throw new Error(`Missing label: ${label}`);
  const item = container.querySelector<HTMLElement>(
    `[role="treeitem"][aria-labelledby="${labelElement.id}"]`,
  );
  if (!item) throw new Error(`Missing treeitem: ${label}`);
  return item;
}

function dragHandle(container: HTMLElement, label: string): HTMLButtonElement {
  const item = treeItem(container, label);
  const handle = item.querySelector<HTMLButtonElement>('.cinder-tree-item__drag-handle');
  if (!handle) throw new Error(`Missing drag handle: ${label}`);
  return handle;
}

function renderTree(
  options: {
    items?: Item[];
    expandedIds?: string[];
    selectionMode?: TreeSelectionMode;
    onReorder?: (draggedId: string, target: TreeReorderTarget) => void;
  } = {},
) {
  const onReorder = options.onReorder ?? mock();
  const items = options.items ?? [
    { id: 'a', label: 'Alpha', reorderHandleVisible: true },
    { id: 'b', label: 'Beta', reorderHandleVisible: true },
    { id: 'c', label: 'Gamma', reorderHandleVisible: true },
  ];
  const result = render(Tree, {
    props: {
      'aria-label': 'Reorder tree',
      expandedIds: options.expandedIds ?? [],
      selectionMode: options.selectionMode ?? 'none',
      onReorder,
      children: treeItemsSnippet(items),
    },
  });
  return { ...result, onReorder };
}

describe('Tree drag-and-drop reorder', () => {
  test('ArrowRight reparents the dragged item into the previous branch', async () => {
    const calls: Array<[string, TreeReorderTarget]> = [];
    const { container } = renderTree({
      expandedIds: ['a'],
      items: [
        { id: 'a', label: 'Alpha', branch: true, reorderHandleVisible: true },
        { id: 'b', label: 'Beta', reorderHandleVisible: true },
      ],
      onReorder: (draggedId, target) => calls.push([draggedId, target]),
    });
    const handle = dragHandle(container, 'Beta');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(treeItem(container, 'Alpha').hasAttribute('data-cinder-drop-into')).toBe(true);
    await fireEvent.keyDown(handle, { key: 'Enter' });

    expect(calls).toEqual([
      ['b', { id: 'a', position: 'child', fromParentId: null, toParentId: 'a' }],
    ]);
  });

  test('ArrowLeft reparents a child out after its parent', async () => {
    const calls: Array<[string, TreeReorderTarget]> = [];
    const { container } = renderTree({
      expandedIds: ['a'],
      items: [
        {
          id: 'a',
          label: 'Alpha',
          branch: true,
          reorderHandleVisible: true,
          children: [{ id: 'b', label: 'Beta', reorderHandleVisible: true }],
        },
      ],
      onReorder: (draggedId, target) => calls.push([draggedId, target]),
    });
    const handle = dragHandle(container, 'Beta');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(treeItem(container, 'Alpha').getAttribute('data-cinder-drop-target')).toBe('after');
    await fireEvent.keyDown(handle, { key: 'Enter' });

    expect(calls).toEqual([
      ['b', { id: 'a', position: 'after', fromParentId: 'a', toParentId: null }],
    ]);
  });
});
