/// <reference lib="dom" />
import { Virtualizer } from '@tanstack/virtual-core';
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { TreeDataItem } from '../../_internal/tree-data.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

afterEach(() => cleanup());

function flatItems(count: number): TreeDataItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    label: `Item ${index}`,
  }));
}

function treeItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')];
}

function treeItemById(container: HTMLElement, id: string): HTMLElement {
  const item = treeItems(container).find((element) => element.dataset['cinderTreeItemId'] === id);
  if (!item) throw new Error(`Missing virtualized tree item: ${id}`);
  return item;
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
    });
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

  test('a row taller than the estimate is measured rather than clipped to it', async () => {
    // getBoundingClientRect() in happy-dom never reflects real CSS layout, so this
    // stands in for a real browser: a row whose OWN box carries an imposed
    // block-size reports that imposed value back (today's bug — the measurement
    // is trapped at the estimate no matter how tall the content is); a row left
    // unsized reports its true content height instead.
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const intrinsicHeightByIndex = new Map<number, number>([[0, 80]]);
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
      const indexAttribute = this.dataset['cinderVirtualIndex'];
      const intrinsic =
        indexAttribute === undefined
          ? undefined
          : intrinsicHeightByIndex.get(Number.parseInt(indexAttribute, 10));
      if (intrinsic === undefined) return originalGetBoundingClientRect.call(this);
      const imposed = (this.getAttribute('style') ?? '').match(/block-size:\s*([\d.]+)px/);
      const height = imposed ? Number.parseFloat(imposed[1]!) : intrinsic;
      return {
        width: 100,
        height,
        top: 0,
        right: 100,
        bottom: height,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    };

    try {
      const { container } = render(Tree, {
        props: {
          'aria-label': 'Virtual files',
          virtualized: true,
          items: flatItems(10),
          virtualizationEstimatedRowHeight: 20,
          virtualizationHeight: 100,
        },
      });

      await waitFor(() => expect(treeItemById(container, 'item-1')).toBeDefined());
      // The virtualizer measures on mount and, once item 0's true 80px height is
      // learned, must shift every row after it down by the difference — clipped
      // measurement leaves item 1 sitting right after the 20px estimate instead.
      await waitFor(() => {
        const secondRow = treeItemById(container, 'item-1');
        const offset = secondRow.getAttribute('style')?.match(/translateY\(([\d.]+)px\)/);
        expect(Number.parseFloat(offset?.[1] ?? '0')).toBeGreaterThan(20);
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });
});
