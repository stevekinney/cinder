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
 * line -- carries forward the nearest preceding matched line, keeping the
 * map monotonically non-decreasing. That fallback is approximate for lines
 * normalization synthesized; it is exact for the blank-line and
 * front-matter drift cinder#1324 was filed against, since those transforms
 * only ever remove lines, never rewrite the ones that remain.
 */
export function buildSourceLineMap(source: string, normalized: string): number[] {
  const sourceLines = splitLines(source);
  const normalizedLines = splitLines(normalized);

  const matched = alignNormalizedToSource(sourceLines, normalizedLines);

  const map: number[] = Array.from({ length: normalizedLines.length });
  let lastSourceIndex = 0; // 0-based fallback for runs before the first match

  for (let i = 0; i < normalizedLines.length; i++) {
    const sourceIndex = matched[i];
    if (sourceIndex !== null && sourceIndex !== undefined) {
      lastSourceIndex = sourceIndex;
    }
    map[i] = lastSourceIndex + 1; // 1-based
  }

  return map;
}

/** Identity map: normalized line N is source line N (unnormalized inputs). */
export function identitySourceLineMap(normalized: string): number[] {
  return splitLines(normalized).map((_, index) => index + 1);
}

/**
 * Look up a normalized-space line number (1-based, as `unified-diff.ts` and
 * `markdown-summary.ts` already track it) in a source line map, clamping
 * out-of-range lookups instead of throwing.
 */
export function mapNormalizedLineNumber(lineMap: number[], normalizedLineNumber: number): number {
  if (lineMap.length === 0) return normalizedLineNumber;
  const index = Math.min(Math.max(normalizedLineNumber - 1, 0), lineMap.length - 1);
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

function splitLines(text: string): string[] {
  if (text === '') return [];
  const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (withoutTrailingNewline === '') return [];
  return withoutTrailingNewline.split('\n');
}
