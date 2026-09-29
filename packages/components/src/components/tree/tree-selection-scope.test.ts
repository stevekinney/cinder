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

    const parent = requiredInstance(treeItem(container, 'Parent'), HTMLElement);
    const checkbox = parent.querySelector<HTMLInputElement>('.cinder-tree-item__checkbox');
    await fireEvent.click(requiredInstance(checkbox, HTMLInputElement));
    expect(selectedIds).toEqual(['unknown', 'parent', 'child']);
    await fireEvent.click(requiredInstance(checkbox, HTMLInputElement));
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

  test('residual native .checked mutation is re-synced to selection state on next flush', async () => {
    const { container } = renderIndeterminateParents(['february']);

    const januaryInput = checkboxFor(container, 'january.pdf');
    const summaryInput = checkboxFor(container, 'summary.pdf');
    const januaryItem = requiredInstance(treeItem(container, 'january.pdf'), HTMLElement);

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
    const januaryItem = requiredInstance(treeItem(container, 'january.pdf'), HTMLElement);

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
    const archiveItem = requiredInstance(treeItem(container, 'archive'), HTMLElement);

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
});
