import { describe, expect, test } from 'bun:test';

import type { DiffReviewTargetInput } from '../../diff-review-state/index.ts';
import { createDiffReviewState } from '../../diff-review-state/index.ts';
import { classifyDiffReviewAnchorStatus } from './diff-review-anchor-status.ts';

const markdownTarget: DiffReviewTargetInput = {
  targetId: 't1',
  kind: 'markdown',
  label: 'notes.md',
  original: 'a',
  current: 'b',
  normalizeInputs: false,
};

function createdState(targets: DiffReviewTargetInput[]) {
  const created = createDiffReviewState(targets);
  if (!created.ok) throw new Error('fixture setup failed');
  return created.value;
}

describe('DiffReview component anchor status', () => {
  test('a live target with no content change classifies as current', () => {
    const state = createdState([markdownTarget]);
    expect(classifyDiffReviewAnchorStatus(state, { targetId: 't1', outdated: false })).toBe(
      'current',
    );
  });

  test('a live target whose record is latched outdated classifies as outdated, not removed', () => {
    const state = createdState([markdownTarget]);
    expect(classifyDiffReviewAnchorStatus(state, { targetId: 't1', outdated: true })).toBe(
      'outdated',
    );
  });

  test('a target absent from state.targets classifies as removed, even if outdated is false', () => {
    const state = createdState([markdownTarget]);
    expect(classifyDiffReviewAnchorStatus(state, { targetId: 'gone', outdated: false })).toBe(
      'removed',
    );
  });

  test('a target absent from state.targets classifies as removed when outdated is also true', () => {
    const state = createdState([markdownTarget]);
    expect(classifyDiffReviewAnchorStatus(state, { targetId: 'gone', outdated: true })).toBe(
      'removed',
    );
  });
});
