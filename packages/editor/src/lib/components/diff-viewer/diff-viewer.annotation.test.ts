import { computeLineDiff } from '@lostgradient/markdown';
import { describe, expect, test } from 'bun:test';

import {
  buildDiffViewerLineSelection,
  extendDiffViewerSelection,
  extractFrontMatterChangedFields,
  isSideCommentable,
  nearestChangeClusterIndex,
  numberDiffViewerRows,
  type DiffViewerAnnotationContext,
} from './diff-viewer.annotation.ts';

/**
 * Pure-logic coverage for DiffViewer's Markdown annotation hooks (COR-514 /
 * DR-4). No Svelte or DOM import here on purpose -- this module is usable in
 * SSR and from plain unit tests, matching SourceDiffViewer's
 * `source-diff-viewer.annotation.ts` (COR-515 / DR-3).
 */

function context(
  lineDiffs: ReturnType<typeof computeLineDiff>,
  options: { normalizeInputs?: boolean; frontMatter?: { old: number; new: number } } = {},
): DiffViewerAnnotationContext {
  const frontMatterLineCounts = options.frontMatter ?? { old: 0, new: 0 };
  return {
    lineDiffs,
    numbered: numberDiffViewerRows(lineDiffs, frontMatterLineCounts),
    normalizeInputs: options.normalizeInputs ?? false,
  };
}

describe('DiffViewer: annotation line numbering', () => {
  test('same/added/removed/modified rows number both sides directly, no front matter', () => {
    const diffs = computeLineDiff('keep\nold middle\nkeep end', 'keep\nkeep end\nbrand new');
    const numbered = numberDiffViewerRows(diffs, { old: 0, new: 0 });

    expect(numbered).toHaveLength(diffs.length);
    // First row ("keep") is unchanged: line 1 on both sides.
    expect(numbered[0]).toEqual({ oldLine: 1, newLine: 1 });
    // Old-only and new-only rows never share a number with the other side's count.
    const oldNumbers = numbered.map((row) => row.oldLine).filter((line) => line !== null);
    const newNumbers = numbered.map((row) => row.newLine).filter((line) => line !== null);
    expect(oldNumbers).toEqual([...oldNumbers].sort((a, b) => a - b));
    expect(newNumbers).toEqual([...newNumbers].sort((a, b) => a - b));
  });

  test('modified rows occupy a position on both sides, independently', () => {
    const diffs = computeLineDiff('first\nsecond\nthird', 'first\nSECOND CHANGED\nthird');
    const numbered = numberDiffViewerRows(diffs, { old: 0, new: 0 });

    expect(diffs[1]!.type).toBe('modified');
    expect(numbered[1]).toEqual({ oldLine: 2, newLine: 2 });
    expect(numbered[2]).toEqual({ oldLine: 3, newLine: 3 });
  });

  test('leading front matter offsets every body line number, per side independently', () => {
    const diffs = computeLineDiff('body one\nbody two', 'body one\nbody two changed');
    // Original front matter is 3 lines ("---\ntitle: X\n---"), current is 4
    // (an extra field was added) -- offsets differ per side.
    const numbered = numberDiffViewerRows(diffs, { old: 3, new: 4 });

    expect(numbered[0]).toEqual({ oldLine: 4, newLine: 5 });
  });

  test('blank body lines still receive a line number', () => {
    const diffs = computeLineDiff('one\n\nthree', 'one\n\nTHREE');
    const numbered = numberDiffViewerRows(diffs, { old: 0, new: 0 });
    expect(numbered[1]).toEqual({ oldLine: 2, newLine: 2 });
    expect(diffs[1]).toEqual({ type: 'same', text: '' });
  });
});

