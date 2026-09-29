import { describe, expect, test } from 'bun:test';

import type {
  DiffReviewComment,
  DiffReviewRangeAnchor,
  DiffReviewState,
} from '../diff-review-state/index.js';
import {
  buildRemovedTargetFixture,
  documentThreadsFixture,
  twoSourceTargetsFixture,
} from './diff-review-export-fixtures.js';
import { buildDiffReviewExportModel } from './diff-review-export-model.js';
import type { DiffReviewExportDocumentThread } from './diff-review-export-types.js';

const defaultRangeAnchor: DiffReviewRangeAnchor = {
  kind: 'range',
  fileOccurrence: 0,
  hunkOccurrence: 0,
  side: 'new',
  startLine: 1,
  endLine: 1,
  coordinateSpace: 'raw-source',
  selectedText: 'x',
  contextBefore: [],
  contextAfter: [],
};

/** A minimal, fully valid range comment, for tests that only care about one or two fields. */
function rangeComment(
  overrides: Partial<DiffReviewComment> & { id: string; anchor?: DiffReviewRangeAnchor },
): DiffReviewComment {
  return {
    targetId: 'solo',
    snapshotId: 'solo-snapshot',
    anchor: defaultRangeAnchor,
    capturedContext: {
      targetKind: 'source',
      targetLabel: 'solo',
      repositoryLabel: undefined,
      baseRevisionLabel: undefined,
      headRevisionLabel: undefined,
      oldPath: 'solo.ts',
      newPath: 'solo.ts',
      fileOccurrence: 0,
      snapshotId: 'solo-snapshot',
      rawMapping: { status: 'exact' },
    },
    body: 'body',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    resolved: false,
    outdated: false,
    ...overrides,
  };
}

function soloState(comments: DiffReviewComment[]): DiffReviewState {
  return {
    version: 1,
    targets: [
      {
        targetId: 'solo',
        kind: 'source',
        label: 'solo',
        repositoryLabel: undefined,
        baseRevisionLabel: undefined,
        headRevisionLabel: undefined,
        snapshotId: 'solo-snapshot',
      },
    ],
    comments,
    drafts: [],
    reviewNote: '',
    selectedTargetId: 'solo',
    selectedFileOccurrence: 0,
    reviewedMarkers: [],
  };
}

function commentIdsInOrder(model: ReturnType<typeof buildDiffReviewExportModel>): string[] {
  if (!model.ok) throw new Error('expected ok');
  return model.value.records.map((record) =>
    record.recordKind === 'diff' ? record.commentId : `${record.targetId}/${record.threadId}`,
  );
}

