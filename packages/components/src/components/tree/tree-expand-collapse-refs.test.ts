/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import type { Snippet } from 'svelte';
import { createRawSnippet, mount, tick, unmount } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { TreeItemProps } from '../tree-item/tree-item.types.ts';
import type { TreeRef } from './tree.types.ts';

setupHappyDom();

const { render, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: TreeItem } = await import('../tree-item/tree-item.svelte');
const { default: Tree } = await import('./tree.svelte');

afterEach(() => cleanup());

type Item = {
  id: string;
  label: string;
  branch?: boolean;
  children?: Item[];
  loadChildren?: TreeItemProps['loadChildren'];
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
        if (item.branch !== undefined) props.branch = item.branch;
        if (children !== undefined) props.children = children;
        if (item.loadChildren !== undefined) props.loadChildren = item.loadChildren;
        instances.push(mount(TreeItem, { target: node, props }));
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

function withExpandedIdsBinding<T extends { expandedIds: string[] }>(
  captured: { expandedIds: string[]; updates?: number },
  props: T,
): T {
  return Object.defineProperty(props, 'expandedIds', {
    enumerable: true,
    get() {
      return captured.expandedIds;
    },
    set(value: string[]) {
      captured.updates = (captured.updates ?? 0) + 1;
      captured.expandedIds = value;
    },
  });
}

describe('Tree expand/collapse contracts', () => {
  test('TreeRef focuses registered items, expands to registered items, and scrolls rows', async () => {
    let treeRef: TreeRef | undefined;
    const captured = { expandedIds: ['projects'] as string[] };
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    let scrolledId = '';
    HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
      scrolledId = this.dataset['cinderTreeItemId'] ?? '';
    };

    try {
      const initialRef: TreeRef | undefined = undefined;
      const props = withExpandedIdsBinding(captured, {
        expandedIds: captured.expandedIds,
        ref: initialRef,
        'aria-label': 'Files',
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [{ id: 'apollo', label: 'Apollo' }],
          },
        ]),
      });
      Object.defineProperty(props, 'ref', {
        enumerable: true,
        get() {
          return treeRef;
        },
        set(value: TreeRef | undefined) {
          treeRef = value;
        },
      });
      const { container } = render(Tree, {
        props,
      });

      await tick();
      expect(treeRef).toBeDefined();
      const child = treeItem(container, 'Apollo');

      treeRef?.focusItem('apollo');
      expect(document.activeElement).toBe(child);
      treeRef?.focusItem('missing');
      expect(document.activeElement).toBe(child);

      treeRef?.collapseAll();
      await treeRef?.expandToItem('apollo');
      expect(captured.expandedIds).toEqual(['projects']);
      expect(document.activeElement).toBe(child);

      treeRef?.scrollToRow('apollo', { block: 'center' });
      expect(scrolledId).toBe('apollo');
      treeRef?.scrollToRow('missing');
      expect(scrolledId).toBe('apollo');
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  test('TreeRef expandAll announces without optional tree chrome', async () => {
    let treeRef: TreeRef | undefined;
    const initialRef: TreeRef | undefined = undefined;
    const props = {
      'aria-label': 'Files',
      ref: initialRef,
      children: treeItemsSnippet([
        {
          id: 'projects',
          label: 'Projects',
          branch: true,
          children: [{ id: 'apollo', label: 'Apollo' }],
        },
      ]),
    };
    Object.defineProperty(props, 'ref', {
      enumerable: true,
      get() {
        return treeRef;
      },
      set(value: TreeRef | undefined) {
        treeRef = value;
      },
    });
    const { container } = render(Tree, {
      props,
    });

    await tick();
    expect(container.querySelector('.cinder-tree-root')).toBeNull();

    await treeRef?.expandAll();

    await waitFor(() => expect(container.textContent).toContain('All items expanded.'));
  });
});
