import { setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import { treeItem, treeItemsSnippet, visibleTreeItemLabels } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — filter/search', () => {
  test('ArrowRight on an expanded filtered branch skips hidden children', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'apollo',
        expandedIds: ['projects'],
        children: treeItemsSnippet([
          {
            id: 'projects',
            label: 'Projects',
            branch: true,
            children: [
              { id: 'borealis', label: 'Borealis' },
              { id: 'apollo', label: 'Apollo' },
            ],
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

    expect(treeItem(container, 'Borealis')?.hasAttribute('data-cinder-hidden')).toBe(true);
    expect(document.activeElement).toBe(treeItem(container, 'Apollo'));
  });

  test('filtering unmounts unrelated collapsed branch children after probing', async () => {
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
          {
            id: 'archive',
            label: 'Archive',
            branch: true,
            children: [{ id: 'zeus', label: 'Zeus' }],
          },
        ]),
      },
    });

    await tick();
    await tick();

    expect(visibleTreeItemLabels(container)).toEqual(['Projects', 'Apollo']);
    expect(treeItem(container, 'Zeus')).toBeNull();
    expect(treeItem(container, 'Archive')?.hasAttribute('data-cinder-hidden')).toBe(true);
  });

  test('shows a non-interactive empty state when no items match', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'nomatch',
        children: treeItemsSnippet([{ id: 'apollo', label: 'Apollo' }]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual([]);
    });
    const empty = container.querySelector<HTMLElement>('.cinder-tree__empty');
    expect(empty?.getAttribute('role')).toBe('none');
    expect(empty?.textContent).toContain('No results');
  });

  test('clearing the controlled filter removes stale hidden state', async () => {
    const { container, rerender } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'apollo',
        children: treeItemsSnippet([
          { id: 'apollo', label: 'Apollo' },
          { id: 'archive', label: 'Archive' },
        ]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Apollo']);
    });

    await rerender({
      'aria-label': 'Project tree',
      searchVisible: true,
      filterValue: '',
      children: treeItemsSnippet([
        { id: 'apollo', label: 'Apollo' },
        { id: 'archive', label: 'Archive' },
      ]),
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Apollo', 'Archive']);
    });
    expect(treeItem(container, 'Archive')?.hasAttribute('data-cinder-hidden')).toBe(false);
    expect(container.querySelector('.cinder-tree__empty')).toBeNull();
  });

  test('uncontrolled search input filters and reports changes', async () => {
    const changes: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        onFilterChange: (value: string) => changes.push(value),
        children: treeItemsSnippet([
          { id: 'apollo', label: 'Apollo' },
          { id: 'archive', label: 'Archive' },
        ]),
      },
    });

    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    await fireEvent.input(search, { target: { value: 'arch' } });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Archive']);
    });
    expect(changes).toEqual(['arch']);
  });

  test('default filter is case-insensitive but does not fold diacritics', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'cafe',
        children: treeItemsSnippet([{ id: 'cafe', label: 'Café' }]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual([]);
    });
  });

  test('custom filter predicate controls matching', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'a1',
        filterPredicate: (_label: string, id: string, query: string) => id.endsWith(query),
        children: treeItemsSnippet([
          { id: 'project-a1', label: 'Apollo' },
          { id: 'project-b2', label: 'Also has a1 text' },
        ]),
      },
    });

    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Apollo']);
    });
  });
});
