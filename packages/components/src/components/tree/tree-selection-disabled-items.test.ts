import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — selection', () => {
  test('disabled ids stay selected when cascade scope is cleared', async () => {
    let selectedIds: string[] = ['parent', 'child'];
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
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            selectionScopeIds: ['parent', 'child'],
            children: [{ id: 'child', label: 'Child', disabled: true }],
          },
        ]),
      },
    });

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    await fireEvent.click(parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')!);
    expect(selectedIds).toEqual(['child']);
  });

  test('row click skips selection and Space toggles selection in checkbox mode', async () => {
    let selectedIds: string[] = [];
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
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            selectionScopeIds: ['parent', 'child'],
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    await fireEvent.click(parent);
    expect(selectedIds).toEqual([]);
    await fireEvent.keyDown(parent, { key: ' ' });
    expect(selectedIds).toEqual(['parent', 'child']);
  });

  test('Shift+Arrow uses cascade scope selection in checkbox mode', async () => {
    let selectedIds: string[] = ['unknown'];
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
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            selectionScopeIds: ['parent', 'child'],
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    await fireEvent.keyDown(parent, { key: ' ' });
    expect(selectedIds).toEqual(['unknown', 'parent', 'child']);

    await fireEvent.keyDown(parent, { key: 'ArrowDown', shiftKey: true });
    expect(selectedIds).toEqual(['unknown']);
    expect(treeItem(container, 'Child')?.getAttribute('tabindex')).toBe('0');
  });

  test('cascade checkbox activation falls back to registered descendants for an empty selection scope', async () => {
    let selectedIds: string[] = [];
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
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            selectionScopeIds: [],
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });

    const checkbox = container.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox');
    await fireEvent.click(requiredInstance(checkbox, HTMLInputElement));
    expect(selectedIds).toEqual(['parent', 'child']);
  });

  test('Enter expands branches and toggles leaves in checkbox mode', async () => {
    let selectedIds: string[] = [];
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
            selectionScopeIds: ['parent', 'child'],
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    await fireEvent.keyDown(parent, { key: 'Enter' });
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    expect(selectedIds).toEqual([]);

    await waitFor(() => expect(treeItem(container, 'Child')).not.toBeNull());
    const child = requiredInstance(treeItem(container, 'Child'), HTMLElement);
    await fireEvent.keyDown(child, { key: 'Enter' });
    expect(selectedIds).toEqual(['child']);
  });
});
