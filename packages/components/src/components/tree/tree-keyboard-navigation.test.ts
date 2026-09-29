import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — keyboard navigation', () => {
  test('ArrowDown moves focus to next visible item', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    a.focus();
    await fireEvent.keyDown(a, { key: 'ArrowDown' });
    const b = treeItem(container, 'B');
    expect(b?.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowUp moves focus to previous visible item', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });
    const b = requiredInstance(treeItem(container, 'B'), HTMLElement);
    b.focus();
    await fireEvent.keyDown(b, { key: 'ArrowUp' });
    const a = treeItem(container, 'A');
    expect(a?.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowDown does not wrap past the last item', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });
    const b = requiredInstance(treeItem(container, 'B'), HTMLElement);
    b.focus();
    await fireEvent.keyDown(b, { key: 'ArrowDown' });
    // Should still be on B
    expect(b.getAttribute('tabindex')).toBe('0');
  });

  test('Home moves focus to first visible item', async () => {
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
    const c = requiredInstance(treeItem(container, 'C'), HTMLElement);
    c.focus();
    await fireEvent.keyDown(c, { key: 'Home' });
    const a = treeItem(container, 'A');
    expect(a?.getAttribute('tabindex')).toBe('0');
  });

  test('End moves focus to last visible item', async () => {
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
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    a.focus();
    await fireEvent.keyDown(a, { key: 'End' });
    const c = treeItem(container, 'C');
    expect(c?.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowRight on collapsed branch expands without moving focus', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
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
    parent.focus();
    await fireEvent.keyDown(parent, { key: 'ArrowRight' });
    expect(expandedIds).toContain('parent');
    // Focus stays on parent
    expect(parent.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowRight on expanded branch moves focus to first child', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        expandedIds: ['parent'],
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
    parent.focus();
    await fireEvent.keyDown(parent, { key: 'ArrowRight' });
    const child = treeItem(container, 'Child');
    expect(child?.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowLeft on expanded branch collapses; focus stays', async () => {
    let expandedIds: string[] = ['parent'];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
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
    parent.focus();
    await fireEvent.keyDown(parent, { key: 'ArrowLeft' });
    expect(expandedIds).not.toContain('parent');
    expect(parent.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowLeft on collapsed branch moves focus to parent', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        expandedIds: ['parent'],
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            children: [
              {
                id: 'inner',
                label: 'Inner',
              },
            ],
          },
        ]),
      },
    });
    const inner = requiredInstance(treeItem(container, 'Inner'), HTMLElement);
    inner.focus();
    await fireEvent.keyDown(inner, { key: 'ArrowLeft' });
    const parent = treeItem(container, 'Parent');
    expect(parent?.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowLeft at root with collapsed branch is a no-op', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([
          { id: 'a', label: 'A', branch: true, children: [{ id: 'c', label: 'C' }] },
        ]),
      },
    });
    const a = requiredInstance(treeItem(container, 'A'), HTMLElement);
    a.focus();
    // Should not throw
    await fireEvent.keyDown(a, { key: 'ArrowLeft' });
    expect(a.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowDown skips collapsed-subtree descendants', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        // parent is collapsed, so children are invisible
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
    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    parent.focus();
    await fireEvent.keyDown(parent, { key: 'ArrowDown' });
    const sibling = treeItem(container, 'Sibling');
    expect(sibling?.getAttribute('tabindex')).toBe('0');
  });

  test('* key expands all sibling branches at the current level', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
        children: treeItemsSnippet([
          { id: 'b1', label: 'Branch1', branch: true, children: [{ id: 'c1', label: 'C1' }] },
          { id: 'b2', label: 'Branch2', branch: true, children: [{ id: 'c2', label: 'C2' }] },
          { id: 'b3', label: 'Branch3', branch: true, children: [{ id: 'c3', label: 'C3' }] },
        ]),
      },
    });
    const b1 = requiredInstance(treeItem(container, 'Branch1'), HTMLElement);
    b1.focus();
    await fireEvent.keyDown(b1, { key: '*' });
    expect(expandedIds).toContain('b1');
    expect(expandedIds).toContain('b2');
    expect(expandedIds).toContain('b3');
  });
});
