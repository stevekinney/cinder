/**
 * Map normalized-document line numbers back to source-document line numbers.
 *
 * `normalizeDocument()` (see `normalize-document.ts`) deliberately changes a
 * document's line *count*: it collapses runs of 3+ blank lines to one,
 * drops the front-matter/body separator down to at most one blank line,
 * removes blank lines between tight list items, and folds a Setext
 * heading's underline into its one-line ATX form. `generateUnifiedDiff` and
 * `generateMarkdownSummary` both diff the *normalized* documents (to avoid
 * reporting formatting-only differences as real edits), but a line index
 * into that normalized text is not the same line index the caller's raw
 * `state.original` / `state.content` uses -- reporting it directly, as both
 * functions used to, points `### Lines` headings and `@@` hunk headers at
 * the wrong line whenever normalization changed the line count above the
 * edit (cinder#1324).
 *
 * Alignment is built from the AST, not from comparing lines of text.
 * `parseOrThrow(source)` and `parseOrThrow(normalized)` each produce an
 * mdast tree whose nodes carry their own source positions; walking both
 * trees in lockstep and pairing corresponding nodes (see
 * {@link collectLeafAnchors}) gives an exact, structural answer to "what
 * source line does this normalized line come from" for every node the
 * parser understood, with no string comparison anywhere.
 *
 * This module used to do the opposite: reconstruct the mapping *after*
 * serialization by comparing normalized and source text line by line
 * (first raw equality, then a hand-rolled marker canonicalizer, then a
 * canonicalizer that called the real `normalize()` per line). Each version
 * was a strictly better string heuristic than the last, but a review round
 * proved the whole *approach* unsound, not just under-enumerated: a Setext
 * heading's underline (`Title\n---`) and a thematic break (`***`) are
 * different mdast node types that can both canonicalize to the identical
 * string `---`. No per-line canonicalization -- however complete -- can
 * recover which source line a normalized `---` actually came from once two
 * structurally different nodes produce the same text; equal strings don't
 * establish provenance. Comparing node *types* instead of rendered text
 * makes that collision structurally impossible: a `heading` node and a
 * `thematicBreak` node are never "the same node" no matter what text they
 * happen to serialize to, so pairing can't confuse them (see the collision
 * regression test below).
 *
 * This also settles the earlier, real performance question head-on:
 * `buildSourceLineMap` can run on every keystroke (`ReviewEditor`'s hidden
 * `formDiff`/`formSummary` inputs are reactive whenever the component has a
 * `name`, so this runs far more often than "once per user-triggered
 * export," a claim an earlier version of this module's changeset made
 * incorrectly). Two parses plus one tree walk is no worse asymptotically
 * than the LCS table the old approach also paid for, and {@link
 * buildSourceLineMapCached} (used by both `unified-diff.ts` and
 * `markdown-summary.ts`) memoizes per distinct `(source, normalized)` pair
 * the same way `@lostgradient/markdown`'s own `normalizeWithCache` does, so
 * repeated calls against an unchanged `original` -- the common case, since
 * only `current` changes per keystroke -- are free after the first.
 *
 * @module
 */

import type { Content, Root } from '@lostgradient/markdown/pipeline';
import { parseOrThrow } from '@lostgradient/markdown/pipeline';

/**
 * A normalized-to-source line mapping, plus the source document's own true
 * line count.
 *
 * `lines[normalizedLineIndex]` (0-based index) is the 1-based line number in
 * `source` that normalized line most plausibly corresponds to.
 * `sourceLineCount` is `source`'s own line count, tracked separately because
 * `lines.length` is the *normalized* document's line count -- normalization
 * can shrink a document by dropping trailing content entirely (blank lines
 * at EOF collapse away with nothing left to anchor them, unlike a mid-
 * document blank run, which always leaves one representative line behind).
 * When that happens, `lines.length` alone is not "how many lines `source`
 * really has," and extrapolating a past-the-end lookup from it instead of
 * from `sourceLineCount` reports a line well before the source's actual end
 * (cinder#1324 follow-up).
 */
export interface SourceLineMap {
  lines: number[];
  sourceLineCount: number;
}

