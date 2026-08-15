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
 * Alignment (see {@link alignNormalizedToSource}) has to recognize when a
 * normalized line is really the *same* source line under a rewritten
 * spelling -- `*` becoming `-`, `1)` becoming `1.`, `_em_` becoming `*em*` --
 * rather than treating the rewrite as "no match, fall back to
 * interpolation." The rewrite rules live in exactly one place already:
 * `serializerOptions` (`@lostgradient/markdown`'s `pipeline/serializer.ts`)
 * plus `remark-stringify`/`remark-gfm`'s own defaults, both reached by
 * calling `normalize()` itself. Earlier revisions of this module
 * re-encoded pieces of that rule set by hand (first a Setext-fold special
 * case, then a `canonicalizeListMarker` regex for unordered markers only) --
 * each review round found the next rewrite kind the hand-rolled copy
 * missed (ordered markers, then whatever comes after that), which is the
 * same "two normalizers drift apart" defect class `normalizeDocument()` /
 * `splitDocument()` (cinder#1307, cinder#1318) already fixed once for
 * front-matter handling. {@link canonicalizeLine} closes it the same way:
 * it calls the real `normalize()` per line instead of re-deriving a second
 * notion of "these two lines are the same modulo style," so the alignment
 * automatically covers every rewrite `normalize()` makes, including ones
 * added after this file was written.
 *
 * `normalize()`'s full rewrite inventory (`@lostgradient/markdown`'s
 * `pipeline/ast.ts`) splits into two kinds, and only one of them needs
 * {@link canonicalizeLine} at all:
 *
 * - **Line-rewriting**: everything `serialize()` does -- `serializerOptions`
 *   (bullet, ordered-bullet, emphasis, strong, fence, rule, listItemIndent,
 *   tightDefinitions, ...) plus every `remark-stringify`/`remark-gfm`
 *   default it doesn't override (GFM tables, strikethrough, task-list
 *   checkboxes, autolinks, ...). {@link canonicalizeLine} reaches all of
 *   this by construction, by calling the exact same `serialize()` path on
 *   one line -- there is nothing here to enumerate or fall behind on.
 * - **Line-deleting**: `normalize()`'s own post-serialization regex passes
 *   -- tight-list separator removal (both marker kinds), 3+ blank lines
 *   collapsing to 1, and leading/trailing blank-run trimming. These only
 *   ever remove lines, never rewrite the content of a line that survives,
 *   so they need no canonicalization: a surviving line still matches
 *   itself, and {@link fillUnmatchedRuns}'s interpolation already handles
 *   a run of lines that simply disappeared.
 *
 * Two known limits of canonicalizing one line in isolation, both
 * deliberately accepted rather than chased further: a transform that only
 * makes sense with multi-line context (a Setext underline folding into the
 * heading above it, four leading spaces being read as an indented code
 * block and re-fenced) can't be reproduced by re-running `normalize()` on
 * just that one line -- {@link canonicalizeLine} detects a multi-line
 * result and falls back to the original line rather than risk comparing
 * it against something unrelated, leaving these cases exactly as
 * approximate as they were before this fix (see the Setext test below).
 * And a line whose *correct* canonical form depends on surrounding
 * document context that a lone line doesn't have (a lazy paragraph
 * continuation's leading whitespace, a table row with no header separator
 * next to it) may canonicalize to something a full-document `normalize()`
 * wouldn't -- this can only cause a missed match (falling back to
 * interpolation, the same approximate behavior this file always had for
 * an unmatched line), never a *false* match, since both sides of any
 * comparison run through the identical function.
 *
 * @module
 */

import { normalize } from '@lostgradient/markdown/pipeline';

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
 * Alignment matches lines between the two documents in order (the same
 * longest-common-subsequence approach the line-level diff itself uses),
 * comparing each pair through {@link canonicalizeLine} rather than by raw
 * equality -- so a normalized line rewritten by `normalize()` (`#   Heading`
 * becoming `# Heading`, `*` becoming `-`, `1)` becoming `1.`, ...) still
 * maps to its own source line instead of registering as "no match at all."
 * A normalized line with no match even under canonicalization -- content
 * normalization synthesized or restructured it in a way {@link
 * canonicalizeLine}'s single-line view can't reconstruct, e.g. a Setext
 * underline disappearing into its heading's own line -- is filled in by
 * {@link fillUnmatchedRuns}, which interpolates forward from the nearest
 * preceding match rather than freezing on it, so the rewritten line itself
 * (not the line before it) is what gets reported. That fallback is
 * approximate for lines normalization synthesized from multi-line context;
 * it is exact for the blank-line and front-matter drift cinder#1324 was
 * filed against, since those transforms only ever remove lines, never
 * rewrite the ones that remain.
 *
 * The canonicalization cache is created fresh per call (not shared across
 * calls) and shared between the source and normalized arrays within this
 * one call -- most normalized lines are byte-identical to some source line,
 * so the cache hits constantly within a single `buildSourceLineMap` run,
 * without holding memory across unrelated export calls.
 */
