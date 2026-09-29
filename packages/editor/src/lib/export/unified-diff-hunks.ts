import type { LineChange, SplitContent } from './unified-diff-lines.js';

export interface DiffHunk {
  originalStart: number;
  originalCount: number;
  currentStart: number;
  currentCount: number;
  lines: string[];
}

export function createHunks(
  changes: LineChange[],
  contextLines: number,
  original: SplitContent,
  current: SplitContent,
): DiffHunk[] {
  const changeIndices = changes.flatMap((change, index) => (change.type === 'same' ? [] : [index]));
  if (changeIndices.length === 0) return [];

  const hunks: DiffHunk[] = [];
  let hunkStart = Math.max(0, changeIndices[0]! - contextLines);
  let hunkEnd = Math.min(changes.length - 1, changeIndices[0]! + contextLines);

  for (const changeIndex of changeIndices.slice(1)) {
    const changeStart = changeIndex - contextLines;
    if (changeStart <= hunkEnd + 1) {
      hunkEnd = Math.min(changes.length - 1, changeIndex + contextLines);
      continue;
    }
    hunks.push(buildHunk(changes, hunkStart, hunkEnd, original, current));
    hunkStart = Math.max(0, changeStart);
    hunkEnd = Math.min(changes.length - 1, changeIndex + contextLines);
  }

  hunks.push(buildHunk(changes, hunkStart, hunkEnd, original, current));
  return hunks;
}

function buildHunk(
  changes: LineChange[],
  start: number,
  end: number,
  original: SplitContent,
  current: SplitContent,
): DiffHunk {
  const lines: string[] = [];
  const state = { originalStart: 0, originalCount: 0, currentStart: 0, currentCount: 0 };

  for (const change of changes.slice(start, end + 1)) {
    appendChange(lines, change, original, current, state);
  }

  return {
    originalStart: state.originalStart || (state.originalCount === 0 ? 0 : 1),
    originalCount: state.originalCount,
    currentStart: state.currentStart || (state.currentCount === 0 ? 0 : 1),
    currentCount: state.currentCount,
    lines,
  };
}

function appendChange(
  lines: string[],
  change: LineChange,
  original: SplitContent,
  current: SplitContent,
  state: {
    originalStart: number;
    originalCount: number;
    currentStart: number;
    currentCount: number;
  },
): void {
  const prefix = change.type === 'same' ? ' ' : change.type === 'removed' ? '-' : '+';
  lines.push(`${prefix}${change.text}`);
  if (change.type !== 'added') {
    state.originalStart = setStart(state.originalStart, change.originalIndex);
    state.originalCount++;
    if (change.type === 'removed') appendNoNewlineMarker(lines, original, change.originalIndex);
  }
  if (change.type !== 'removed') {
    state.currentStart = setStart(state.currentStart, change.currentIndex);
    state.currentCount++;
    if (change.type === 'added') appendNoNewlineMarker(lines, current, change.currentIndex);
  }
}

function setStart(current: number, index: number | null): number {
  return current === 0 && index !== null ? index + 1 : current;
}

function appendNoNewlineMarker(lines: string[], content: SplitContent, index: number | null): void {
  if (!content.hasTrailingNewline && index === content.lines.length - 1) {
    lines.push('\\ No newline at end of file');
  }
}
