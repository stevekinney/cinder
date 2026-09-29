/**
 * Builds the format-agnostic `DiffReviewExportModel` both `exportDiffReviewMarkdown` and
 * `exportDiffReviewJson` render (DR-5, "Agent export contract" and "Export literalness and
 * existing threads").
 *
 * Validation, scope filtering, and ordering all happen here, once, so both renderers agree on
 * IDs, bodies, location, and state by construction rather than by two independently maintained
 * implementations.
 *
 * @module
 */

import {
  ensureDiffReviewNoPendingDrafts,
  validateSerializedDiffReviewState,
  type DiffReviewComment,
  type DiffReviewResult,
  type DiffReviewState,
} from '../diff-review-state/index.js';
import { validateDiffReviewExportDocumentThreads } from './diff-review-export-document-threads.js';
import type {
  DiffReviewExportDiffRecord,
  DiffReviewExportDocumentRecord,
  DiffReviewExportDocumentThread,
  DiffReviewExportModel,
  DiffReviewExportOptions,
  DiffReviewExportRecord,
  DiffReviewExportScope,
} from './diff-review-export-types.js';
import { DIFF_REVIEW_EXPORT_SCHEMA_VERSION } from './diff-review-export-types.js';

const DEFAULT_REVIEW_TITLE = 'Review feedback';

function diffExportId(commentId: string): string {
  return JSON.stringify(['diff', commentId]);
}

function documentExportId(targetId: string, threadId: string): string {
  return JSON.stringify(['document', targetId, threadId]);
}

