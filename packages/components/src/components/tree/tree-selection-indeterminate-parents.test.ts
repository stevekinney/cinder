import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

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
  const item = requiredInstance(treeItem(container, label), HTMLElement);
  return item.querySelector<HTMLInputElement>('input.cinder-tree-item__checkbox')!;
}

const { default: TreeTestHarness } = await import('../_tree-test-harness.svelte');
describe('Tree — selection', () => {
  test('parent checkbox reads fully checked (never mixed) when its whole scope is selected', async () => {
    const { container } = renderIndeterminateParents([]);

    const archiveInput = checkboxFor(container, 'archive');
    const archiveItem = requiredInstance(treeItem(container, 'archive'), HTMLElement);

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

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
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

    const item = requiredInstance(treeItem(container, 'A'), HTMLElement);
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

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
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

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
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

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    const child = requiredInstance(treeItem(container, 'Child'), HTMLElement);
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
});
