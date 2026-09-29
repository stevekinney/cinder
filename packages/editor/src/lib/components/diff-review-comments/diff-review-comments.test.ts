/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import type { DiffReviewState } from '../../diff-review-state/index.ts';
import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: DiffReviewComments } = await import('./diff-review-comments.svelte');

function stateWithTwoComments(): DiffReviewState {
  const created = createDiffReviewState([
    {
      targetId: 't1',
      kind: 'markdown',
      label: 'README.md',
      original: 'a',
      current: 'b',
      normalizeInputs: false,
    },
  ]);
  if (!created.ok) throw new Error('fixture setup failed');
  const withOpen = reduceDiffReviewState(created.value, {
    id: 'open-1',
    type: 'create-comment',
    targetId: 't1',
    anchor: { kind: 'file', fileOccurrence: 0 },
    body: 'Please clarify this section.',
  });
  if (!withOpen.ok) throw new Error('fixture setup failed');
  const withResolved = reduceDiffReviewState(withOpen.value, {
    id: 'resolved-1',
    type: 'create-comment',
    targetId: 't1',
    anchor: { kind: 'file', fileOccurrence: 0 },
    body: 'Already addressed.',
  });
  if (!withResolved.ok) throw new Error('fixture setup failed');
  const resolved = reduceDiffReviewState(withResolved.value, {
    type: 'resolve-comment',
    id: 'resolved-1',
  });
  if (!resolved.ok) throw new Error('fixture setup failed');
  return resolved.value;
}

describe('DiffReview component comments panel: default filter', () => {
  test('shows every saved comment, including resolved ones, by default', () => {
    const state = stateWithTwoComments();
    const { container } = render(DiffReviewComments, { state, onStateChange: () => {} });
    expect(container.querySelectorAll('.diff-review-comment-item')).toHaveLength(2);
    expect(container.textContent).toContain('Please clarify this section.');
    expect(container.textContent).toContain('Already addressed.');
  });

  test('"Unresolved only" hides resolved comments', async () => {
    const state = stateWithTwoComments();
    const { container, getByText } = render(DiffReviewComments, { state, onStateChange: () => {} });
    await fireEvent.click(getByText('Unresolved only'));
    expect(container.querySelectorAll('.diff-review-comment-item')).toHaveLength(1);
    expect(container.textContent).toContain('Please clarify this section.');
    expect(container.textContent).not.toContain('Already addressed.');
  });
});

describe('DiffReview component comments panel: mutations', () => {
  test('resolving an open comment calls onStateChange with it marked resolved', async () => {
    const state = stateWithTwoComments();
    let latest: DiffReviewState = state;
    const { getAllByText } = render(DiffReviewComments, {
      state,
      onStateChange: (next: DiffReviewState) => {
        latest = next;
      },
    });
    await fireEvent.click(getAllByText('Resolve')[0]!);
    const comment = latest.comments.find((c) => c.id === 'open-1');
    expect(comment?.resolved).toBe(true);
  });

  test('clicking Delete does not remove the comment until a confirmation is granted', async () => {
    const state = stateWithTwoComments();
    let latest: DiffReviewState = state;
    const { getAllByText } = render(DiffReviewComments, {
      state,
      onStateChange: (next: DiffReviewState) => {
        latest = next;
      },
    });
    await fireEvent.click(getAllByText('Delete')[0]!);
    // Not deleted yet -- onStateChange is never called just from opening the
    // confirmation; the real confirm/cancel interaction is covered by the
    // browser fixture (ConfirmDialog owns its own <dialog> focus trap, which
    // this harness cannot exercise -- see diff-viewer.test.ts's file header
    // for the same environment limitation).
    expect(latest.comments).toHaveLength(2);
  });

  test('readonly hides mutating controls but keeps the filter available', () => {
    const state = stateWithTwoComments();
    const { container, queryByText } = render(DiffReviewComments, {
      state,
      onStateChange: () => {},
      readonly: true,
    });
    expect(queryByText('Resolve')).toBeNull();
    expect(queryByText('Delete')).toBeNull();
    expect(container.querySelector('.diff-review-comments-filter')).not.toBeNull();
  });
});

describe('DiffReview component comments panel: readonly rejects mutation at the handler (defense in depth)', () => {
  // Contract: "underlying action handlers also return `readonly`". Edit,
  // Delete, Resolve, and Reopen are removed from the DOM entirely in
  // read-only mode (`{#if !readonly}`, no `disabled` fallback to bypass),
  // already covered above by "readonly hides mutating controls". The review
  // note textarea is the one control here that stays rendered-but-`disabled`,
  // so it is the one this suite can force-bypass to prove the dispatch
  // itself -- not just the `disabled` attribute -- rejects the mutation.

  test('set-review-note: force-enabling the Review note textarea still cannot mutate state', async () => {
    const onStateChange = mock(() => {});
    const { getByLabelText } = render(DiffReviewComments, {
      state: stateWithTwoComments(),
      onStateChange,
      readonly: true,
    });
    const textarea = getByLabelText('Review note') as HTMLTextAreaElement;
    // Bypass the UI-level guard: `disabled={readonly}` is the only thing
    // stopping this change today.
    textarea.disabled = false;
    await fireEvent.change(textarea, { target: { value: 'attempted note' } });
    expect(onStateChange).not.toHaveBeenCalled();
  });
});

describe('DiffReview component comments panel: multiple instances', () => {
  test('two mounted instances never share a review-note label/input id', () => {
    // Regression: the review-note field used a hardcoded id, so two
    // instances on one page (e.g. two standalone-viewer examples) broke
    // label association and produced invalid duplicate-id HTML.
    const first = render(DiffReviewComments, {
      state: stateWithTwoComments(),
      onStateChange: () => {},
    });
    const second = render(DiffReviewComments, {
      state: stateWithTwoComments(),
      onStateChange: () => {},
    });

    const firstTextarea = first.container.querySelector('textarea');
    const secondTextarea = second.container.querySelector('textarea');
    expect(firstTextarea?.id).not.toBe('');
    expect(firstTextarea?.id).not.toBe(secondTextarea?.id);
    // Each label still resolves to its own instance's textarea, scoped by container.
    expect(first.container.querySelector(`label[for="${firstTextarea?.id}"]`)).not.toBeNull();
  });
});
