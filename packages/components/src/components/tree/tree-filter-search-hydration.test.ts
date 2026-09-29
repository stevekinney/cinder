/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { flushSync } from 'svelte';
import {
  checkBuildFlagHydrationSafety,
  prepareBuildFlagHydrationSafety,
} from '../../test/hydration-safety.ts';
import {
  flushTreeFilterStatus,
  treeItem,
  treeItemsSnippet,
  visibleTreeItemLabels,
} from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');
const treeFilterHydrationSource = new URL(
  '../../test/fixtures/tree-filter-hydration-fixture.svelte',
  import.meta.url,
).pathname;
await prepareBuildFlagHydrationSafety(treeFilterHydrationSource);
afterEach(() => cleanup());

describe('Tree — filter/search', () => {
  test('ArrowDown from search focuses the first visible item and Escape clears the query', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        children: treeItemsSnippet([
          { id: 'alpha', label: 'Alpha' },
          { id: 'beta', label: 'Beta' },
        ]),
      },
    });

    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    await fireEvent.input(search, { target: { value: 'bet' } });
    await waitFor(() => {
      expect(visibleTreeItemLabels(container)).toEqual(['Beta']);
    });

    search.focus();
    await fireEvent.keyDown(search, { key: 'ArrowDown' });
    const beta = requiredInstance(treeItem(container, 'Beta'), HTMLElement);
    expect(document.activeElement).toBe(beta);
    expect(beta.getAttribute('tabindex')).toBe('0');

    search.focus();
    await fireEvent.keyDown(search, { key: 'Escape' });
    flushSync();
    expect(search.value).toBe('');
    expect(visibleTreeItemLabels(container)).toEqual(['Alpha', 'Beta']);
    expect(document.activeElement).toBe(search);
  });

  test('announces debounced result counts and marks the tree busy while pending', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        children: treeItemsSnippet([
          { id: 'apollo', label: 'Apollo' },
          { id: 'archive', label: 'Archive' },
        ]),
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;

    await fireEvent.input(search, { target: { value: 'apo' } });
    expect(tree.getAttribute('aria-busy')).toBe('true');

    await flushTreeFilterStatus();
    const liveRegion = container.querySelector('[role="status"]');
    expect(tree.hasAttribute('aria-busy')).toBe(false);
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
    expect(liveRegion?.textContent).toContain('1 result found.');
  });

  test('renders a visual highlight without changing the treeitem accessible name', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        searchVisible: true,
        filterValue: 'pol',
        children: treeItemsSnippet([{ id: 'apollo', label: 'Apollo' }]),
      },
    });

    await waitFor(() => {
      const item = treeItem(container, 'Apollo');
      const mark = item?.querySelector('mark');
      expect(mark?.getAttribute('aria-hidden')).toBe('true');
      expect(mark?.textContent).toBe('pol');
      const labelId = item?.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      expect(container.ownerDocument.getElementById(labelId!)?.textContent).toBe('Apollo');
    });
  });

  test('filtered SSR markup is invariant for the client build', async () => {
    const result = await checkBuildFlagHydrationSafety(treeFilterHydrationSource, {
      filterValue: 'apollo',
    });

    const serverContainer = document.createElement('div');
    serverContainer.innerHTML = result.serverHtml;
    const clientContainer = document.createElement('div');
    clientContainer.innerHTML = result.clientHtml;

    expect(result.buildFlagInvariant).toBe(true);
    expect(visibleTreeItemLabels(serverContainer)).toEqual(['Apollo']);
    expect(visibleTreeItemLabels(clientContainer)).toEqual(['Apollo']);
  });
});
