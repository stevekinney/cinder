/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import type { Snippet } from 'svelte';
import { createRawSnippet, mount, tick, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { checkBuildFlagHydrationSafety } from '../../test/hydration-safety.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');
const { default: TreeItem } = await import('../tree-item/tree-item.svelte');
const { default: TreeSelectAll } = await import('../_tree-select-all/tree-select-all.svelte');
const { default: TreeTestHarness } = await import('../_tree-test-harness.svelte');
const { default: TreeAttachFixture } =
  await import('../../test/fixtures/tree-attach-fixture.svelte');
const treeFilterHydrationSource = new URL(
  '../../test/fixtures/tree-filter-hydration-fixture.svelte',
  import.meta.url,
).pathname;

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Snippet helpers
// ---------------------------------------------------------------------------

type TreeItemMountProps = {
  id: string;
  label: string;
  disabled?: boolean;
  branch?: boolean;
  selectionScopeIds?: string[];
  children?: Snippet;
  row?: Snippet<
    [
      {
        expanded: boolean;
        selected: boolean;
        busy: boolean;
        level: number;
        checkboxSelection: boolean;
        selectionState: { checked: boolean; indeterminate: boolean };
        toggleSelection: () => void;
      },
    ]
  >;
};

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function treeItem(container: HTMLElement, label: string): HTMLElement | null {
  const labelElement = [...container.querySelectorAll<HTMLElement>('.cinder-sr-only')].find(
    (element) => element.textContent === label,
  );

  if (!labelElement?.id) return null;
  return container.querySelector<HTMLElement>(
    `[role="treeitem"][aria-labelledby="${labelElement.id}"]`,
  );
}

function visibleTreeItemLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')]
    .filter((element) => !element.hasAttribute('data-cinder-hidden'))
    .map((element) => {
      const labelId = element.getAttribute('aria-labelledby');
      const localLabel = [...container.querySelectorAll<HTMLElement>('[id]')].find(
        (candidate) => candidate.id === labelId,
      );
      return labelId
        ? (localLabel?.textContent ??
            container.ownerDocument.getElementById(labelId)?.textContent ??
            '')
        : '';
    })
    .filter(Boolean);
}

async function flushTreeFilterStatus(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 520));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await tick();
}

function treeItemsSnippet(
  items: Array<{
    id: string;
    label: string;
    disabled?: boolean;
    branch?: boolean;
    selectionScopeIds?: string[];
    children?: Array<{ id: string; label: string; disabled?: boolean }>;
  }>,
) {
  return createRawSnippet(() => ({
    render: () => `<div class="items-wrapper"></div>`,
    setup: (node: Element) => {
      const instances: ReturnType<typeof mount>[] = [];

      for (const item of items) {
        const childrenSnippet = item.children
          ? createRawSnippet(() => ({
              render: () => `<div class="children-wrapper"></div>`,
              setup: (childNode: Element) => {
                const childInstances: ReturnType<typeof mount>[] = [];
                for (const child of item.children ?? []) {
                  const childProps = {
                    id: child.id,
                    label: child.label,
                    ...(child.disabled !== undefined && { disabled: child.disabled }),
                  } satisfies TreeItemMountProps;
                  childInstances.push(
                    mount(TreeItem, {
                      target: childNode,
                      props: childProps,
                    }),
                  );
                }
                return () => {
                  for (const ci of childInstances) unmount(ci);
                };
              },
            }))
          : undefined;

        const itemProps = {
          id: item.id,
          label: item.label,
          ...(item.disabled !== undefined && { disabled: item.disabled }),
          ...(item.branch !== undefined && { branch: item.branch }),
          ...(item.selectionScopeIds && { selectionScopeIds: item.selectionScopeIds }),
          ...(childrenSnippet && { children: childrenSnippet }),
        } satisfies TreeItemMountProps;
        instances.push(
          mount(TreeItem, {
            target: node,
            props: itemProps,
          }),
        );
      }
      return () => {
        for (const inst of instances) unmount(inst);
      };
    },
  }));
}

