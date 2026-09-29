import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from '../diff-review-state/index.ts';
import { dispatchDiffReviewAction } from './diff-review-dispatch.ts';

function baseState() {
  const created = createDiffReviewState([
    {
      targetId: 't1',
      kind: 'markdown',
      label: 'Target 1',
      original: 'a',
      current: 'b',
      normalizeInputs: true,
    },
  ]);
  if (!created.ok) throw new Error('fixture setup failed');
  return created.value;
}

describe('DiffReview component dispatch', () => {
  test('a successful action calls onstatechange with the next state and returns it', () => {
    const state = baseState();
    const seen: unknown[] = [];
    const result = dispatchDiffReviewAction(
      state,
      { type: 'set-review-note', body: 'Looks good' },
      (next) => seen.push(next),
    );
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(1);
    if (result.ok) expect(result.value.reviewNote).toBe('Looks good');
    expect(seen[0]).toBe(result.ok ? result.value : undefined);
  });

  test('a rejected action never calls onstatechange and surfaces the structured error', () => {
    const state = baseState();
    let called = false;
    const result = dispatchDiffReviewAction(
      state,
      { type: 'edit-comment', id: 'does-not-exist', body: 'x' },
      () => {
        called = true;
      },
    );
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-record');
  });

  test('readonly rejects a mutating action with the readonly code, unchanged', () => {
    const state = baseState();
    let called = false;
    const result = dispatchDiffReviewAction(
      state,
      { type: 'set-review-note', body: 'nope' },
      () => {
        called = true;
      },
      { readonly: true },
    );
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('readonly');
  });
});
