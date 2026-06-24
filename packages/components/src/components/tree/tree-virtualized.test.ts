/// <reference lib="dom" />
import { Virtualizer } from '@tanstack/virtual-core';
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, tick, unmount } from 'svelte';

import type { TreeDataItem } from '../../_internal/tree-data.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TreeRef } from './tree.types.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');
const { default: TreeSelectAll } = await import('../_tree-select-all/tree-select-all.svelte');

afterEach(() => cleanup());

function flatItems(count: number): TreeDataItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    label: `Item ${index}`,
  }));
}

function nestedItems(): TreeDataItem[] {
  return [
    {
      id: 'projects',
      label: 'Projects',
      children: [
        { id: 'apollo', label: 'Apollo' },
        { id: 'zeus', label: 'Zeus', disabled: true },
      ],
    },
    {
      id: 'archive',
      label: 'Archive',
      children: [{ id: 'old-apollo', label: 'Old Apollo' }],
    },
  ];
}

function treeItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')];
}

function treeItemById(container: HTMLElement, id: string): HTMLElement {
  const item = treeItems(container).find((element) => element.dataset['cinderTreeItemId'] === id);
  if (!item) throw new Error(`Missing virtualized tree item: ${id}`);
  return item;
}

function visibleItemIds(container: HTMLElement): string[] {
  return treeItems(container).map((item) => item.dataset['cinderTreeItemId'] ?? '');
}

