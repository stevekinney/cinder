/**
 * Toolbar change-count computation for ReviewEditor.
 *
 * Pulled out of `review-editor-impl.svelte` so it is testable directly: the
 * component itself is too heavy to mount in happy-dom (Milkdown + ProseMirror
 * internals fail in non-browser DOMs — see
 * `review-editor.snapshot-mode.test.ts`), but this computation only ever
 * touches its two string arguments, so it does not need the component at all.
 */
import { computeLineDiff, getDiffStats } from '@lostgradient/markdown/diff/line-diff';
import { normalizeDocument } from '../../export/normalize-document.js';

export interface ReviewEditorDiffStats {
  added: number;
  removed: number;
  modified: number;
}

/**
 * Compute the toolbar's added/removed/modified counts for a document pair.
 *
 * Must use the same front-matter-aware {@link normalizeDocument} the diff
 * panel and `generateUnifiedDiff` use, not the bare `normalize()` pipeline —
 * handed a whole document with front matter, `normalize()` misreads the `---`
 * fences as a thematic break plus a setext heading and rewrites the closing
 * fence's underline to match the content's width, so an edit that only
 * changes a front-matter value's length is counted as two modified lines
 * (the value AND the now-different-length underline) instead of one
 * (cinder#1307).
 */
export function computeReviewEditorDiffStats(
  original: string,
  current: string,
): ReviewEditorDiffStats {
  if (!original) {
    return { added: 0, removed: 0, modified: 0 };
  }

  const normalizedOriginal = normalizeDocument(original);
  const normalizedCurrent = normalizeDocument(current);
  const lineDiffs = computeLineDiff(normalizedOriginal, normalizedCurrent);
  return getDiffStats(lineDiffs);
}
