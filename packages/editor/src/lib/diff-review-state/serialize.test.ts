import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import { reduceDiffReviewState } from './reduce.ts';
import { serializeDiffReviewState } from './serialize.ts';

describe('DiffReview state serialize', () => {
  test('produces a plain JSON-safe object equal to the state', () => {
    const created = createDiffReviewState([
      { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
    ]);
    if (!created.ok) throw new Error('expected ok');
    const withComment = reduceDiffReviewState(created.value, {
      type: 'create-comment',
      id: 'c1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'Feedback',
    });
    if (!withComment.ok) throw new Error('expected ok');
    const withDraft = reduceDiffReviewState(withComment.value, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'In progress',
    });
    if (!withDraft.ok) throw new Error('expected ok');

    const serialized = serializeDiffReviewState(withDraft.value);
    expect(serialized).toEqual(withDraft.value);
    // Round-trips through JSON with no loss (no functions, undefined-only differences aside).
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(
      JSON.parse(JSON.stringify(withDraft.value)),
    );
  });

  test('does not share array/object references with the original state (a defensive copy)', () => {
    const created = createDiffReviewState([
      { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
    ]);
    if (!created.ok) throw new Error('expected ok');
    const serialized = serializeDiffReviewState(created.value);
    expect(serialized).not.toBe(created.value);
    expect(serialized.targets).not.toBe(created.value.targets);
  });
});
