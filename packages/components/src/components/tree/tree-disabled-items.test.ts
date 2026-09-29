import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — disabled items', () => {
  test('disabled items carry aria-disabled="true"', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: 'A', disabled: true }]),
      },
    });
    const item = container.querySelector('[role="treeitem"]');
    expect(item?.getAttribute('aria-disabled')).toBe('true');
  });

  test('disabled items remain in tab order (keyboard-reachable)', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: 'A', disabled: true }]),
      },
    });
    const item = container.querySelector('[role="treeitem"]');
    // First item should still have tabindex=0 even if disabled
    expect(item?.getAttribute('tabindex')).toBe('0');
  });

  test('disabled branches expand on Enter without becoming selected', async () => {
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
          {
            id: 'branch',
            label: 'Branch',
            disabled: true,
            branch: true,
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });
    const branch = requiredInstance(treeItem(container, 'Branch'), HTMLElement);

    await fireEvent.keyDown(branch, { key: 'Enter' });

    expect(branch.getAttribute('aria-expanded')).toBe('true');
    expect(selectedIds).toEqual([]);
  });

  test('disabled branches expand on plain click without becoming selected', async () => {
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
          {
            id: 'branch',
            label: 'Branch',
            disabled: true,
            branch: true,
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });
    const branch = requiredInstance(treeItem(container, 'Branch'), HTMLElement);

    await fireEvent.click(branch);

    expect(branch.getAttribute('aria-expanded')).toBe('true');
    expect(selectedIds).toEqual([]);
  });

  test('enabled branches select and expand on plain click', async () => {
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
          {
            id: 'branch',
            label: 'Branch',
            branch: true,
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });
    const branch = requiredInstance(treeItem(container, 'Branch'), HTMLElement);

    await fireEvent.click(branch);

    expect(branch.getAttribute('aria-expanded')).toBe('true');
    expect(selectedIds).toEqual(['branch']);
  });
});
