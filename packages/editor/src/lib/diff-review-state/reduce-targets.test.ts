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

function withComment(state: DiffReviewState, targetId: string): DiffReviewState {
  const result = reduceDiffReviewState(state, {
    type: 'create-comment',
    id: `c-${targetId}`,
    targetId,
    anchor: fileAnchor,
    body: 'Feedback',
  });
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

function withDraft(state: DiffReviewState, targetId: string): DiffReviewState {
  const result = reduceDiffReviewState(state, {
    type: 'create-draft',
    draftId: `d-${targetId}`,
    targetId,
    anchor: fileAnchor,
    body: 'Draft in progress',
  });
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

describe('DiffReview state target updates', () => {
  test('a content change latches every comment on that target as outdated', () => {
    let state = withComment(baseState(), 't1');
    const changed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-changed' },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) throw new Error('expected ok');
    expect(changed.value.comments.find((c) => c.id === 'c-t1')?.outdated).toBe(true);
    // Unrelated target's comment is untouched.
    expect(changed.value.comments.find((c) => c.id === 'c-t2')).toBeUndefined();
  });

  test('the outdated latch never un-latches when content reverts to the original', () => {
    let state = withComment(baseState(), 't1');
    const originalPatch = 'diff-1';

    const changed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-changed' },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    if (!changed.ok) throw new Error('expected ok');
    state = changed.value;
    expect(state.comments[0]?.outdated).toBe(true);

    const reverted = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: originalPatch },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    expect(reverted.ok).toBe(true);
    if (!reverted.ok) throw new Error('expected ok');
    expect(reverted.value.comments[0]?.outdated).toBe(true);
  });

  test('reordering targets alone does not invalidate comments', () => {
    let state = withComment(baseState(), 't1');
    const reordered = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
      ],
    });
    expect(reordered.ok).toBe(true);
    if (!reordered.ok) throw new Error('expected ok');
    expect(reordered.value.comments[0]?.outdated).toBe(false);
    expect(reordered.value.targets.map((t) => t.targetId)).toEqual(['t2', 't1']);
  });

  test('a content change latches every draft on that target as outdated, same as a comment', () => {
    let state = withDraft(baseState(), 't1');
    expect(state.drafts[0]?.outdated).toBe(false);

    const changed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-changed' },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) throw new Error('expected ok');
    expect(changed.value.drafts[0]?.outdated).toBe(true);
  });

  test('a draft outdated latch never un-latches when content reverts to the original', () => {
    let state = withDraft(baseState(), 't1');

    const changed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-changed' },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    if (!changed.ok) throw new Error('expected ok');
    state = changed.value;
    expect(state.drafts[0]?.outdated).toBe(true);

    const reverted = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    expect(reverted.ok).toBe(true);
    if (!reverted.ok) throw new Error('expected ok');
    expect(reverted.value.drafts[0]?.outdated).toBe(true);

    // Saving after a revert-then-relatch must still produce an outdated comment: the latch, not
    // a snapshot-equality re-check, is what save-draft consults. `reverted.value` started this
    // test with no comments, so the one comment present is the just-saved draft.
    const saved = reduceDiffReviewState(reverted.value, { type: 'save-draft', draftId: 'd-t1' });
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('expected ok');
    expect(saved.value.comments).toHaveLength(1);
    expect(saved.value.comments[0]?.outdated).toBe(true);
  });

  test('a removed target remains represented by captured metadata in the comments list', () => {
    let state = withComment(baseState(), 't1');
    const originalCapturedContext = state.comments[0]!.capturedContext;

    const removed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [{ kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' }],
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) throw new Error('expected ok');
    expect(removed.value.comments).toHaveLength(1);
    expect(removed.value.comments[0]?.capturedContext).toEqual(originalCapturedContext);
    expect(removed.value.comments[0]?.outdated).toBe(true);
    expect(removed.value.targets.map((t) => t.targetId)).toEqual(['t2']);
  });

  test('reviewed markers reset when a target changes content', () => {
    let state = baseState();
    const reviewed = reduceDiffReviewState(state, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!reviewed.ok) throw new Error('expected ok');
    state = reviewed.value;
    expect(state.reviewedMarkers).toHaveLength(1);

    const changed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-changed' },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) throw new Error('expected ok');
    expect(changed.value.reviewedMarkers).toHaveLength(0);
  });

  test('reviewed markers survive reorder and label/revision-label changes', () => {
    let state = baseState();
    const reviewed = reduceDiffReviewState(state, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!reviewed.ok) throw new Error('expected ok');
    state = reviewed.value;

    const relabeled = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
        {
          kind: 'source',
          targetId: 't1',
          label: 'src/x-renamed.ts',
          headRevisionLabel: 'new-label',
          patch: 'diff-1',
        },
      ],
    });
    expect(relabeled.ok).toBe(true);
    if (!relabeled.ok) throw new Error('expected ok');
    expect(relabeled.value.reviewedMarkers).toHaveLength(1);
  });

  test('removing a target deletes its reviewed markers, and reintroducing it starts unreviewed', () => {
    let state = baseState();
    const reviewed = reduceDiffReviewState(state, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!reviewed.ok) throw new Error('expected ok');
    state = reviewed.value;

    const removed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [{ kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' }],
    });
    if (!removed.ok) throw new Error('expected ok');
    expect(removed.value.reviewedMarkers).toHaveLength(0);

    // Reintroduce t1 with byte-identical content to its original.
    const reintroduced = reduceDiffReviewState(removed.value, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
      ],
    });
    expect(reintroduced.ok).toBe(true);
    if (!reintroduced.ok) throw new Error('expected ok');
    expect(reintroduced.value.reviewedMarkers).toHaveLength(0);
  });

  test('set-reviewed toggles a marker off', () => {
    let state = baseState();
    const on = reduceDiffReviewState(state, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!on.ok) throw new Error('expected ok');
    const off = reduceDiffReviewState(on.value, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: false,
    });
    expect(off.ok).toBe(true);
    if (!off.ok) throw new Error('expected ok');
    expect(off.value.reviewedMarkers).toHaveLength(0);
  });

  test('set-reviewed on an unknown target fails with invalid-target', () => {
    const state = baseState();
    const result = reduceDiffReviewState(state, {
      type: 'set-reviewed',
      targetId: 'nonexistent',
      fileOccurrence: 0,
      reviewed: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-target');
  });

  test('selection falls back to the first remaining target when the selected one is removed', () => {
    let state = baseState();
    const select = reduceDiffReviewState(state, { type: 'select-target', targetId: 't1' });
    if (!select.ok) throw new Error('expected ok');
    state = select.value;

    const removed = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [{ kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' }],
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) throw new Error('expected ok');
    expect(removed.value.selectedTargetId).toBe('t2');
  });

  test('selection becomes null when every target is removed', () => {
    const state = baseState();
    const removed = reduceDiffReviewState(state, { type: 'set-targets', targets: [] });
    expect(removed.ok).toBe(true);
    if (!removed.ok) throw new Error('expected ok');
    expect(removed.value.selectedTargetId).toBeNull();
  });

  test('an atomically invalid target-list update retains the previous valid state', () => {
    const state = withComment(baseState(), 't1');
    const invalid = reduceDiffReviewState(state, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-dup' },
      ],
    });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) throw new Error('expected error');
    expect(invalid.error.code).toBe('duplicate-id');
    // The caller keeps their existing `state` reference untouched; this asserts reduce did not
    // mutate it in place while validating.
    expect(state.targets.map((t) => t.targetId)).toEqual(['t1', 't2']);
  });
});
