/**
 * Generate Git-compatible unified diff format from ReviewState.
 *
 * Produces output that can be applied with `git apply` or `patch` command.
 */

import type { DiffHunk as MarkdownDiffHunk } from '@lostgradient/markdown/diff/line-diff';
import { normalize, parseFrontMatter } from '@lostgradient/markdown/pipeline';
import type { ReviewState } from '../comments/types.js';
import type { UnifiedDiffOptions, UnifiedDiffResult } from './types.js';

interface DiffHunk {
  originalStart: number;
  originalCount: number;
  currentStart: number;
  currentCount: number;
  lines: string[];
}

interface SplitContent {
  lines: string[];
  hasTrailingNewline: boolean;
}

interface ComputedUnifiedDiffOptions {
  original: string;
  current: string;
}

/** Join the exact front-matter and body strings rendered by DiffViewer. */
export function composeDisplayedDocument(
  frontMatter: string,
  body: string,
  hasTerminatingNewline: boolean,
): string {
  return frontMatter ? `${frontMatter}${hasTerminatingNewline ? '\n' : ''}${body}` : body;
}

/** Format already-computed viewer hunks without running another line diff. */
export function formatComputedUnifiedDiff(
  hunks: MarkdownDiffHunk[],
  content?: ComputedUnifiedDiffOptions,
): string {
  if (hunks.length === 0) return '';
  const original = content ? splitIntoLines(content.original, false) : undefined;
  const current = content ? splitIntoLines(content.current, false) : undefined;
  const lines = ['--- a/document.md', '+++ b/document.md'];
  for (const hunk of hunks) {
    let originalLineNumber = hunk.originalStart;
    let currentLineNumber = hunk.currentStart;
    lines.push(
      `@@ -${hunk.originalStart},${hunk.originalCount} +${hunk.currentStart},${hunk.currentCount} @@`,
    );
    for (const line of hunk.lines) {
      if (line.type === 'same') {
        const originalLacksNewline = isFinalLineWithoutNewline(original, originalLineNumber);
        const currentLacksNewline = isFinalLineWithoutNewline(current, currentLineNumber);
        if (originalLacksNewline !== currentLacksNewline) {
          lines.push(`-${line.text}`);
          if (originalLacksNewline) lines.push('\\ No newline at end of file');
          lines.push(`+${line.text}`);
          if (currentLacksNewline) lines.push('\\ No newline at end of file');
        } else {
          lines.push(` ${line.text}`);
          if (originalLacksNewline && currentLacksNewline) {
            lines.push('\\ No newline at end of file');
          }
        }
        originalLineNumber += 1;
        currentLineNumber += 1;
      } else if (line.type === 'added') {
        lines.push(`+${line.text}`);
        if (isFinalLineWithoutNewline(current, currentLineNumber)) {
          lines.push('\\ No newline at end of file');
        }
        currentLineNumber += 1;
      } else if (line.type === 'removed') {
        lines.push(`-${line.text}`);
        if (isFinalLineWithoutNewline(original, originalLineNumber)) {
          lines.push('\\ No newline at end of file');
        }
        originalLineNumber += 1;
      } else {
        lines.push(`-${line.oldText}`);
        if (isFinalLineWithoutNewline(original, originalLineNumber)) {
          lines.push('\\ No newline at end of file');
        }
        lines.push(`+${line.newText}`);
        if (isFinalLineWithoutNewline(current, currentLineNumber)) {
          lines.push('\\ No newline at end of file');
        }
        originalLineNumber += 1;
        currentLineNumber += 1;
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

function isFinalLineWithoutNewline(content: SplitContent | undefined, lineNumber: number): boolean {
  return Boolean(content && !content.hasTrailingNewline && lineNumber === content.lines.length);
}

/**
 * Generate a Git-compatible unified diff from review state.
 *
 * @param state - The current review state containing original and current content
 * @param options - Configuration options for diff generation
 * @returns UnifiedDiffResult with diff string and statistics
 *
 * @example
 * ```typescript
 * const result = generateUnifiedDiff(state, { contextLines: 3 });
 * console.log(result.diff);
 * // --- a/document.md
 * // +++ b/document.md
 * // @@ -1,5 +1,6 @@
 * //  context line
 * // -old line
 * // +new line
 * //  context line
 * ```
 */
export function generateUnifiedDiff(
  state: ReviewState,
  options: UnifiedDiffOptions = {},
): UnifiedDiffResult {
  const {
    originalPath = 'a/document.md',
    currentPath = 'b/document.md',
    contextLines = 3,
    normalizeInputs = true,
    // Opt in because modern ReviewState content generally includes front matter already.
    includeFrontMatter = false,
  } = options;

  const originalContent = state.original ?? '';
  let currentContent = state.content;

  // Optionally prepend front matter for older body-only state payloads. Avoid
  // duplicating front matter when state.content is already full Markdown.
  if (
    includeFrontMatter &&
    state.frontMatterRaw &&
    !parseFrontMatter(currentContent).hasFrontMatter
  ) {
    currentContent = `---\n${state.frontMatterRaw}\n---\n\n${currentContent}`;
  }

  // Normalize both inputs to canonical form to avoid false positives
  // from formatting differences (e.g., `*` vs `-` list markers, trailing whitespace).
  // This ensures only semantic content changes appear in the diff.
  const original = normalizeInputs
    ? normalizeDocument(originalContent)
    : originalContent.replace(/\r\n?/g, '\n');
  const current = normalizeInputs
    ? normalizeDocument(currentContent)
    : currentContent.replace(/\r\n?/g, '\n');

  // Handle empty or identical content
  if (original === current) {
    return {
      diff: '',
      stats: { additions: 0, deletions: 0, hunks: 0 },
    };
  }

  const originalSplit = splitIntoLines(original, normalizeInputs);
  const currentSplit = splitIntoLines(current, normalizeInputs);

  // Compute line-level diff
  const changes = computeLineChanges(originalSplit.lines, currentSplit.lines);
  representTrailingNewlineChange(changes, originalSplit, currentSplit);

  // Group changes into hunks with context
  const hunks = createHunks(changes, contextLines, originalSplit, currentSplit);

  // Build the unified diff output
  const diffLines: string[] = [`--- ${originalPath}`, `+++ ${currentPath}`];

  let additions = 0;
  let deletions = 0;

  for (const hunk of hunks) {
    diffLines.push(
      `@@ -${hunk.originalStart},${hunk.originalCount} +${hunk.currentStart},${hunk.currentCount} @@`,
    );
    for (const line of hunk.lines) {
      diffLines.push(line);
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
  }

  return {
    diff: hunks.length > 0 ? diffLines.join('\n') + '\n' : '',
    stats: {
      additions,
      deletions,
      hunks: hunks.length,
    },
  };
}

interface DocumentParts {
  /** The fenced front-matter block verbatim, including the newline that closes it. */
  frontMatter: string;
  /** The blank line between front matter and body, collapsed to at most one. */
  separator: string;
  /** Everything after the front matter block. */
  body: string;
}

/**
 * Split a document into its verbatim front-matter block and its body.
 *
 * `normalize()` is a Markdown pipeline with no front-matter step. Handed a whole
 * document it re-reads the opening `---` as a thematic break, and the YAML lines
 * closed by the second `---` as a setext heading — whose underline it re-emits as
 * a run of dashes as long as the longest line it underlines. The YAML is rewritten
 * (blank lines injected, indentation of sequence items lost) and every subsequent
 * line number shifts, so the resulting patch does not apply. DiffViewer already
 * sidesteps this by normalizing only the body; the export path must do the same.
 */
function splitDocument(content: string): DocumentParts {
  const text = content.replace(/\r\n?/g, '\n');
  const parsed = parseFrontMatter(text);
  if (!parsed.hasFrontMatter) return { frontMatter: '', separator: '', body: text };

  return {
    frontMatter: text.slice(0, text.length - parsed.body.length),
    // normalize() collapses runs of blank lines to a single one, so apply the same
    // rule to the gap after the front matter rather than copying it verbatim —
    // otherwise a whitespace-only difference there would surface as a phantom hunk.
    separator: parsed.body.startsWith('\n') ? '\n' : '',
    body: parsed.body,
  };
}

/**
 * Canonicalize a document for diffing: front matter kept byte-for-byte, body run
 * through the Markdown pipeline.
 *
 * Note: normalize() adds a trailing newline; we strip it to avoid phantom empty lines.
 */
function normalizeDocument(content: string): string {
  if (!content.trim()) return '';

  const { frontMatter, separator, body } = splitDocument(content);
  const normalizedBody = body.trim() ? normalize(body).replace(/\n+$/, '') : '';
  if (!frontMatter) return normalizedBody;
  if (!normalizedBody) return frontMatter.replace(/\n+$/, '');

  return `${frontMatter}${separator}${normalizedBody}`;
}

/**
 * Split content into lines, preserving empty lines.
 */
function splitIntoLines(content: string, normalized: boolean): SplitContent {
  if (content === '') return { lines: [], hasTrailingNewline: normalized };
  const hasTrailingNewline = normalized || content.endsWith('\n');
  const text = content.endsWith('\n') ? content.slice(0, -1) : content;
  return { lines: text.split('\n'), hasTrailingNewline };
}

/**
 * Represents a change between original and current.
 */
interface LineChange {
  type: 'same' | 'added' | 'removed';
  originalIndex: number | null;
  currentIndex: number | null;
  text: string;
}

function representTrailingNewlineChange(
  changes: LineChange[],
  original: SplitContent,
  current: SplitContent,
): void {
  if (original.hasTrailingNewline === current.hasTrailingNewline) return;
  const lastChange = changes.at(-1);
  if (!lastChange || lastChange.type !== 'same') return;

  changes.splice(
    -1,
    1,
    {
      type: 'removed',
      originalIndex: lastChange.originalIndex,
      currentIndex: null,
      text: lastChange.text,
    },
    {
      type: 'added',
      originalIndex: null,
      currentIndex: lastChange.currentIndex,
      text: lastChange.text,
    },
  );
}

/**
 * Compute line-by-line changes using Myers diff algorithm (simplified LCS).
 */
function computeLineChanges(original: string[], current: string[]): LineChange[] {
  // Use dynamic programming for LCS-based diff
  const m = original.length;
  const n = current.length;

  // Build LCS table
  const lcs: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1] === current[j - 1]) {
        lcs[i]![j] = lcs[i - 1]![j - 1]! + 1;
      } else {
        lcs[i]![j] = Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
      }
    }
  }

  // Backtrack to build the diff
  let i = m;
  let j = n;
  const result: LineChange[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === current[j - 1]) {
      result.unshift({
        type: 'same',
        originalIndex: i - 1,
        currentIndex: j - 1,
        text: original[i - 1]!,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i]![j - 1]! >= lcs[i - 1]![j]!)) {
      result.unshift({
        type: 'added',
        originalIndex: null,
        currentIndex: j - 1,
        text: current[j - 1]!,
      });
      j--;
    } else {
      result.unshift({
        type: 'removed',
        originalIndex: i - 1,
        currentIndex: null,
        text: original[i - 1]!,
      });
      i--;
    }
  }

  return result;
}

