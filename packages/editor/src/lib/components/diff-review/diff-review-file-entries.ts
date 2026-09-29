/**
 * Derives the `DiffReview` file list (COR-509 / DR-6, "file list with
 * changed-line/comment counts, Reviewed checkbox, and path filter").
 *
 * A `DiffReviewState` target record carries only identity (target id, kind,
 * label, snapshot id) — the actual document/patch text is host-owned and
 * supplied separately as `DiffReviewTargetInput[]` (the same shape
 * `createDiffReviewState`/`set-targets` take). This module reconciles the
 * two: one live target input can expand into one (Markdown) or many
 * (source patch) file entries, each carrying the comment/draft counts and
 * reviewed state `diff-review-state` already tracks by target id + file
 * occurrence.
 *
 * Pure and DOM-free: reuses `@lostgradient/markdown`'s line-diff stats for a
 * Markdown target's single file and `@lostgradient/cinder`'s
 * `parseUnifiedPatch` for a source target's per-file descriptors, rather than
 * re-deriving either.
 *
 * @module
 */

import { parseUnifiedPatch } from '@lostgradient/cinder';
import { computeLineDiff, getDiffStats } from '@lostgradient/markdown';

import type {
  DiffReviewState,
  DiffReviewTargetInput,
  DiffReviewTargetKind,
} from '../../diff-review-state/index.ts';
import { isDiffReviewFileReviewed } from '../../diff-review-state/index.ts';

export interface DiffReviewFileEntry {
  targetId: string;
  targetLabel: string;
  targetKind: DiffReviewTargetKind;
  fileOccurrence: number;
  /** Display path: the file's own path for a source target, the target label for Markdown. */
  path: string;
  changedLineCount: number;
  commentCount: number;
  draftCount: number;
  reviewed: boolean;
}

function countAnchored(
  records: { targetId: string; anchor: { fileOccurrence: number } }[],
  targetId: string,
  fileOccurrence: number,
): number {
  return records.filter(
    (record) => record.targetId === targetId && record.anchor.fileOccurrence === fileOccurrence,
  ).length;
}

/**
 * The number of changed (added/removed/modified) lines a file occurrence
 * has, independent of any `DiffReviewState` -- shared by the file list's
 * counts and by `DiffReviewRenderer`'s "No commentable patch lines" state,
 * so the two can never disagree about what counts as commentable.
 */
export function getDiffReviewFileChangedLineCount(
  target: DiffReviewTargetInput,
  fileOccurrence: number,
): number {
  if (target.kind === 'markdown') {
    const stats = getDiffStats(computeLineDiff(target.original, target.current));
    return stats.added + stats.removed + stats.modified;
  }
  const descriptor = parseUnifiedPatch(target.patch).descriptors.find(
    (candidate) => candidate.fileOccurrence === fileOccurrence,
  );
  return descriptor?.changedLineCount ?? 0;
}

function markdownFileEntries(
  target: Extract<DiffReviewTargetInput, { kind: 'markdown' }>,
  state: DiffReviewState,
): DiffReviewFileEntry[] {
  return [
    {
      targetId: target.targetId,
      targetLabel: target.label,
      targetKind: 'markdown',
      fileOccurrence: 0,
      path: target.label,
      changedLineCount: getDiffReviewFileChangedLineCount(target, 0),
      commentCount: countAnchored(state.comments, target.targetId, 0),
      draftCount: countAnchored(state.drafts, target.targetId, 0),
      reviewed: isDiffReviewFileReviewed(state, target.targetId, 0),
    },
  ];
}

function sourceFileEntries(
  target: Extract<DiffReviewTargetInput, { kind: 'source' }>,
  state: DiffReviewState,
): DiffReviewFileEntry[] {
  const parsed = parseUnifiedPatch(target.patch);
  return parsed.descriptors.map((descriptor) => ({
    targetId: target.targetId,
    targetLabel: target.label,
    targetKind: 'source',
    fileOccurrence: descriptor.fileOccurrence,
    path: descriptor.newPath ?? descriptor.oldPath ?? descriptor.label,
    changedLineCount: descriptor.changedLineCount,
    commentCount: countAnchored(state.comments, target.targetId, descriptor.fileOccurrence),
    draftCount: countAnchored(state.drafts, target.targetId, descriptor.fileOccurrence),
    reviewed: isDiffReviewFileReviewed(state, target.targetId, descriptor.fileOccurrence),
  }));
}

/**
 * Build the flattened file list for every live target, in target order and
 * then file-occurrence order. Removed targets (present in `state.comments`'
 * captured context but absent from `targets`) are not file entries — the
 * comments/drafts panel surfaces those directly from state instead.
 */
export function buildDiffReviewFileEntries(
  targets: DiffReviewTargetInput[],
  state: DiffReviewState,
): DiffReviewFileEntry[] {
  return targets.flatMap((target) =>
    target.kind === 'markdown'
      ? markdownFileEntries(target, state)
      : sourceFileEntries(target, state),
  );
}