/**
 * Build a {@link SourceLineMap} from `source` to `normalized`.
 *
 * Parses both documents and walks their ASTs in lockstep ({@link
 * collectLeafAnchors}), pairing corresponding nodes by structural type
 * rather than comparing rendered text. Each paired *leaf* node (a node this
 * module doesn't recurse further into -- see {@link CONTAINER_TYPES})
 * contributes an exact anchor: its own source and normalized line spans,
 * linearly interpolated against each other when the two spans differ in
 * length (a Setext heading's two source lines folding into one normalized
 * ATX line, for instance). Lines no anchor covers -- gaps between sibling
 * nodes, and any leading or trailing blank run -- are filled by {@link
 * fillUnmatchedRuns}, interpolating forward from the nearest preceding
 * anchor and clamped to the next one, exactly as before, just now anchored
 * by node boundaries instead of string matches.
 *
 * If parsing either document fails (not expected -- `normalize()` itself
 * just parsed and reserialized `normalized`, and `source` is ordinary
 * Markdown -- but not guaranteed either), this degrades to treating the
 * entire document as unanchored rather than throwing: {@link
 * fillUnmatchedRuns}'s pure forward interpolation still produces a
 * monotonic, in-range (if approximate) map.
 */
export function buildSourceLineMap(source: string, normalized: string): SourceLineMap {
  const sourceLines = splitLines(source);
  const normalizedLines = splitLines(normalized);

  const matched = alignNormalizedToSourceByAst(source, normalized, normalizedLines.length);
  const filled = fillUnmatchedRuns(matched, sourceLines.length);

  return {
    lines: filled.map((sourceIndex) => sourceIndex + 1), // 1-based
    sourceLineCount: sourceLines.length,
  };
}

/**
 * Small LRU cache in front of {@link buildSourceLineMap}, mirroring
 * `@lostgradient/markdown`'s own `normalizeWithCache` (same size, same
 * "first key evicted" policy). `unified-diff.ts` and `markdown-summary.ts`
 * both call this instead of the raw builder: `ReviewEditor`'s hidden
 * `formDiff`/`formSummary` inputs are `$derived`, so both exports re-run on
 * every content edit whenever the component has a `name` -- not just on a
 * user-triggered "export" action. Each export needs a line map for
 * `original` (which rarely changes across keystrokes) and one for
 * `current` (which changes every keystroke); caching by the exact
 * `(source, normalized)` pair means the `original` side is typically a
 * cache hit after the first call, and repeated calls with an unchanged
 * document pair (e.g. two exports reading the same original) cost nothing
 * beyond the lookup.
 */
const lineMapCache = new Map<string, SourceLineMap>();
const LINE_MAP_CACHE_SIZE = 10;

export function buildSourceLineMapCached(source: string, normalized: string): SourceLineMap {
  // `JSON.stringify` of a two-element array, not `${source} ${normalized}`
  // string concatenation: a plain join is ambiguous -- `source: "X"`,
  // `normalized: "Y Z"` and `source: "X Y"`, `normalized: "Z"` both
  // concatenate to `"X Y Z"`, which would return the wrong cached map for
  // one of the two genuinely different input pairs. `JSON.stringify`
  // escapes each string, so the pair boundary is never ambiguous.
  const key = JSON.stringify([source, normalized]);
  const cached = lineMapCache.get(key);
  if (cached !== undefined) return cached;

  const map = buildSourceLineMap(source, normalized);

  if (lineMapCache.size >= LINE_MAP_CACHE_SIZE) {
    const firstKey = lineMapCache.keys().next().value;
    if (firstKey !== undefined) lineMapCache.delete(firstKey);
  }
  lineMapCache.set(key, map);

  return map;
}

/** Clears {@link buildSourceLineMapCached}'s cache. Exposed for tests. */
export function clearSourceLineMapCache(): void {
  lineMapCache.clear();
}

/**
 * Fill the gaps AST alignment left as `null` (normalized lines no leaf
 * anchor covers) by interpolating forward from the nearest preceding
 * anchor, one source line per unanchored normalized line, clamped to the
 * nearest *following* anchor so the result never overshoots past where
 * alignment resumes. Freezing on the preceding anchor instead (the simpler
 * alternative) reports the line *before* a gap -- e.g. the blank line
 * before a synthesized paragraph break -- instead of interpolating toward
 * the gap's own approximate position; clamping to the following anchor
 * instead of advancing unboundedly keeps the result monotonically
 * non-decreasing even when a long gap sits between two anchors that are
 * close together in `source`.
 */
function fillUnmatchedRuns(matched: (number | null)[], sourceLength: number): number[] {
  const n = matched.length;
  const filled: number[] = Array.from({ length: n });

  let i = 0;
  while (i < n) {
    const current = matched[i];
    if (current !== null && current !== undefined) {
      filled[i] = current;
      i++;
      continue;
    }

    // Start of a run of unanchored normalized lines: find where it ends and
    // what the next real anchor (if any) is, so the interpolation below has
    // both a point to advance from and a ceiling not to cross.
    let end = i;
    while (end < n && (matched[end] === null || matched[end] === undefined)) end++;

    const precedingMatch = i > 0 ? filled[i - 1]! : -1; // -1: no anchor yet
    const followingMatch = end < n ? matched[end]! : sourceLength - 1;

    for (let k = 0; k < end - i; k++) {
      filled[i + k] = Math.min(precedingMatch + k + 1, followingMatch);
    }

    i = end;
  }

  return filled;
}

