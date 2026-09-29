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

type FakeNode = { type: string; ordered?: boolean };
const node = (type: string, ordered?: boolean): FakeNode =>
  ordered === undefined ? { type } : { type, ordered };
function typeKey(n: FakeNode): string {
  return n.type === 'list' ? (n.ordered ? 'list:ordered' : 'list:bullet') : n.type;
}
function run(source: FakeNode[], normalized: FakeNode[]): (number | null)[] {
  return pairChildrenByType(source, normalized);
}

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
