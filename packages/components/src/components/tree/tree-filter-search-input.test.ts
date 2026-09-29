import { setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet, visibleTreeItemLabels } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — filter/search', () => {
  test('renders the search input outside role="tree" with aria-controls', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        children: treeItemsSnippet([{ id: 'apollo', label: 'Apollo' }]),
      },
    });

    const root = container.querySelector('.cinder-tree-root');
    const tree = container.querySelector<HTMLElement>('[role="tree"]');
    const search = container.querySelector<HTMLInputElement>('input[type="search"]');

    expect(root).not.toBeNull();
    expect(root?.firstElementChild?.contains(search)).toBe(true);
    expect(tree?.contains(search)).toBe(false);
    expect(search?.getAttribute('aria-controls')).toBe(tree?.id);
    expect(search?.getAttribute('aria-label')).toBe('Search tree');
    expect(search?.autocomplete).toBe('off');
    expect(search?.getAttribute('spellcheck')).toBe('false');
  });

  test('falls back to the default search label when filterPlaceholder is empty after trimming', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterPlaceholder: '   ',
        children: treeItemsSnippet([{ id: 'apollo', label: 'Apollo' }]),
      },
    });

    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    const label = container.querySelector<HTMLLabelElement>('label[for]');

    expect(search?.getAttribute('aria-label')).toBe('Search tree');
    expect(search?.getAttribute('placeholder')).toBe('Search tree');
    expect(label?.textContent).toBe('Search tree');
  });

  test('hides non-matching items while retaining ancestors of deep matches', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'apollo',
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [
              { id: 'apollo', label: 'Apollo' },
              { id: 'borealis', label: 'Borealis' },
            ],
          },
          { id: 'archive', label: 'Archive' },
        ]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Projects', 'Apollo']);
    });
    expect(treeItem(container, 'Projects')?.hasAttribute('data-cinder-hidden')).toBe(false);
    expect(treeItem(container, 'Apollo')?.hasAttribute('data-cinder-hidden')).toBe(false);
    expect(treeItem(container, 'Borealis')?.hasAttribute('data-cinder-hidden')).toBe(true);
    expect(treeItem(container, 'Archive')?.hasAttribute('data-cinder-hidden')).toBe(true);
  });

  test('filtered tree positions count only visible siblings', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'apollo',
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [
              { id: 'apollo', label: 'Apollo' },
              { id: 'borealis', label: 'Borealis' },
            ],
          },
          { id: 'archive', label: 'Archive' },
        ]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Projects', 'Apollo']);
    });

    expect(treeItem(container, 'Projects')?.getAttribute('aria-posinset')).toBe('1');
    expect(treeItem(container, 'Projects')?.getAttribute('aria-setsize')).toBe('1');
    expect(treeItem(container, 'Apollo')?.getAttribute('aria-posinset')).toBe('1');
    expect(treeItem(container, 'Apollo')?.getAttribute('aria-setsize')).toBe('1');
  });

  test('shows matching descendants through a view-only expansion without mutating expandedIds', async () => {
    let expandedIds = ['existing'];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'apollo',
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [{ id: 'apollo', label: 'Apollo' }],
          },
          {
            id: 'existing',
            label: 'Existing',
            branch: true,
            children: [{ id: 'already-open', label: 'Already Open' }],
          },
        ]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Projects', 'Apollo']);
    });
    expect(treeItem(container, 'Projects')?.getAttribute('aria-expanded')).toBe('true');
    expect(expandedIds).toEqual(['existing']);
  });

  test('filter-forced open branches suppress stale disclosure controls', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'apollo',
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [{ id: 'apollo', label: 'Apollo' }],
          },
        ]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Projects', 'Apollo']);
    });

    const projects = treeItem(container, 'Projects');
    expect(projects?.getAttribute('aria-expanded')).toBe('true');
    expect(projects?.querySelector('.cinder-tree-item__disclosure')).toBeNull();
    expect(projects?.querySelector('.cinder-tree-item__disclosure-spacer')).not.toBeNull();
  });

  test('ArrowRight on a filter-revealed branch focuses the visible child without mutating expandedIds', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'apollo',
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [{ id: 'apollo', label: 'Apollo' }],
          },
        ]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Projects', 'Apollo']);
    });
    const projects = treeItem(container, 'Projects')!;
    projects.focus();
    await fireEvent.keyDown(projects, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(treeItem(container, 'Apollo'));
    expect(expandedIds).toEqual([]);
  });
});
