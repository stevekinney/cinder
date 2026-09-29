/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { TreeDataItem } from '../../_internal/tree-data.ts';
import type { TreeRef } from './tree.types.ts';

setupHappyDom();

const { render, waitFor, cleanup } = await import('@testing-library/svelte');
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

describe('Tree virtualized data path', () => {
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
    tree.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      scrollToCalls += 1;
      currentScrollTop =
        typeof options === 'number' ? (y ?? 0) : (options?.top ?? currentScrollTop);
    };
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