/**
 * Identity map: normalized line N is source line N (unnormalized inputs).
 * `sourceLineCount` equals the line count of the same text, since with no
 * normalization applied there's nothing for it to diverge from.
 */
export function identitySourceLineMap(normalized: string): SourceLineMap {
  const lines = splitLines(normalized).map((_, index) => index + 1);
  return { lines, sourceLineCount: lines.length };
}

/**
 * Look up a normalized-space line number (1-based, as `unified-diff.ts` and
 * `markdown-summary.ts` already track it) in a {@link SourceLineMap}.
 *
 * A lookup past the end of `lines` (normalized line count + 1, the "insert
 * after the last line" position both callers use for a pure trailing
 * addition) extrapolates from `sourceLineCount` -- the source document's own
 * true end -- rather than from `lines`' own length or its last entry.
 * Anchoring to `lines.length` instead would undercount whenever
 * normalization stripped trailing source content (e.g. blank lines at EOF)
 * entirely rather than collapsing it to a representative line, since then
 * the normalized document, and therefore `lines`, is shorter than `source`
 * itself by more than just the collapsed lines' difference.
 */
export function mapNormalizedLineNumber(
  lineMap: SourceLineMap,
  normalizedLineNumber: number,
): number {
  const { lines, sourceLineCount } = lineMap;
  if (normalizedLineNumber > lines.length) {
    return sourceLineCount + (normalizedLineNumber - lines.length);
  }
  const index = Math.max(normalizedLineNumber - 1, 0);
  return lines[index]!;
}

/**
 * Node types this module recurses into for finer-grained alignment --
 * markdown's own block containers. Every other node type (`paragraph`,
 * `heading`, `thematicBreak`, `code`, `html`, table nodes, and every inline
 * node) is treated as an atomic leaf: its own `position.start`/`.end` line
 * span is mapped as a single unit, without looking at its children. This
 * is coarser than line-level for a node whose content spans multiple lines
 * (a paragraph with a soft line break, a table, a fenced code block whose
 * fence style changed), but no coarser than the interpolation this module
 * always used for a rewritten-and-unmatched run -- see {@link
 * collectLeafAnchors}'s interpolation within a single anchor's span.
 */
const CONTAINER_TYPES = new Set(['root', 'blockquote', 'list', 'listItem']);

/** A paired leaf node's source and normalized line spans (1-based, inclusive). */
interface LeafAnchor {
  sourceStart: number;
  sourceEnd: number;
  normalizedStart: number;
  normalizedEnd: number;
}

function childrenOf(node: Root | Content): Content[] {
  return 'children' in node && Array.isArray(node.children) ? (node.children as Content[]) : [];
}

/**
 * A node's pairing key: its type, plus (for lists) whether it's ordered.
 * `normalize()` never turns an ordered list into an unordered one or vice
 * versa, so this distinction is never exercised by any current repro --
 * it's a defensive detail that costs nothing and rules out a pairing this
 * module should never want to make.
 */
function nodeKey(node: Content): string {
  if (node.type === 'list') {
    // `node.type === 'list'` already narrows `Content` (a discriminated
    // union) to mdast's `List`, which declares `ordered`, so no cast is
    // needed to read it.
    return node.ordered ? 'list:ordered' : 'list:bullet';
  }
  return node.type;
}

/**
 * Pair a container's children in document order by structural type -- the
 * same longest-common-subsequence shape `computeLineChanges` (and this
 * module's own earlier string-based alignment) used, now comparing
 * {@link nodeKey} instead of line text. Returns, for each index into
 * `normalizedChildren`, the matched index into `sourceChildren`, or `null`
 * if nothing paired.
 *
 * Every repro in this file's test suite has a 1:1 matching child-type
 * sequence between `source` and `normalized` (see the tree-shape
 * assertions there), so this degrades to a plain zip in every case this
 * module has ever seen in practice. Pairing by type rather than by
 * position is what makes it degrade *gracefully*, rather than silently
 * misaligning everything after the first difference, if some future
 * `normalize()` change ever inserts, removes, or reorders a node a source
 * document didn't have.
 *
 * Exported (rather than module-private) so the test suite can check it
 * directly against an independent LCS oracle -- see the suffix-trim
 * equivalence tests, which exist because the trim implemented below is
 * `O(n)` in the common case but only safe in one direction; see its own
 * comment for why.
 */
