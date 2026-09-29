import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import { reduceDiffReviewState } from './reduce.ts';
import type { DiffReviewState } from './types.ts';

function baseState(): DiffReviewState {
  const result = createDiffReviewState([
    { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
    { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
  ]);
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

describe('DiffReview state navigation', () => {
  test('selects a target by ID', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, { type: 'select-target', targetId: 't2' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.selectedTargetId).toBe('t2');
  });

  test('clears the selection with null', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, { type: 'select-target', targetId: null });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.selectedTargetId).toBeNull();
  });

  test('rejects selecting a targetId that does not exist', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'select-target',
      targetId: 'nonexistent',
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-target', path: '/targetId', message: expect.any(String) },
    });
  });

  test('selects a file occurrence within the current target', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, { type: 'select-file', fileOccurrence: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.selectedFileOccurrence).toBe(3);
  });

  test('clears the file selection with null', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, { type: 'select-file', fileOccurrence: null });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.selectedFileOccurrence).toBeNull();
  });
});