describe('DiffViewer: side commentability', () => {
  test('unchanged rows are commentable on both sides', () => {
    const diffs = computeLineDiff('same line', 'same line');
    expect(diffs[0]!.type).toBe('same');
    expect(isSideCommentable(diffs[0]!, 'old')).toBe(true);
    expect(isSideCommentable(diffs[0]!, 'new')).toBe(true);
  });

  test('an added row is only commentable on the new side', () => {
    const diffs = computeLineDiff('keep', 'keep\nadded');
    const added = diffs.find((diff) => diff.type === 'added');
    expect(added).toBeDefined();
    expect(isSideCommentable(added!, 'old')).toBe(false);
    expect(isSideCommentable(added!, 'new')).toBe(true);
  });

  test('a removed row is only commentable on the old side', () => {
    const diffs = computeLineDiff('keep\nremoved', 'keep');
    const removed = diffs.find((diff) => diff.type === 'removed');
    expect(removed).toBeDefined();
    expect(isSideCommentable(removed!, 'old')).toBe(true);
    expect(isSideCommentable(removed!, 'new')).toBe(false);
  });

  test('a modified row is commentable on both sides, independently', () => {
    const diffs = computeLineDiff('before', 'after');
    expect(diffs[0]!.type).toBe('modified');
    expect(isSideCommentable(diffs[0]!, 'old')).toBe(true);
    expect(isSideCommentable(diffs[0]!, 'new')).toBe(true);
  });
});

