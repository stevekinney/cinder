import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import { reduceDiffReviewState } from './reduce.ts';
import type { DiffReviewAction, DiffReviewAnchor, DiffReviewState } from './types.ts';

function baseState(): DiffReviewState {
  const result = createDiffReviewState([
    { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
  ]);
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

const fileAnchor: DiffReviewAnchor = { kind: 'file', fileOccurrence: 0 };

describe('DiffReview state readonly mode', () => {
  const mutatingActions: DiffReviewAction[] = [
    { type: 'create-comment', targetId: 't1', anchor: fileAnchor, body: 'x' },
    { type: 'edit-comment', id: 'any', body: 'x' },
    { type: 'delete-comment', id: 'any' },
    { type: 'resolve-comment', id: 'any' },
    { type: 'reopen-comment', id: 'any' },
    { type: 'set-review-note', body: 'x' },
    { type: 'set-reviewed', targetId: 't1', fileOccurrence: 0, reviewed: true },
    { type: 'create-draft', targetId: 't1', anchor: fileAnchor },
    { type: 'update-draft', draftId: 'any', body: 'x' },
    { type: 'save-draft', draftId: 'any' },
    { type: 'discard-draft', draftId: 'any' },
  ];

  for (const action of mutatingActions) {
    test(`rejects '${action.type}' with the readonly error code`, () => {
      const state = baseState();
      const result = reduceDiffReviewState(state, action, { readonly: true });
      expect(result).toEqual({
        ok: false,
        error: { code: 'readonly', path: '', message: expect.any(String) },
      });
    });
  }

  test('navigation actions remain available in readonly mode', () => {
    const state = baseState();
    const result = reduceDiffReviewState(
      state,
      { type: 'select-target', targetId: 't1' },
      { readonly: true },
    );
    expect(result.ok).toBe(true);
  });

  test('set-targets (a host-driven content update, not a user mutation) is not blocked by readonly', () => {
    const state = baseState();
    const result = reduceDiffReviewState(
      state,
      {
        type: 'set-targets',
        targets: [{ kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' }],
      },
      { readonly: true },
    );
    expect(result.ok).toBe(true);
  });

  test('an underlying action handler returning readonly leaves state untouched', () => {
    const state = baseState();
    reduceDiffReviewState(state, { type: 'set-review-note', body: 'x' }, { readonly: true });
    expect(state.reviewNote).toBe('');
  });
});