export function buildSourceLineMap(source: string, normalized: string): SourceLineMap {
  const sourceLines = splitLines(source);
  const normalizedLines = splitLines(normalized);

  const cache = new Map<string, string>();
  const canonicalSourceLines = sourceLines.map((line) => canonicalizeLine(line, cache));
  const canonicalNormalizedLines = normalizedLines.map((line) => canonicalizeLine(line, cache));

  const matched = alignNormalizedToSource(canonicalSourceLines, canonicalNormalizedLines);
  const filled = fillUnmatchedRuns(matched, sourceLines.length);

  return {
    lines: filled.map((sourceIndex) => sourceIndex + 1), // 1-based
    sourceLineCount: sourceLines.length,
  };
}

/**
 * Fill the gaps `alignNormalizedToSource` left as `null` (normalized lines
 * with no verbatim source match) by interpolating forward from the nearest
 * preceding match, one source line per unmatched normalized line, clamped
 * to the nearest *following* match so the result never overshoots past
 * where the alignment resumes. Freezing on the preceding match instead
 * (the simpler alternative) reports the line *before* a rewritten line --
 * e.g. the blank line above a collapsed Setext heading -- instead of the
 * rewritten line's own position; clamping to the following match instead of
 * advancing unboundedly keeps the result monotonically non-decreasing even
 * when a long unmatched run sits between two matches that are close
 * together in `source`.
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

    // Start of a run of unmatched normalized lines: find where it ends and
    // what the next real match (if any) is, so the interpolation below has
    // both an anchor to advance from and a ceiling not to cross.
    let end = i;
    while (end < n && (matched[end] === null || matched[end] === undefined)) end++;

    const precedingMatch = i > 0 ? filled[i - 1]! : -1; // -1: no match yet
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
 * Longest-common-subsequence line alignment, matching `computeLineChanges`'s
 * DP shape. Callers pass already-{@link canonicalizeLine}-canonicalized
 * arrays, so equality here is plain `===` -- comparing canonical strings
 * subsumes exact-match comparison, since `canonicalizeLine` is a
 * deterministic function of its input (`a === b` implies
 * `canonicalizeLine(a) === canonicalizeLine(b)`), so there is no separate
 * "byte-exact first" case to special-case.
 */
function alignNormalizedToSource(
  canonicalSourceLines: string[],
  canonicalNormalizedLines: string[],
): (number | null)[] {
  const m = canonicalSourceLines.length;
  const n = canonicalNormalizedLines.length;

  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      lcs[i]![j] =
        canonicalSourceLines[i - 1] === canonicalNormalizedLines[j - 1]
          ? lcs[i - 1]![j - 1]! + 1
          : Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
    }
  }

  const matched: (number | null)[] = Array.from({ length: n }, () => null);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (canonicalSourceLines[i - 1] === canonicalNormalizedLines[j - 1]) {
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
 * Canonicalize a single line the way `normalize()` -- the real Markdown
 * pipeline, `@lostgradient/markdown/pipeline` -- would rewrite it, memoized
 * per {@link buildSourceLineMap} call.
 *
 * This exists so alignment's notion of "these two lines are the same
 * modulo style" comes from calling the normalizer, not from re-deriving a
 * second copy of its rules. Earlier versions of this module hand-encoded
 * that notion one rewrite kind at a time (Setext folding, then unordered
 * list markers), and each review round found the next kind the copy
 * missed -- ordered list markers (`1)` vs `1.`), which is exactly what
 * calling `normalize()` here picks up for free, along with emphasis
 * (`_x_`/`*x*`), strong (`__x__`/`**x**`), thematic breaks
 * (`***`/`___`/`- - -`), and list-item indent spacing, without this file
 * needing to know any of those rules exist.
 *
 * Two guards keep a per-line call safe even though `normalize()` is really
 * a whole-document pipeline:
 *
 * - **Blank/whitespace-only lines canonicalize to `''`** without calling
 *   `normalize()` at all, so a trailing-whitespace source line still
 *   matches its stripped normalized twin.
 * - **A result containing a newline is discarded, falling back to the
 *   original line.** Most rewrites `normalize()` makes are line-local, but
 *   a few are multi-line-context transforms that don't make sense run on
 *   an isolated line -- a Setext heading's underline folding into the
 *   heading above it, or four spaces of leading whitespace being
 *   (mis)read as an indented code block and re-fenced. Trusting a
 *   multi-line result here would risk comparing it against an unrelated
 *   single line and calling that a match; falling back to the original
 *   line instead means these lines simply don't canonicalize, and the
 *   surrounding LCS/interpolation fallback handles them the way it always
 *   has (approximate, but never a false match).
 *
 * `normalize()` is not expected to throw on a single line -- it's a
 * complete (if often small) Markdown document -- but a `try`/`catch`
 * falls back to the original line rather than letting a parser edge case
 * here break the whole export.
 */
function canonicalizeLine(line: string, cache: Map<string, string>): string {
  const cached = cache.get(line);
  if (cached !== undefined) return cached;

  const canonical = computeCanonicalLine(line);
  cache.set(line, canonical);
  return canonical;
}

function computeCanonicalLine(line: string): string {
  if (line.trim() === '') return '';

  let normalized: string;
  try {
    normalized = normalize(line).replace(/\n+$/, '');
  } catch {
    return line;
  }

  return normalized.includes('\n') ? line : normalized;
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
