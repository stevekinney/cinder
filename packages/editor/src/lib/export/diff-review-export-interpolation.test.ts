import { describe, expect, test } from 'bun:test';

import { buildInterpolatingSourceLineMapFixture } from './diff-review-export-fixtures.js';
import { exportDiffReviewJson, exportDiffReviewMarkdown } from './diff-review-export.js';
import { buildSourceLineMap, mapNormalizedLineNumber } from './source-line-map.js';

/**
 * Proves this fixture genuinely exercises the *real* interpolating line map — not a hand-picked
 * `rawMapping: 'unavailable'` literal — before building a `DiffReviewState` around it and
 * asserting the export never surfaces the interpolated (and therefore untrustworthy) line.
 */
describe('DiffReview export: an input where the existing source-line map interpolates', () => {
  // Real production input/output (see source-line-map.test.ts's own "stays monotonic" case):
  // normalized lines "p", "q", "r" replace source line "X" wholesale. None of them is the
  // product of any AST node the source ever contained, so whatever source line the map
  // attributes to "q" is necessarily a *guess* — proof enough that surfacing it as a raw
  // coordinate would misattribute authored content to a line that never held it.
  const source = ['A', 'X', 'B'].join('\n') + '\n';
  const normalized = ['A', 'p', 'q', 'r', 'B'].join('\n') + '\n';

  test('the real buildSourceLineMap interpolates a source line for normalized line "q", which appears nowhere in source', () => {
    expect(source).not.toContain('q');

    const map = buildSourceLineMap(source, normalized);
    const interpolatedLine = mapNormalizedLineNumber(map, 3); // "q" is normalized line 3 (1-based)

    // It is a real, in-range guess (clamped between the real anchors for "A" and "B"), not an
    // exact correspondence: "q" doesn't exist in `source`, so no source line can genuinely be
    // "q"'s raw location.
    expect(interpolatedLine).toBeGreaterThanOrEqual(1);
    expect(interpolatedLine).toBeLessThanOrEqual(3);
  });

  test('exporting a normalized-markdown comment anchored at that interpolated line never emits a raw coordinate', () => {
    const state = buildInterpolatingSourceLineMapFixture();

    const markdownResult = exportDiffReviewMarkdown(state);
    if (!markdownResult.ok) throw new Error('expected ok');
    expect(markdownResult.value).toContain('Location: new side, normalized-markdown line 3');
    expect(markdownResult.value).not.toMatch(/raw-source/);
    // The interpolated numeric guesses from the real map (1, 2, or 3) never leak in as an
    // alternate "raw" line — the only line number present anywhere is the normalized one, 3.
    expect(markdownResult.value.match(/line \d+/g)).toEqual(['line 3']);

    const jsonResult = exportDiffReviewJson(state);
    if (!jsonResult.ok) throw new Error('expected ok');
    const parsed = JSON.parse(jsonResult.value);
    expect(parsed.records[0].rawMapping).toEqual({
      status: 'unavailable',
      reason: 'normalization',
    });
    expect(parsed.records[0].anchor).toEqual({
      kind: 'range',
      side: 'new',
      startLine: 3,
      endLine: 3,
      coordinateSpace: 'normalized-markdown',
      hunkOccurrence: 0,
      selectedText: 'q',
      contextBefore: ['p'],
      contextAfter: ['r'],
    });
  });
});
