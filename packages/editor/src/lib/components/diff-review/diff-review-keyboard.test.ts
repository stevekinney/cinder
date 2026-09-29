/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

import type { DiffReviewState, DiffReviewTargetInput } from '../../diff-review-state/index.ts';
import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';

setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: DiffReview } = await import('./diff-review.svelte');

const targets: DiffReviewTargetInput[] = [
  {
    targetId: 't1',
    kind: 'markdown',
    label: 'notes.md',
    original: 'line one\nline two',
    current: 'line one\nline TWO',
    normalizeInputs: false,
  },
];

function stateWithComment(): DiffReviewState {
  const created = createDiffReviewState(targets);
  if (!created.ok) throw new Error('fixture setup failed');
  const commented = reduceDiffReviewState(created.value, {
    type: 'create-comment',
    targetId: 't1',
    anchor: { kind: 'file', fileOccurrence: 0 },
    body: 'A saved comment',
  });
  if (!commented.ok) throw new Error('fixture setup failed');
  return commented.value;
}

/** A state with one RESOLVED comment, so the item's mutation control is the "Reopen" button
 * rather than "Resolve" (COR-511 review: the existing keyboard-matrix coverage only ever
 * exercised the unresolved/"Resolve" case, leaving "Reopen" -- one of the contract's own named
 * keyboard-matrix cases, "create/edit/delete/resolve/reopen" -- with no tab-reachability
 * assertion at all). */
function stateWithResolvedComment(): DiffReviewState {
  const commented = stateWithComment();
  const commentId = commented.comments[0]?.id;
  if (!commentId) throw new Error('fixture setup failed');
  const resolved = reduceDiffReviewState(commented, { type: 'resolve-comment', id: commentId });
  if (!resolved.ok) throw new Error('fixture setup failed');
  return resolved.value;
}

/** A state with one nonempty (pending) draft, so the toolbar's export gate
 * is blocked and its "Review drafts" control -- the only way to open the
 * drafts inventory -- is rendered. */
function stateWithPendingDraft(): DiffReviewState {
  const created = createDiffReviewState(targets);
  if (!created.ok) throw new Error('fixture setup failed');
  const drafted = reduceDiffReviewState(created.value, {
    type: 'create-draft',
    draftId: 'draft-1',
    targetId: 't1',
    anchor: { kind: 'file', fileOccurrence: 0 },
    body: 'An unsaved draft',
  });
  if (!drafted.ok) throw new Error('fixture setup failed');
  return drafted.value;
}

function findButtonByText(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
}

describe('DiffReview component shell: keyboard matrix', () => {
  test('every own control -- file button, Reviewed checkbox, filter, toolbar, comment actions -- is a native, tab-reachable element', () => {
    const state = stateWithComment();
    const { container, getByLabelText } = render(DiffReview, {
      targets,
      state,
      onStateChange: () => {},
    });

    const nativelyFocusable = (element: Element | null): void => {
      expect(element).not.toBeNull();
      expect(element?.getAttribute('tabindex')).not.toBe('-1');
    };

    nativelyFocusable(container.querySelector('.diff-review-file-list-button'));
    nativelyFocusable(
      container.querySelector('.diff-review-file-list-item input[type="checkbox"]'),
    );
    nativelyFocusable(getByLabelText('Filter files by path'));
    nativelyFocusable(container.querySelector('.diff-review-comment-item-goto'));
    for (const label of [
      'Edit',
      'Resolve',
      'Delete',
      'Copy review',
      'Download Markdown',
      'Download JSON',
    ]) {
      nativelyFocusable(findButtonByText(container, label) ?? null);
    }
  });

  test('a resolved comment\'s "Reopen" control is a native, tab-reachable element, and activating it dispatches reopen-comment', async () => {
    const state = stateWithResolvedComment();
    let latest = state;
    const { container } = render(DiffReview, {
      targets,
      state,
      onStateChange: (next: DiffReviewState) => {
        latest = next;
      },
    });

    const reopen = findButtonByText(container, 'Reopen');
    expect(reopen).not.toBeUndefined();
    expect(reopen?.getAttribute('tabindex')).not.toBe('-1');
    expect(findButtonByText(container, 'Resolve')).toBeUndefined();

    await fireEvent.click(reopen!);
    expect(latest.comments[0]?.resolved).toBe(false);
  });

  test("the drafts inventory's Open/Save/Discard actions are native, tab-reachable elements once opened", async () => {
    const state = stateWithPendingDraft();
    const { container, getByText } = render(DiffReview, {
      targets,
      state,
      onStateChange: () => {},
    });

    await fireEvent.click(getByText('Review drafts'));

    for (const label of ['Open', 'Save', 'Discard']) {
      const button = findButtonByText(container, label);
      expect(button).not.toBeUndefined();
      expect(button?.getAttribute('tabindex')).not.toBe('-1');
    }
  });

  test('canceling the delete confirmation dialog returns focus to the Delete button that opened it', async () => {
    const state = stateWithComment();
    const { container, getByText } = render(DiffReview, {
      targets,
      state,
      onStateChange: () => {},
    });

    const deleteButton = getByText('Delete') as HTMLButtonElement;
    deleteButton.focus();
    await fireEvent.click(deleteButton);

    const cancelButton = findButtonByText(container, 'Cancel');
    expect(cancelButton).toBeDefined();
    await fireEvent.click(cancelButton!);

    expect(document.activeElement).toBe(deleteButton);
  });

  test('confirming delete also returns focus somewhere in the document, never dropping it to <body>', async () => {
    const state = stateWithComment();
    const { getByText } = render(DiffReview, {
      targets,
      state,
      onStateChange: () => {},
    });

    const deleteButton = getByText('Delete') as HTMLButtonElement;
    deleteButton.focus();
    await fireEvent.click(deleteButton);

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Delete' && candidate !== deleteButton,
    );
    expect(confirmButton).toBeDefined();
    await fireEvent.click(confirmButton!);

    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('DiffReview component shell: narrow stacked layout with labelled regions', () => {
  test('the file navigation, diff, and review regions are landmarks with accessible names', () => {
    const state = stateWithComment();
    const { getByRole } = render(DiffReview, {
      targets,
      state,
      onStateChange: () => {},
    });

    expect(getByRole('navigation', { name: 'File navigation' })).toBeDefined();
    expect(getByRole('main', { name: 'Diff' })).toBeDefined();
    expect(getByRole('complementary', { name: 'Review' })).toBeDefined();
  });

  test('the layout stacks the three regions in document order (files, diff, review) for narrow viewports', () => {
    const state = stateWithComment();
    const { container } = render(DiffReview, {
      targets,
      state,
      onStateChange: () => {},
    });

    const layout = container.querySelector('.diff-review-layout');
    expect(layout).not.toBeNull();
    const children = Array.from(layout!.children);
    expect(children.map((child) => child.tagName.toLowerCase())).toEqual(['nav', 'main', 'aside']);
  });
});