// ---------------------------------------------------------------------------
// Structure & ARIA
// ---------------------------------------------------------------------------

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

  test('tree contains zero <li> elements', () => {
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
    expect(container.querySelectorAll('li').length).toBe(0);
  });

  test('warns when neither aria-label nor aria-labelledby is provided', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };

    try {
      render(Tree, {
        props: { children: textSnippet('') },
      });
      expect(warnings.some((w) => w.includes('[cinder-tree]'))).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns and omits accessible-name attributes when labels are empty after trimming', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };

    try {
      const { container } = render(Tree, {
        props: {
          'aria-label': '   ',
          'aria-labelledby': '   ',
          children: textSnippet(''),
        },
      });
      const tree = container.querySelector<HTMLElement>('[role="tree"]');

      expect(warnings.some((warning) => warning.includes('[cinder-tree]'))).toBe(true);
      expect(tree?.hasAttribute('aria-label')).toBe(false);
      expect(tree?.hasAttribute('aria-labelledby')).toBe(false);
    } finally {
      console.warn = originalWarn;
    }
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('Tree — filter/search', () => {
  test('renders the search input outside role="tree" with aria-controls', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        showSearch: true,
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
        showSearch: true,
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
        showSearch: true,
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

  test('shows matching descendants through a view-only expansion without mutating expandedIds', async () => {
    let expandedIds = ['existing'];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        showSearch: true,
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

  test('ArrowRight on a filter-revealed branch focuses the visible child without mutating expandedIds', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        showSearch: true,
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

  test('ArrowRight on an expanded filtered branch skips hidden children', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        showSearch: true,
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
        showSearch: true,
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
        showSearch: true,
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
        showSearch: true,
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
      showSearch: true,
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
        showSearch: true,
        onfilterchange: (value: string) => changes.push(value),
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
        showSearch: true,
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
        showSearch: true,
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

  test('ArrowDown from search focuses the first visible item and Escape clears the query', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        showSearch: true,
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
    const beta = treeItem(container, 'Beta') as HTMLElement;
    expect(document.activeElement).toBe(beta);
    expect(beta.getAttribute('tabindex')).toBe('0');

    search.focus();
    await fireEvent.keyDown(search, { key: 'Escape' });
    await waitFor(() => {
      expect(search.value).toBe('');
      expect(visibleTreeItemLabels(container)).toEqual(['Alpha', 'Beta']);
      expect(document.activeElement).toBe(search);
    });
  });

  test('announces debounced result counts and marks the tree busy while pending', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Project tree',
        showSearch: true,
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
        showSearch: true,
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

// ---------------------------------------------------------------------------
// Roving tabindex
// ---------------------------------------------------------------------------

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
    const child = treeItem(container, 'Child') as HTMLElement;
    await fireEvent.focus(child);
    // Collapse the parent while the child still owns focus; the child becomes
    // invisible and unregisters.
    const parent = treeItem(container, 'Parent') as HTMLElement;
    await fireEvent.keyDown(parent, { key: 'ArrowLeft' });
    await waitFor(() => {
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
});

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

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
    const a = treeItem(container, 'A') as HTMLElement;
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
    const b = treeItem(container, 'B') as HTMLElement;
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
    const b = treeItem(container, 'B') as HTMLElement;
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
    const c = treeItem(container, 'C') as HTMLElement;
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
    const a = treeItem(container, 'A') as HTMLElement;
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
    const parent = treeItem(container, 'Parent') as HTMLElement;
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
    const parent = treeItem(container, 'Parent') as HTMLElement;
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
    const parent = treeItem(container, 'Parent') as HTMLElement;
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
    const inner = treeItem(container, 'Inner') as HTMLElement;
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
    const a = treeItem(container, 'A') as HTMLElement;
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
    const parent = treeItem(container, 'Parent') as HTMLElement;
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
    const b1 = treeItem(container, 'Branch1') as HTMLElement;
    b1.focus();
    await fireEvent.keyDown(b1, { key: '*' });
    expect(expandedIds).toContain('b1');
    expect(expandedIds).toContain('b2');
    expect(expandedIds).toContain('b3');
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

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
    const a = treeItem(container, 'A') as HTMLElement;
    const b = treeItem(container, 'B') as HTMLElement;
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
    const a = treeItem(container, 'A') as HTMLElement;
    const b = treeItem(container, 'B') as HTMLElement;
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
    const a = treeItem(container, 'A') as HTMLElement;
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
    const tree = container.querySelector('[role="tree"]') as HTMLElement;
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

    const tree = container.querySelector('[role="tree"]') as HTMLElement;
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
    const a = treeItem(container, 'A') as HTMLElement;
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
    const a = treeItem(container, 'A') as HTMLElement;
    await fireEvent.click(a);
    expect(Array.isArray(selectedIds)).toBe(true);
    expect(selectedIds.length).toBe(1);
  });

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
    const a = treeItem(container, 'A') as HTMLElement;
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
    const c = treeItem(container, 'C') as HTMLElement;
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
    const a = treeItem(container, 'A') as HTMLElement;
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
    await fireEvent.click(checkbox as HTMLInputElement);
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
    const checkbox = parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox');
    await waitFor(() => expect(checkbox?.indeterminate).toBe(false));
    expect(checkbox?.checked).toBe(false);
    expect(parent.getAttribute('aria-checked')).toBe('false');
  });

  test('cascade checkbox activation selects and clears the explicit selection scope', async () => {
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
    const checkbox = parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox');
    await fireEvent.click(checkbox as HTMLInputElement);
    expect(selectedIds).toEqual(['unknown', 'parent', 'child']);
    await fireEvent.click(checkbox as HTMLInputElement);
    expect(selectedIds).toEqual(['unknown']);
  });

  // ---------------------------------------------------------------------------
  // Regression: controlled checkbox `.checked`/`.indeterminate` re-assertion
  //
  // The native checkbox uses a THREE-PART control strategy. (1) The declarative
  // `checked={selectionState.checked}` attribute renders the SSR-correct initial
  // value and rewrites on value CHANGE between renders. (2) An `$effect` reconciles
  // `.checked`/`.indeterminate` on every reactive flush. (3) A requestAnimationFrame
  // re-sync in the click handler heals the post-revert state. The bug these tests
  // pin: the declarative attribute ALONE only rewrites `.checked` when its boolean
  // value changes, so a residual native mutation (from the pre-handler checkbox
  // click, reverted by Chromium AFTER the sync handler + microtasks) that lands on
  // a checkbox whose authoritative state evaluates to the same boolean Svelte last
  // rendered would never be healed — the visible `<input>.checked` diverges from the
  // authoritative `aria-checked`. The rAF re-sync (part 3) is what actually heals it.
  //
  // These tests must assert the RENDERED DOM after multiple clicks, so they
  // render through `TreeTestHarness` (selectedIds backed by real Svelte
  // `$state`). A plain `let selectedIds` with `get/set` accessors propagates
  // the value back to the closure but does NOT trigger reactive re-render of
  // the tree — the same reason the async-loading suite below uses the harness.
  //
  // NOTE on discriminability: happy-dom does NOT reproduce the Chromium timing
  // quirk (post-dispatch preventDefault revert) that triggers the original bug.
  // In this environment, tests 1 and 3 below are INVARIANT-COVERAGE tests —
  // they prove that `.checked`/`.indeterminate` always agree with `aria-checked`
  // after any state change, but they cannot distinguish pre-fix from post-fix
  // code because the race condition does not exist in happy-dom. Tests 2 and 4
  // do fail pre-fix (they toggle `selectionState.checked` directly and verify
  // the DOM update) and are the true regression discriminators in this
  // environment. The Playwright spec (tree-checkbox-selection.playwright.ts)
  // drives real Chromium checkbox clicks and IS the authoritative regression
  // proof for the original bug.
  //
  // Fixture mirrors the playground `indeterminate-parents` example: branch
  // `archive` (scope ['archive','january','february']) with leaf children
  // january/february, plus sibling leaf summary.
  // ---------------------------------------------------------------------------

  function indeterminateParentsChildren() {
    return treeItemsSnippet([
      {
        id: 'archive',
        label: 'archive',
        branch: true,
        selectionScopeIds: ['archive', 'january', 'february'],
        children: [
          { id: 'january', label: 'january.pdf' },
          { id: 'february', label: 'february.pdf' },
        ],
      },
      { id: 'summary', label: 'summary.pdf' },
    ]);
  }

  function renderIndeterminateParents(initialSelectedIds: string[]) {
    return render(TreeTestHarness, {
      props: {
        'aria-label': 'Archived reports',
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        initialExpandedIds: ['archive'],
        initialSelectedIds,
        children: indeterminateParentsChildren(),
      },
    });
  }

  function checkboxFor(container: HTMLElement, label: string): HTMLInputElement {
    const item = treeItem(container, label) as HTMLElement;
    return item.querySelector<HTMLInputElement>('input.cinder-tree-item__checkbox')!;
  }

  test('residual native .checked mutation is re-synced to selection state on next flush', async () => {
    const { container } = renderIndeterminateParents(['february']);

    const januaryInput = checkboxFor(container, 'january.pdf');
    const summaryInput = checkboxFor(container, 'summary.pdf');
    const januaryItem = treeItem(container, 'january.pdf') as HTMLElement;

    // january is NOT selected, so its checkbox renders unchecked.
    await waitFor(() => expect(januaryInput.checked).toBe(false));
    expect(januaryItem.getAttribute('aria-checked')).toBe('false');

    // Simulate a residual native mutation: the DOM .checked is flipped true
    // out-of-band (as a real native checkbox click would do before the
    // handler's preventDefault reverts it). selectionState for january is
    // still { checked: false }, so a declarative attribute whose value did not
    // change would never rewrite this.
    januaryInput.checked = true;
    expect(januaryInput.checked).toBe(true);

    // Click an UNRELATED checkbox (summary) to drive a selection change and a
    // reactive flush. The imperative re-assertion must heal january's stray
    // .checked back to false to match its authoritative state.
    await fireEvent.click(summaryInput);
    await waitFor(() => expect(januaryInput.checked).toBe(false));
    expect(januaryItem.getAttribute('aria-checked')).toBe('false');
  });

  test('clicking a leaf checkbox toggles its visible checked state in sync with aria-checked', async () => {
    const { container } = renderIndeterminateParents(['february']);

    const januaryInput = checkboxFor(container, 'january.pdf');
    const januaryItem = treeItem(container, 'january.pdf') as HTMLElement;

    await waitFor(() => expect(januaryInput.checked).toBe(false));

    // A real native checkbox click flips `.checked` in the DOM BEFORE the
    // handler runs (and preventDefault only reverts it on that tick).
    // happy-dom's fireEvent.click does not auto-flip, so model the native
    // pre-flip explicitly before each click — the residual mutation the
    // controlled input must reconcile. Click on → both must agree on truthy.
    januaryInput.checked = true;
    await fireEvent.click(januaryInput);
    await waitFor(() => expect(januaryInput.checked).toBe(true));
    expect(januaryItem.getAttribute('aria-checked')).toBe('true');

    // Click off → native pre-flip clears `.checked`; both must agree on false.
    januaryInput.checked = false;
    await fireEvent.click(januaryInput);
    await waitFor(() => expect(januaryInput.checked).toBe(false));
    expect(januaryItem.getAttribute('aria-checked')).toBe('false');
  });

  test('parent checkbox recomputes mixed/checked/unchecked as descendants toggle', async () => {
    const { container } = renderIndeterminateParents(['february']);

    const januaryInput = checkboxFor(container, 'january.pdf');
    const februaryInput = checkboxFor(container, 'february.pdf');
    const archiveInput = checkboxFor(container, 'archive');
    const archiveItem = treeItem(container, 'archive') as HTMLElement;

    // february-only → 1/3 of archive scope selected → mixed.
    await waitFor(() => expect(archiveInput.indeterminate).toBe(true));
    expect(archiveInput.checked).toBe(false);
    expect(archiveItem.getAttribute('aria-checked')).toBe('mixed');

    // Stray-mutate the ARCHIVE checkbox's DOM `.checked` to true out-of-band.
    // archive stays mixed across the next click (1/3 → 2/3 selected), so its
    // authoritative `selectionState.checked` boolean does NOT change value —
    // a declarative `checked={...}` binding would skip the DOM write and leave
    // this stray `true` un-healed. The imperative re-assertion must reconcile
    // it back to false because the effect re-runs on the fresh selectionState.
    archiveInput.checked = true;

    // Add january → 2/3 selected → still mixed, still indeterminate, and the
    // visible checkbox must NOT read as fully checked. The input properties are
    // written in a $effect that runs AFTER the aria-checked attribute updates,
    // so assert them inside the same waitFor to wait for that reconciliation.
    await fireEvent.click(januaryInput);
    await waitFor(() => {
      expect(archiveItem.getAttribute('aria-checked')).toBe('mixed');
      expect(archiveInput.indeterminate).toBe(true);
      expect(archiveInput.checked).toBe(false);
    });

    // Remove february → 1/3 selected → still mixed.
    await fireEvent.click(februaryInput);
    await waitFor(() => {
      expect(archiveItem.getAttribute('aria-checked')).toBe('mixed');
      expect(archiveInput.indeterminate).toBe(true);
      expect(archiveInput.checked).toBe(false);
    });

    // Remove january → 0/3 selected → fully unchecked, never mixed.
    await fireEvent.click(januaryInput);
    await waitFor(() => {
      expect(archiveItem.getAttribute('aria-checked')).toBe('false');
      expect(archiveInput.checked).toBe(false);
      expect(archiveInput.indeterminate).toBe(false);
    });
  });

  test('parent checkbox reads fully checked (never mixed) when its whole scope is selected', async () => {
    const { container } = renderIndeterminateParents([]);

    const archiveInput = checkboxFor(container, 'archive');
    const archiveItem = treeItem(container, 'archive') as HTMLElement;

    await waitFor(() => expect(archiveItem.getAttribute('aria-checked')).toBe('false'));

    // Select the full scope via the archive checkbox (cascade). Model the
    // native pre-flip: the click sets `.checked` true in the DOM first. The
    // input properties are written in a $effect that runs AFTER the aria-checked
    // attribute updates, so assert them inside the same waitFor.
    archiveInput.checked = true;
    await fireEvent.click(archiveInput);
    await waitFor(() => {
      expect(archiveItem.getAttribute('aria-checked')).toBe('true');
      expect(archiveInput.checked).toBe(true);
      expect(archiveInput.indeterminate).toBe(false);
    });

    // Clear the full scope → native pre-flip clears `.checked`; final state is
    // fully unchecked, never mixed.
    archiveInput.checked = false;
    await fireEvent.click(archiveInput);
    await waitFor(() => {
      expect(archiveItem.getAttribute('aria-checked')).toBe('false');
      expect(archiveInput.checked).toBe(false);
      expect(archiveInput.indeterminate).toBe(false);
    });
  });

  test('partially selected scope exposes indeterminate checkbox and mixed aria-checked', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
    const checkbox = parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox');
    await waitFor(() => expect(checkbox?.indeterminate).toBe(true));
    expect(parent.getAttribute('aria-checked')).toBe('mixed');
  });

  test('checkbox selection omits aria-selected from treeitems', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectedIds: ['a'],
        children: treeItemsSnippet([{ id: 'a', label: 'A' }]),
      },
    });

    const item = treeItem(container, 'A') as HTMLElement;
    expect(item.hasAttribute('aria-selected')).toBe(false);
    expect(item.getAttribute('aria-checked')).toBe('true');
  });

  test('disabled ids are excluded from cascade checkbox updates', async () => {
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
            children: [{ id: 'child', label: 'Child', disabled: true }],
          },
        ]),
      },
    });

    const parent = treeItem(container, 'Parent') as HTMLElement;
    await fireEvent.click(parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')!);
    expect(selectedIds).toEqual(['parent']);
  });

  test('cascade aggregate ignores disabled descendants for rendered checked state', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        selectedIds: ['parent'],
        expandedIds: ['parent'],
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
    await waitFor(() =>
      expect(parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')?.checked).toBe(
        true,
      ),
    );
    expect(parent.getAttribute('aria-checked')).toBe('true');
  });

  test('disabled selected items render checked without changing cascade aggregates', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        selectedIds: ['parent', 'child'],
        expandedIds: ['parent'],
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
    const child = treeItem(container, 'Child') as HTMLElement;
    await waitFor(() =>
      expect(parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')?.checked).toBe(
        true,
      ),
    );
    await waitFor(() =>
      expect(child.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')?.checked).toBe(
        true,
      ),
    );
    expect(parent.getAttribute('aria-checked')).toBe('true');
    expect(child.getAttribute('aria-checked')).toBe('true');
  });

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

    const parent = treeItem(container, 'Parent') as HTMLElement;
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
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
    await fireEvent.click(checkbox as HTMLInputElement);
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
    await fireEvent.keyDown(parent, { key: 'Enter' });
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    expect(selectedIds).toEqual([]);

    await waitFor(() => expect(treeItem(container, 'Child')).not.toBeNull());
    const child = treeItem(container, 'Child') as HTMLElement;
    await fireEvent.keyDown(child, { key: 'Enter' });
    expect(selectedIds).toEqual(['child']);
  });

  test('checkbox click does not expand or collapse branches', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        checkboxSelection: true,
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

    const parent = treeItem(container, 'Parent') as HTMLElement;
    await fireEvent.click(parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')!);
    expect(expandedIds).toEqual([]);
  });

  test('TreeSelectAll selects and clears root-level ids from selectionControls', async () => {
    let selectedIds: string[] = [];
    const selectionControls = createRawSnippet(() => ({
      render: () => `<div class="controls"></div>`,
      setup: (node: Element) => {
        const instance = mount(TreeSelectAll, { target: node, props: { parentId: null } });
        return () => unmount(instance);
      },
    }));

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
        selectionControls,
        children: treeItemsSnippet([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]),
      },
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    await fireEvent.click(buttons[0]!);
    expect(selectedIds).toEqual(['a', 'b']);
    await fireEvent.click(buttons[1]!);
    expect(selectedIds).toEqual([]);
  });

  test('TreeSelectAll includeDescendants selects nested ids', async () => {
    let selectedIds: string[] = [];
    const selectionControls = createRawSnippet(() => ({
      render: () => `<div class="controls"></div>`,
      setup: (node: Element) => {
        const instance = mount(TreeSelectAll, {
          target: node,
          props: { parentId: null, includeDescendants: true },
        });
        return () => unmount(instance);
      },
    }));

    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        selectionBehavior: 'cascade',
        expandedIds: ['parent'],
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
        selectionControls,
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

    const button = container.querySelector<HTMLButtonElement>('.cinder-tree-select-all__button');
    await fireEvent.click(button as HTMLButtonElement);
    expect(selectedIds).toEqual(['parent', 'child']);
  });

  test('TreeSelectAll includeDescendants respects explicit child selection scopes', async () => {
    let selectedIds: string[] = [];
    const selectionControls = createRawSnippet(() => ({
      render: () => `<div class="controls"></div>`,
      setup: (node: Element) => {
        const instance = mount(TreeSelectAll, {
          target: node,
          props: { parentId: null, includeDescendants: true },
        });
        return () => unmount(instance);
      },
    }));

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
        selectionControls,
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            selectionScopeIds: ['child'],
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });

    const selectAllButton = container.querySelector<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    await fireEvent.click(selectAllButton as HTMLButtonElement);
    expect(selectedIds).toEqual(['child']);

    const parent = treeItem(container, 'Parent') as HTMLElement;
    await fireEvent.click(parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox')!);
    expect(selectedIds).toEqual([]);
  });

  test('TreeSelectAll disables when every target is disabled', async () => {
    const selectionControls = createRawSnippet(() => ({
      render: () => `<div class="controls"></div>`,
      setup: (node: Element) => {
        const instance = mount(TreeSelectAll, { target: node, props: { parentId: null } });
        return () => unmount(instance);
      },
    }));

    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        selectionMode: 'multiple',
        selectionControls,
        children: treeItemsSnippet([{ id: 'a', label: 'A', disabled: true }]),
      },
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[1]?.disabled).toBe(true);
  });

  test('TreeSelectAll outside tree context throws a clear usage error', () => {
    expect(() => render(TreeSelectAll, { props: {} })).toThrow(/missing_context/);
  });
});

