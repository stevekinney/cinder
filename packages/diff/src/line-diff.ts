/**
 * Line-based diff computation for the DiffViewer component.
 *
 * Uses diff-match-patch for line-level diffing, with word-level
 * highlighting for modified lines.
 */

import DiffMatchPatch from 'diff-match-patch';

export type LineDiff =
  | { type: 'same'; text: string }
  | { type: 'added'; text: string }
  | { type: 'removed'; text: string }
  | { type: 'modified'; oldText: string; newText: string; wordChanges: WordChange[] };

export type WordChange =
  | { type: 'same'; text: string }
  | { type: 'added'; text: string }
  | { type: 'removed'; text: string };

/** Statistics from line-based diff computation */
export interface LineDiffStats {
  /** Number of lines added */
  added: number;
  /** Number of lines removed */
  removed: number;
  /** Number of lines modified (word-level changes) */
  modified: number;
}

/**
 * A hunk is a group of consecutive changes with surrounding context.
 * Used for hunk-based revert operations.
 */
export interface DiffHunk {
  /** Index of this hunk in the list */
  index: number;
  /** 1-based line number in original content where hunk starts */
  originalStart: number;
  /** Number of lines in original content affected by this hunk */
  originalCount: number;
  /** 1-based line number in current content where hunk starts */
  currentStart: number;
  /** Number of lines in current content affected by this hunk */
  currentCount: number;
  /** Line diffs within this hunk (includes context) */
  lines: LineDiff[];
  /** Original lines that were changed/removed (for revert) */
  originalLines: string[];
  /** Current lines that were added/modified (for reference) */
  currentLines: string[];
}

const dmp = new DiffMatchPatch();

