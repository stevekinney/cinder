import { computeLineDiff, type LineDiff } from '@lostgradient/markdown';
import { mapNormalizedLineNumber, type SourceLineMap } from './source-line-map.js';

type ChangeRange = { start: number; end: number };

export function generateChangesSection(
  original: string,
  current: string,
  contextLines: number,
  originalLineMap: SourceLineMap,
): { markdown: string; changeCount: number } {
  const lineDiffs = computeLineDiff(original, current);
  const ranges = findChangeRanges(lineDiffs, contextLines);
  return ranges.length === 0
    ? { markdown: '', changeCount: 0 }
    : renderChangeRanges(lineDiffs, ranges, contextLines, originalLineMap);
}

function findChangeRanges(lineDiffs: LineDiff[], contextLines: number): ChangeRange[] {
  const ranges: ChangeRange[] = [];
  let range: ChangeRange | null = null;
  for (let index = 0; index < lineDiffs.length; index++) {
    const diff = lineDiffs[index];
    if (!diff) continue;
    if (diff.type !== 'same') {
      range = range === null ? { start: index, end: index } : { start: range.start, end: index };
      continue;
    }
    if (range === null || shouldMergeRange(lineDiffs, index, range, contextLines)) continue;
    ranges.push(range);
    range = null;
  }
  if (range !== null) ranges.push(range);
  return ranges;
}

function shouldMergeRange(
  lineDiffs: LineDiff[],
  index: number,
  range: ChangeRange,
  contextLines: number,
): boolean {
  const nextChange = lineDiffs.findIndex(
    (diff, nextIndex) => nextIndex > index && diff.type !== 'same',
  );
  return nextChange !== -1 && nextChange - range.end <= contextLines * 2 + 1;
}

function renderChangeRanges(
  lineDiffs: LineDiff[],
  ranges: ChangeRange[],
  contextLines: number,
  originalLineMap: SourceLineMap,
): { markdown: string; changeCount: number } {
  const lines = ['## Changes Made\n', 'The following edits were made to the document:\n'];
  let changeCount = 0;
  for (const range of ranges) {
    const bounds = calculateDisplayBounds(lineDiffs, range, contextLines, originalLineMap);
    lines.push('### Lines ' + bounds.start + '-' + bounds.end + '\n', '```diff');
    const rendered = renderDiffLines(lineDiffs, bounds.contextStart, bounds.contextEnd);
    lines.push(...rendered.lines, '```\n');
    changeCount += rendered.changeCount;
  }
  return { markdown: lines.join('\n'), changeCount };
}

function calculateDisplayBounds(
  lineDiffs: LineDiff[],
  range: ChangeRange,
  contextLines: number,
  originalLineMap: SourceLineMap,
): { start: number; end: number; contextStart: number; contextEnd: number } {
  const contextStart = Math.max(0, range.start - contextLines);
  const contextEnd = Math.min(lineDiffs.length - 1, range.end + contextLines);
  const startNormalizedLine = countOriginalLines(lineDiffs, 0, contextStart);
  const displayOriginalLines = countOriginalLines(lineDiffs, contextStart, contextEnd + 1, 0);
  const endNormalizedLine =
    countOriginalLines(lineDiffs, contextStart, contextEnd + 1, startNormalizedLine) -
    (displayOriginalLines > 0 ? 1 : 0);
  const start = mapNormalizedLineNumber(originalLineMap, startNormalizedLine);
  const end = mapNormalizedLineNumber(originalLineMap, endNormalizedLine);
  return {
    start,
    end: endNormalizedLine >= startNormalizedLine ? end : start,
    contextStart,
    contextEnd,
  };
}

function countOriginalLines(
  lineDiffs: LineDiff[],
  start: number,
  end: number,
  initial = 1,
): number {
  let count = initial;
  for (const diff of lineDiffs.slice(start, end)) {
    if (diff.type === 'same' || diff.type === 'removed' || diff.type === 'modified') count++;
  }
  return count;
}

function renderDiffLines(
  lineDiffs: LineDiff[],
  start: number,
  end: number,
): { lines: string[]; changeCount: number } {
  const lines: string[] = [];
  let changeCount = 0;
  for (const diff of lineDiffs.slice(start, end + 1)) {
    if (diff.type === 'same') lines.push(' ' + diff.text);
    if (diff.type === 'added') {
      lines.push('+' + diff.text);
      changeCount++;
    }
    if (diff.type === 'removed') {
      lines.push('-' + diff.text);
      changeCount++;
    }
    if (diff.type === 'modified') {
      lines.push('-' + diff.oldText, '+' + diff.newText);
      changeCount++;
    }
  }
  return { lines, changeCount };
}
