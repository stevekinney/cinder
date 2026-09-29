import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import type { Snippet } from 'svelte';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

setupHappyDom();
const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

const { default: TreeItem } = await import('../tree-item/tree-item.svelte');
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

    const btn = requiredInstance(container.querySelector('.inner-btn'), HTMLElement);
    await fireEvent.click(btn);
    expect(selectedIds).toEqual([]);
  });
});
