import type { Content, Root } from '@lostgradient/markdown';
import { parseOrThrow } from '@lostgradient/markdown';

type PairableNode = { type: string; ordered?: boolean | null | undefined };

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
function nodeKey(node: PairableNode): string {
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
  sourceChildren: PairableNode[],
  normalizedChildren: PairableNode[],
): (number | null)[] {
  const { matched, sourceEnd, normalizedEnd } = trimMatchingSuffix(
    sourceChildren,
    normalizedChildren,
  );
  if (sourceEnd === 0 || normalizedEnd === 0) return matched;
  const lcs = buildLcs(sourceChildren, normalizedChildren, sourceEnd, normalizedEnd);
  backtrackMatches(sourceChildren, normalizedChildren, sourceEnd, normalizedEnd, lcs, matched);
  return matched;
}

function trimMatchingSuffix(
  sourceChildren: PairableNode[],
  normalizedChildren: PairableNode[],
): { matched: (number | null)[]; sourceEnd: number; normalizedEnd: number } {
  let sourceEnd = sourceChildren.length;
  let normalizedEnd = normalizedChildren.length;
  const matched: (number | null)[] = Array.from({ length: normalizedEnd }, () => null);
  while (
    sourceEnd > 0 &&
    normalizedEnd > 0 &&
    nodeKey(sourceChildren[sourceEnd - 1]!) === nodeKey(normalizedChildren[normalizedEnd - 1]!)
  ) {
    matched[normalizedEnd - 1] = sourceEnd - 1;
    sourceEnd--;
    normalizedEnd--;
  }
  return { matched, sourceEnd, normalizedEnd };
}

function buildLcs(
  sourceChildren: PairableNode[],
  normalizedChildren: PairableNode[],
  sourceEnd: number,
  normalizedEnd: number,
): number[][] {
  const lcs = Array.from({ length: sourceEnd + 1 }, () => Array(normalizedEnd + 1).fill(0));
  for (let sourceIndex = 1; sourceIndex <= sourceEnd; sourceIndex++) {
    for (let normalizedIndex = 1; normalizedIndex <= normalizedEnd; normalizedIndex++) {
      lcs[sourceIndex]![normalizedIndex] =
        nodeKey(sourceChildren[sourceIndex - 1]!) ===
        nodeKey(normalizedChildren[normalizedIndex - 1]!)
          ? lcs[sourceIndex - 1]![normalizedIndex - 1]! + 1
          : Math.max(
              lcs[sourceIndex - 1]![normalizedIndex] ?? 0,
              lcs[sourceIndex]![normalizedIndex - 1] ?? 0,
            );
    }
  }
  return lcs;
}

function backtrackMatches(
  sourceChildren: PairableNode[],
  normalizedChildren: PairableNode[],
  sourceEnd: number,
  normalizedEnd: number,
  lcs: number[][],
  matched: (number | null)[],
): void {
  let sourceIndex = sourceEnd;
  let normalizedIndex = normalizedEnd;
  while (sourceIndex > 0 && normalizedIndex > 0) {
    if (
      nodeKey(sourceChildren[sourceIndex - 1]!) ===
      nodeKey(normalizedChildren[normalizedIndex - 1]!)
    ) {
      matched[normalizedIndex - 1] = sourceIndex - 1;
      sourceIndex--;
      normalizedIndex--;
    } else if (lcs[sourceIndex - 1]![normalizedIndex]! >= lcs[sourceIndex]![normalizedIndex - 1]!) {
      sourceIndex--;
    } else {
      normalizedIndex--;
    }
  }
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
    collectContainerAnchors(sourceNode, normalizedNode, anchors);
    return;
  }

  appendLeafAnchor(sourceNode, normalizedNode, anchors);
}

function collectContainerAnchors(
  sourceNode: Root | Content,
  normalizedNode: Root | Content,
  anchors: LeafAnchor[],
): void {
  const sourceChildren = childrenOf(sourceNode);
  const normalizedChildren = childrenOf(normalizedNode);
  const matched = pairChildrenByType(sourceChildren, normalizedChildren);
  for (let index = 0; index < normalizedChildren.length; index++) {
    const sourceIndex = matched[index];
    const normalizedChild = normalizedChildren[index];
    if (sourceIndex === null || sourceIndex === undefined || normalizedChild === undefined)
      continue;
    const sourceChild = sourceChildren[sourceIndex];
    if (sourceChild !== undefined) collectLeafAnchors(sourceChild, normalizedChild, anchors);
  }
}

function appendLeafAnchor(
  sourceNode: Root | Content,
  normalizedNode: Root | Content,
  anchors: LeafAnchor[],
): void {
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
export function alignNormalizedToSourceByAst(
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