// ---------------------------------------------------------------------------
// Async loading
// Use TreeTestHarness so expandedIds is backed by real Svelte $state,
// enabling cross-component reactive tracking for the async load effects.
// ---------------------------------------------------------------------------

describe('Tree — async loading', () => {
  test('expanding a branch with loadChildren sets aria-busy="true" while pending', async () => {
    let resolveLoad!: () => void;
    const loadChildren = () =>
      new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });

    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        children: createRawSnippet(() => ({
          render: () => `<div class="w"></div>`,
          setup: (node: Element) => {
            const inst = mount(TreeItem, {
              target: node,
              props: { id: 'async-branch', label: 'Branch', loadChildren },
            });
            return () => unmount(inst);
          },
        })),
      },
    });

    const item = container.querySelector('[role="treeitem"]') as HTMLElement;
    item.focus();
    await fireEvent.keyDown(item, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });

    resolveLoad();
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    });
  });

  test('loader rejection invokes onloaderror and collapses branch', async () => {
    const errors: Array<{ error: unknown; id: string }> = [];
    const loadError = new Error('fetch failed');

    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        children: createRawSnippet(() => ({
          render: () => `<div class="w"></div>`,
          setup: (node: Element) => {
            const inst = mount(TreeItem, {
              target: node,
              props: {
                id: 'error-branch',
                label: 'Error Branch',
                loadChildren: async () => {
                  throw loadError;
                },
                onloaderror: (error: unknown, id: string) => errors.push({ error, id }),
              },
            });
            return () => unmount(inst);
          },
        })),
      },
    });

    const item = container.querySelector('[role="treeitem"]') as HTMLElement;
    item.focus();
    await fireEvent.keyDown(item, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(errors.length).toBe(1);
      expect(errors[0]?.error).toBe(loadError);
      expect(errors[0]?.id).toBe('error-branch');
    });

    await waitFor(() => {
      expect(container.querySelector('[aria-expanded="true"]')).toBeNull();
    });
  });

  test('when onloaderror is absent, console.error is called with [cinder-tree] prefix', async () => {
    const errorMessages: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errorMessages.push(args.join(' '));
    };

    try {
      const { container } = render(TreeTestHarness, {
        props: {
          'aria-label': 'T',
          children: createRawSnippet(() => ({
            render: () => `<div class="w"></div>`,
            setup: (node: Element) => {
              const inst = mount(TreeItem, {
                target: node,
                props: {
                  id: 'nohandler-branch',
                  label: 'NoHandler',
                  loadChildren: async () => {
                    throw new Error('unhandled');
                  },
                },
              });
              return () => unmount(inst);
            },
          })),
        },
      });

      const item = container.querySelector('[role="treeitem"]') as HTMLElement;
      item.focus();
      await fireEvent.keyDown(item, { key: 'ArrowRight' });

      await waitFor(() => {
        expect(errorMessages.some((m) => m.includes('[cinder-tree]'))).toBe(true);
      });
    } finally {
      console.error = originalError;
    }
  });

  test('collapsing during load aborts without calling onloaderror', async () => {
    const errors: unknown[] = [];
    let aborted = false;
    const loadChildren = ({ signal }: { id: string; signal: AbortSignal }) =>
      new Promise<void>((_resolve, _reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        // never resolves — simulates a hung request
      });

    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        children: createRawSnippet(() => ({
          render: () => `<div class="w"></div>`,
          setup: (node: Element) => {
            const inst = mount(TreeItem, {
              target: node,
              props: {
                id: 'abort-branch',
                label: 'Abort Branch',
                loadChildren,
                onloaderror: (error: unknown) => errors.push(error),
              },
            });
            return () => unmount(inst);
          },
        })),
      },
    });

    const item = container.querySelector('[role="treeitem"]') as HTMLElement;
    item.focus();
    // Expand to start loading
    await fireEvent.keyDown(item, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });
    // Collapse to abort
    await fireEvent.keyDown(item, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    });
    expect(aborted).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test('loadChildren is not re-invoked after successful load', async () => {
    let callCount = 0;
    const loadChildren = async () => {
      callCount++;
    };

    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        children: createRawSnippet(() => ({
          render: () => `<div class="w"></div>`,
          setup: (node: Element) => {
            const inst = mount(TreeItem, {
              target: node,
              props: { id: 'reload-branch', label: 'Reload Branch', loadChildren },
            });
            return () => unmount(inst);
          },
        })),
      },
    });

    const item = container.querySelector('[role="treeitem"]') as HTMLElement;
    // Expand
    item.focus();
    await fireEvent.keyDown(item, { key: 'ArrowRight' });
    await waitFor(() => expect(callCount).toBe(1));
    // Collapse
    await fireEvent.keyDown(item, { key: 'ArrowLeft' });
    await waitFor(() => {
      const reloadItem = treeItem(container, 'Reload Branch');
      expect(reloadItem?.getAttribute('aria-expanded')).toBe('false');
    });
    // Expand again
    await fireEvent.keyDown(item, { key: 'ArrowRight' });
    // Give time for any re-trigger
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Should still be 1, not 2
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Accessibility — disabled items
// ---------------------------------------------------------------------------

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
    const branch = treeItem(container, 'Branch') as HTMLElement;

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
    const branch = treeItem(container, 'Branch') as HTMLElement;

    await fireEvent.click(branch);

    expect(branch.getAttribute('aria-expanded')).toBe('true');
    expect(selectedIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Typeahead
// ---------------------------------------------------------------------------

describe('Tree — typeahead', () => {
  test('typing a character focuses next item starting with that char', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([
          { id: 'banana', label: 'Banana' },
          { id: 'apple', label: 'Apple' },
          { id: 'avocado', label: 'Avocado' },
        ]),
      },
    });
    const banana = treeItem(container, 'Banana') as HTMLElement;
    banana.focus();
    await fireEvent.keyDown(banana, { key: 'a' });
    const apple = treeItem(container, 'Apple');
    expect(apple?.getAttribute('tabindex')).toBe('0');
  });

  test('unmounting before the reset timer fires leaves no leaked timer', async () => {
    // handleTypeahead schedules a 500 ms setTimeout to clear typeaheadBuffer.
    // The $effect cleanup in tree.svelte must clearTimeout on destroy —
    // otherwise the callback fires against an unmounted component.
    const timers = trackTimers();
    try {
      const { container, unmount } = render(Tree, {
        props: {
          'aria-label': 'T',
          children: treeItemsSnippet([
            { id: 'banana', label: 'Banana' },
            { id: 'apple', label: 'Apple' },
          ]),
        },
      });

      // Fire a single printable-character keydown on the first treeitem to
      // trigger handleTypeahead, which schedules typeaheadTimer = setTimeout(..., 500).
      const firstItem = treeItem(container, 'Banana') as HTMLElement;
      firstItem.focus();
      await fireEvent.keyDown(firstItem, { key: 'a' });

      // Unmount immediately — the 500 ms timer is still pending.
      unmount();
      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });

  test('disableTypeahead prevents typeahead from moving focus', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        disableTypeahead: true,
        children: treeItemsSnippet([
          { id: 'banana', label: 'Banana' },
          { id: 'apple', label: 'Apple' },
        ]),
      },
    });
    const banana = treeItem(container, 'Banana') as HTMLElement;
    banana.focus();
    await fireEvent.keyDown(banana, { key: 'a' });
    // Banana should still be focused (typeahead disabled)
    expect(banana.getAttribute('tabindex')).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// Button inside row does not trigger tree actions
