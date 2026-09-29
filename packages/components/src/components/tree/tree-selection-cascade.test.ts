import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — selection', () => {
  test('multiple mode: Shift+ArrowDown selects anchor item and moves focus', async () => {
    // The current implementation toggles the anchor item on Shift+Arrow (range=anchor-to-anchor)
    // then moves focus. This is the implemented behavior; a future improvement could
    // select the destination item instead (APG suggestion from the review).
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
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    // Click A to set anchor
    await fireEvent.click(a);
    // Shift+ArrowDown selects range(anchor, current=a) = ['a'] and moves focus to b
    await fireEvent.keyDown(a, { key: 'ArrowDown', shiftKey: true });
    expect(selectedIds).toContain('a');
    // Focus has moved to b
    const b = treeItem(container, 'B');
    expect(b?.getAttribute('tabindex')).toBe('0');
  });

  test('multiple mode: Shift+ArrowUp selects anchor item and moves focus', async () => {
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
    const c = requiredInstance(treeItem(container, 'C'), HTMLElement);
    // Click C to set anchor
    await fireEvent.click(c);
    // Shift+ArrowUp selects range(anchor, current=c) = ['c'] and moves focus to b
    await fireEvent.keyDown(c, { key: 'ArrowUp', shiftKey: true });
    expect(selectedIds).toContain('c');
    // Focus has moved to b
    const b = treeItem(container, 'B');
    expect(b?.getAttribute('tabindex')).toBe('0');
  });

  test('single mode: Shift+ArrowDown does not perform range selection', async () => {
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
    await fireEvent.click(a);
    await fireEvent.keyDown(a, { key: 'ArrowDown', shiftKey: true });
    // Single mode ignores shift; focus moves but selection stays
    expect(selectedIds.length).toBeLessThanOrEqual(1);
  });

  test('checkbox selection renders one visual checkbox per default row in multiple mode', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });
    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      '.cinder-tree-item__checkbox[type="checkbox"]',
    );
    expect(checkboxes.length).toBe(2);
    for (const checkbox of checkboxes) {
      expect(checkbox.getAttribute('aria-hidden')).toBe('true');
      expect(checkbox.tabIndex).toBe(-1);
    }
  });

  test('checkbox selection is inactive outside multiple mode', () => {
    const modes = ['none', 'single'] as const;
    for (const selectionMode of modes) {
      const { container } = render(Tree, {
        props: {
          'aria-label': 'T',
          selectionMode,
          checkboxSelection: true,
          children: treeItemsSnippet([{ id: 'a', label: 'A' }]),
        },
      });
      expect(container.querySelector('.cinder-tree-item__checkbox')).toBeNull();
    }
  });

  test('independent checkbox activation toggles only the target id', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
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

    const checkbox = container.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox');
    expect(checkbox).not.toBeNull();
    await fireEvent.click(requiredInstance(checkbox, HTMLInputElement));
    expect(selectedIds).toEqual(['parent']);
  });

  test('independent checkbox state ignores selected descendants', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectedIds: ['child'],
        expandedIds: ['parent'],
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
    const checkbox = parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox');
    await waitFor(() => expect(checkbox?.indeterminate).toBe(false));
    expect(checkbox?.checked).toBe(false);
    expect(parent.getAttribute('aria-checked')).toBe('false');
  });
});
