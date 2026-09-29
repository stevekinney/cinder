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

export { getDiffStats } from './line-diff-stats.js';

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
    return splitLines(original).map((text) => ({ type: 'same' as const, text }));
  }

  // Use diff-match-patch's line diff mode
  const { chars1, chars2, lineArray } = dmp['diff_linesToChars_'](original, current);
  const lineDiffs = dmp.diff_main(chars1, chars2, false);
  dmp.diff_cleanupSemantic(lineDiffs);
  dmp['diff_charsToLines_'](lineDiffs, lineArray);

  const result: LineDiff[] = [];

  for (let i = 0; i < lineDiffs.length; i++) {
    const [op, text] = getArrayItem(lineDiffs, i);
    if (processDiffChunk(op, text, lineDiffs[i + 1], result)) i++;
  }

  return result;
}

function processDiffChunk(
  op: number,
  text: string,
  next: [number, string] | undefined,
  result: LineDiff[],
): boolean {
  const lines = splitLines(text);
  if (op === 0) appendLines(result, lines, 'same');
  if (op === 1) appendLines(result, lines, 'added');
  if (op !== -1) return false;
  if (next?.[0] === 1) {
    processModification(lines, splitLines(next[1]), result);
    return true;
  }
  appendLines(result, lines, 'removed');
  return false;
}

function appendLines(
  result: LineDiff[],
  lines: string[],
  type: 'same' | 'added' | 'removed',
): void {
  for (const text of lines) result.push({ type, text });
}

/**
 * Split text by newlines, handling trailing newline correctly.
 */
function splitLines(text: string): string[] {
  const lines = text.split('\n');
  // If text ends with newline, remove the trailing empty string
  if (lines.length > 1 && lines[lines.length - 1] === '') {
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
    const bestMatchIdx = findBestMatch(oldLine, newLines, minNewIdx, matchedNew);
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
    const step = appendAlignment(
      result,
      oldLines,
      newLines,
      oldMatches,
      matchedNew,
      oldIdx,
      newIdx,
    );
    oldIdx = step.oldIndex;
    newIdx = step.newIndex;
  }

  return result;
}

function findBestMatch(
  oldLine: string,
  newLines: string[],
  minNewIdx: number,
  matchedNew: Set<number>,
): number {
  let bestMatchIdx = -1;
  let bestSimilarity = 0.5;
  for (let newIdx = minNewIdx; newIdx < newLines.length; newIdx++) {
    if (matchedNew.has(newIdx)) continue;
    const similarity = computeSimilarity(oldLine, getArrayItem(newLines, newIdx));
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatchIdx = newIdx;
      if (similarity === 1) break;
    }
  }
  return bestMatchIdx;
}

function appendAlignment(
  result: AlignmentResult[],
  oldLines: string[],
  newLines: string[],
  oldMatches: (number | null)[],
  matchedNew: Set<number>,
  oldIndex: number,
  newIndex: number,
): { oldIndex: number; newIndex: number } {
  if (oldIndex >= oldLines.length) {
    if (!matchedNew.has(newIndex))
      result.push({ type: 'added', text: getArrayItem(newLines, newIndex) });
    return { oldIndex, newIndex: newIndex + 1 };
  }
  const matchIndex = getArrayItem(oldMatches, oldIndex);
  if (matchIndex === null) {
    result.push({ type: 'removed', text: getArrayItem(oldLines, oldIndex) });
    return { oldIndex: oldIndex + 1, newIndex };
  }
  while (newIndex < matchIndex) {
    if (!matchedNew.has(newIndex))
      result.push({ type: 'added', text: getArrayItem(newLines, newIndex) });
    newIndex++;
  }
  const oldLine = getArrayItem(oldLines, oldIndex);
  const newLine = getArrayItem(newLines, matchIndex);
  result.push(
    oldLine === newLine
      ? { type: 'same', text: oldLine }
      : { type: 'modified', oldText: oldLine, newText: newLine },
  );
  return { oldIndex: oldIndex + 1, newIndex: matchIndex + 1 };
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
  const numberedLines = numberLines(lineDiffs);
  const ranges = groupChangeRanges(numberedLines);
  return ranges.map((range, index) => buildHunk(numberedLines, range, index));
}

type NumberedLine = {
  diff: LineDiff;
  originalLineNumber?: number | undefined;
  currentLineNumber?: number | undefined;
};

function numberLines(lineDiffs: LineDiff[]): NumberedLine[] {
  let originalLine = 1;
  let currentLine = 1;
  return lineDiffs.map((diff) => {
    const numbered = {
      diff,
      originalLineNumber: diff.type === 'added' ? undefined : originalLine,
      currentLineNumber: diff.type === 'removed' ? undefined : currentLine,
    };
    if (diff.type !== 'added') originalLine++;
    if (diff.type !== 'removed') currentLine++;
    return numbered;
  });
}

function groupChangeRanges(lines: NumberedLine[]): { start: number; end: number }[] {
  const indices = lines.flatMap((line, index) => (line.diff.type === 'same' ? [] : [index]));
  if (indices.length === 0) return [];
  const ranges: { start: number; end: number }[] = [];
  let start = getArrayItem(indices, 0);
  let end = start;
  for (const index of indices.slice(1)) {
    if (index - end <= 2 * CONTEXT_LINES) end = index;
    else {
      ranges.push({ start, end });
      start = index;
      end = index;
    }
  }
  ranges.push({ start, end });
  return ranges;
}

function buildHunk(
  lines: NumberedLine[],
  range: { start: number; end: number },
  index: number,
): DiffHunk {
  const start = Math.max(0, range.start - CONTEXT_LINES);
  const end = Math.min(lines.length - 1, range.end + CONTEXT_LINES);
  const selected = lines.slice(start, end + 1);
  const originalLines = selected.flatMap(({ diff }) =>
    diff.type === 'modified' ? [diff.oldText] : diff.type === 'removed' ? [diff.text] : [],
  );
  const currentLines = selected.flatMap(({ diff }) =>
    diff.type === 'modified' ? [diff.newText] : diff.type === 'added' ? [diff.text] : [],
  );
  const originalStart = selected.find((line) => line.originalLineNumber)?.originalLineNumber ?? 1;
  const currentStart = selected.find((line) => line.currentLineNumber)?.currentLineNumber ?? 1;
  return {
    index,
    originalStart,
    originalCount: selected.filter((line) => line.originalLineNumber !== undefined).length,
    currentStart,
    currentCount: selected.filter((line) => line.currentLineNumber !== undefined).length,
    lines: selected.map(({ diff }) => diff),
    originalLines,
    currentLines,
  };
}
