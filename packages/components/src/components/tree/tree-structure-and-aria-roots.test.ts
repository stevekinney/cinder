import { setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { textSnippet, treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — structure and ARIA', () => {
  test('root has role="tree"', () => {
    const { container } = render(Tree, {
      props: { 'aria-label': 'Test tree', children: textSnippet('') },
    });
    expect(container.querySelector('[role="tree"]')).not.toBeNull();
  });

  test('tree remains the root element without selection controls', () => {
    const { container } = render(Tree, {
      props: { 'aria-label': 'Test tree', children: textSnippet('') },
    });
    expect(container.firstElementChild?.getAttribute('role')).toBe('tree');
    expect(container.querySelector('.cinder-tree-root')).toBeNull();
  });

  test('native attributes are forwarded to the role tree element', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Test tree',
        'data-testid': 'tree-root',
        style: 'max-block-size: 7rem; overflow: auto;',
        children: textSnippet(''),
      },
    });
    const tree = container.querySelector('[role="tree"]');
    expect(tree?.getAttribute('data-testid')).toBe('tree-root');
    expect(tree?.getAttribute('style')).toContain('max-block-size: 7rem');
  });

  test('provided id is used for the role tree element', () => {
    const { container } = render(Tree, {
      props: {
        id: 'custom-tree-id',
        'aria-label': 'Test tree',
        children: textSnippet(''),
      },
    });

    expect(container.querySelector('[role="tree"]')?.id).toBe('custom-tree-id');
  });

  test('aria-multiselectable="true" only in multiple mode', () => {
    const { container: c1 } = render(Tree, {
      props: { 'aria-label': 'T', selectionMode: 'multiple', children: textSnippet('') },
    });
    expect(c1.querySelector('[role="tree"]')?.getAttribute('aria-multiselectable')).toBe('true');

    const { container: c2 } = render(Tree, {
      props: { 'aria-label': 'T', selectionMode: 'single', children: textSnippet('') },
    });
    expect(c2.querySelector('[role="tree"]')?.hasAttribute('aria-multiselectable')).toBe(false);

    const { container: c3 } = render(Tree, {
      props: { 'aria-label': 'T', selectionMode: 'none', children: textSnippet('') },
    });
    expect(c3.querySelector('[role="tree"]')?.hasAttribute('aria-multiselectable')).toBe(false);
  });

  test('items have role="treeitem"', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: 'Alpha' }]),
      },
    });
    expect(container.querySelector('[role="treeitem"]')).not.toBeNull();
  });

  test('items have correct aria-level (1-based)', () => {
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
    const parent = treeItem(container, 'Parent');
    const child = treeItem(container, 'Child');
    expect(parent?.getAttribute('aria-level')).toBe('1');
    expect(child?.getAttribute('aria-level')).toBe('2');
  });

  test('leaf items omit aria-expanded entirely', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'leaf', label: 'Leaf' }]),
      },
    });
    const item = container.querySelector('[role="treeitem"]');
    expect(item?.hasAttribute('aria-expanded')).toBe(false);
  });

  test('branch items have aria-expanded="true"/"false"', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        expandedIds: ['b1'],
        children: treeItemsSnippet([
          { id: 'b1', label: 'Branch1', branch: true, children: [{ id: 'c1', label: 'C1' }] },
          { id: 'b2', label: 'Branch2', branch: true, children: [{ id: 'c2', label: 'C2' }] },
        ]),
      },
    });
    const b1 = treeItem(container, 'Branch1');
    const b2 = treeItem(container, 'Branch2');
    expect(b1?.getAttribute('aria-expanded')).toBe('true');
    expect(b2?.getAttribute('aria-expanded')).toBe('false');
  });

  test('aria-selected absent in none mode', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'none',
        children: treeItemsSnippet([{ id: 'a', label: 'A' }]),
      },
    });
    const item = container.querySelector('[role="treeitem"]');
    expect(item?.hasAttribute('aria-selected')).toBe(false);
  });

  test('aria-selected present in single mode', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'single',
        children: treeItemsSnippet([{ id: 'a', label: 'A' }]),
      },
    });
    const item = container.querySelector('[role="treeitem"]');
    expect(item?.hasAttribute('aria-selected')).toBe(true);
  });

  test('nested item lists use role="group"', () => {
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
    expect(container.querySelector('[role="group"]')).not.toBeNull();
  });

  test('group labels point to unique treeitem ids across multiple trees', () => {
    const first = render(Tree, {
      props: {
        'aria-label': 'First tree',
        expandedIds: ['shared'],
        children: treeItemsSnippet([
          {
            id: 'shared',
            label: 'Shared',
            branch: true,
            children: [{ id: 'first-child', label: 'First Child' }],
          },
        ]),
      },
    });
    const second = render(Tree, {
      props: {
        'aria-label': 'Second tree',
        expandedIds: ['shared'],
        children: treeItemsSnippet([
          {
            id: 'shared',
            label: 'Shared',
            branch: true,
            children: [{ id: 'second-child', label: 'Second Child' }],
          },
        ]),
      },
    });

    const firstItem = treeItem(first.container, 'Shared');
    const secondItem = treeItem(second.container, 'Shared');
    const firstGroup = first.container.querySelector('[role="group"]');
    const secondGroup = second.container.querySelector('[role="group"]');

    expect(firstItem?.id).toBeTruthy();
    expect(secondItem?.id).toBeTruthy();
    expect(firstItem?.id).not.toBe(secondItem?.id);
    expect(firstGroup?.getAttribute('aria-labelledby')).toBe(firstItem?.id);
    expect(secondGroup?.getAttribute('aria-labelledby')).toBe(secondItem?.id);
  });
});