export function pairChildrenByType(
  sourceChildren: Content[],
  normalizedChildren: Content[],
): (number | null)[] {
  const m = sourceChildren.length;
  const n = normalizedChildren.length;
  const matched: (number | null)[] = Array.from({ length: n }, () => null);

  // Trim a common *suffix* first, by walking both arrays backward from
  // their ends and matching greedily while types agree. This is exactly
  // equivalent to the LCS backtrace below on its own, not an approximation
  // of it: the backtrace starts at `(m, n)` -- the very end of both arrays
  // -- and its first check every iteration is "do these types match?",
  // taking that diagonal (matching) step unconditionally whenever they do,
  // before it ever looks at the DP table. Replaying that same walk directly
  // for the trailing run the table doesn't need to arbitrate reproduces the
  // identical matches the full backtrace would have produced for that run,
  // just without paying for the table cells underneath it.
  //
  // A *prefix* trim by the mirror-image logic (walk forward from index 0,
  // matching while types agree) is deliberately NOT done here, because it
  // is not equivalent: this backtrace's direction, combined with its
  // `i--` bias on DP ties, means a repeated type at the front (`[A, A, B]`
  // vs `[A, B]`) can end up matched to the *second* `A`, not the first, once
  // the walk from the end reaches it -- a real divergence, not a
  // hypothetical one; see `pairChildrenByType`'s test file for the worked
  // example and the equivalence test that checks this trimmed version
  // against an untrimmed LCS oracle across shape-varied and
  // shape-mismatched inputs, precisely because that asymmetry makes this
  // easy to get wrong silently.
  //
  // In the common case -- content edited within an existing node rather
  // than a node inserted, removed, or reordered, which is what typing a
  // single keystroke does to the top-level child sequence -- source and
  // normalized have the identical type sequence throughout, so this suffix
  // walk alone consumes the *entire* array and the LCS table below never
  // runs at all. This is the fix for the "quadratic AST child matcher on
  // every keystroke" finding (cinder#1330 round-6): the table this module
  // used to build unconditionally, on every call, for every container, at
  // full `(m+1) x (n+1)` size, now only gets built for the span an actual
  // structural difference falls within -- typically empty, and never
  // larger than the distance between the outermost two differing nodes.
  let mEnd = m;
  let nEnd = n;
  while (
    mEnd > 0 &&
    nEnd > 0 &&
    nodeKey(sourceChildren[mEnd - 1]!) === nodeKey(normalizedChildren[nEnd - 1]!)
  ) {
    matched[nEnd - 1] = mEnd - 1;
    mEnd--;
    nEnd--;
  }

  if (mEnd === 0 || nEnd === 0) {
    // Either side (or both) is fully consumed by the suffix trim -- nothing
    // left to align via the table. Any remaining `normalizedChildren`
    // indices below `nEnd` (when `mEnd === 0` but `nEnd > 0`) stay `null`,
    // already their initialized value: there's no `sourceChildren` left to
    // pair them with.
    return matched;
  }

  const lcs: number[][] = Array.from({ length: mEnd + 1 }, () =>
    Array.from({ length: nEnd + 1 }, () => 0),
  );
  for (let i = 1; i <= mEnd; i++) {
    for (let j = 1; j <= nEnd; j++) {
      lcs[i]![j] =
        nodeKey(sourceChildren[i - 1]!) === nodeKey(normalizedChildren[j - 1]!)
          ? lcs[i - 1]![j - 1]! + 1
          : Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
    }
  }

  let i = mEnd;
  let j = nEnd;
  while (i > 0 && j > 0) {
    if (nodeKey(sourceChildren[i - 1]!) === nodeKey(normalizedChildren[j - 1]!)) {
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

/**
 * Walk a paired `(sourceNode, normalizedNode)` -- guaranteed the same
 * {@link nodeKey} by construction, since {@link pairChildrenByType} only
 * pairs same-key nodes, and the two ASTs' roots are both always `root` --
 * recursing into {@link CONTAINER_TYPES} for finer-grained pairing and
 * pushing a {@link LeafAnchor} for everything else.
 *
 * A leaf anchor's line span is linearly interpolated when `source`'s and
 * `normalized`'s spans differ in length: offset 0 of the normalized span
 * maps to `sourceStart`, offset `normalizedSpan` (the last line) maps to
 * `sourceEnd`, and everything between is scaled proportionally. For a
 * single-line normalized span (`normalizedSpan === 0`) this always resolves
 * to `sourceStart` -- exactly the desired "a rewritten line maps to the
 * *start* of what it was rewritten from" behavior for a Setext heading's
 * one-line ATX form, whose normalized span is one line but whose source
 * span is two (the heading text plus its underline).
 */
function collectLeafAnchors(
  sourceNode: Root | Content,
  normalizedNode: Root | Content,
  anchors: LeafAnchor[],
): void {
  if (CONTAINER_TYPES.has(sourceNode.type) && CONTAINER_TYPES.has(normalizedNode.type)) {
    const sourceChildren = childrenOf(sourceNode);
    const normalizedChildren = childrenOf(normalizedNode);
    const matched = pairChildrenByType(sourceChildren, normalizedChildren);

    for (let j = 0; j < normalizedChildren.length; j++) {
      const sourceIndex = matched[j];
      const normalizedChild = normalizedChildren[j];
      // `sourceIndex === null`: unpaired normalized child, no anchor, becomes
      // a gap. The `undefined` checks below (both from `noUncheckedIndexedAccess`,
      // since `matched`/`normalizedChildren` are indexed by a bounded loop
      // variable) are never actually reachable, but narrow explicitly via a
      // real conditional rather than a non-null assertion.
      if (sourceIndex === null || sourceIndex === undefined || normalizedChild === undefined) {
        continue;
      }
      const sourceChild = sourceChildren[sourceIndex];
      if (sourceChild === undefined) continue;
      collectLeafAnchors(sourceChild, normalizedChild, anchors);
    }
    return;
  }

  const sourceStart = sourceNode.position?.start.line;
  const sourceEnd = sourceNode.position?.end.line;
  const normalizedStart = normalizedNode.position?.start.line;
  const normalizedEnd = normalizedNode.position?.end.line;
  if (
    sourceStart == null ||
    sourceEnd == null ||
    normalizedStart == null ||
    normalizedEnd == null
  ) {
    return; // no position data to anchor with -- leave this span as a gap
  }

  anchors.push({ sourceStart, sourceEnd, normalizedStart, normalizedEnd });
}

/**
 * Build the `(number | null)[]` alignment array {@link fillUnmatchedRuns}
 * expects -- indexed by 0-based normalized line, valued by 0-based source
 * line, `null` where no leaf anchor covers -- from an AST lockstep walk
 * instead of string comparison.
 */
function alignNormalizedToSourceByAst(
  source: string,
  normalized: string,
  normalizedLineCount: number,
): (number | null)[] {
  const matched: (number | null)[] = Array.from({ length: normalizedLineCount }, () => null);

  let sourceAst: Root;
  let normalizedAst: Root;
  try {
    sourceAst = parseOrThrow(source);
    normalizedAst = parseOrThrow(normalized);
  } catch {
    // Not expected -- `normalize()` itself just parsed and reserialized
    // `normalized`, and `source` is the caller's own ordinary Markdown --
    // but if parsing fails anyway, leave everything unanchored rather than
    // throwing: fillUnmatchedRuns's pure forward interpolation still
    // produces a monotonic, in-range map for the whole document.
    return matched;
  }

  const anchors: LeafAnchor[] = [];
  collectLeafAnchors(sourceAst, normalizedAst, anchors);

  for (const anchor of anchors) {
    const sourceSpan = anchor.sourceEnd - anchor.sourceStart;
    const normalizedSpan = anchor.normalizedEnd - anchor.normalizedStart;

    for (let line = anchor.normalizedStart; line <= anchor.normalizedEnd; line++) {
      if (line < 1 || line > matched.length) continue; // defensive: stay in range
      const offset = line - anchor.normalizedStart;
      const sourceOffset =
        normalizedSpan <= 0 ? 0 : Math.round((offset * sourceSpan) / normalizedSpan);
      matched[line - 1] = anchor.sourceStart + sourceOffset - 1; // 0-based
    }
  }

  return matched;
}

/**
 * Split on `\n`, dropping at most one trailing newline -- the same rule
 * `splitIntoLines` in `unified-diff.ts` uses, so indices line up between the
 * two. A document that's exactly `'\n'` (one blank line) must split to
 * `['']` (one line), not `[]`: stripping the trailing newline leaves `''`,
 * and `''.split('\n')` already correctly yields `['']` -- there is no
 * separate "now it's empty, so zero lines" case to special-case, and doing
 * so was a bug (`splitLines('\n')` returned `[]`), only the true empty
 * string (`text === ''`, no trailing newline to even strip) has zero lines.
 */
function splitLines(text: string): string[] {
  if (text === '') return [];
  const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
  return withoutTrailingNewline.split('\n');
}