describe('DiffViewer: building and extending selections', () => {
  test('a single-line selection on a modified row captures the OLD side independently of the NEW side', () => {
    const diffs = computeLineDiff('one\nbefore\nthree', 'one\nafter\nthree');
    const ctx = context(diffs);

    const oldSelection = buildDiffViewerLineSelection(ctx, { side: 'old', line: 2 });
    const newSelection = buildDiffViewerLineSelection(ctx, { side: 'new', line: 2 });

    expect(oldSelection?.selectedText).toBe('before');
    expect(newSelection?.selectedText).toBe('after');
    expect(oldSelection?.side).toBe('old');
    expect(newSelection?.side).toBe('new');
    // Independent targets: not the same object, not aliased.
    expect(oldSelection).not.toBe(newSelection);
    expect(oldSelection?.contextBefore).not.toBe(newSelection?.contextBefore);
  });

  test('building a selection on a side the row has no content for returns null', () => {
    const diffs = computeLineDiff('keep', 'keep\nadded');
    const ctx = context(diffs);
    const added = diffs.find((diff) => diff.type === 'added')!;
    const numbered = numberDiffViewerRows(diffs, { old: 0, new: 0 });
    const addedIndex = diffs.indexOf(added);

    expect(
      buildDiffViewerLineSelection(ctx, { side: 'old', line: numbered[addedIndex]!.newLine! }),
    ).toBeNull();
  });

  test('captures up to three same-side context lines, fewer at the document edge', () => {
    const diffs = computeLineDiff('a\nb\nc\nd\ne\nf\ng', 'a\nb\nc\nCHANGED\ne\nf\ng');
    const ctx = context(diffs);
    const selection = buildDiffViewerLineSelection(ctx, { side: 'new', line: 4 });
    expect(selection?.contextBefore).toEqual(['a', 'b', 'c']);
    expect(selection?.contextAfter).toEqual(['e', 'f', 'g']);

    const edgeSelection = buildDiffViewerLineSelection(ctx, { side: 'old', line: 1 });
    expect(edgeSelection?.contextBefore).toEqual([]);
  });

  test('extension across a long unchanged run succeeds (no artificial hunk boundary)', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    const original = lines.join('\n');
    const current = lines.map((line, i) => (i === 0 ? 'CHANGED' : line)).join('\n');
    const diffs = computeLineDiff(original, current);
    const ctx = context(diffs);

    // Extend from the very first (changed) row to the very last (unchanged) row,
    // spanning the entire document on the 'new' side.
    const result = extendDiffViewerSelection(
      ctx,
      { side: 'new', line: 1 },
      { side: 'new', line: 20 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selection.startLine).toBe(1);
      expect(result.selection.endLine).toBe(20);
    }
  });

  test('reversed endpoints normalize to ascending line order', () => {
    const diffs = computeLineDiff('a\nb\nc\nd', 'a\nb\nc\nd');
    const ctx = context(diffs);
    const result = extendDiffViewerSelection(
      ctx,
      { side: 'old', line: 3 },
      { side: 'old', line: 1 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selection.startLine).toBe(1);
      expect(result.selection.endLine).toBe(3);
    }
  });

  test('cross-side extension is rejected without moving the origin', () => {
    const diffs = computeLineDiff('a\nb', 'a\nb');
    const ctx = context(diffs);
    const result = extendDiffViewerSelection(
      ctx,
      { side: 'old', line: 1 },
      { side: 'new', line: 2 },
    );
    expect(result).toEqual({
      ok: false,
      reason: 'cross-side',
      message: 'A selection cannot extend to the other side of the diff.',
    });
  });

  test('extending past the top or bottom of the document is rejected with an "edge" reason', () => {
    const diffs = computeLineDiff('only line', 'only line');
    const ctx = context(diffs);
    const result = extendDiffViewerSelection(
      ctx,
      { side: 'old', line: 1 },
      { side: 'old', line: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('edge');
  });
});

describe('DiffViewer: hunk-occurrence identity', () => {
  test('a document with no changes assigns hunkOccurrence 0 to every row', () => {
    const diffs = computeLineDiff('a\nb\nc', 'a\nb\nc');
    for (let index = 0; index < diffs.length; index++) {
      expect(nearestChangeClusterIndex(diffs, index)).toBe(0);
    }
  });

  test('rows nearest each of two separated change clusters get distinct occurrences', () => {
    const original = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
    const currentLines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    currentLines[0] = 'CHANGED-FIRST';
    currentLines[19] = 'CHANGED-LAST';
    const diffs = computeLineDiff(original, currentLines.join('\n'));

    const firstClusterRow = 0;
    const lastClusterRow = diffs.length - 1;
    expect(nearestChangeClusterIndex(diffs, firstClusterRow)).not.toBe(
      nearestChangeClusterIndex(diffs, lastClusterRow),
    );
    // A row roughly in the middle is nearest whichever cluster it's closer to.
    const middle = Math.floor(diffs.length / 2);
    expect(typeof nearestChangeClusterIndex(diffs, middle)).toBe('number');
  });
});

describe('DiffViewer: coordinate space and raw mapping', () => {
  test('normalizeInputs=false yields raw-source coordinates with an exact raw mapping', () => {
    const diffs = computeLineDiff('a\nb', 'a\nB');
    const ctx = context(diffs, { normalizeInputs: false });
    const selection = buildDiffViewerLineSelection(ctx, { side: 'new', line: 2 });
    expect(selection?.coordinateSpace).toBe('raw-source');
    expect(selection?.rawMapping).toEqual({ status: 'exact' });
  });

  test('normalizeInputs=true labels every body row normalized-markdown and never raw, including unchanged rows', () => {
    const diffs = computeLineDiff('a\nb\nc', 'a\nB\nc');
    const ctx = context(diffs, { normalizeInputs: true });

    const changedSelection = buildDiffViewerLineSelection(ctx, { side: 'new', line: 2 });
    expect(changedSelection?.coordinateSpace).toBe('normalized-markdown');
    expect(changedSelection?.rawMapping).toEqual({
      status: 'unavailable',
      reason: 'normalization',
    });

    // Unchanged row 1 ("a"): still normalized-markdown / unavailable, never raw.
    const unchangedSelection = buildDiffViewerLineSelection(ctx, { side: 'old', line: 1 });
    expect(unchangedSelection?.coordinateSpace).toBe('normalized-markdown');
    expect(unchangedSelection?.coordinateSpace).not.toBe('raw-source');
    expect(unchangedSelection?.rawMapping.status).not.toBe('exact');
  });

  test('CRLF is treated as a single line separator: no trailing carriage return leaks into selected text', () => {
    const diffs = computeLineDiff('a\r\nb\r\nc', 'a\r\nB\r\nc');
    const ctx = context(diffs);
    const selection = buildDiffViewerLineSelection(ctx, { side: 'new', line: 2 });
    expect(selection?.selectedText).toBe('B');
    expect(selection?.selectedText).not.toContain('\r');
  });
});

describe('DiffViewer: front-matter field context', () => {
  test('extracts changed YAML-ish field names, ignoring delimiters and unchanged lines', () => {
    const diffs = computeLineDiff(
      '---\ntitle: Old\nstatus: draft\n---',
      '---\ntitle: New\nstatus: draft\n---',
    );
    expect(extractFrontMatterChangedFields(diffs)).toEqual(['title']);
  });

  test('returns an empty list when front matter has no changes', () => {
    const diffs = computeLineDiff('---\ntitle: Same\n---', '---\ntitle: Same\n---');
    expect(extractFrontMatterChangedFields(diffs)).toEqual([]);
  });

  test('reports every changed field across multiple modified lines', () => {
    const diffs = computeLineDiff(
      '---\ntitle: Old\nowner: docs\n---',
      '---\ntitle: New\nowner: editorial\n---',
    );
    expect(extractFrontMatterChangedFields(diffs).sort()).toEqual(['owner', 'title']);
  });
});
