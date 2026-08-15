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
 * Bounded cache of `original` -> `normalizeDocument(original)` (cinder#1336).
 *
 * `computeReviewEditorDiffStats` is re-invoked on every settled edit —
 * roughly every 300-500ms while typing, per the debounce chain documented on
 * `review-editor-impl.svelte`'s `diffStats` — but `original` is a review
 * session's fixed baseline: it only ever changes if the consumer passes a
 * new `original` prop. Re-normalizing it from scratch on every call was the
 * entire cost cinder#1336 measured: a stage-level breakdown attributed >99%
 * of a ~30ms recompute, on a realistic 304-line document, to two
 * near-identical `normalizeDocument` calls, one of which (original's) never
 * needed to run more than once per baseline.
 *
 * Keyed by value (a `Map`, not a `WeakMap` — strings aren't `WeakMap`-eligible
 * keys) and bounded to a handful of entries rather than a single slot: this
 * is a shared, stateless, pure function with no per-instance identity to key
 * off, and a page can legitimately hold more than one `ReviewEditor`, each
 * with its own `original`. A single-slot cache would still be *correct*
 * under that interleaving — a miss just recomputes — but it would hit 0% of
 * the time and deliver none of the win this exists for. LRU eviction (bump
 * an entry to most-recently-used on every hit, evict the least-recently-used
 * entry once over capacity) means an `original` in active use keeps
 * surviving even while other instances' unrelated `current` recomputations
 * interleave, while an abandoned instance's entry ages out instead of
 * growing this cache without bound.
 */
const ORIGINAL_NORMALIZE_CACHE_SIZE = 8;
const normalizedOriginalCache = new Map<string, string>();

function getNormalizedOriginal(original: string): string {
  const cached = normalizedOriginalCache.get(original);
  if (cached !== undefined) {
    normalizedOriginalCache.delete(original);
    normalizedOriginalCache.set(original, cached);
    return cached;
  }

  const normalized = normalizeDocument(original);
  normalizedOriginalCache.set(original, normalized);
  if (normalizedOriginalCache.size > ORIGINAL_NORMALIZE_CACHE_SIZE) {
    const oldestKey = normalizedOriginalCache.keys().next().value;
    if (oldestKey !== undefined) normalizedOriginalCache.delete(oldestKey);
  }
  return normalized;
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

  const normalizedOriginal = getNormalizedOriginal(original);
  const normalizedCurrent = normalizeDocument(current);
  const lineDiffs = computeLineDiff(normalizedOriginal, normalizedCurrent);
  return getDiffStats(lineDiffs);
}
