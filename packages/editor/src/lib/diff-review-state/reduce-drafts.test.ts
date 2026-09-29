import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import { reduceDiffReviewState } from './reduce.ts';
import type { DiffReviewAnchor, DiffReviewState } from './types.ts';

function baseState(): DiffReviewState {
  const result = createDiffReviewState([
    { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
    { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
  ]);
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

const fileAnchor: DiffReviewAnchor = { kind: 'file', fileOccurrence: 0 };

describe('DiffReview state drafts', () => {
  test('creates a draft retaining its anchor and original snapshot', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.drafts).toHaveLength(1);
    expect(result.value.drafts[0]).toMatchObject({
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
      body: '',
      outdated: false,
    });
    expect(result.value.drafts[0]?.capturedContext.snapshotId).toBe(state.targets[0]!.snapshotId);
  });

  test('allows multiple simultaneous drafts, one per draft ID', () => {
    let state = baseState();
    const first = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
    });
    if (!first.ok) throw new Error('expected ok');
    state = first.value;

    const second = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd2',
      targetId: 't2',
      anchor: fileAnchor,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('expected ok');
    expect(second.value.drafts.map((d) => d.draftId)).toEqual(['d1', 'd2']);
  });

  test('rejects a duplicate draft ID with duplicate-id', () => {
    let state = baseState();
    const first = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'dup',
      targetId: 't1',
      anchor: fileAnchor,
    });
    if (!first.ok) throw new Error('expected ok');
    state = first.value;

    const second = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'dup',
      targetId: 't2',
      anchor: fileAnchor,
    });
    expect(second).toEqual({
      ok: false,
      error: { code: 'duplicate-id', path: '/draftId', message: expect.any(String) },
    });
  });

  test('updates draft text, including to whitespace-only, retaining it in state', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Draft in progress',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const updated = reduceDiffReviewState(state, {
      type: 'update-draft',
      draftId: 'd1',
      body: '   ',
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) throw new Error('expected ok');
    expect(updated.value.drafts[0]?.body).toBe('   ');
  });

  test('draft text and selection survive navigating to a different target/file', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Do not lose me',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const navigated = reduceDiffReviewState(state, { type: 'select-target', targetId: 't2' });
    expect(navigated.ok).toBe(true);
    if (!navigated.ok) throw new Error('expected ok');
    expect(navigated.value.drafts).toEqual(state.drafts);
  });

  test('discards a draft', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Throwaway',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const discarded = reduceDiffReviewState(state, { type: 'discard-draft', draftId: 'd1' });
    expect(discarded.ok).toBe(true);
    if (!discarded.ok) throw new Error('expected ok');
    expect(discarded.value.drafts).toHaveLength(0);
  });

  test('saving a nonempty draft on an unchanged target converts it into a current comment', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Ready to save',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const saved = reduceDiffReviewState(state, {
      type: 'save-draft',
      draftId: 'd1',
      id: 'c1',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('expected ok');
    expect(saved.value.drafts).toHaveLength(0);
    expect(saved.value.comments).toHaveLength(1);
    expect(saved.value.comments[0]).toMatchObject({
      id: 'c1',
      targetId: 't1',
      body: 'Ready to save',
      outdated: false,
    });
  });

  test('saving a whitespace-only draft fails with invalid-record and retains the draft', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
      body: '   ',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const saved = reduceDiffReviewState(state, { type: 'save-draft', draftId: 'd1' });
    expect(saved.ok).toBe(false);
    if (saved.ok) throw new Error('expected error');
    expect(saved.error.code).toBe('invalid-record');
  });

  test('saving a draft whose target has changed since creation produces an outdated comment', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Written before the change',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const changed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-changed' },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    if (!changed.ok) throw new Error('expected ok');
    state = changed.value;

    const saved = reduceDiffReviewState(state, { type: 'save-draft', draftId: 'd1' });
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('expected ok');
    expect(saved.value.comments[0]?.outdated).toBe(true);
    expect(saved.value.comments[0]?.body).toBe('Written before the change');
  });

  test('saving a draft whose target has been removed produces an outdated comment with captured context', () => {
    let state = baseState();
    const created = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Written before removal',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;
    const originalCapturedContext = state.drafts[0]!.capturedContext;

    const removed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [{ kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' }],
    });
    if (!removed.ok) throw new Error('expected ok');
    state = removed.value;

    const saved = reduceDiffReviewState(state, { type: 'save-draft', draftId: 'd1' });
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('expected ok');
    expect(saved.value.comments[0]?.outdated).toBe(true);
    expect(saved.value.comments[0]?.capturedContext).toEqual(originalCapturedContext);
  });

  test('saving an unknown draft id fails with invalid-record', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, { type: 'save-draft', draftId: 'missing' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-record');
  });

  test('creating a draft on an unknown target fails with invalid-target', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'create-draft',
      targetId: 'nonexistent',
      anchor: fileAnchor,
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-target', path: '/targetId', message: expect.any(String) },
    });
  });

  test('saving a draft whose explicit id collides with an existing comment fails with duplicate-id', () => {
    let state = baseState();
    const commented = reduceDiffReviewState(state, {
      type: 'create-comment',
      id: 'shared-id',
      targetId: 't1',
      anchor: fileAnchor,
      body: 'Existing comment.',
    });
    if (!commented.ok) throw new Error('expected ok');
    state = commented.value;

    const created = reduceDiffReviewState(state, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't2',
      anchor: fileAnchor,
      body: 'Draft text',
    });
    if (!created.ok) throw new Error('expected ok');
    state = created.value;

    const saved = reduceDiffReviewState(state, {
      type: 'save-draft',
      draftId: 'd1',
      id: 'shared-id',
    });
    expect(saved).toEqual({
      ok: false,
      error: { code: 'duplicate-id', path: '/id', message: expect.any(String) },
    });
  });

  test('discarding an unknown draft id fails with invalid-record', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, { type: 'discard-draft', draftId: 'missing' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-record');
  });
});