describe('DiffReview export ordering', () => {
  test('orders records within a target: file comments first, then by side, then by line, then by creation time', () => {
    const model = buildDiffReviewExportModel(twoSourceTargetsFixture);
    if (!model.ok) throw new Error('expected ok');

    // 'left' target's records: the file comment before the range comment;
    // 'right' target follows because it is later in state.targets.
    expect(commentIdsInOrder(model)).toEqual([
      'comment-file',
      'comment-resolved',
      'comment-outdated',
    ]);
  });

  test('every diff record totals to the state comment count for the default (all) scope', () => {
    const model = buildDiffReviewExportModel(twoSourceTargetsFixture);
    if (!model.ok) throw new Error('expected ok');
    expect(model.value.totals).toEqual({
      records: 3,
      messageBodies: 3,
      open: 2, // file comment (unresolved) + outdated comment (unresolved)
      resolved: 1,
      outdated: 1,
    });
  });

  test('unresolved-only scope excludes resolved diff comments and updates totals, without discarding them from state', () => {
    const model = buildDiffReviewExportModel(twoSourceTargetsFixture, { scope: 'unresolved' });
    if (!model.ok) throw new Error('expected ok');
    expect(commentIdsInOrder(model)).toEqual(['comment-file', 'comment-outdated']);
    expect(model.value.totals).toEqual({
      records: 2,
      messageBodies: 2,
      open: 2,
      resolved: 0,
      outdated: 1,
    });
    expect(model.value.scope).toBe('unresolved');
  });

  test('a comment on a removed target sorts after every comment on a present target, marked not current', () => {
    const present = buildDiffReviewExportModel(twoSourceTargetsFixture);
    if (!present.ok) throw new Error('expected ok');
    const removedState = buildRemovedTargetFixture();

    // Merge: 'left'/'right' are still present targets; 'gone' is now absent from state.targets,
    // but its comment must still export, sorted after the present-target comments.
    const combined = {
      ...twoSourceTargetsFixture,
      comments: [...twoSourceTargetsFixture.comments, ...removedState.comments],
    };
    const model = buildDiffReviewExportModel(combined);
    if (!model.ok) throw new Error('expected ok');
    expect(commentIdsInOrder(model)).toEqual([
      'comment-file',
      'comment-resolved',
      'comment-outdated',
      'comment-on-removed',
    ]);

    const removedRecord = model.value.records.find(
      (record) => record.recordKind === 'diff' && record.commentId === 'comment-on-removed',
    );
    expect(removedRecord).toBeDefined();
    if (removedRecord?.recordKind !== 'diff') throw new Error('expected diff record');
    expect(removedRecord.current).toBe(false);
    expect(removedRecord.outdated).toBe(true);
  });

  test('two removed targets sort among themselves by captured target ID (code-unit order)', () => {
    const stateWithTwoRemoved = {
      ...twoSourceTargetsFixture,
      targets: [],
      comments: twoSourceTargetsFixture.comments.map((comment) => ({ ...comment, outdated: true })),
    };
    const model = buildDiffReviewExportModel(stateWithTwoRemoved);
    if (!model.ok) throw new Error('expected ok');
    const targetIdsInOrder = model.value.records
      .filter((record) => record.recordKind === 'diff')
      .map((record) => (record.recordKind === 'diff' ? record.targetId : ''));
    // 'left' < 'right' by code-unit comparison.
    expect(targetIdsInOrder).toEqual(['left', 'left', 'right']);
  });

  test('document thread records are appended after every diff record, ordered by creation time', () => {
    const model = buildDiffReviewExportModel(twoSourceTargetsFixture, {
      documentThreads: documentThreadsFixture,
    });
    if (!model.ok) throw new Error('expected ok');
    const documentRecordIds = model.value.records
      .filter((record) => record.recordKind === 'document')
      .map((record) => (record.recordKind === 'document' ? record.threadId : ''));
    // 'thread-fully-deleted' is dropped entirely (zero surviving messages).
    expect(documentRecordIds).toEqual(['thread-deleted-initial', 'thread-ordinary']);

    const firstDiffIndex = model.value.records.findIndex((r) => r.recordKind === 'diff');
    const firstDocumentIndex = model.value.records.findIndex((r) => r.recordKind === 'document');
    expect(firstDiffIndex).toBeLessThan(firstDocumentIndex);
  });

  test('within one target, file occurrence orders ascending regardless of array order', () => {
    const state = soloState([
      rangeComment({
        id: 'on-occurrence-1',
        anchor: { ...defaultRangeAnchor, fileOccurrence: 1 },
      }),
      rangeComment({ id: 'on-occurrence-0' }),
    ]);
    const model = buildDiffReviewExportModel(state);
    if (!model.ok) throw new Error('expected ok');
    expect(model.value.records.map((r) => (r.recordKind === 'diff' ? r.commentId : ''))).toEqual([
      'on-occurrence-0',
      'on-occurrence-1',
    ]);
  });

  test('two range comments on the same side and start line order by ascending end line', () => {
    const state = soloState([
      rangeComment({
        id: 'wide',
        anchor: { ...defaultRangeAnchor, startLine: 5, endLine: 7 },
      }),
      rangeComment({
        id: 'narrow',
        anchor: { ...defaultRangeAnchor, startLine: 5, endLine: 5 },
      }),
    ]);
    const model = buildDiffReviewExportModel(state);
    if (!model.ok) throw new Error('expected ok');
    expect(model.value.records.map((r) => (r.recordKind === 'diff' ? r.commentId : ''))).toEqual([
      'narrow',
      'wide',
    ]);
  });

  test('two records with identical creation time fall back to the namespaced export ID, code-unit order', () => {
    const state = soloState([
      rangeComment({ id: 'b', createdAt: '2026-01-01T00:00:00.000Z' }),
      rangeComment({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    const model = buildDiffReviewExportModel(state);
    if (!model.ok) throw new Error('expected ok');
    // ["diff","a"] < ["diff","b"] by code-unit comparison.
    expect(model.value.records.map((r) => (r.recordKind === 'diff' ? r.commentId : ''))).toEqual([
      'a',
      'b',
    ]);
  });

  test('document thread messages with identical creation time fall back to message ID, code-unit order', () => {
    const threads: DiffReviewExportDocumentThread[] = [
      {
        targetId: 'doc',
        threadId: 'thread',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [
          { id: 'b', body: 'second by id', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'a', body: 'first by id', createdAt: '2026-01-01T00:00:00.000Z' },
        ],
      },
    ];
    const model = buildDiffReviewExportModel(soloState([]), { documentThreads: threads });
    if (!model.ok) throw new Error('expected ok');
    const record = model.value.records[0];
    if (record?.recordKind !== 'document') throw new Error('expected document record');
    expect(record.messages.map((m) => m.id)).toEqual(['a', 'b']);
  });

  test('a custom reviewTitle option is honored in the model', () => {
    const model = buildDiffReviewExportModel(soloState([]), { reviewTitle: 'Custom title' });
    if (!model.ok) throw new Error('expected ok');
    expect(model.value.reviewTitle).toBe('Custom title');
  });
});