/**
 * Group changes into hunks with surrounding context lines.
 */
function createHunks(
  changes: LineChange[],
  contextLines: number,
  original: SplitContent,
  current: SplitContent,
): DiffHunk[] {
  // Find indices of actual changes (non-same lines)
  const changeIndices: number[] = [];
  for (let i = 0; i < changes.length; i++) {
    if (changes[i]?.type !== 'same') {
      changeIndices.push(i);
    }
  }

  if (changeIndices.length === 0) {
    return [];
  }

  // Group consecutive changes with context
  const hunks: DiffHunk[] = [];
  const firstChangeIndex = changeIndices[0]!;
  let hunkStart = Math.max(0, firstChangeIndex - contextLines);
  let hunkEnd = Math.min(changes.length - 1, firstChangeIndex + contextLines);

  for (let i = 1; i < changeIndices.length; i++) {
    const changeIndex = changeIndices[i];
    if (changeIndex === undefined) continue;

    const changeStart = changeIndex - contextLines;
    const changeEnd = changeIndex + contextLines;

    // Check if this change should be merged with current hunk
    if (changeStart <= hunkEnd + 1) {
      // Merge: extend the current hunk
      hunkEnd = Math.min(changes.length - 1, changeEnd);
    } else {
      // Create hunk from current range
      hunks.push(buildHunk(changes, hunkStart, hunkEnd, original, current));
      hunkStart = Math.max(0, changeStart);
      hunkEnd = Math.min(changes.length - 1, changeEnd);
    }
  }

  // Don't forget the last hunk
  hunks.push(buildHunk(changes, hunkStart, hunkEnd, original, current));

  return hunks;
}

