import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — selection', () => {
  test('single mode: clicking item A then B leaves only B selected', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'single',
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    const b = requiredInstance(treeItem(container, 'B'), HTMLElement);
    await fireEvent.click(a);
    expect(selectedIds).toEqual(['a']);
    await fireEvent.click(b);
    expect(selectedIds).toEqual(['b']);
    expect(selectedIds).not.toContain('a');
  });

  test('multiple mode: click toggles individual ids', async () => {
    let selectedIds: string[] = [];
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
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    const b = requiredInstance(treeItem(container, 'B'), HTMLElement);
    await fireEvent.click(a);
    expect(selectedIds).toContain('a');
    await fireEvent.click(b);
    expect(selectedIds).toContain('a');
    expect(selectedIds).toContain('b');
    await fireEvent.click(a);
    expect(selectedIds).not.toContain('a');
    expect(selectedIds).toContain('b');
  });

  test('disabled items are never added to selectedIds', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'single',
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        children: treeItemsSnippet([{ id: 'a', label: 'A', disabled: true }]),
      },
    });
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    await fireEvent.click(a);
    expect(selectedIds).toEqual([]);
  });

  test('Ctrl/Cmd+A selects all visible items in multiple mode', async () => {
    let selectedIds: string[] = [];
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
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ]),
      },
    });
    const tree = requiredInstance(container.querySelector('[role="tree"]'), HTMLElement);
    await fireEvent.keyDown(tree, { key: 'a', ctrlKey: true });
    expect(selectedIds).toContain('a');
    expect(selectedIds).toContain('b');
    expect(selectedIds).toContain('c');
  });

  test('Ctrl/Cmd+A preserves collapsed cascade-selected descendants', async () => {
    let selectedIds: string[] = ['parent', 'child'];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            children: [{ id: 'child', label: 'Child' }],
          },
          { id: 'sibling', label: 'Sibling' },
        ]),
      },
    });

    const tree = requiredInstance(container.querySelector('[role="tree"]'), HTMLElement);
    await fireEvent.keyDown(tree, { key: 'a', ctrlKey: true });
    expect(selectedIds).toEqual(['parent', 'child', 'sibling']);
  });

  test('Enter toggles selection', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'single',
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        children: treeItemsSnippet([{ id: 'a', label: 'A' }]),
      },
    });
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    await fireEvent.keyDown(a, { key: 'Enter' });
    expect(selectedIds).toContain('a');
  });

  test('selectedIds is an array even in single mode', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'single',
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        children: treeItemsSnippet([{ id: 'a', label: 'A' }]),
      },
    });
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    await fireEvent.click(a);
    expect(Array.isArray(selectedIds)).toBe(true);
    expect(selectedIds.length).toBe(1);
  });
});