describe('Tree — virtualized data path', () => {
  test('renders only a window while aria metadata reflects the full data set', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: flatItems(100),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    await waitFor(() => expect(treeItems(container).length).toBeGreaterThanOrEqual(9));
    expect(treeItems(container).length).toBeLessThan(100);
    expect(tree.getAttribute('aria-activedescendant')).toBe(`${tree.id}-item-0`);

    const first = treeItems(container)[0]!;
    expect(first.dataset['cinderTreeItemId']).toBe('item-0');
    expect(first.hasAttribute('data-cinder-focused')).toBe(true);
    expect(first.getAttribute('aria-posinset')).toBe('1');
    expect(first.getAttribute('aria-setsize')).toBe('100');
  });

  test('custom virtualized rows keep stable treeitem accessible names', async () => {
    const iconOnlyRow = createRawSnippet(() => ({
      render: () => '<span aria-hidden="true">*</span>',
    }));

    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: flatItems(10),
        virtualizedItem: iconOnlyRow,
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
      },
    });

    await waitFor(() => expect(treeItemById(container, 'item-0')).toBeDefined());
    expect(treeItemById(container, 'item-0').getAttribute('aria-label')).toBe('Item 0');
  });

  test('virtualizationOverscan can intentionally disable extra rows', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: flatItems(100),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        virtualizationOverscan: 0,
      },
    });

    await waitFor(() => expect(treeItems(container).length).toBeGreaterThan(0));
    expect(treeItems(container).length).toBeLessThanOrEqual(6);
  });

  test('falls back to calculated rows when virtual-core returns an empty measured window', async () => {
    const originalGetVirtualItems = Virtualizer.prototype.getVirtualItems;
    Virtualizer.prototype.getVirtualItems = Object.assign(() => [], {
      updateDeps: () => {},
    }) as typeof Virtualizer.prototype.getVirtualItems;
    try {
      const { container } = render(Tree, {
        props: {
          'aria-label': 'Virtual files',
          virtualized: true,
          items: flatItems(100),
          virtualizationEstimatedRowHeight: 20,
          virtualizationHeight: 100,
        },
      });

      await waitFor(() => expect(treeItems(container).length).toBeGreaterThan(0));
      expect(treeItemById(container, 'item-0').getAttribute('aria-posinset')).toBe('1');
    } finally {
      Virtualizer.prototype.getVirtualItems = originalGetVirtualItems;
    }
  });

  test('scrolling shifts the rendered window and keeps full aria-posinset', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: flatItems(100),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    tree.scrollTop = 1000;
    await fireEvent.scroll(tree);

    await waitFor(() =>
      expect(
        treeItems(container).some((item) => item.dataset['cinderTreeItemId'] === 'item-50'),
      ).toBe(true),
    );
    const row = treeItems(container).find(
      (item) => item.dataset['cinderTreeItemId'] === 'item-50',
    )!;
    expect(row.getAttribute('aria-posinset')).toBe('51');
    expect(row.getAttribute('aria-setsize')).toBe('100');

    const activeId = tree.getAttribute('aria-activedescendant');
    expect(activeId).toBe(`${tree.id}-item-0`);
    expect(container.querySelector(`#${activeId}`)).not.toBeNull();
  });

  test('keyboard focus scrolls off-window items before updating aria-activedescendant', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: flatItems(100),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    tree.focus();
    await fireEvent.keyDown(tree, { key: 'End' });

    await waitFor(() =>
      expect(tree.getAttribute('aria-activedescendant')).toBe(`${tree.id}-item-99`),
    );
    expect(treeItems(container).some((item) => item.id === `${tree.id}-item-99`)).toBe(true);
  });

  test('ArrowRight on a virtualized leaf is a prevented no-op', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: flatItems(10),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    tree.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });

    tree.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(tree.getAttribute('aria-activedescendant')).toBe(`${tree.id}-item-0`);
  });

  test('Shift+ArrowDown selects the active virtualized row before moving focus', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        items: flatItems(10),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    tree.focus();
    await fireEvent.keyDown(tree, { key: 'ArrowDown', shiftKey: true });

    await waitFor(() => {
      expect(tree.getAttribute('aria-activedescendant')).toBe(`${tree.id}-item-1`);
      expect(treeItemById(container, 'item-0').getAttribute('aria-selected')).toBe('true');
    });
  });

  test('filtering retains matching descendants and ancestors without mutating expandedIds', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        filterValue: 'old',
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
      },
    });

    await waitFor(() => {
      expect(visibleItemIds(container)).toEqual(['archive', 'old-apollo']);
    });
    expect(treeItemById(container, 'archive').getAttribute('aria-expanded')).toBe('true');
    expect(expandedIds).toEqual([]);
  });

  test('ArrowRight on a filter-revealed virtualized branch focuses the visible child without mutating expandedIds', async () => {
    let expandedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        filterValue: 'old',
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    await waitFor(() => {
      expect(visibleItemIds(container)).toEqual(['archive', 'old-apollo']);
    });
    tree.focus();
    await fireEvent.keyDown(tree, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(treeItemById(container, 'old-apollo').hasAttribute('data-cinder-focused')).toBe(true);
    });
    expect(expandedIds).toEqual([]);
  });

  test('disableTypeahead prevents virtualized typeahead focus movement', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: [
          { id: 'alpha', label: 'Alpha' },
          { id: 'beta', label: 'Beta' },
        ],
        disableTypeahead: true,
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    tree.focus();
    await fireEvent.keyDown(tree, { key: 'b' });

    expect(tree.getAttribute('aria-activedescendant')).toBe(`${tree.id}-item-0`);
    expect(treeItemById(container, 'alpha').hasAttribute('data-cinder-focused')).toBe(true);
    expect(treeItemById(container, 'beta').hasAttribute('data-cinder-focused')).toBe(false);
  });

  test('star key expands virtualized sibling branches', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        expandedIds: ['projects'],
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    tree.focus();
    await fireEvent.keyDown(tree, { key: '*' });

    await waitFor(() => {
      expect(treeItemById(container, 'old-apollo').getAttribute('aria-level')).toBe('2');
    });
  });

  test('disabled virtualized rows receive focus but do not change selection', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'single',
        items: [
          { id: 'alpha', label: 'Alpha', disabled: true },
          { id: 'beta', label: 'Beta' },
        ],
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
      },
    });

    await fireEvent.click(treeItemById(container, 'alpha'));

    expect(selectedIds).toEqual([]);
    expect(treeItemById(container, 'alpha').hasAttribute('data-cinder-focused')).toBe(true);
    expect(treeItemById(container, 'alpha').getAttribute('aria-selected')).toBe('false');
  });

  test('virtualized rows ignore double-click follow-up activation', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
      },
    });

    await fireEvent.click(treeItemById(container, 'projects'), { detail: 1 });
    await waitFor(() => {
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true');
    });

    await fireEvent.click(treeItemById(container, 'projects'), { detail: 2 });

    expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true');
  });

  test('virtualized branch rows select and expand on plain click', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'single',
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
      },
    });

    await fireEvent.click(treeItemById(container, 'projects'));
    await waitFor(() => {
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true');
    });

    expect(selectedIds).toEqual(['projects']);
  });

  test('cascade selection includes virtualized descendants and skips disabled descendants', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        selectionBehavior: 'cascade',
        expandedIds: ['projects'],
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
      },
    });

    expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true');
    await fireEvent.keyDown(treeItemById(container, 'projects'), { key: ' ' });

    await waitFor(() => {
      expect(treeItemById(container, 'projects').getAttribute('aria-selected')).toBe('true');
      expect(treeItemById(container, 'apollo').getAttribute('aria-selected')).toBe('true');
      expect(treeItemById(container, 'zeus').getAttribute('aria-selected')).toBe('false');
    });
  });

  test('checkbox selection renders checkbox state for virtualized rows', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        selectedIds: ['apollo'],
        expandedIds: ['projects'],
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
      },
    });

    const projects = treeItemById(container, 'projects');
    const projectsCheckbox = projects.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(projects.getAttribute('aria-selected')).toBeNull();
    expect(projects.getAttribute('aria-checked')).toBe('mixed');
    expect(projectsCheckbox.indeterminate).toBe(true);
    expect(treeItemById(container, 'apollo').getAttribute('aria-checked')).toBe('true');

    await fireEvent.click(projectsCheckbox);

    await waitFor(() => {
      expect(projects.getAttribute('aria-checked')).toBe('true');
      expect(projectsCheckbox.checked).toBe(true);
    });
    expect(treeItemById(container, 'apollo').getAttribute('aria-checked')).toBe('true');
    expect(treeItemById(container, 'zeus').getAttribute('aria-checked')).toBe('false');
    expect(projects.getAttribute('aria-expanded')).toBe('true');
  });

  test('Enter on a virtualized checkbox branch toggles expansion without selection', async () => {
    let selectedIds: string[] = [];
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        checkboxSelection: true,
        selectionBehavior: 'cascade',
        items: nestedItems(),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;

    tree.focus();
    await fireEvent.keyDown(tree, { key: 'Enter' });
    await waitFor(() =>
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true'),
    );
    expect(selectedIds).toEqual([]);
    expect(treeItemById(container, 'projects').getAttribute('aria-checked')).toBe('false');

    await fireEvent.keyDown(tree, { key: 'Enter' });
    await waitFor(() =>
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('false'),
    );
    expect(selectedIds).toEqual([]);
    expect(treeItemById(container, 'projects').getAttribute('aria-checked')).toBe('false');

    await fireEvent.keyDown(treeItemById(container, 'projects'), { key: 'Enter' });
    await waitFor(() =>
      expect(treeItemById(container, 'projects').getAttribute('aria-expanded')).toBe('true'),
    );
    expect(selectedIds).toEqual([]);
    expect(treeItemById(container, 'projects').getAttribute('aria-checked')).toBe('false');
  });

  test('TreeSelectAll includeDescendants selects virtualized data children', async () => {
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
        'aria-label': 'Virtual files',
        virtualized: true,
        selectionMode: 'multiple',
        selectionBehavior: 'cascade',
        expandedIds: ['projects'],
        items: nestedItems(),
        selectionControls,
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 120,
        get selectedIds() {
          return selectedIds;
        },
        set selectedIds(value: string[]) {
          selectedIds = value;
        },
      },
    });

    const selectAllButton = container.querySelector<HTMLButtonElement>(
      '.cinder-tree-select-all__button',
    );
    expect(selectAllButton?.disabled).toBe(false);

    await fireEvent.click(selectAllButton as HTMLButtonElement);

    expect(selectedIds).toEqual(['projects', 'apollo', 'archive', 'old-apollo']);
  });

  test('TreeRef scrollToRow uses the virtualizer for data rows', async () => {
    let treeRef: TreeRef | undefined;
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: flatItems(100),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get ref() {
          return treeRef;
        },
        set ref(value: TreeRef | undefined) {
          treeRef = value;
        },
      },
    });

    await tick();
    treeRef?.scrollToRow('item-75', { block: 'center' });

    await waitFor(() =>
      expect(
        treeItems(container).some((item) => item.dataset['cinderTreeItemId'] === 'item-75'),
      ).toBe(true),
    );
  });

  test('TreeRef scrollToRow delegates to scrollTo without synthetic scroll events', async () => {
    let treeRef: TreeRef | undefined;
    const { container } = render(Tree, {
      props: {
        'aria-label': 'Virtual files',
        virtualized: true,
        items: flatItems(100),
        virtualizationEstimatedRowHeight: 20,
        virtualizationHeight: 100,
        get ref() {
          return treeRef;
        },
        set ref(value: TreeRef | undefined) {
          treeRef = value;
        },
      },
    });

    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    let currentScrollTop = 0;
    let directScrollTopWrites = 0;
    let scrollEvents = 0;
    let scrollToCalls = 0;

    Object.defineProperty(tree, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(tree, 'scrollTop', {
      configurable: true,
      get: () => currentScrollTop,
      set: (value: number) => {
        directScrollTopWrites += 1;
        currentScrollTop = value;
      },
    });
    tree.scrollTo = ((options?: ScrollToOptions | number, y?: number) => {
      scrollToCalls += 1;
      currentScrollTop =
        typeof options === 'number' ? (y ?? 0) : (options?.top ?? currentScrollTop);
    }) as typeof tree.scrollTo;
    tree.addEventListener('scroll', () => {
      scrollEvents += 1;
    });

    await waitFor(() => expect(treeRef).toBeDefined());
    treeRef?.scrollToRow('item-75', { block: 'center' });

    expect(scrollToCalls).toBe(1);
    expect(directScrollTopWrites).toBe(0);
    expect(scrollEvents).toBe(0);
  });
});