/**
 * Build a single hunk from a range of changes.
 */
function buildHunk(
  changes: LineChange[],
  start: number,
  end: number,
  original: SplitContent,
  current: SplitContent,
): DiffHunk {
  const lines: string[] = [];
  let originalStart = 0;
  let originalCount = 0;
  let currentStart = 0;
  let currentCount = 0;
  let foundFirstOriginal = false;
  let foundFirstCurrent = false;

  for (let i = start; i <= end; i++) {
    const change = changes[i];
    if (!change) continue;

    switch (change.type) {
      case 'same':
        lines.push(` ${change.text}`);
        if (!foundFirstOriginal && change.originalIndex !== null) {
          originalStart = change.originalIndex + 1; // 1-indexed
          foundFirstOriginal = true;
        }
        if (!foundFirstCurrent && change.currentIndex !== null) {
          currentStart = change.currentIndex + 1; // 1-indexed
          foundFirstCurrent = true;
        }
        originalCount++;
        currentCount++;
        break;

      case 'removed':
        lines.push(`-${change.text}`);
        if (!original.hasTrailingNewline && change.originalIndex === original.lines.length - 1) {
          lines.push('\\ No newline at end of file');
        }
        if (!foundFirstOriginal && change.originalIndex !== null) {
          originalStart = change.originalIndex + 1;
          foundFirstOriginal = true;
        }
        originalCount++;
        break;

      case 'added':
        lines.push(`+${change.text}`);
        if (!current.hasTrailingNewline && change.currentIndex === current.lines.length - 1) {
          lines.push('\\ No newline at end of file');
        }
        if (!foundFirstCurrent && change.currentIndex !== null) {
          currentStart = change.currentIndex + 1;
          foundFirstCurrent = true;
        }
        currentCount++;
        break;
    }
  }

  // Handle edge cases for empty sides (new file or full deletion)
  // Git unified diff requires start=0 when count=0, e.g., @@ -0,0 +1,n @@
  if (!foundFirstOriginal) originalStart = originalCount === 0 ? 0 : 1;
  if (!foundFirstCurrent) currentStart = currentCount === 0 ? 0 : 1;

  return {
    originalStart,
    originalCount,
    currentStart,
    currentCount,
    lines,
  };
}
