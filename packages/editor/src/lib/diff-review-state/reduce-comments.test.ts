import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import { reduceDiffReviewState } from './reduce.ts';
import type { DiffReviewAnchor, DiffReviewState } from './types.ts';

function baseState(): DiffReviewState {
  const result = createDiffReviewState([
    { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff --git a/x b/x' },
  ]);
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

const rangeAnchor: DiffReviewAnchor = {
  kind: 'range',
  fileOccurrence: 0,
  hunkOccurrence: 0,
  side: 'new',
  startLine: 4,
  endLine: 6,
  coordinateSpace: 'raw-source',
  selectedText: 'const x = 1;',
  contextBefore: [],
  contextAfter: [],
};

const fileAnchor: DiffReviewAnchor = { kind: 'file', fileOccurrence: 0 };

describe('DiffReview state comments', () => {
  test('creates a range comment on a live target with computed captured context', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'create-comment',
      id: 'c1',
      targetId: 't1',
      anchor: rangeAnchor,
      body: 'Please fix this.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.comments).toHaveLength(1);
    const comment = result.value.comments[0]!;
    expect(comment).toMatchObject({
      id: 'c1',
      targetId: 't1',
      snapshotId: state.targets[0]!.snapshotId,
      anchor: rangeAnchor,
      body: 'Please fix this.',
      resolved: false,
      outdated: false,
    });
    expect(comment.createdAt).toBe(comment.updatedAt);
    expect(comment.capturedContext).toEqual({
      targetKind: 'source',
      targetLabel: 'src/x.ts',
      repositoryLabel: undefined,
      baseRevisionLabel: undefined,
      headRevisionLabel: undefined,
      oldPath: null,
      newPath: null,
      fileOccurrence: 0,
      snapshotId: state.targets[0]!.snapshotId,
      rawMapping: { status: 'exact' },
    });
  });

  test('a file comment is available even with no commentable text rows', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'General file feedback.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.comments[0]?.anchor).toEqual(fileAnchor);
  });

  test('generates an ID when none is supplied', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Feedback.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.comments[0]?.id.length).toBeGreaterThan(0);
  });

  test('rejects a duplicate comment id with duplicate-id', () => {
    let state = baseState();
    const first = reduceDiffReviewState(state, {
      type: 'create-comment',
      id: 'dup',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'One.',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('expected ok');
    state = first.value;

    const second = reduceDiffReviewState(state, {
      type: 'create-comment',
      id: 'dup',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Two.',
    });
    expect(second).toEqual({
      ok: false,
      error: { code: 'duplicate-id', path: '/id', message: expect.any(String) },
    });
  });

  test('rejects an empty body with invalid-record', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: fileAnchor,
      body: '',
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-record', path: '/body', message: expect.any(String) },
    });
  });

  test('rejects a whitespace-only body with invalid-record', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: fileAnchor,
      body: '   \n\t  ',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-record');
  });

  test('rejects an unknown targetId with invalid-target', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 'nonexistent',
      anchor: fileAnchor,
      body: 'Feedback.',
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-target', path: '/targetId', message: expect.any(String) },
    });
  });

  test('rejects an invalid anchor with invalid-anchor', () => {
    const state = baseState();
    const badAnchor = { ...rangeAnchor, startLine: 0 };
    const result = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: badAnchor,
      body: 'Feedback.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-anchor');
  });

  test('edits an existing comment body and advances updatedAt', async () => {
    let state = baseState();
    const created = reduceDiffReviewState(
      state,
      { type: 'create-comment', id: 'c1', targetId: 't1', anchor: fileAnchor, body: 'Original.' },
      { clock: () => '2026-01-01T00:00:00.000Z' },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const edited = reduceDiffReviewState(
      state,
      { type: 'edit-comment', id: 'c1', body: 'Edited.' },
      { clock: () => '2026-01-02T00:00:00.000Z' },
    );
    expect(edited.ok).toBe(true);
    if (!edited.ok) throw new Error('expected ok');
    const comment = edited.value.comments[0]!;
    expect(comment.body).toBe('Edited.');
    expect(comment.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(comment.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  test('rejects editing a comment to an empty body', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-comment',
      id: 'c1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Original.',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const edited = reduceDiffReviewState(state, { type: 'edit-comment', id: 'c1', body: '  ' });
    expect(edited.ok).toBe(false);
    if (edited.ok) throw new Error('expected error');
    expect(edited.error.code).toBe('invalid-record');
  });

  test('editing an unknown comment id fails with invalid-record', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'edit-comment',
      id: 'missing',
      body: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-record');
  });

  test('deletes a comment, removing it from state and future exports', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-comment',
      id: 'c1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Original.',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const deleted = reduceDiffReviewState(state, { type: 'delete-comment', id: 'c1' });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) throw new Error('expected ok');
    expect(deleted.value.comments).toHaveLength(0);
  });

  test('deleting an unknown comment id fails with invalid-record', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, { type: 'delete-comment', id: 'missing' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-record');
  });

  test('resolves and reopens a comment independent of file reviewed state', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-comment',
      id: 'c1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Original.',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const resolved = reduceDiffReviewState(state, { type: 'resolve-comment', id: 'c1' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error('expected ok');
    expect(resolved.value.comments[0]?.resolved).toBe(true);

    const reopened = reduceDiffReviewState(resolved.value, { type: 'reopen-comment', id: 'c1' });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new Error('expected ok');
    expect(reopened.value.comments[0]?.resolved).toBe(false);
  });

  test('resolving an unknown comment id fails with invalid-record', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, { type: 'resolve-comment', id: 'missing' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-record');
  });

  test('sets a review-level note, including clearing it to empty', () => {
    let state = baseState();
    const withNote = reduceDiffReviewState(state, {
      type: 'set-review-note',
      body: 'Looks solid overall.',
    });
    expect(withNote.ok).toBe(true);
    if (!withNote.ok) throw new Error('expected ok');
    expect(withNote.value.reviewNote).toBe('Looks solid overall.');
    state = withNote.value;

    const cleared = reduceDiffReviewState(state, { type: 'set-review-note', body: '' });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) throw new Error('expected ok');
    expect(cleared.value.reviewNote).toBe('');
  });

  test('does not mutate the input state object (immutable transitions)', () => {
    const state = baseState();
    const before = JSON.parse(JSON.stringify(state));
    reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Feedback.',
    });
    expect(state).toEqual(before);
  });
});