function getArrayItem<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Expected item at index ${index}.`);
  }
  return item;
}

/**
 * Compute word-level changes within a single line.
 */
export function computeWordChanges(oldText: string, newText: string): WordChange[] {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map(([op, text]) => {
    if (op === 0) return { type: 'same' as const, text };
    if (op === -1) return { type: 'removed' as const, text };
    return { type: 'added' as const, text };
  });
}

/**
 * Compute line-based diff between two strings.
 * For modified lines, includes word-level changes.
 */
export function computeLineDiff(original: string, current: string): LineDiff[] {
  // Fast path for identical content
  if (original === current) {
    return original.split('\n').map((text) => ({ type: 'same' as const, text }));
  }

  // Use diff-match-patch's line diff mode
  const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(original, current);
  const lineDiffs = dmp.diff_main(chars1, chars2, false);
  dmp.diff_cleanupSemantic(lineDiffs);
  dmp.diff_charsToLines_(lineDiffs, lineArray);

  const result: LineDiff[] = [];

  for (let i = 0; i < lineDiffs.length; i++) {
    const [op, text] = getArrayItem(lineDiffs, i);
    // Split by newlines, removing trailing empty string from final newline
    const lines = splitLines(text);

    if (op === 0) {
      // Equal - these lines are unchanged
      for (const line of lines) {
        result.push({ type: 'same', text: line });
      }
    } else if (op === -1) {
      // Deletion - check if followed by insertion (modification)
      const next = lineDiffs[i + 1];
      if (next && next[0] === 1) {
        // This is a modification (delete + insert)
        const oldLines = lines;
        const newLines = splitLines(next[1]);

        // Process each line pair
        processModification(oldLines, newLines, result);
        i++; // Skip the insertion we just processed
      } else {
        // Pure deletion
        for (const line of lines) {
          result.push({ type: 'removed', text: line });
        }
      }
    } else if (op === 1) {
      // Insertion (not preceded by deletion - that case is handled above)
      for (const line of lines) {
        result.push({ type: 'added', text: line });
      }
    }
  }

  return result;
}

/**
 * Split text by newlines, handling trailing newline correctly.
 */
function splitLines(text: string): string[] {
  const lines = text.split('\n');
  // If text ends with newline, remove the trailing empty string
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/**
 * Process a modification (paired deletion + insertion).
 *
 * The key insight: when one line is modified, diff-match-patch sees it as
 * "delete old line, insert new line". We need to pair these correctly.
 *
 * Strategy: Use similarity matching to pair old and new lines,
 * rather than naive index-based pairing.
 */
function processModification(oldLines: string[], newLines: string[], result: LineDiff[]): void {
  // For simple cases (same number of lines), pair by index
  if (oldLines.length === newLines.length) {
    for (let i = 0; i < oldLines.length; i++) {
      const oldLine = getArrayItem(oldLines, i);
      const newLine = getArrayItem(newLines, i);

      if (oldLine === newLine) {
        result.push({ type: 'same', text: oldLine });
      } else {
        result.push({
          type: 'modified',
          oldText: oldLine,
          newText: newLine,
          wordChanges: computeWordChanges(oldLine, newLine),
        });
      }
    }
    return;
  }

  // For unequal line counts, use LCS-based alignment
  // This handles cases like inserting/deleting lines in the middle
  const alignment = alignLines(oldLines, newLines);

  for (const item of alignment) {
    if (item.type === 'same') {
      result.push({ type: 'same', text: item.text });
    } else if (item.type === 'removed') {
      result.push({ type: 'removed', text: item.text });
    } else if (item.type === 'added') {
      result.push({ type: 'added', text: item.text });
    } else if (item.type === 'modified') {
      result.push({
        type: 'modified',
        oldText: item.oldText,
        newText: item.newText,
        wordChanges: computeWordChanges(item.oldText, item.newText),
      });
    }
  }
}

type AlignmentResult =
  | { type: 'same'; text: string }
  | { type: 'added'; text: string }
  | { type: 'removed'; text: string }
  | { type: 'modified'; oldText: string; newText: string };

/**
 * Align two arrays of lines using similarity matching.
 *
 * Uses a greedy approach with monotonic matching to ensure output order
 * reflects the visual reading order of the document:
 * 1. Find best match for each old line (must be after previous match)
 * 2. Process in document order: additions, then matched/removed lines
 */
function alignLines(oldLines: string[], newLines: string[]): AlignmentResult[] {
  const result: AlignmentResult[] = [];

  // Track which new lines have been matched
  const matchedNew = new Set<number>();

  // For each old line, find best matching new line (must be monotonically increasing)
  const oldMatches: (number | null)[] = oldLines.map(() => null);
  let minNewIdx = 0; // Ensures matches are in order

  for (let oldIdx = 0; oldIdx < oldLines.length; oldIdx++) {
    const oldLine = getArrayItem(oldLines, oldIdx);
    let bestMatchIdx = -1;
    let bestSimilarity = 0.5; // Minimum threshold for a match

    // Only consider new lines at or after the last match
    for (let newIdx = minNewIdx; newIdx < newLines.length; newIdx++) {
      if (matchedNew.has(newIdx)) continue;

      const newLine = getArrayItem(newLines, newIdx);
      const similarity = computeSimilarity(oldLine, newLine);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatchIdx = newIdx;

        // Exact matches cannot be improved, but near matches can still hide
        // a better match later in the candidate window.
        if (similarity === 1) break;
      }
    }

    if (bestMatchIdx >= 0) {
      oldMatches[oldIdx] = bestMatchIdx;
      matchedNew.add(bestMatchIdx);
      minNewIdx = bestMatchIdx + 1; // Next match must be after this one
    }
  }

  // Build result by processing in document order
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx < oldLines.length) {
      const matchIdx = getArrayItem(oldMatches, oldIdx);

      if (matchIdx !== null) {
        // Output any unmatched new lines before this match
        while (newIdx < matchIdx) {
          if (!matchedNew.has(newIdx)) {
            result.push({ type: 'added', text: getArrayItem(newLines, newIdx) });
          }
          newIdx++;
        }

        // Output the matched pair
        const oldLine = getArrayItem(oldLines, oldIdx);
        const newLine = getArrayItem(newLines, matchIdx);

        if (oldLine === newLine) {
          result.push({ type: 'same', text: oldLine });
        } else {
          result.push({ type: 'modified', oldText: oldLine, newText: newLine });
        }

        oldIdx++;
        newIdx = matchIdx + 1;
      } else {
        // No match for this old line - it was removed
        result.push({ type: 'removed', text: getArrayItem(oldLines, oldIdx) });
        oldIdx++;
      }
    } else {
      // No more old lines - remaining new lines are additions
      if (!matchedNew.has(newIdx)) {
        result.push({ type: 'added', text: getArrayItem(newLines, newIdx) });
      }
      newIdx++;
    }
  }

  return result;
}

/**
 * Compute similarity between two strings (0-1).
 * Uses character-level comparison.
 */
function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Use diff to compute similarity
  const diffs = dmp.diff_main(a, b);
  let commonLength = 0;

  for (const [op, text] of diffs) {
    if (op === 0) {
      commonLength += text.length;
    }
  }

  return (2 * commonLength) / (a.length + b.length);
}

/** Number of context lines to show around changes in hunks */
const CONTEXT_LINES = 3;

/**
 * Group line diffs into hunks with surrounding context.
 *
 * A hunk is a group of consecutive changes with CONTEXT_LINES of
 * unchanged lines before and after. When two change regions are
 * close enough (within 2 * CONTEXT_LINES), they're merged into
 * a single hunk.
 */
export function groupIntoHunks(lineDiffs: LineDiff[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];

  // Track line numbers as we iterate
  let originalLine = 1;
  let currentLine = 1;

  // Build an array with line number information
  const linesWithNumbers = lineDiffs.map((diff) => {
    const result = {
      diff,
      originalLineNumber: diff.type !== 'added' ? originalLine : undefined,
      currentLineNumber: diff.type !== 'removed' ? currentLine : undefined,
    };

    // Advance line counters based on diff type
    if (diff.type === 'same') {
      originalLine++;
      currentLine++;
    } else if (diff.type === 'added') {
      currentLine++;
    } else if (diff.type === 'removed') {
      originalLine++;
    } else if (diff.type === 'modified') {
      originalLine++;
      currentLine++;
    }

    return result;
  });

  // Find change regions (indices where changes occur)
  const changeIndices: number[] = [];
  for (const [index, lineWithNumbers] of linesWithNumbers.entries()) {
    if (lineWithNumbers.diff.type !== 'same') {
      changeIndices.push(index);
    }
  }

  if (changeIndices.length === 0) {
    return []; // No changes, no hunks
  }

  // Group consecutive change indices into ranges
  const changeRanges: { start: number; end: number }[] = [];
  let rangeStart = getArrayItem(changeIndices, 0);
  let rangeEnd = getArrayItem(changeIndices, 0);

  for (let i = 1; i < changeIndices.length; i++) {
    const idx = getArrayItem(changeIndices, i);
    // If this change is close enough to the previous, extend the range
    if (idx - rangeEnd <= 2 * CONTEXT_LINES) {
      rangeEnd = idx;
    } else {
      changeRanges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = idx;
      rangeEnd = idx;
    }
  }
  changeRanges.push({ start: rangeStart, end: rangeEnd });

  // Build hunks from change ranges
  for (const [index, range] of changeRanges.entries()) {
    // Calculate hunk boundaries with context
    const hunkStart = Math.max(0, range.start - CONTEXT_LINES);
    const hunkEnd = Math.min(linesWithNumbers.length - 1, range.end + CONTEXT_LINES);

    // Extract lines for this hunk
    const hunkLines: LineDiff[] = [];
    const originalLines: string[] = [];
    const currentLines: string[] = [];

    let hunkOriginalStart = Number.MAX_SAFE_INTEGER;
    let hunkCurrentStart = Number.MAX_SAFE_INTEGER;
    let hunkOriginalCount = 0;
    let hunkCurrentCount = 0;

    for (let j = hunkStart; j <= hunkEnd; j++) {
      const { diff, originalLineNumber, currentLineNumber } = getArrayItem(linesWithNumbers, j);
      hunkLines.push(diff);

      if (originalLineNumber !== undefined) {
        hunkOriginalStart = Math.min(hunkOriginalStart, originalLineNumber);
        hunkOriginalCount++;
        if (diff.type === 'removed' || diff.type === 'modified') {
          originalLines.push(diff.type === 'modified' ? diff.oldText : diff.text);
        }
      }

      if (currentLineNumber !== undefined) {
        hunkCurrentStart = Math.min(hunkCurrentStart, currentLineNumber);
        hunkCurrentCount++;
        if (diff.type === 'added' || diff.type === 'modified') {
          currentLines.push(diff.type === 'modified' ? diff.newText : diff.text);
        }
      }
    }

    hunks.push({
      index,
      originalStart: hunkOriginalStart === Number.MAX_SAFE_INTEGER ? 1 : hunkOriginalStart,
      originalCount: hunkOriginalCount,
      currentStart: hunkCurrentStart === Number.MAX_SAFE_INTEGER ? 1 : hunkCurrentStart,
      currentCount: hunkCurrentCount,
      lines: hunkLines,
      originalLines,
      currentLines,
    });
  }

  return hunks;
}

/**
 * Get diff statistics from line diff result.
 */
export function getDiffStats(lineDiffs: LineDiff[]): LineDiffStats {
  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const diff of lineDiffs) {
    if (diff.type === 'added') added++;
    else if (diff.type === 'removed') removed++;
    else if (diff.type === 'modified') modified++;
  }

  return { added, removed, modified };
}
