import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import {
  ensureDiffReviewNoPendingDrafts,
  getDiffReviewPendingDrafts,
  isDiffReviewFileReviewed,
} from './query.ts';
import { reduceDiffReviewState } from './reduce.ts';
import type { DiffReviewState } from './types.ts';

function baseState(): DiffReviewState {
  const result = createDiffReviewState([
    { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
  ]);
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

describe('DiffReview state queries', () => {
  test('no pending drafts on a fresh session', () => {
    const state = baseState();
    expect(getDiffReviewPendingDrafts(state)).toEqual([]);
    expect(ensureDiffReviewNoPendingDrafts(state)).toEqual({ ok: true, value: undefined });
  });

  test('a nonempty draft is pending; a whitespace-only draft is not', () => {
    let state = baseState();
    const withNonempty = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'has content',
    });
    if (!withNonempty.ok) throw new Error('expected ok');
    state = withNonempty.value;

    const withWhitespace = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd2',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: '   ',
    });
    if (!withWhitespace.ok) throw new Error('expected ok');
    state = withWhitespace.value;

    expect(getDiffReviewPendingDrafts(state).map((d) => d.draftId)).toEqual(['d1']);

    const result = ensureDiffReviewNoPendingDrafts(state);
    expect(result).toEqual({
      ok: false,
      error: { code: 'drafts-pending', path: '/drafts', message: expect.any(String) },
    });
  });

  test('isDiffReviewFileReviewed reflects only the current snapshot', () => {
    let state = baseState();
    const reviewed = reduceDiffReviewState(state, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!reviewed.ok) throw new Error('expected ok');
    state = reviewed.value;
    expect(isDiffReviewFileReviewed(state, 't1', 0)).toBe(true);
    expect(isDiffReviewFileReviewed(state, 't1', 1)).toBe(false);
    expect(isDiffReviewFileReviewed(state, 'nonexistent', 0)).toBe(false);
  });
});
