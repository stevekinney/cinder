/**
 * Formats a saved comment's (or an in-progress draft's) location for
 * display, from its `capturedContext` — the same fields a comment retains
 * even after its target/file disappears, so a removed target's comments
 * still render a meaningful location. `DiffReviewDraft` shares the exact
 * `anchor`/`capturedContext` shape with `DiffReviewComment`, so the
 * composer reuses this to name the file/side/range above its textarea
 * before Save ever turns the draft into a comment (contract: "The composer
 * names the file, side, and range before saving").
 */

import type { DiffReviewAnchor, DiffReviewCapturedContext } from '../../diff-review-state/index.ts';

export interface DiffReviewLocatable {
  anchor: DiffReviewAnchor;
  capturedContext: DiffReviewCapturedContext;
}

function pathLabel(locatable: DiffReviewLocatable): string {
  const { newPath, oldPath, targetLabel } = locatable.capturedContext;
  return newPath ?? oldPath ?? targetLabel;
}

export function formatDiffReviewCommentLocation(locatable: DiffReviewLocatable): string {
  const path = pathLabel(locatable);
  if (locatable.anchor.kind === 'file') return path;
  const { side, startLine, endLine } = locatable.anchor;
  const lines = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;
  return `${path} · ${side} ${lines}`;
}
