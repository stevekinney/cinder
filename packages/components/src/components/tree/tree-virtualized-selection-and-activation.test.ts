/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { TreeDataItem } from '../../_internal/tree-data.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');
const { default: TreeSelectAll } = await import('../_tree-select-all/tree-select-all.svelte');

afterEach(() => cleanup());

function nestedItems(): TreeDataItem[] {
  return [
    {
      id: 'projects',
      label: 'Projects',
      children: [
        { id: 'apollo', label: 'Apollo' },
        { id: 'zeus', label: 'Zeus', disabled: true },
      ],
    },
    {
      id: 'archive',
      label: 'Archive',
      children: [{ id: 'old-apollo', label: 'Old Apollo' }],
    },
  ];
}

function treeItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')];
}

function treeItemById(container: HTMLElement, id: string): HTMLElement {
  const item = treeItems(container).find((element) => element.dataset['cinderTreeItemId'] === id);
  if (!item) throw new Error(`Missing virtualized tree item: ${id}`);
  return item;
}

describe('Tree virtualized data path', () => {
  test('disabled virtualized rows receive focus but do not change selection', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'single',
        items: [
          { id: 'alpha', label: 'Alpha', disabled: true },
          { id: 'beta', label: 'Beta' },
        ],
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
      },
    });

    await fireEvent.click(treeItemById(container, 'alpha'));

    expect(selectedIds).toEqual([]);
    expect(treeItemById(container, 'alpha').hasAttribute('data-cinder-focused')).toBe(true);
    expect(treeItemById(container, 'alpha').getAttribute('aria-selected')).toBe('false');
  });

  test('virtualized rows ignore double-click follow-up activation', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
      },
    });

    await fireEvent.click(treeItemById(container, 'projects'), { detail: 1 });
    await waitFor(() => {
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true');
    });

    await fireEvent.click(treeItemById(container, 'projects'), { detail: 2 });

    expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true');
  });

  test('virtualized branch rows select and expand on plain click', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'single',
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
      },
    });

    await fireEvent.click(treeItemById(container, 'projects'));
    await waitFor(() => {
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true');
    });

    expect(selectedIds).toEqual(['projects']);
  });

  test('cascade selection includes virtualized descendants and skips disabled descendants', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        selectionBehavior: 'cascade',
        expandedIds: ['projects'],
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
      },
    });

    expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true');
    await fireEvent.keyDown(treeItemById(container, 'projects'), { key: ' ' });

    await waitFor(() => {
      expect(treeItemById(container, 'projects').getAttribute('aria-selected')).toBe('true');
      expect(treeItemById(container, 'apollo').getAttribute('aria-selected')).toBe('true');
      expect(treeItemById(container, 'zeus').getAttribute('aria-selected')).toBe('false');
    });
  });

  test('checkbox selection renders checkbox state for virtualized rows', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        selectedIds: ['apollo'],
        expandedIds: ['projects'],
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
      },
    });

    const projects = treeItemById(container, 'projects');
    const projectsCheckbox = projects.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(projects.getAttribute('aria-selected')).toBeNull();
    expect(projects.getAttribute('aria-checked')).toBe('mixed');
    expect(projectsCheckbox.indeterminate).toBe(true);
    expect(treeItemById(container, 'apollo').getAttribute('aria-checked')).toBe('true');

    await fireEvent.click(projectsCheckbox);

    await waitFor(() => {
      expect(projects.getAttribute('aria-checked')).toBe('true');
      expect(projectsCheckbox.checked).toBe(true);
    });
    expect(treeItemById(container, 'apollo').getAttribute('aria-checked')).toBe('true');
    expect(treeItemById(container, 'zeus').getAttribute('aria-checked')).toBe('false');
    expect(projects.getAttribute('aria-expanded')).toBe('true');
  });

  test('Enter on a virtualized checkbox branch toggles expansion without selection', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;

    tree.focus();
    await fireEvent.keyDown(tree, { key: 'Enter' });
    await waitFor(() =>
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true'),
    );
    expect(selectedIds).toEqual([]);
    expect(treeItemById(container, 'projects').getAttribute('aria-checked')).toBe('false');

    await fireEvent.keyDown(tree, { key: 'Enter' });
    await waitFor(() =>
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('false'),
    );
    expect(selectedIds).toEqual([]);
    expect(treeItemById(container, 'projects').getAttribute('aria-checked')).toBe('false');

    await fireEvent.keyDown(treeItemById(container, 'projects'), { key: 'Enter' });
    await waitFor(() =>
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true'),
    );
    expect(selectedIds).toEqual([]);
    expect(treeItemById(container, 'projects').getAttribute('aria-checked')).toBe('false');
  });

  test('TreeSelectAll includeDescendants selects virtualized data children', async () => {
    let selectedIds: string[] = [];
    const selectionControls = createRawSnippet(() => ({
      render: () => `<div class="controls"></div>`,
      setup: (node: Element) => {
        const instance = mount(TreeSelectAll, {
          target: node,
          props: { parentId: null, includeDescendants: true },
        });
        return () => unmount(instance);
      },
    }));

    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        selectionBehavior: 'cascade',
        expandedIds: ['projects'],
        items: nestedItems(),
        selectionControls,
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
      },
    });

    const selectAllButton = container.querySelector<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    expect(selectAllButton?.disabled).toBe(false);

    if (!selectAllButton) throw new Error('Missing select all button');
    await fireEvent.click(selectAllButton);

    expect(selectedIds).toEqual(['projects', 'apollo', 'archive', 'old-apollo']);
  });
});
