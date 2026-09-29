/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import type { TreeDataItem } from '../../_internal/tree-data.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

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

function visibleItemIds(container: HTMLElement): string[] {
  return treeItems(container).map((item) => item.dataset['cinderTreeItemId'] ?? '');
}

describe('Tree — virtualized data path', () => {
  test('filtering retains matching descendants and ancestors without mutating expandedIds', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        filterValue: 'old',
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
      },
    });

    await waitFor(() => {
      expect(visibleItemIds(container)).toEqual(['archive', 'old-apollo']);
    });
    expect(treeItemById(container, 'archive').getAttribute('aria-expanded')).toBe('true');
    expect(expandedIds).toEqual([]);
  });

  test('filter-forced open virtualized branches suppress stale disclosure controls', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        filterValue: 'old',
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
      },
    });

    await waitFor(() => {
      expect(visibleItemIds(container)).toEqual(['archive', 'old-apollo']);
    });

    const archive = treeItemById(container, 'archive');
    expect(archive.getAttribute('aria-expanded')).toBe('true');
    expect(archive.querySelector('.cinder-tree-item__disclosure')).toBeNull();
    expect(expandedIds).toEqual([]);
  });

  test('ArrowRight on a filter-revealed virtualized branch focuses the visible child without mutating expandedIds', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        filterValue: 'old',
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    await waitFor(() => {
      expect(visibleItemIds(container)).toEqual(['archive', 'old-apollo']);
    });
    tree.focus();
    await fireEvent.keyDown(tree, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(treeItemById(container, 'old-apollo').hasAttribute('data-cinder-focused')).toBe(true);
    });
    expect(expandedIds).toEqual([]);
  });

  test('typeaheadDisabled prevents virtualized typeahead focus movement', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: [
          { id: 'alpha', label: 'Alpha' },
          { id: 'beta', label: 'Beta' },
        ],
        typeaheadDisabled: true,
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    tree.focus();
    await fireEvent.keyDown(tree, { key: 'b' });

    expect(tree.getAttribute('aria-activedescendant')).toBe(`${tree.id}-item-0`);
    expect(treeItemById(container, 'alpha').hasAttribute('data-cinder-focused')).toBe(true);
    expect(treeItemById(container, 'beta').hasAttribute('data-cinder-focused')).toBe(false);
  });

  test('star key expands virtualized sibling branches', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        expandedIds: ['projects'],
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    tree.focus();
    await fireEvent.keyDown(tree, { key: '*' });

    await waitFor(() => {
      expect(treeItemById(container, 'old-apollo').getAttribute('aria-level')).toBe('2');
    });
  });
});
