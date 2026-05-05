/**
 * Generate Git-compatible unified diff format from ReviewState.
 *
 * Produces output that can be applied with `git apply` or `patch` command.
 */

import { normalize, parseFrontMatter } from '@cinder/markdown/pipeline';
import type { ReviewState } from '../comments/types.js';
import type { UnifiedDiffOptions, UnifiedDiffResult } from './types.js';

interface DiffHunk {
  originalStart: number;
  originalCount: number;
  currentStart: number;
  currentCount: number;
  lines: string[];
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
    // Default to false for backwards-compatible caller control. Modern ReviewState
    // content may already include front matter, so this option only prepends raw
    // front matter for older body-only states.
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
  // Note: normalize() adds a trailing newline; we strip it to avoid phantom empty lines.
  const original = originalContent.trim() ? normalize(originalContent).replace(/\n+$/, '') : '';
  const current = currentContent.trim() ? normalize(currentContent).replace(/\n+$/, '') : '';

  // Handle empty or identical content
  if (original === current) {
    return {
      diff: '',
      stats: { additions: 0, deletions: 0, hunks: 0 },
    };
  }

  const originalLines = splitIntoLines(original);
  const currentLines = splitIntoLines(current);

  // Compute line-level diff
  const changes = computeLineChanges(originalLines, currentLines);

  // Group changes into hunks with context
  const hunks = createHunks(changes, contextLines);

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

/**
 * Split content into lines, preserving empty lines.
 */
function splitIntoLines(content: string): string[] {
  if (content === '') return [];
  return content.split('\n');
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
function createHunks(changes: LineChange[], contextLines: number): DiffHunk[] {
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
      hunks.push(buildHunk(changes, hunkStart, hunkEnd));
      hunkStart = Math.max(0, changeStart);
      hunkEnd = Math.min(changes.length - 1, changeEnd);
    }
  }

  // Don't forget the last hunk
  hunks.push(buildHunk(changes, hunkStart, hunkEnd));

  return hunks;
}

/**
 * Build a single hunk from a range of changes.
 */
function buildHunk(changes: LineChange[], start: number, end: number): DiffHunk {
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
        if (!foundFirstOriginal && change.originalIndex !== null) {
          originalStart = change.originalIndex + 1;
          foundFirstOriginal = true;
        }
        originalCount++;
        break;

      case 'added':
        lines.push(`+${change.text}`);
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
