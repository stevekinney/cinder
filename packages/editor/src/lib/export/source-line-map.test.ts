import { describe, expect, test } from 'bun:test';
import {
  buildSourceLineMap,
  identitySourceLineMap,
  mapNormalizedLineNumber,
  type SourceLineMap,
} from './source-line-map';

describe('buildSourceLineMap', () => {
  test('maps identical documents line-for-line', () => {
    const doc = 'Alpha\nBeta\nGamma\n';

    expect(buildSourceLineMap(doc, doc)).toEqual({ lines: [1, 2, 3], sourceLineCount: 3 });
  });

  test('maps a normalized line past a collapsed blank-line run to its actual source line', () => {
    // The cinder#1324 repro: 3 blank lines collapse to 1, so normalized
    // line 3 ("Original text") is source line 5 -- the specific one of the
    // three interchangeable raw blank lines the single normalized blank
    // line maps to (here, the last of the three, by LCS backtrack order) is
    // not itself load-bearing; what matters is that the unique, unambiguous
    // "Original text" line resolves to its exact source line.
    const source = 'Alpha\n\n\n\nOriginal text\n';
    const normalized = 'Alpha\n\nOriginal text\n';

    const map = buildSourceLineMap(source, normalized);

    expect(map.lines[0]).toBe(1); // "Alpha"
    expect(map.lines[2]).toBe(5); // "Original text"
    expect(map.sourceLineCount).toBe(5);
  });

  test('a document that is exactly one blank line splits to one line, not zero (review finding)', () => {
    // splitLines('\n') used to return [] (stripping the trailing newline
    // left '', which was special-cased to "no lines"), rather than [''] --
    // one blank line, consistent with unified-diff.ts's own splitIntoLines.
    // A source document that's a single blank line must still produce a
    // one-entry map, or every lookup against it silently falls through to
    // whatever `mapNormalizedLineNumber`'s empty-map fallback does instead
    // of a real mapped line.
    const map = buildSourceLineMap('\n', '\n');

    expect(map.lines).toEqual([1]);
    expect(map.sourceLineCount).toBe(1);
  });

  test('a normalized line rewritten by normalization (not just deleted) maps to its own source line, not the line before it', () => {
    // Setext heading "Old title\n===" collapses to the one-line ATX form
    // "# Old title", which has no verbatim match in the source -- the
    // naive fallback (freeze on the nearest preceding match) would map it
    // to line 2 (the blank line above), not line 3 (where "Old title"
    // itself starts). Interpolating forward from the preceding match
    // instead reports line 3.
    const source = 'Intro\n\nOld title\n===\n';
    const normalized = 'Intro\n\n# Old title\n';

    expect(buildSourceLineMap(source, normalized)).toEqual({
      lines: [1, 2, 3],
      sourceLineCount: 4,
    });
  });

  test('interpolation across an unmatched run never overshoots the next real match (stays monotonic)', () => {
    // A contrived but structurally real case: two matched lines close
    // together in source, with several unmatched normalized lines between
    // them. Naively advancing by 1 per unmatched line without a ceiling
    // would produce a value *larger* than the next real match, and then
    // drop back down when that match is reached -- a non-monotonic map.
    const source = ['A', 'X', 'B'].join('\n') + '\n';
    // Three synthetic normalized lines ("p", "q", "r") stand in for content
    // normalization rewrote from "X", none of which appear verbatim in
    // source, immediately followed by "B", which does.
    const normalized = ['A', 'p', 'q', 'r', 'B'].join('\n') + '\n';

    const { lines } = buildSourceLineMap(source, normalized);

    // Monotonically non-decreasing, and the real match for "B" (source
    // line 3) is never exceeded by the interpolated lines before it.
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toBeGreaterThanOrEqual(lines[i - 1]!);
    }
    expect(lines[4]).toBe(3); // "B" itself, the real match
    expect(lines[1]).toBeLessThanOrEqual(3);
    expect(lines[2]).toBeLessThanOrEqual(3);
    expect(lines[3]).toBeLessThanOrEqual(3);
  });

  test('sourceLineCount reflects trailing source lines normalization stripped entirely, not just the mapped lines (review finding)', () => {
    // normalizeDocument() collapses trailing blank lines at EOF down to
    // nothing (there's no following content to anchor a representative
    // blank line the way a mid-document blank run keeps one) -- so a
    // 3-line source can normalize to a 1-line document, and `lines.length`
    // alone would then understate the source's real line count by more
    // than the collapsed lines account for.
    const source = 'Alpha\n\n\n'; // 3 lines: Alpha, blank, blank
    const normalized = 'Alpha'; // trailing blank lines stripped entirely

    const map = buildSourceLineMap(source, normalized);

    expect(map.lines).toEqual([1]);
    expect(map.sourceLineCount).toBe(3);
  });
});

describe('identitySourceLineMap', () => {
  test('maps every line to itself', () => {
    expect(identitySourceLineMap('Alpha\nBeta\nGamma\n')).toEqual({
      lines: [1, 2, 3],
      sourceLineCount: 3,
    });
  });

  test('empty content maps to an empty array with a zero source line count', () => {
    expect(identitySourceLineMap('')).toEqual({ lines: [], sourceLineCount: 0 });
  });
});

describe('mapNormalizedLineNumber', () => {
  test('looks up an in-range line directly', () => {
    const map: SourceLineMap = { lines: [1, 2, 5], sourceLineCount: 5 };

    expect(mapNormalizedLineNumber(map, 1)).toBe(1);
    expect(mapNormalizedLineNumber(map, 3)).toBe(5);
  });

  test('extrapolates past the end of the map instead of clamping onto the last line (review finding)', () => {
    // markdown-summary/unified-diff both use "normalized line count + 1" as
    // the "insert after the last line" position for a pure trailing
    // addition. Clamping that lookup to the map's last real entry would
    // silently relocate a legitimate append-at-EOF position onto the
    // document's last real line instead of reporting it as after that line.
    const map: SourceLineMap = { lines: [1], sourceLineCount: 1 }; // a one-line source document

    expect(mapNormalizedLineNumber(map, 2)).toBe(2);
    expect(mapNormalizedLineNumber(map, 3)).toBe(3);
  });

  test('extrapolates past the end relative to the last mapped source line, not the normalized line count', () => {
    // If normalization already shifted the last mapped line forward, an
    // append past the end should continue forward from *that* line, not
    // from the normalized-space count.
    const map: SourceLineMap = { lines: [1, 2, 5], sourceLineCount: 5 }; // last normalized line maps to source line 5

    expect(mapNormalizedLineNumber(map, 4)).toBe(6);
  });

  test('extrapolates from sourceLineCount, not from the mapped lines, when normalization stripped trailing source content entirely (review finding, follow-up)', () => {
    // The exact follow-up repro: original 'Alpha\n\n\n' (3 source lines) with
    // normalization collapsing trailing blank lines away entirely leaves a
    // map with only 1 entry -- but a lookup past that entry must still
    // extrapolate from the source's real end (line 3), not from the single
    // mapped line, or an addition appended after all of `original` gets
    // reported several lines too early.
    const map: SourceLineMap = { lines: [1], sourceLineCount: 3 };

    expect(mapNormalizedLineNumber(map, 2)).toBe(4);
  });

  test('returns the input unchanged for an empty map with no source content either', () => {
    expect(mapNormalizedLineNumber({ lines: [], sourceLineCount: 0 }, 7)).toBe(7);
  });
});