// ---------------------------------------------------------------------------

describe('Tree — event filtering', () => {
  test('click on a button inside row does NOT toggle selection', async () => {
    let selectedIds: string[] = [];

    const buttonSnippet = createRawSnippet(() => ({
      render: () => `<div class="w"></div>`,
      setup: (node: Element) => {
        const rowSnippet = createRawSnippet(() => ({
          render: () => `<button class="inner-btn" type="button">Action</button>`,
          setup: () => {},
        })) satisfies Snippet<
          [{ expanded: boolean; selected: boolean; busy: boolean; level: number }]
        >;
        const inst = mount(TreeItem, {
          target: node,
          props: {
            id: 'item-with-btn',
            label: 'Item',
            row: rowSnippet,
          },
        });
        return () => unmount(inst);
      },
    }));

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
        children: buttonSnippet,
      },
    });

    const btn = container.querySelector('.inner-btn') as HTMLElement;
    await fireEvent.click(btn);
    expect(selectedIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Attachment-based registration (DOM-order navigation)
// ---------------------------------------------------------------------------

describe('Tree — attachment registration', () => {
  test('arrow keys walk items in DOM order after the middle item remounts', async () => {
    const { container, rerender } = render(TreeAttachFixture, {
      props: { ids: ['a', 'b', 'c'], showMiddle: true },
    });

    expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(3);

    // Unmount the middle item; navigation should now skip over the missing slot.
    await rerender({ ids: ['a', 'b', 'c'], showMiddle: false });
    await waitFor(() => {
      expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(2);
    });

    const a = treeItem(container, 'a') as HTMLElement;
    a.focus();
    await fireEvent.keyDown(a, { key: 'ArrowDown' });
    const c = treeItem(container, 'c') as HTMLElement;
    expect(c.getAttribute('tabindex')).toBe('0');

    // Remount the middle item; navigation should once again include it.
    await rerender({ ids: ['a', 'b', 'c'], showMiddle: true });
    await waitFor(() => {
      expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(3);
    });

    const aAgain = treeItem(container, 'a') as HTMLElement;
    aAgain.focus();
    await fireEvent.keyDown(aAgain, { key: 'ArrowDown' });
    const b = treeItem(container, 'b') as HTMLElement;
    expect(b.getAttribute('tabindex')).toBe('0');
    await fireEvent.keyDown(b, { key: 'ArrowDown' });
    const cAgain = treeItem(container, 'c') as HTMLElement;
    expect(cAgain.getAttribute('tabindex')).toBe('0');
  });

  test('conditional item unmount/remount returns the registry to baseline', async () => {
    const { container, rerender } = render(TreeAttachFixture, {
      props: { ids: ['a', 'b', 'c'], showMiddle: true },
    });

    const baseline = container.querySelectorAll('[role="treeitem"]').length;
    expect(baseline).toBe(3);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await rerender({ ids: ['a', 'b', 'c'], showMiddle: false });
      await waitFor(() => {
        expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(baseline - 1);
      });
      await rerender({ ids: ['a', 'b', 'c'], showMiddle: true });
      await waitFor(() => {
        expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(baseline);
      });
    }

    // After the cycles, ArrowDown still visits each item in DOM order.
    const a = treeItem(container, 'a') as HTMLElement;
    a.focus();
    await fireEvent.keyDown(a, { key: 'ArrowDown' });
    const b = treeItem(container, 'b') as HTMLElement;
    expect(b.getAttribute('tabindex')).toBe('0');
    await fireEvent.keyDown(b, { key: 'ArrowDown' });
    const c = treeItem(container, 'c') as HTMLElement;
    expect(c.getAttribute('tabindex')).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// Touch targets and long-label overflow (markup contract)
//
// happy-dom does not lay out or compute box sizes, so these assert the markup
// hooks the CSS depends on rather than computed pixels: the row carries the
// class that the stylesheet gives a min-block-size touch target, and the
// visible label carries the truncation class while the full text stays in the
// visually-hidden span for assistive tech.
// ---------------------------------------------------------------------------

describe('Tree touch targets and label overflow', () => {
  const LONG_LABEL =
    'Quarterly financial reports and supporting appendices for the audit committee';

  test('each item row carries the touch-target row class', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: 'Alpha' }]),
      },
    });
    const item = treeItem(container, 'Alpha');
    expect(item?.querySelector('.cinder-tree-item__row')).not.toBeNull();
  });

  test('the visible label carries the overflow/truncation class', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: LONG_LABEL }]),
      },
    });
    const item = treeItem(container, LONG_LABEL);
    const label = item?.querySelector<HTMLElement>('.cinder-tree-item__label');
    expect(label).not.toBeNull();
    // Visible label is aria-hidden so the truncated text is never announced.
    expect(label?.getAttribute('aria-hidden')).toBe('true');
  });

  test('the full label text remains available to assistive tech regardless of visual truncation', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: LONG_LABEL }]),
      },
    });
    // The visually-hidden label span (which labels the treeitem) holds the
    // complete, untruncated text.
    const srLabel = [...container.querySelectorAll<HTMLElement>('.cinder-sr-only')].find(
      (element) => element.textContent === LONG_LABEL,
    );
    expect(srLabel).not.toBeUndefined();
    const item = treeItem(container, LONG_LABEL);
    expect(item?.getAttribute('aria-labelledby')).toBe(srLabel?.id);
  });
});
