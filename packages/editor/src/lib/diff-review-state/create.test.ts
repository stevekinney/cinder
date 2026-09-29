import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import { computeDiffReviewSnapshotId } from './identity.ts';
import type { DiffReviewTargetInput } from './types.ts';

function source(targetId: string, patch = 'diff'): DiffReviewTargetInput {
  return { kind: 'source', targetId, label: `Label ${targetId}`, patch };
}

describe('DiffReview state create', () => {
  test('creates an empty session with no targets: no selection, no comments, no drafts', () => {
    const result = createDiffReviewState([]);
    expect(result).toEqual({
      ok: true,
      value: {
        version: 1,
        targets: [],
        comments: [],
        drafts: [],
        reviewNote: '',
        selectedTargetId: null,
        selectedFileOccurrence: null,
        reviewedMarkers: [],
      },
    });
  });

  test('selects the first supplied target by default', () => {
    const result = createDiffReviewState([source('a'), source('b')]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.selectedTargetId).toBe('a');
    expect(result.value.selectedFileOccurrence).toBeNull();
  });

  test('computes each target record snapshotId from its exact content identity', () => {
    const target = source('a', 'diff --git a/x b/x');
    const result = createDiffReviewState([target]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.targets[0]?.snapshotId).toBe(computeDiffReviewSnapshotId(target));
  });

  test('preserves target order and every descriptive field', () => {
    const target: DiffReviewTargetInput = {
      kind: 'source',
      targetId: 'a',
      label: 'Label A',
      repositoryLabel: 'org/repo',
      baseRevisionLabel: 'main',
      headRevisionLabel: 'feature',
      patch: 'diff',
    };
    const result = createDiffReviewState([target]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.targets[0]).toEqual({
      targetId: 'a',
      kind: 'source',
      label: 'Label A',
      repositoryLabel: 'org/repo',
      baseRevisionLabel: 'main',
      headRevisionLabel: 'feature',
      snapshotId: computeDiffReviewSnapshotId(target),
    });
  });

  test('allows the same path/label to appear in two distinct targets (distinguished by targetId)', () => {
    const targets: DiffReviewTargetInput[] = [
      { kind: 'source', targetId: 'left', label: 'src/x.ts', patch: 'diff-left' },
      { kind: 'source', targetId: 'right', label: 'src/x.ts', patch: 'diff-right' },
    ];
    const result = createDiffReviewState(targets);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.targets.map((t) => t.targetId)).toEqual(['left', 'right']);
  });

  test('rejects an invalid target atomically, exposing the structured error', () => {
    const bad = { ...source('a'), kind: 'nope' } as unknown as DiffReviewTargetInput;
    const result = createDiffReviewState([bad]);
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-target', path: '/targets/0/kind', message: expect.any(String) },
    });
  });

  test('rejects duplicate targetIds atomically', () => {
    const result = createDiffReviewState([source('same'), source('same')]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('duplicate-id');
  });

  test('identity is stable for identical input across two independent calls (remount)', () => {
    const target = source('a', 'same-patch');
    const first = createDiffReviewState([target]);
    const second = createDiffReviewState([{ ...target }]);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('expected ok');
    expect(first.value.targets[0]?.snapshotId).toBe(second.value.targets[0]?.snapshotId);
  });
});
