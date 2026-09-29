import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import { reduceDiffReviewState } from './reduce.ts';
import { restoreDiffReviewState } from './restore.ts';
import { serializeDiffReviewState } from './serialize.ts';
import type { DiffReviewSerializedState, DiffReviewTargetInput } from './types.ts';

function targets(): DiffReviewTargetInput[] {
  return [
    { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1' },
    { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
  ];
}

function seededState(): DiffReviewSerializedState {
  const created = createDiffReviewState(targets());
  if (!created.ok) throw new Error('fixture setup failed');
  const commented = reduceDiffReviewState(created.value, {
    type: 'create-comment',
    id: 'c1',
    targetId: 't1',
    anchor: { kind: 'file', fileOccurrence: 0 },
    body: 'Feedback',
  });
  if (!commented.ok) throw new Error('fixture setup failed');
  return serializeDiffReviewState(commented.value);
}

describe('DiffReview state restore', () => {
  test('round-trips identically when targets are re-supplied unchanged', () => {
    const serialized = seededState();
    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored).toEqual({ ok: true, value: serialized });
  });

  test('identity is stable across remount with the exact same targets, in a different order', () => {
    const serialized = seededState();
    const reordered = [targets()[1]!, targets()[0]!];
    const restored = restoreDiffReviewState(serialized, reordered);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    // Order follows the newly supplied list, matched by ID, not the serialized order.
    expect(restored.value.targets.map((t) => t.targetId)).toEqual(['t2', 't1']);
    expect(restored.value.comments[0]?.outdated).toBe(false);
    expect(restored.value.comments[0]?.snapshotId).toBe(serialized.comments[0]?.snapshotId);
  });

  test('restoring with different target content marks the retained comment outdated', () => {
    const serialized = seededState();
    const changedTargets: DiffReviewTargetInput[] = [
      { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-CHANGED' },
      { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
    ];
    const restored = restoreDiffReviewState(serialized, changedTargets);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    expect(restored.value.comments[0]?.outdated).toBe(true);
    expect(restored.value.comments[0]?.body).toBe('Feedback');
  });

  test('restoring without the comment target retains the comment by captured context', () => {
    const serialized = seededState();
    const withoutT1: DiffReviewTargetInput[] = [
      { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
    ];
    const restored = restoreDiffReviewState(serialized, withoutT1);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    expect(restored.value.comments).toHaveLength(1);
    expect(restored.value.comments[0]?.outdated).toBe(true);
    expect(restored.value.comments[0]?.capturedContext).toEqual(
      serialized.comments[0]?.capturedContext,
    );
    expect(restored.value.targets.map((t) => t.targetId)).toEqual(['t2']);
  });

  test('an already-outdated comment stays outdated even if content matches its original snapshot', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const commented = reduceDiffReviewState(created.value, {
      type: 'create-comment',
      id: 'c1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'Feedback',
    });
    if (!commented.ok) throw new Error('fixture setup failed');
    const invalidated = reduceDiffReviewState(commented.value, {
      type: 'set-targets',
      targets: [
        { kind: 'source', targetId: 't1', label: 'src/x.ts', patch: 'diff-1-CHANGED' },
        { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
      ],
    });
    if (!invalidated.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(invalidated.value);

    // Restore with the *original* content the comment was created against.
    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    expect(restored.value.comments[0]?.outdated).toBe(true);
  });

  test('selection falls back to the first supplied target when the restored selection is missing', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const selected = reduceDiffReviewState(created.value, {
      type: 'select-target',
      targetId: 't1',
    });
    if (!selected.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(selected.value);

    const restored = restoreDiffReviewState(serialized, [
      { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
    ]);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    expect(restored.value.selectedTargetId).toBe('t2');
  });

  test('selection becomes null when no supplied targets remain', () => {
    const serialized = seededState();
    const restored = restoreDiffReviewState(serialized, []);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    expect(restored.value.selectedTargetId).toBeNull();
  });

  test('rejects an unsupported version', () => {
    const serialized = { ...seededState(), version: 2 as unknown as 1 };
    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored).toEqual({
      ok: false,
      error: { code: 'unsupported-version', path: '/version', message: expect.any(String) },
    });
  });

  test('rejects a non-object input', () => {
    const restored = restoreDiffReviewState('nope', targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.path).toBe('');
  });

  test('rejects an unknown top-level key', () => {
    const serialized = { ...seededState(), extra: true } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.code).toBe('invalid-record');
    expect(restored.error.path).toBe('/extra');
  });

  test('rejects an unknown key nested in a comment record', () => {
    const serialized = seededState();
    const withExtra = {
      ...serialized,
      comments: [{ ...serialized.comments[0], extra: 1 }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(withExtra, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.code).toBe('invalid-record');
    expect(restored.error.path).toBe('/comments/0/extra');
  });

  test('rejects a malformed comment record with invalid-record and a JSON Pointer path', () => {
    const serialized = seededState();
    const malformed = {
      ...serialized,
      comments: [{ ...serialized.comments[0], body: 42 }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/comments/0/body',
      message: expect.any(String),
    });
  });

  test('rejects an invalid anchor nested in a comment with invalid-anchor', () => {
    const serialized = seededState();
    const malformed = {
      ...serialized,
      comments: [{ ...serialized.comments[0], anchor: { kind: 'file', fileOccurrence: -1 } }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.code).toBe('invalid-anchor');
    expect(restored.error.path).toBe('/comments/0/anchor/fileOccurrence');
  });

  test('rejects a noncanonical timestamp with invalid-timestamp', () => {
    const serialized = seededState();
    const malformed = {
      ...serialized,
      comments: [{ ...serialized.comments[0], createdAt: '2026-01-01' }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-timestamp',
      path: '/comments/0/createdAt',
      message: expect.any(String),
    });
  });

  test('rejects an inverted updatedAt/createdAt pair with invalid-timestamp', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    const malformed = {
      ...serialized,
      comments: [
        {
          ...comment,
          createdAt: '2026-01-05T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-timestamp',
      path: '/comments/0/updatedAt',
      message: expect.any(String),
    });
  });

  test('rejects a duplicate comment id with duplicate-id', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    const duplicated = {
      ...serialized,
      comments: [comment, { ...comment }],
    };
    const restored = restoreDiffReviewState(duplicated, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'duplicate-id',
      path: '/comments/1/id',
      message: expect.any(String),
    });
  });

  test('rejects a duplicate target id in the restored target-record list', () => {
    const serialized = seededState();
    const duplicated = {
      ...serialized,
      targets: [serialized.targets[0]!, { ...serialized.targets[0]! }],
    };
    const restored = restoreDiffReviewState(duplicated, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.code).toBe('duplicate-id');
    expect(restored.error.path).toBe('/targets/1/targetId');
  });

  test('a comment retaining an absent target with incomplete captured context fails with missing-context', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    const brokenContext = {
      ...serialized,
      targets: [serialized.targets[1]!], // t1 is gone
      comments: [
        {
          ...comment,
          targetId: 't1',
          capturedContext: { ...comment.capturedContext, targetLabel: 42 },
        },
      ],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(brokenContext, [
      { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
    ]);
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.code).toBe('missing-context');
    expect(restored.error.path).toBe('/comments/0/capturedContext/targetLabel');
  });

  test('rejects an invalid supplied target list atomically, leaving no partial state', () => {
    const serialized = seededState();
    const restored = restoreDiffReviewState(serialized, [
      { kind: 'source', targetId: 't1', label: 'x', patch: 'a' },
      { kind: 'source', targetId: 't1', label: 'x', patch: 'b' },
    ]);
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.code).toBe('duplicate-id');
  });

  test('restores drafts, preserving multiple simultaneous drafts', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const withDraft = reduceDiffReviewState(created.value, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'In progress',
    });
    if (!withDraft.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(withDraft.value);

    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    expect(restored.value.drafts).toEqual(serialized.drafts);
  });

  test('restores a reviewed marker and rejects a malformed one', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const reviewed = reduceDiffReviewState(created.value, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!reviewed.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(reviewed.value);

    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    expect(restored.value.reviewedMarkers).toEqual(serialized.reviewedMarkers);

    const malformed = {
      ...serialized,
      reviewedMarkers: [{ ...serialized.reviewedMarkers[0], fileOccurrence: -1 }],
    };
    const malformedResult = restoreDiffReviewState(malformed, targets());
    expect(malformedResult.ok).toBe(false);
    if (malformedResult.ok) throw new Error('expected error');
    expect(malformedResult.error).toEqual({
      code: 'invalid-record',
      path: '/reviewedMarkers/0/fileOccurrence',
      message: expect.any(String),
    });
  });

  test('rejects a non-array drafts field', () => {
    const serialized = { ...seededState(), drafts: 'not-an-array' };
    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/drafts',
      message: expect.any(String),
    });
  });

  test('rejects a non-string reviewNote', () => {
    const serialized = { ...seededState(), reviewNote: 42 };
    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/reviewNote',
      message: expect.any(String),
    });
  });

  test('rejects a non-string, non-null selectedTargetId', () => {
    const serialized = { ...seededState(), selectedTargetId: 42 };
    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/selectedTargetId',
      message: expect.any(String),
    });
  });

  test('rejects a negative selectedFileOccurrence', () => {
    const serialized = { ...seededState(), selectedFileOccurrence: -1 };
    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/selectedFileOccurrence',
      message: expect.any(String),
    });
  });

  test('rejects a non-string repositoryLabel/baseRevisionLabel/headRevisionLabel in captured context', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    for (const field of ['repositoryLabel', 'baseRevisionLabel', 'headRevisionLabel'] as const) {
      const malformed = {
        ...serialized,
        comments: [{ ...comment, capturedContext: { ...comment.capturedContext, [field]: 42 } }],
      };
      const restored = restoreDiffReviewState(malformed, targets());
      expect(restored.ok).toBe(false);
      if (restored.ok) throw new Error(`expected error for ${field}`);
      expect(restored.error.path).toBe(`/comments/0/capturedContext/${field}`);
    }
  });

  test('rejects a non-string, non-null oldPath/newPath in captured context', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    for (const field of ['oldPath', 'newPath'] as const) {
      const malformed = {
        ...serialized,
        comments: [{ ...comment, capturedContext: { ...comment.capturedContext, [field]: 42 } }],
      };
      const restored = restoreDiffReviewState(malformed, targets());
      expect(restored.ok).toBe(false);
      if (restored.ok) throw new Error(`expected error for ${field}`);
      expect(restored.error.path).toBe(`/comments/0/capturedContext/${field}`);
    }
  });

  test('rejects a non-string comment createdAt/updatedAt outright (not merely noncanonical)', () => {
    const serialized = seededState();
    const malformed = {
      ...serialized,
      comments: [{ ...serialized.comments[0], createdAt: 12345 }],
    };
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.code).toBe('invalid-timestamp');
  });

  test('rejects a noncanonical updatedAt when createdAt is canonical', () => {
    const serialized = seededState();
    const malformed = {
      ...serialized,
      comments: [{ ...serialized.comments[0], updatedAt: 'not-a-timestamp' }],
    };
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-timestamp',
      path: '/comments/0/updatedAt',
      message: expect.any(String),
    });
  });

  test('rejects an empty comment targetId and snapshotId', () => {
    const serialized = seededState();
    const badTargetId = { ...serialized, comments: [{ ...serialized.comments[0], targetId: '' }] };
    const targetIdResult = restoreDiffReviewState(badTargetId, targets());
    expect(targetIdResult.ok).toBe(false);
    if (targetIdResult.ok) throw new Error('expected error');
    expect(targetIdResult.error.path).toBe('/comments/0/targetId');

    const badSnapshotId = {
      ...serialized,
      comments: [{ ...serialized.comments[0], snapshotId: '' }],
    };
    const snapshotIdResult = restoreDiffReviewState(badSnapshotId, targets());
    expect(snapshotIdResult.ok).toBe(false);
    if (snapshotIdResult.ok) throw new Error('expected error');
    expect(snapshotIdResult.error.path).toBe('/comments/0/snapshotId');
  });

  test('rejects a non-boolean resolved/outdated on a comment', () => {
    const serialized = seededState();
    const badResolved = {
      ...serialized,
      comments: [{ ...serialized.comments[0], resolved: 'yes' }],
    };
    const resolvedResult = restoreDiffReviewState(badResolved, targets());
    expect(resolvedResult.ok).toBe(false);
    if (resolvedResult.ok) throw new Error('expected error');
    expect(resolvedResult.error.path).toBe('/comments/0/resolved');

    const badOutdated = {
      ...serialized,
      comments: [{ ...serialized.comments[0], outdated: 'no' }],
    };
    const outdatedResult = restoreDiffReviewState(badOutdated, targets());
    expect(outdatedResult.ok).toBe(false);
    if (outdatedResult.ok) throw new Error('expected error');
    expect(outdatedResult.error.path).toBe('/comments/0/outdated');
  });

  test('rejects an empty draftId/targetId and a non-string draft body', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const withDraft = reduceDiffReviewState(created.value, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'In progress',
    });
    if (!withDraft.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(withDraft.value);
    const draft = serialized.drafts[0]!;

    const badDraftId = { ...serialized, drafts: [{ ...draft, draftId: '' }] };
    const draftIdResult = restoreDiffReviewState(badDraftId, targets());
    expect(draftIdResult.ok).toBe(false);
    if (draftIdResult.ok) throw new Error('expected error');
    expect(draftIdResult.error.path).toBe('/drafts/0/draftId');

    const badTargetId = { ...serialized, drafts: [{ ...draft, targetId: '' }] };
    const targetIdResult = restoreDiffReviewState(badTargetId, targets());
    expect(targetIdResult.ok).toBe(false);
    if (targetIdResult.ok) throw new Error('expected error');
    expect(targetIdResult.error.path).toBe('/drafts/0/targetId');

    const badBody = { ...serialized, drafts: [{ ...draft, body: 42 }] };
    const bodyResult = restoreDiffReviewState(badBody, targets());
    expect(bodyResult.ok).toBe(false);
    if (bodyResult.ok) throw new Error('expected error');
    expect(bodyResult.error.path).toBe('/drafts/0/body');
  });

  test('rejects a non-string draft createdAt/updatedAt outright', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const withDraft = reduceDiffReviewState(created.value, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'In progress',
    });
    if (!withDraft.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(withDraft.value);
    const draft = serialized.drafts[0]!;

    const malformed = { ...serialized, drafts: [{ ...draft, createdAt: 12345 }] };
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error.code).toBe('invalid-timestamp');
  });

  test('rejects an invalid targetKind, fileOccurrence, and snapshotId in captured context', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;

    const badTargetKind = {
      ...serialized,
      comments: [
        { ...comment, capturedContext: { ...comment.capturedContext, targetKind: 'binary' } },
      ],
    };
    const targetKindResult = restoreDiffReviewState(badTargetKind, targets());
    expect(targetKindResult.ok).toBe(false);
    if (targetKindResult.ok) throw new Error('expected error');
    expect(targetKindResult.error.path).toBe('/comments/0/capturedContext/targetKind');

    const badFileOccurrence = {
      ...serialized,
      comments: [
        { ...comment, capturedContext: { ...comment.capturedContext, fileOccurrence: -1 } },
      ],
    };
    const fileOccurrenceResult = restoreDiffReviewState(badFileOccurrence, targets());
    expect(fileOccurrenceResult.ok).toBe(false);
    if (fileOccurrenceResult.ok) throw new Error('expected error');
    expect(fileOccurrenceResult.error.path).toBe('/comments/0/capturedContext/fileOccurrence');

    const badSnapshotId = {
      ...serialized,
      comments: [{ ...comment, capturedContext: { ...comment.capturedContext, snapshotId: '' } }],
    };
    const snapshotIdResult = restoreDiffReviewState(badSnapshotId, targets());
    expect(snapshotIdResult.ok).toBe(false);
    if (snapshotIdResult.ok) throw new Error('expected error');
    expect(snapshotIdResult.error.path).toBe('/comments/0/capturedContext/snapshotId');
  });

  test('accepts an "unavailable" rawMapping and rejects a malformed reason', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;

    const unavailable = {
      ...serialized,
      comments: [
        {
          ...comment,
          capturedContext: {
            ...comment.capturedContext,
            rawMapping: { status: 'unavailable', reason: 'normalization' },
          },
        },
      ],
    };
    const restored = restoreDiffReviewState(unavailable, targets());
    expect(restored.ok).toBe(true);

    const badReason = {
      ...serialized,
      comments: [
        {
          ...comment,
          capturedContext: {
            ...comment.capturedContext,
            rawMapping: { status: 'unavailable', reason: 'something-else' },
          },
        },
      ],
    };
    const badReasonResult = restoreDiffReviewState(badReason, targets());
    expect(badReasonResult.ok).toBe(false);
    if (badReasonResult.ok) throw new Error('expected error');
    expect(badReasonResult.error.path).toBe('/comments/0/capturedContext/rawMapping/reason');

    const badStatus = {
      ...serialized,
      comments: [
        {
          ...comment,
          capturedContext: { ...comment.capturedContext, rawMapping: { status: 'nonsense' } },
        },
      ],
    };
    const badStatusResult = restoreDiffReviewState(badStatus, targets());
    expect(badStatusResult.ok).toBe(false);
    if (badStatusResult.ok) throw new Error('expected error');
    expect(badStatusResult.error.path).toBe('/comments/0/capturedContext/rawMapping/status');
  });

  test('rejects every malformed target-record field', () => {
    const serialized = seededState();
    const target = serialized.targets[0]!;
    const cases: Array<[string, unknown]> = [
      ['targetId', 42],
      ['kind', 'binary'],
      ['label', 42],
      ['repositoryLabel', 42],
      ['baseRevisionLabel', 42],
      ['headRevisionLabel', 42],
      ['snapshotId', 42],
    ];
    for (const [field, value] of cases) {
      const malformed = { ...serialized, targets: [{ ...target, [field]: value }] };
      const restored = restoreDiffReviewState(malformed, targets());
      expect(restored.ok).toBe(false);
      if (restored.ok) throw new Error(`expected error for ${field}`);
      expect(restored.error.path).toBe(`/targets/0/${field}`);
    }
  });

  test('rejects an unknown key on a comment anchor', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    const malformed = {
      ...serialized,
      comments: [{ ...comment, anchor: { ...comment.anchor, extra: 1 } }],
    };
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-anchor',
      path: '/comments/0/anchor/extra',
      message: expect.any(String),
    });
  });

  test('restores a draft outdated flag and rejects a non-boolean one', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const withDraft = reduceDiffReviewState(created.value, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'In progress',
    });
    if (!withDraft.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(withDraft.value);
    expect(serialized.drafts[0]?.outdated).toBe(false);

    const restored = restoreDiffReviewState(serialized, targets());
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('expected ok');
    expect(restored.value.drafts[0]?.outdated).toBe(false);

    const draft = serialized.drafts[0]!;
    const malformed = { ...serialized, drafts: [{ ...draft, outdated: 'no' }] };
    const malformedResult = restoreDiffReviewState(malformed, targets());
    expect(malformedResult.ok).toBe(false);
    if (malformedResult.ok) throw new Error('expected error');
    expect(malformedResult.error).toEqual({
      code: 'invalid-record',
      path: '/drafts/0/outdated',
      message: expect.any(String),
    });
  });

  test('rejects an empty targetId/snapshotId on a reviewed marker', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const reviewed = reduceDiffReviewState(created.value, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!reviewed.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(reviewed.value);
    const marker = serialized.reviewedMarkers[0]!;

    const badTargetId = { ...serialized, reviewedMarkers: [{ ...marker, targetId: '' }] };
    const targetIdResult = restoreDiffReviewState(badTargetId, targets());
    expect(targetIdResult.ok).toBe(false);
    if (targetIdResult.ok) throw new Error('expected error');
    expect(targetIdResult.error.path).toBe('/reviewedMarkers/0/targetId');

    const badSnapshotId = { ...serialized, reviewedMarkers: [{ ...marker, snapshotId: '' }] };
    const snapshotIdResult = restoreDiffReviewState(badSnapshotId, targets());
    expect(snapshotIdResult.ok).toBe(false);
    if (snapshotIdResult.ok) throw new Error('expected error');
    expect(snapshotIdResult.error.path).toBe('/reviewedMarkers/0/snapshotId');
  });

  test('rejects an unknown key on a target record', () => {
    const serialized = seededState();
    const malformed = {
      ...serialized,
      targets: [{ ...serialized.targets[0]!, extra: 1 }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/targets/0/extra',
      message: expect.any(String),
    });
  });

  test('rejects an unknown key nested in a draft record', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const withDraft = reduceDiffReviewState(created.value, {
      type: 'create-draft',
      draftId: 'd1',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'In progress',
    });
    if (!withDraft.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(withDraft.value);
    const malformed = {
      ...serialized,
      drafts: [{ ...serialized.drafts[0]!, extra: 1 }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/drafts/0/extra',
      message: expect.any(String),
    });
  });

  test('rejects an unknown key on a reviewed marker', () => {
    const created = createDiffReviewState(targets());
    if (!created.ok) throw new Error('fixture setup failed');
    const reviewed = reduceDiffReviewState(created.value, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!reviewed.ok) throw new Error('fixture setup failed');
    const serialized = serializeDiffReviewState(reviewed.value);
    const malformed = {
      ...serialized,
      reviewedMarkers: [{ ...serialized.reviewedMarkers[0]!, extra: 1 }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/reviewedMarkers/0/extra',
      message: expect.any(String),
    });
  });

  test('rejects an unknown key on a comment capturedContext', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    const malformed = {
      ...serialized,
      comments: [{ ...comment, capturedContext: { ...comment.capturedContext, extra: 1 } }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/comments/0/capturedContext/extra',
      message: expect.any(String),
    });
  });

  test('rejects an unknown key on a captured-context rawMapping', () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    const malformed = {
      ...serialized,
      comments: [
        {
          ...comment,
          capturedContext: {
            ...comment.capturedContext,
            rawMapping: { ...comment.capturedContext.rawMapping, extra: 1 },
          },
        },
      ],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, targets());
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'invalid-record',
      path: '/comments/0/capturedContext/rawMapping/extra',
      message: expect.any(String),
    });
  });

  test("an unknown key nested in a missing target's captured context fails with missing-context", () => {
    const serialized = seededState();
    const comment = serialized.comments[0]!;
    const malformed = {
      ...serialized,
      targets: [serialized.targets[1]!], // t1 (the comment's target) is gone
      comments: [{ ...comment, capturedContext: { ...comment.capturedContext, extra: 1 } }],
    } as unknown as DiffReviewSerializedState;
    const restored = restoreDiffReviewState(malformed, [
      { kind: 'source', targetId: 't2', label: 'src/y.ts', patch: 'diff-2' },
    ]);
    expect(restored.ok).toBe(false);
    if (restored.ok) throw new Error('expected error');
    expect(restored.error).toEqual({
      code: 'missing-context',
      path: '/comments/0/capturedContext/extra',
      message: expect.any(String),
    });
  });
});
