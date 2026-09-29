import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { flushSync } from 'svelte';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

const { default: TreeTestHarness } = await import('../_tree-test-harness.svelte');
describe('Tree — roving tabindex', () => {
  test('exactly one item has tabindex="0" at any time', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ]),
      },
    });
    const zeros = [...container.querySelectorAll('[role="treeitem"]')].filter(
      (el) => el.getAttribute('tabindex') === '0',
    );
    expect(zeros.length).toBe(1);
  });

  test('initial tabindex=0 lands on first item when no selection', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });
    const items = [...container.querySelectorAll('[role="treeitem"]')];
    expect(items[0]?.getAttribute('tabindex')).toBe('0');
    expect(items[1]?.getAttribute('tabindex')).toBe('-1');
  });

  test('initial tabindex=0 lands on first selected item when selection exists', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'single',
        selectedIds: ['b'],
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });
    const b = treeItem(container, 'B');
    expect(b?.getAttribute('tabindex')).toBe('0');
  });

  test('focus falls back to a visible item when focused item becomes invisible (parent collapses)', async () => {
    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        initialExpandedIds: ['parent'],
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
    // Focus the child (inside the expanded parent).
    const child = requiredInstance(treeItem(container, 'Child'), HTMLElement);
    await fireEvent.focus(child);
    // Collapse the parent while the child still owns focus; the child becomes
    // invisible and unregisters.
    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    await fireEvent.keyDown(parent, { key: 'ArrowLeft' });
    flushSync();
    // After collapse, exactly one visible item should have tabindex=0.
    const tabbables = [...container.querySelectorAll('[role="treeitem"]')].filter(
      (element) => element.getAttribute('tabindex') === '0',
    );
    expect(tabbables.length).toBe(1);
    // The focused item must be a root-level item (child is now hidden).
    const focused = tabbables[0];
    expect(focused?.getAttribute('aria-level')).toBe('1');
    expect(document.activeElement).toBe(parent);
  });
});
