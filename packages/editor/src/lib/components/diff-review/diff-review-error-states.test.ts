/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

import type { DiffReviewState, DiffReviewTargetInput } from '../../diff-review-state/index.ts';
import { createDiffReviewState } from '../../diff-review-state/index.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: DiffReview } = await import('./diff-review.svelte');

const validTargets: DiffReviewTargetInput[] = [
  {
    targetId: 't1',
    kind: 'markdown',
    label: 'notes.md',
    original: 'line one',
    current: 'line ONE',
    normalizeInputs: false,
  },
];

function createdState(targets: DiffReviewTargetInput[]): DiffReviewState {
  const created = createDiffReviewState(targets);
  if (!created.ok) throw new Error('fixture setup failed');
  return created.value;
}

describe('DiffReview component shell: invalid targets', () => {
  test('an invalid targets update shows a structured error and keeps the last valid file list', async () => {
    const state = createdState(validTargets);
    const { container, getByText, rerender } = render(DiffReview, {
      targets: validTargets,
      state,
      onStateChange: () => {},
    });
    expect(getByText('notes.md')).toBeDefined();

    const invalidTargets = [
      { ...validTargets[0], kind: 'nonsense' },
    ] as unknown as DiffReviewTargetInput[];
    await rerender({ targets: invalidTargets, state, onStateChange: () => {} });

    expect(container.querySelector('[role="alert"].diff-review-targets-error')).not.toBeNull();
    expect(container.textContent).toContain('invalid-target');
    // The last valid file list is still shown, not wiped by the bad update.
    expect(container.textContent).toContain('notes.md');
  });

  test('a subsequent valid targets update clears the error and applies normally', async () => {
    const state = createdState(validTargets);
    const invalidTargets = [
      { ...validTargets[0], kind: 'nonsense' },
    ] as unknown as DiffReviewTargetInput[];
    const { container, rerender } = render(DiffReview, {
      targets: invalidTargets,
      state,
      onStateChange: () => {},
    });
    expect(container.querySelector('.diff-review-targets-error')).not.toBeNull();

    await rerender({ targets: validTargets, state, onStateChange: () => {} });
    expect(container.querySelector('.diff-review-targets-error')).toBeNull();
  });
});

// Renderer-failure (the boundary catching an exception thrown while
// mounting a target's viewer, disabling that target's own comment
// creation without affecting other targets or export) is covered at
// `DiffReviewRenderer`'s own level in `diff-review-renderer.test.ts`.
// It can't be exercised here through `DiffReview`'s public `targets` prop:
// the same shape check that would make a target throw during parsing
// (e.g. a non-string `patch`) is already rejected by the "invalid targets"
// handling above, which falls back to the last good render before the
// broken data ever reaches `DiffReviewRenderer`.

describe('DiffReview component shell: no commentable patch lines', () => {
  test('a file with no changed lines shows the empty message and export remains available', () => {
    const unchanged: DiffReviewTargetInput[] = [
      {
        targetId: 't1',
        kind: 'markdown',
        label: 'same.md',
        original: 'identical',
        current: 'identical',
        normalizeInputs: false,
      },
    ];
    const state = createdState(unchanged);
    const { container, getByLabelText } = render(DiffReview, {
      targets: unchanged,
      state,
      onStateChange: () => {},
    });

    expect(container.textContent).toContain('No commentable patch lines.');
    // Export controls are unaffected by an empty diff.
    expect(getByLabelText('Filter files by path')).toBeDefined();
  });
});
