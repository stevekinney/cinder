/**
 * Which (target, file, side, line) coordinates a CURRENT saved comment
 * covers, for rendering saved-comment markers through `DiffViewer`'s and
 * `SourceDiffViewer`'s public `lineAnnotation`/`fileAnnotation` snippets
 * (COR-509 / DR-6, "inline saved-comment markers ... for CURRENT comments
 * only").
 *
 * Deliberately excludes `hunkOccurrence` from the line key: both viewers'
 * line/side line numbers are absolute positions within the file (or
 * document), not hunk-relative, so a line number can only belong to one
 * hunk on a given side of a given file -- matching on
 * target+file+side+line alone cannot collide across hunks, and dropping it
 * lets `DiffViewer`'s `lineAnnotation` context (which carries no
 * `hunkOccurrence` at all -- a Markdown target's line-annotation context is
 * `{ side, line, diff }`) and `SourceDiffViewer`'s (which does) share one
 * lookup shape.
 *
 * @module
 */

import type { DiffReviewState } from '../../diff-review-state/index.ts';
import { classifyDiffReviewAnchorStatus } from './diff-review-anchor-status.ts';

function lineKey(
  targetId: string,
  fileOccurrence: number,
  side: 'old' | 'new',
  line: number,
): string {
  return `${targetId}:${fileOccurrence}:${side}:${line}`;
}

/**
 * Every (target, file, side, line) covered by a CURRENT range comment,
 * expanded across each comment's inclusive `startLine..endLine` range.
 * Outdated and removed comments contribute nothing.
 */
export function buildDiffReviewCurrentLineMarkerKeys(state: DiffReviewState): Set<string> {
  const keys = new Set<string>();
  for (const comment of state.comments) {
    if (comment.anchor.kind !== 'range') continue;
    if (classifyDiffReviewAnchorStatus(state, comment) !== 'current') continue;
    for (let line = comment.anchor.startLine; line <= comment.anchor.endLine; line += 1) {
      keys.add(lineKey(comment.targetId, comment.anchor.fileOccurrence, comment.anchor.side, line));
    }
  }
  return keys;
}

export function hasDiffReviewCurrentLineMarker(
  keys: Set<string>,
  targetId: string,
  fileOccurrence: number,
  side: 'old' | 'new',
  line: number,
): boolean {
  return keys.has(lineKey(targetId, fileOccurrence, side, line));
}

/** Whether a CURRENT file-level comment exists for this exact target+file. */
export function hasDiffReviewCurrentFileMarker(
  state: DiffReviewState,
  targetId: string,
  fileOccurrence: number,
): boolean {
  return state.comments.some(
    (comment) =>
      comment.anchor.kind === 'file' &&
      comment.targetId === targetId &&
      comment.anchor.fileOccurrence === fileOccurrence &&
      classifyDiffReviewAnchorStatus(state, comment) === 'current',
  );
}
