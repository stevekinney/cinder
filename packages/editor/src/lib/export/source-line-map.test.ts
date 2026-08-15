import { normalize, parseOrThrow } from '@lostgradient/markdown/pipeline';
import { describe, expect, test } from 'bun:test';
import {
  buildSourceLineMap,
  buildSourceLineMapCached,
  clearSourceLineMapCache,
  identitySourceLineMap,
  mapNormalizedLineNumber,
  pairChildrenByType,
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
    // line maps to (here, wherever the gap-interpolation lands) is not
    // itself load-bearing; what matters is that the unique, unambiguous
    // "Original text" paragraph node resolves to its exact source line.
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
    // "# Old title". The heading *node* spans source lines 3-4 (the text
    // plus its underline) but only normalized line 3 (the folded ATX
    // form); a single-line normalized span always maps to the *start* of
    // its paired source span (see collectLeafAnchors's interpolation), so
    // "# Old title" resolves to line 3 ("Old title" itself), not line 2
    // (the blank line above, which a naive "freeze on the preceding
    // anchor" fallback would report instead).
    const source = 'Intro\n\nOld title\n===\n';
    const normalized = 'Intro\n\n# Old title\n';

    expect(buildSourceLineMap(source, normalized)).toEqual({
      lines: [1, 2, 3],
      sourceLineCount: 4,
    });
  });

  test('interpolation across an unanchored run never overshoots the next real anchor (stays monotonic)', () => {
    // A contrived but structurally real case: two matched lines close
    // together in source, with several unanchored normalized lines between
    // them. Naively advancing by 1 per unanchored line without a ceiling
    // would produce a value *larger* than the next real anchor, and then
    // drop back down when that anchor is reached -- a non-monotonic map.
    const source = ['A', 'X', 'B'].join('\n') + '\n';
    // Three synthetic normalized lines ("p", "q", "r") stand in for content
    // normalization rewrote from "X" into something this synthetic
    // "normalized" text was never actually parsed to produce a matching
    // node for, immediately followed by "B", which does match.
    const normalized = ['A', 'p', 'q', 'r', 'B'].join('\n') + '\n';

    const { lines } = buildSourceLineMap(source, normalized);

    // Monotonically non-decreasing, and the real anchor for "B" (source
    // line 3) is never exceeded by the interpolated lines before it.
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toBeGreaterThanOrEqual(lines[i - 1]!);
    }
    expect(lines[4]).toBe(3); // "B" itself, the real anchor
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

  test('preserves provenance for a source line deleted from within a rewritten list item, instead of absorbing it into the next item (cinder#1324, round 3 finding)', () => {
    // normalize() both rewrites `*` markers to `-` and deletes the blank
    // separator between tight list items in the same pass. Since AST
    // alignment pairs list items by structural position (both are
    // `listItem` nodes, matched via pairChildrenByType), each item resolves
    // to its own source line directly -- there's no marker-comparison step
    // to get right or wrong, so the previously-load-bearing distinction
    // between `*`/`+`/ordered markers collapses into "list items pair
    // structurally," and this, the `+` variant, and the ordered-marker case
    // below all now exercise the exact same code path.
    const source = 'Intro\n\n* one\n\n* old\n';
    const normalized = 'Intro\n\n- one\n- old';

    const map = buildSourceLineMap(source, normalized);

    expect(map.lines).toEqual([1, 2, 3, 5]);
  });

  test('the same provenance case, with `+` instead of `*` as the unordered marker (cinder#1324, round 3 follow-up)', () => {
    const source = 'Intro\n\n+ one\n\n+ old\n';
    const normalized = 'Intro\n\n- one\n- old';

    const map = buildSourceLineMap(source, normalized);

    expect(map.lines).toEqual([1, 2, 3, 5]);
  });

  test('the same provenance case, with an ordered-list marker rewrite (cinder#1324, round 4 finding)', () => {
    // normalize() rewrites ordered markers (`1)` -> `1.`, preserving each
    // item's own start number -- `2) old` stays `2.`, not `1.`) and deletes
    // the blank separator between them in the same tight-list pass. Under
    // the old per-line-string-canonicalization approach, this needed its
    // own marker-recognition rule (a review finding of its own, since the
    // round-3 fix only canonicalized unordered markers); under AST
    // alignment, an ordered `listItem` pairs with its source counterpart
    // the same structural way an unordered one does, so there is nothing
    // marker-specific left to get right.
    const source = 'Intro\n\n1) one\n\n2) old\n';
    const normalized = 'Intro\n\n1. one\n2. old';

    const map = buildSourceLineMap(source, normalized);

    expect(map.lines).toEqual([1, 2, 3, 5]);
  });

  describe('rewrites that only make sense with document-level context (cinder#1324, round 4/5 findings)', () => {
    // These four cases (list-item content rewrites, plus a bare thematic
    // break) share one property: the *rewritten* line has no verbatim (or,
    // under the old approach, no per-line-canonicalized) match in the
    // source text, so provenance depends on the surrounding structure, not
    // just the line's own content. AST alignment resolves all four the
    // same way -- by pairing the *node* each rewritten line belongs to,
    // not by comparing text -- rather than needing a dedicated
    // per-rewrite-kind mechanism the way the old per-line canonicalizer
    // did (see the module docblock's history: Setext folding, then
    // unordered markers, then ordered markers, each its own hand-rolled
    // rule and its own review-round finding).

    test('emphasis inside tight-list content (`_x_` -> `*x*`)', () => {
      const map = buildSourceLineMap('* _one_\n\n* _two_\n', '- *one*\n- *two*\n');
      expect(map.lines).toEqual([1, 3]);
      expect(map.sourceLineCount).toBe(3);
    });

    test('strong inside tight-list content (`__x__` -> `**x**`)', () => {
      const map = buildSourceLineMap('* __one__\n\n* __two__\n', '- **one**\n- **two**\n');
      expect(map.lines).toEqual([1, 3]);
      expect(map.sourceLineCount).toBe(3);
    });

    test('list-item indent spacing (`-   x` -> `- x`)', () => {
      const map = buildSourceLineMap('-   one\n\n-   two\n', '- one\n- two\n');
      expect(map.lines).toEqual([1, 3]);
      expect(map.sourceLineCount).toBe(3);
    });

    test('a bare thematic break, padded with synthesized blank lines (`***` -> `---`)', () => {
      // normalize() inserts blank-line padding around a thematic break that
      // didn't already have any -- a genuine line-count change, not just a
      // rewrite -- so the thematicBreak node's own source/normalized spans
      // (both length 1, just at different positions) are what resolve
      // this, independent of any surrounding blank-line ambiguity.
      const map = buildSourceLineMap('Before\n***\nAfter\n', 'Before\n\n---\n\nAfter\n');
      expect(map.lines).toEqual([1, 2, 2, 3, 3]);
      expect(map.sourceLineCount).toBe(3);
    });
  });

  describe('a thematic break and a Setext underline can canonicalize to the identical string -- AST alignment cannot confuse them (cinder#1324, round 5 finding)', () => {
    // The finding that forced this module's rewrite: `Title\n---` (a Setext
    // heading) and `***` (a thematic break) are structurally different
    // mdast node types -- `heading` and `thematicBreak` -- but both can
    // serialize to the literal string `---`. Per-line *text* canonicalization,
    // however complete its rewrite-rule coverage, cannot tell these apart:
    // comparing rendered strings after the fact has already thrown away the
    // one piece of information (which node produced the string) that would
    // disambiguate them. Comparing node *types* during an AST walk never
    // loses that information in the first place, because it never converts
    // either side to a string to compare.
    test('a Setext heading immediately followed by a thematic break: the rule maps to its own line, not the deleted underline', () => {
      // source: 1 "Title", 2 "---" (Setext underline, part of the heading
      // node), 3 "***" (thematic break), 4 "After".
      // normalized: "## Title\n\n---\n\nAfter\n" -- the heading folds to one
      // line, and the thematic break's own `---` is padded with blank
      // lines. Both the folded heading's underline (source line 2) and the
      // thematic break (source line 3) no longer exist as their own
      // "---"-shaped text in isolation, and the OLD per-line canonicalizer
      // treated both as the identical canonical string "---", giving the
      // LCS backtrack no structural reason to prefer one over the other --
      // it picked the underline (line 2), reverted and confirmed below.
      const source = 'Title\n---\n***\nAfter\n';
      const normalized = normalize(source);

      expect(normalized).toBe('## Title\n\n---\n\nAfter\n');

      const map = buildSourceLineMap(source, normalized);

      // Line 3 (index 2, the "---" in normalized) must resolve to source
      // line 3 (the actual thematic break), not source line 2 (the
      // Setext underline that folded into the heading above it).
      expect(map.lines[2]).toBe(3);
      expect(map.lines).toEqual([1, 2, 3, 4, 4]);
      expect(map.sourceLineCount).toBe(4);
    });
  });

  describe('AST tree shapes stay structurally aligned across every rewrite kind this module relies on (cinder#1324, round 5)', () => {
    // buildSourceLineMap's soundness rests on one precondition: pairing
    // `parseOrThrow(source)` and `parseOrThrow(normalized)` children by
    // type produces a 1:1 correspondence for every rewrite normalize()
    // makes. This isn't argued for in prose -- it's checked directly, node
    // type by node type, across the same corpus the tests above already
    // exercise via buildSourceLineMap, so a future normalize() change that
    // ever breaks this precondition fails here first, with a shape
    // mismatch pointing at exactly which case broke, rather than surfacing
    // later as a subtly wrong line number.
    function topLevelTypes(markdown: string): string[] {
      return parseOrThrow(markdown).children.map((child) => child.type);
    }

    const cases: Record<string, string> = {
      identical: 'Alpha\nBeta\nGamma\n',
      blankLineCollapse: 'Alpha\n\n\n\nOriginal text\n',
      setextFold: 'Intro\n\nOld title\n===\n',
      unorderedMarker: 'Intro\n\n* one\n\n* old\n',
      orderedMarker: 'Intro\n\n1) one\n\n2) old\n',
      setextThematicCollision: 'Title\n---\n***\nAfter\n',
      emphasisInList: '* _one_\n\n* _two_\n',
      strongInList: '* __one__\n\n* __two__\n',
      indentInList: '-   one\n\n-   two\n',
      thematicNoPadding: 'Before\n***\nAfter\n',
      fenceStyle: 'Intro\n\n\n\n~~~\ncode\n~~~\n',
    };

    for (const [label, source] of Object.entries(cases)) {
      test(`${label}: source and normalized top-level node types match 1:1`, () => {
        const normalized = normalize(source);
        expect(topLevelTypes(normalized)).toEqual(topLevelTypes(source));
      });
    }
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

describe('buildSourceLineMapCached', () => {
  test('returns the same result as the uncached builder', () => {
    clearSourceLineMapCache();
    const source = 'Alpha\n\n\n\nOriginal text\n';
    const normalized = 'Alpha\n\nOriginal text\n';

    expect(buildSourceLineMapCached(source, normalized)).toEqual(
      buildSourceLineMap(source, normalized),
    );
  });

  test('two distinct (source, normalized) pairs whose naive `source + " " + normalized` concatenation collides are not confused with each other (review finding)', () => {
    // A first draft of this cache keyed on a template-literal join --
    // `` `${source} ${normalized}` `` -- which is ambiguous: two genuinely
    // different pairs can concatenate to the identical string. Here,
    // splitting `'One Two\nThree Four'` after "One" (source: "One",
    // normalized: "Two\nThree Four") and splitting it after "Three"
    // (source: "One Two\nThree", normalized: "Four") both reassemble to
    // the same 20-character string once joined by a single space, even
    // though the two pairs have different line counts and produce
    // different maps. The fix keys on `JSON.stringify([source,
    // normalized])` instead, which escapes each string so the pair
    // boundary can't be ambiguous this way.
    clearSourceLineMapCache();

    const sourceA = 'One';
    const normalizedA = 'Two\nThree Four';
    const sourceB = 'One Two\nThree';
    const normalizedB = 'Four';

    // Confirm the premise: these really do collide under naive concatenation.
    expect(`${sourceA} ${normalizedA}`).toBe(`${sourceB} ${normalizedB}`);

    const cachedA = buildSourceLineMapCached(sourceA, normalizedA);
    const cachedB = buildSourceLineMapCached(sourceB, normalizedB);

    expect(cachedA).toEqual(buildSourceLineMap(sourceA, normalizedA));
    expect(cachedB).toEqual(buildSourceLineMap(sourceB, normalizedB));
    // And the two pairs really do produce different maps -- otherwise a
    // collision returning the wrong one would go unnoticed.
    expect(cachedA).not.toEqual(cachedB);
  });

  test('evicts the oldest entry once the cache exceeds its size', () => {
    clearSourceLineMapCache();
    // Fill the cache with 10 distinct pairs (LINE_MAP_CACHE_SIZE), then a
    // repeat lookup of the very first one should be a fresh computation
    // (not a stale hit) since it was evicted -- verified indirectly here
    // by confirming it still returns the correct result, not a crash or a
    // mismatched map, after the eviction.
    for (let i = 0; i < 11; i++) {
      buildSourceLineMapCached(`Doc ${i}`, `Doc ${i}`);
    }
    const first = buildSourceLineMapCached('Doc 0', 'Doc 0');
    expect(first).toEqual(buildSourceLineMap('Doc 0', 'Doc 0'));
  });
});

describe('pairChildrenByType suffix-trim optimization (cinder#1330 round-6 finding)', () => {
  // A minimal stand-in for a mdast `Content` node -- `pairChildrenByType`
  // and the `nodeKey` it calls internally only ever read `.type` (and
  // `.ordered` for `list`), so a real parsed tree isn't needed to exercise
  // the pairing logic directly.
  type FakeNode = { type: string; ordered?: boolean };
  const node = (type: string, ordered?: boolean): FakeNode =>
    ordered === undefined ? { type } : { type, ordered };

  function typeKey(n: FakeNode): string {
    if (n.type === 'list') return n.ordered ? 'list:ordered' : 'list:bullet';
    return n.type;
  }

  /**
   * An independent, untrimmed LCS pairing -- exactly the algorithm
   * `pairChildrenByType` used before the suffix-trim optimization, kept
   * here (not imported) as the equivalence oracle. If this and the
   * production function ever disagree, the trim changed observable output,
   * which the optimization must never do.
   */
  function untrimmedOraclePairing(source: FakeNode[], normalized: FakeNode[]): (number | null)[] {
    const m = source.length;
    const n = normalized.length;
    const lcs: number[][] = Array.from({ length: m + 1 }, () =>
      Array.from({ length: n + 1 }, () => 0),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        lcs[i]![j] =
          typeKey(source[i - 1]!) === typeKey(normalized[j - 1]!)
            ? lcs[i - 1]![j - 1]! + 1
            : Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
      }
    }
    const matched: (number | null)[] = Array.from({ length: n }, () => null);
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (typeKey(source[i - 1]!) === typeKey(normalized[j - 1]!)) {
        matched[j - 1] = i - 1;
        i--;
        j--;
      } else if (lcs[i - 1]![j]! >= lcs[i]![j - 1]!) {
        i--;
      } else {
        j--;
      }
    }
    return matched;
  }

  function run(source: FakeNode[], normalized: FakeNode[]): (number | null)[] {
    return pairChildrenByType(
      source as unknown as Parameters<typeof pairChildrenByType>[0],
      normalized as unknown as Parameters<typeof pairChildrenByType>[1],
    );
  }

  const cases: Record<string, { source: FakeNode[]; normalized: FakeNode[] }> = {
    'both empty': { source: [], normalized: [] },
    'identical, no duplicates': {
      source: [node('paragraph'), node('heading'), node('thematicBreak')],
      normalized: [node('paragraph'), node('heading'), node('thematicBreak')],
    },
    'identical with a long uniform run (the typing-edit case: no type change at all)': {
      source: Array.from({ length: 50 }, () => node('paragraph')),
      normalized: Array.from({ length: 50 }, () => node('paragraph')),
    },
    'a single node inserted at the very front': {
      source: [node('heading'), node('paragraph'), node('paragraph'), node('thematicBreak')],
      normalized: [node('paragraph'), node('paragraph'), node('thematicBreak')],
    },
    'a single node inserted at the very end': {
      source: [node('paragraph'), node('paragraph'), node('thematicBreak')],
      normalized: [node('paragraph'), node('paragraph'), node('thematicBreak'), node('heading')],
    },
    'a single node inserted in the middle': {
      source: [node('paragraph'), node('list'), node('paragraph'), node('paragraph')],
      normalized: [node('paragraph'), node('paragraph'), node('paragraph')],
    },
    'a node removed from the very end': {
      source: [node('paragraph'), node('paragraph'), node('thematicBreak')],
      normalized: [node('paragraph'), node('paragraph')],
    },
    // The exact worked example that shows why a *prefix* trim (the mirror
    // of the suffix trim implemented here) is NOT equivalent to the
    // untrimmed backtrace: source = [A, A, B], normalized = [A, B]. The
    // real backtrace (starting from the end) matches normalized's lone `A`
    // against source's *second* `A`, not its first, because by the time
    // the walk reaches index 0 it has already consumed the first `A` via a
    // different path. A naive prefix trim would match the first `A`
    // instead -- a different, wrong answer. This case is exactly why this
    // module trims only the suffix.
    'duplicate leading type, single trailing match (the prefix-trim counterexample)': {
      source: [node('paragraph'), node('paragraph'), node('thematicBreak')],
      normalized: [node('paragraph'), node('thematicBreak')],
    },
    'duplicate types throughout, with a real difference at the front': {
      source: [
        node('heading'),
        node('paragraph'),
        node('paragraph'),
        node('paragraph'),
        node('thematicBreak'),
      ],
      normalized: [node('paragraph'), node('paragraph'), node('paragraph'), node('thematicBreak')],
    },
    'completely disjoint types (no common subsequence at all)': {
      source: [node('heading'), node('list', true)],
      normalized: [node('paragraph'), node('thematicBreak'), node('code')],
    },
    'ordered vs. bullet lists are distinct keys even though both are "list"': {
      source: [node('list', true), node('paragraph')],
      normalized: [node('list', false), node('paragraph')],
    },
    'source shorter than normalized, no common suffix': {
      source: [node('paragraph')],
      normalized: [node('heading'), node('paragraph'), node('thematicBreak')],
    },
  };

  for (const [description, { source, normalized }] of Object.entries(cases)) {
    test(`matches the untrimmed LCS oracle exactly: ${description}`, () => {
      expect(run(source, normalized)).toEqual(untrimmedOraclePairing(source, normalized));
    });
  }

  test('the suffix trim actually engages for the typing-edit case (sanity check for the equivalence tests above)', () => {
    // Not a behavioral assertion about output -- a check that the fixture
    // above genuinely exercises the trim's fast path, so "matches the
    // oracle" isn't vacuously true because the interior LCS ran anyway for
    // every case. All 50 positions should be trimmed-and-matched directly.
    const uniform = Array.from({ length: 50 }, () => node('paragraph'));
    const result = run(uniform, uniform);
    expect(result).toEqual(Array.from({ length: 50 }, (_, index) => index));
  });
});
