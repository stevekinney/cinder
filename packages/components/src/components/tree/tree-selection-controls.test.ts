import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

const { default: TreeSelectAll } = await import('../_tree-select-all/tree-select-all.svelte');
describe('Tree — selection', () => {
  test('checkbox click does not expand or collapse branches', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    await fireEvent.click(parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')!);
    expect(expandedIds).toEqual([]);
  });

  test('TreeSelectAll selects and clears root-level ids from selectionControls', async () => {
    let selectedIds: string[] = [];
    const selectionControls = createRawSnippet(() => ({
      render: () => `<div class="controls"></div>`,
      setup: (node: Element) => {
        const instance = mount(TreeSelectAll, { target: node, props: { parentId: null } });
        return () => unmount(instance);
      },
    }));

    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        selectionControls,
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    await fireEvent.click(buttons[0]!);
    expect(selectedIds).toEqual(['a', 'b']);
    await fireEvent.click(buttons[1]!);
    expect(selectedIds).toEqual([]);
  });

  test('TreeSelectAll includeDescendants selects nested ids', async () => {
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
        'aria-label': 'T',
        selectionMode: 'multiple',
        selectionBehavior: 'cascade',
        expandedIds: ['parent'],
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        selectionControls,
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });

    const button = container.querySelector<HTMLButtonElement>('.cinder-tree-select-all__button');
    await fireEvent.click(requiredInstance(button, HTMLButtonElement));
    expect(selectedIds).toEqual(['parent', 'child']);
  });

  test('TreeSelectAll includeDescendants respects explicit child selection scopes', async () => {
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
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        expandedIds: ['parent'],
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        selectionControls,
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            selectionScopeIds: ['child'],
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });

    const selectAllButton = container.querySelector<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    await fireEvent.click(requiredInstance(selectAllButton, HTMLButtonElement));
    expect(selectedIds).toEqual(['child']);

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    await fireEvent.click(parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')!);
    expect(selectedIds).toEqual([]);
  });

  test('TreeSelectAll disables when every target is disabled', async () => {
    const selectionControls = createRawSnippet(() => ({
      render: () => `<div class="controls"></div>`,
      setup: (node: Element) => {
        const instance = mount(TreeSelectAll, { target: node, props: { parentId: null } });
        return () => unmount(instance);
      },
    }));

    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        selectionControls,
        children: treeItemsSnippet([{ id: 'a', label: 'A', disabled: true }]),
      },
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[1]?.disabled).toBe(true);
  });
});