function toDiffRecord(
  comment: DiffReviewComment,
  liveTargetIds: ReadonlySet<string>,
): DiffReviewExportDiffRecord {
  const { anchor, capturedContext } = comment;
  return {
    recordKind: 'diff',
    exportId: diffExportId(comment.id),
    commentId: comment.id,
    targetId: comment.targetId,
    current: liveTargetIds.has(comment.targetId),
    targetKind: capturedContext.targetKind,
    targetLabel: capturedContext.targetLabel,
    repositoryLabel: capturedContext.repositoryLabel ?? null,
    baseRevisionLabel: capturedContext.baseRevisionLabel ?? null,
    headRevisionLabel: capturedContext.headRevisionLabel ?? null,
    snapshotId: comment.snapshotId,
    fileOccurrence: capturedContext.fileOccurrence,
    oldPath: capturedContext.oldPath,
    newPath: capturedContext.newPath,
    anchor:
      anchor.kind === 'file'
        ? { kind: 'file' }
        : {
            kind: 'range',
            side: anchor.side,
            startLine: anchor.startLine,
            endLine: anchor.endLine,
            coordinateSpace: anchor.coordinateSpace,
            hunkOccurrence: anchor.hunkOccurrence,
            selectedText: anchor.selectedText,
            contextBefore: anchor.contextBefore,
            contextAfter: anchor.contextAfter,
          },
    rawMapping: capturedContext.rawMapping,
    body: comment.body,
    resolved: comment.resolved,
    outdated: comment.outdated,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

/**
 * Sort key for diff records (contract, "Export literalness and existing threads"): current
 * targets in the state's own target order, then missing targets by captured target ID; within a
 * target, by file occurrence; within a file, file-level comments first, then by side, then by
 * ascending line range; finally by creation timestamp and namespaced export ID. Every comparison
 * is a plain code-unit string/number comparison, never locale-aware collation.
 */
function compareDiffRecords(
  a: DiffReviewExportDiffRecord,
  b: DiffReviewExportDiffRecord,
  presentTargetIndex: ReadonlyMap<string, number>,
): number {
  const aIndex = presentTargetIndex.get(a.targetId);
  const bIndex = presentTargetIndex.get(b.targetId);
  if (aIndex !== undefined && bIndex !== undefined) {
    if (aIndex !== bIndex) return aIndex - bIndex;
  } else if ((aIndex !== undefined) !== (bIndex !== undefined)) {
    // Present targets sort before every missing target.
    return aIndex !== undefined ? -1 : 1;
  } else if (a.targetId !== b.targetId) {
    return a.targetId < b.targetId ? -1 : 1;
  }

  if (a.fileOccurrence !== b.fileOccurrence) return a.fileOccurrence - b.fileOccurrence;

  const aIsFile = a.anchor.kind === 'file';
  const bIsFile = b.anchor.kind === 'file';
  if (aIsFile !== bIsFile) return aIsFile ? -1 : 1;

  if (a.anchor.kind === 'range' && b.anchor.kind === 'range') {
    if (a.anchor.side !== b.anchor.side) return a.anchor.side < b.anchor.side ? -1 : 1;
    if (a.anchor.startLine !== b.anchor.startLine) return a.anchor.startLine - b.anchor.startLine;
    if (a.anchor.endLine !== b.anchor.endLine) return a.anchor.endLine - b.anchor.endLine;
  }

  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.exportId < b.exportId ? -1 : a.exportId > b.exportId ? 1 : 0;
}

function toDocumentRecord(
  thread: DiffReviewExportDocumentThread,
): DiffReviewExportDocumentRecord | null {
  const messages = thread.messages
    .filter((message) => !message.deletedAt)
    .toSorted((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((message) => ({ id: message.id, body: message.body, createdAt: message.createdAt }));

  if (messages.length === 0) return null;

  return {
    recordKind: 'document',
    exportId: documentExportId(thread.targetId, thread.threadId),
    targetId: thread.targetId,
    threadId: thread.threadId,
    createdAt: thread.createdAt,
    anchor: thread.anchor,
    messages,
  };
}

function compareDocumentRecords(
  a: DiffReviewExportDocumentRecord,
  b: DiffReviewExportDocumentRecord,
): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.exportId < b.exportId ? -1 : a.exportId > b.exportId ? 1 : 0;
}

function buildTotals(records: DiffReviewExportRecord[]) {
  let messageBodies = 0;
  let open = 0;
  let resolved = 0;
  let outdated = 0;

  for (const record of records) {
    if (record.recordKind === 'diff') {
      messageBodies += 1;
      if (record.resolved) resolved += 1;
      else open += 1;
      if (record.outdated) outdated += 1;
    } else {
      messageBodies += record.messages.length;
      // Existing document threads have no resolved state; the contract treats every retained
      // thread as open.
      open += 1;
    }
  }

  return { records: records.length, messageBodies, open, resolved, outdated };
}

export function buildDiffReviewExportModel(
  state: DiffReviewState,
  options: DiffReviewExportOptions = {},
): DiffReviewResult<DiffReviewExportModel> {
  const liveTargetIds = new Set(state.targets.map((target) => target.targetId));

  const validatedState = validateSerializedDiffReviewState(state, liveTargetIds);
  if (!validatedState.ok) return validatedState;

  const documentThreadsInput = options.documentThreads ?? [];
  const validatedThreads = validateDiffReviewExportDocumentThreads(documentThreadsInput);
  if (!validatedThreads.ok) return validatedThreads;

  const pendingDrafts = ensureDiffReviewNoPendingDrafts(validatedState.value);
  if (!pendingDrafts.ok) return pendingDrafts;

  const scope: DiffReviewExportScope = options.scope ?? 'all';
  const reviewTitle = options.reviewTitle ?? DEFAULT_REVIEW_TITLE;

  const presentTargetIndex = new Map(
    validatedState.value.targets.map((target, index) => [target.targetId, index] as const),
  );

  const scopedComments =
    scope === 'unresolved'
      ? validatedState.value.comments.filter((comment) => !comment.resolved)
      : validatedState.value.comments;

  const diffRecords = scopedComments
    .map((comment) => toDiffRecord(comment, liveTargetIds))
    .toSorted((a, b) => compareDiffRecords(a, b, presentTargetIndex));

  const documentRecords = validatedThreads.value
    .map(toDocumentRecord)
    .filter((record): record is DiffReviewExportDocumentRecord => record !== null)
    .toSorted(compareDocumentRecords);

  const records: DiffReviewExportRecord[] = [...diffRecords, ...documentRecords];

  return {
    ok: true,
    value: {
      schemaVersion: DIFF_REVIEW_EXPORT_SCHEMA_VERSION,
      scope,
      reviewTitle,
      reviewNote: validatedState.value.reviewNote,
      totals: buildTotals(records),
      records,
    },
  };
}
