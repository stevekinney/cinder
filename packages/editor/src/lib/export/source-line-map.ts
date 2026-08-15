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
 * @module
 */

/**
 * Build a 0-indexed array where `map[normalizedLineIndex]` is the 1-based
 * line number in `source` that normalized line most plausibly corresponds
 * to.
 *
 * Alignment matches identical lines between the two documents in order (the
 * same longest-common-subsequence approach the line-level diff itself
 * uses), so any normalized line that exists verbatim in the source maps to
 * its exact source line. A normalized line with no verbatim match --
 * content normalization actually rewrote it, e.g. `#   Heading` becoming
 * `# Heading`, or a Setext underline disappearing into its heading's own
 * line -- is filled in by {@link fillUnmatchedRuns}, which interpolates
 * forward from the nearest preceding match rather than freezing on it, so
 * the rewritten line itself (not the line before it) is what gets reported.
 * That fallback is approximate for lines normalization synthesized; it is
 * exact for the blank-line and front-matter drift cinder#1324 was filed
 * against, since those transforms only ever remove lines, never rewrite the
 * ones that remain.
 */
export function buildSourceLineMap(source: string, normalized: string): number[] {
  const sourceLines = splitLines(source);
  const normalizedLines = splitLines(normalized);

  const matched = alignNormalizedToSource(sourceLines, normalizedLines);
  const filled = fillUnmatchedRuns(matched, sourceLines.length);

  return filled.map((sourceIndex) => sourceIndex + 1); // 1-based
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

/** Identity map: normalized line N is source line N (unnormalized inputs). */
export function identitySourceLineMap(normalized: string): number[] {
  return splitLines(normalized).map((_, index) => index + 1);
}

/**
 * Look up a normalized-space line number (1-based, as `unified-diff.ts` and
 * `markdown-summary.ts` already track it) in a source line map.
 *
 * A lookup past the end of the map (normalized line count + 1, the "insert
 * after the last line" position both callers use for a pure trailing
 * addition) extrapolates past the last mapped source line rather than
 * clamping back onto it -- clamping would silently relocate a legitimate
 * append-at-EOF position onto the document's last real line instead of
 * reporting it as after that line.
 */
export function mapNormalizedLineNumber(lineMap: number[], normalizedLineNumber: number): number {
  if (lineMap.length === 0) return normalizedLineNumber;
  if (normalizedLineNumber > lineMap.length) {
    const lastSourceLine = lineMap[lineMap.length - 1]!;
    return lastSourceLine + (normalizedLineNumber - lineMap.length);
  }
  const index = Math.max(normalizedLineNumber - 1, 0);
  return lineMap[index]!;
}

/** Longest-common-subsequence line alignment, matching `computeLineChanges`'s DP shape. */
function alignNormalizedToSource(
  sourceLines: string[],
  normalizedLines: string[],
): (number | null)[] {
  const m = sourceLines.length;
  const n = normalizedLines.length;

  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      lcs[i]![j] =
        sourceLines[i - 1] === normalizedLines[j - 1]
          ? lcs[i - 1]![j - 1]! + 1
          : Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
    }
  }

  const matched: (number | null)[] = Array.from({ length: n }, () => null);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (sourceLines[i - 1] === normalizedLines[j - 1]) {
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
