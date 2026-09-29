/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import type { Snippet } from 'svelte';
import { createRawSnippet, mount, tick, unmount } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { TreeItemProps } from '../tree-item/tree-item.types.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: TreeExpandAll } = await import('../_tree-expand-all/tree-expand-all.svelte');
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

function expansionControlsSnippet(options: { safetyThreshold?: number } = {}): Snippet {
  return createRawSnippet(() => ({
    render: () => '<div></div>',
    setup: (node: Element) => {
      const instance = mount(TreeExpandAll, {
        target: node,
        props: {
          label: 'Files',
          ...(options.safetyThreshold !== undefined && {
            safetyThreshold: options.safetyThreshold,
          }),
        },
      });
      return () => unmount(instance);
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
  test('TreeExpandAll expands nested static branches and announces once', async () => {
    const { container, getByRole } = render(Tree, {
      props: {
        'aria-label': 'Files',
        selectionControls: expansionControlsSnippet(),
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [
              {
                id: 'apollo',
                label: 'Apollo',
                branch: true,
                children: [{ id: 'notes', label: 'Notes' }],
              },
            ],
          },
        ]),
      },
    });

    const expandButton = getByRole('button', { name: 'Expand all: Files' });
    expect(expandButton.closest('[role="tree"]')).toBeNull();

    await fireEvent.click(expandButton);

    await waitFor(() =>
      expect(treeItem(container, 'Apollo').getAttribute('aria-expanded')).toBe('true'),
    );
    expect(treeItem(container, 'Projects').getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(container.textContent).toContain('All items expanded.'));
  });

  test('collapseAll clears expandedIds with one update', async () => {
    const captured = { expandedIds: ['projects', 'apollo'] as string[], updates: 0 };
    const { getByRole } = render(Tree, {
      props: withExpandedIdsBinding(captured, {
        expandedIds: captured.expandedIds,
        'aria-label': 'Files',
        selectionControls: expansionControlsSnippet(),
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [
              {
                id: 'apollo',
                label: 'Apollo',
                branch: true,
                children: [{ id: 'notes', label: 'Notes' }],
              },
            ],
          },
        ]),
      }),
    });

    await fireEvent.click(getByRole('button', { name: 'Collapse all: Files' }));

    expect(captured.expandedIds).toEqual([]);
    expect(captured.updates).toBe(1);
  });

  test('collapseAll collapses rendered branches', async () => {
    const { container, getByRole } = render(Tree, {
      props: {
        'aria-label': 'Files',
        expandedIds: ['projects', 'apollo'],
        selectionControls: expansionControlsSnippet(),
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [
              {
                id: 'apollo',
                label: 'Apollo',
                branch: true,
                children: [{ id: 'notes', label: 'Notes' }],
              },
            ],
          },
        ]),
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Collapse all: Files' }));
    await tick();

    expect(treeItem(container, 'Projects').getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(container.textContent).toContain('All items collapsed.'));
  });
});
