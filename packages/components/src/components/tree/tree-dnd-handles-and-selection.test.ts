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
  test('renders non-tab-stop drag handles only for enabled reorderHandleVisible items', () => {
    const { container } = renderTree({
      items: [
        { id: 'a', label: 'Alpha', reorderHandleVisible: true },
        { id: 'b', label: 'Beta', reorderHandleVisible: true, disabled: true },
        { id: 'c', label: 'Gamma' },
      ],
    });

    const alphaHandle = dragHandle(container, 'Alpha');
    expect(alphaHandle.getAttribute('aria-label')).toBe('Reorder Alpha');
    expect(alphaHandle.getAttribute('aria-describedby')).toBeTruthy();
    expect(treeItem(container, 'Alpha').getAttribute('aria-describedby')).toBe(
      alphaHandle.getAttribute('aria-describedby'),
    );
    expect(alphaHandle.getAttribute('tabindex')).toBe('-1');
    expect(treeItem(container, 'Beta').querySelector('.cinder-tree-item__drag-handle')).toBeNull();
    expect(treeItem(container, 'Gamma').querySelector('.cinder-tree-item__drag-handle')).toBeNull();
  });

  test('drag handle click does not bubble to the tree item', async () => {
    const { container } = renderTree({ selectionMode: 'single' });
    const alpha = treeItem(container, 'Alpha');
    const handle = dragHandle(container, 'Alpha');
    let bubbledClicks = 0;
    alpha.addEventListener('click', () => {
      bubbledClicks += 1;
    });

    await fireEvent.click(handle);

    expect(bubbledClicks).toBe(0);
    expect(alpha.getAttribute('aria-selected')).toBe('false');
  });

  test('Space and Enter on a reorderHandleVisible selectable item keep their selection behavior', async () => {
    const onReorder = mock();
    const { container } = renderTree({ selectionMode: 'single', onReorder });
    const alpha = treeItem(container, 'Alpha');

    alpha.focus();
    await fireEvent.keyDown(alpha, { key: ' ' });

    expect(alpha.getAttribute('aria-selected')).toBe('true');
    expect(alpha.hasAttribute('data-cinder-dragging')).toBe(false);

    await fireEvent.keyDown(alpha, { key: 'Enter' });

    expect(alpha.getAttribute('aria-selected')).toBe('false');
    expect(onReorder).not.toHaveBeenCalled();
  });
});
