/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

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
});
