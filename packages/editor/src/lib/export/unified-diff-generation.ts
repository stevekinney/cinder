import { parseFrontMatter } from '@lostgradient/markdown';
import type { ReviewState } from '../comments/types.js';
import { normalizeDocument } from './normalize-document.js';
import {
  buildSourceLineMapCached,
  identitySourceLineMap,
  mapNormalizedLineNumber,
  type SourceLineMap,
} from './source-line-map.js';
import type { UnifiedDiffOptions, UnifiedDiffResult } from './types.js';
import { createHunks, type DiffHunk } from './unified-diff-hunks.js';
import {
  computeLineChanges,
  representTrailingNewlineChange,
  splitIntoLines,
  type SplitContent,
} from './unified-diff-lines.js';

interface DiffInputs {
  original: string;
  current: string;
  originalMap: SourceLineMap;
  currentMap: SourceLineMap;
  originalSplit: SplitContent;
  currentSplit: SplitContent;
}

/**
 * Generate a Git-compatible unified diff from review state.
 *
 * @param state - The current review state containing original and current content
 * @param options - Configuration options for diff generation
 * @returns UnifiedDiffResult with diff string and statistics
 */
export function generateUnifiedDiff(
  state: ReviewState,
  options: UnifiedDiffOptions = {},
): UnifiedDiffResult {
  const inputs = prepareDiffInputs(state, options);
  if (inputs.original === inputs.current) return emptyDiffResult();
  const changes = computeLineChanges(inputs.originalSplit.lines, inputs.currentSplit.lines);
  representTrailingNewlineChange(changes, inputs.originalSplit, inputs.currentSplit);
  const hunks = createHunks(
    changes,
    options.contextLines ?? 3,
    inputs.originalSplit,
    inputs.currentSplit,
  );
  return renderDiff(hunks, inputs, options);
}

function prepareDiffInputs(state: ReviewState, options: UnifiedDiffOptions): DiffInputs {
  const originalContent = state.original ?? '';
  const currentContent = includeFrontMatter(state, options)
    ? addFrontMatter(state.content, state.frontMatterRaw!)
    : state.content;
  const original = normalizeContent(originalContent, options.normalizeInputs ?? true);
  const current = normalizeContent(currentContent, options.normalizeInputs ?? true);
  const originalMap = buildLineMap(originalContent, original, options.normalizeInputs ?? true);
  const currentMap = buildLineMap(currentContent, current, options.normalizeInputs ?? true);
  return {
    original,
    current,
    originalMap,
    currentMap,
    originalSplit: splitIntoLines(original, options.normalizeInputs ?? true),
    currentSplit: splitIntoLines(current, options.normalizeInputs ?? true),
  };
}

function includeFrontMatter(state: ReviewState, options: UnifiedDiffOptions): boolean {
  return Boolean(
    options.includeFrontMatter &&
    state.frontMatterRaw &&
    !parseFrontMatter(state.content).fencePresent,
  );
}

function addFrontMatter(content: string, frontMatter: string): string {
  return `---\n${frontMatter}\n---\n\n${content}`;
}

function normalizeContent(content: string, shouldNormalize: boolean): string {
  return shouldNormalize ? normalizeDocument(content) : content.replace(/\r\n?/g, '\n');
}

function buildLineMap(source: string, normalized: string, shouldNormalize: boolean): SourceLineMap {
  return shouldNormalize
    ? buildSourceLineMapCached(source.replace(/\r\n?/g, '\n'), normalized)
    : identitySourceLineMap(normalized);
}

function renderDiff(
  hunks: DiffHunk[],
  inputs: DiffInputs,
  options: UnifiedDiffOptions,
): UnifiedDiffResult {
  const lines = [
    `--- ${options.originalPath ?? 'a/document.md'}`,
    `+++ ${options.currentPath ?? 'b/document.md'}`,
  ];
  let additions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    lines.push(formatHeader(hunk, inputs));
    lines.push(...hunk.lines);
    additions += hunk.lines.filter(
      (line) => line.startsWith('+') && !line.startsWith('+++'),
    ).length;
    deletions += hunk.lines.filter(
      (line) => line.startsWith('-') && !line.startsWith('---'),
    ).length;
  }
  return {
    diff: hunks.length > 0 ? `${lines.join('\n')}\n` : '',
    stats: { additions, deletions, hunks: hunks.length },
  };
}

function formatHeader(hunk: DiffHunk, inputs: DiffInputs): string {
  const originalStart = mapStart(inputs.originalMap, hunk.originalStart);
  const currentStart = mapStart(inputs.currentMap, hunk.currentStart);
  return `@@ -${originalStart},${hunk.originalCount} +${currentStart},${hunk.currentCount} @@`;
}

function mapStart(map: SourceLineMap, start: number): number {
  return start === 0 ? 0 : mapNormalizedLineNumber(map, start);
}

function emptyDiffResult(): UnifiedDiffResult {
  return { diff: '', stats: { additions: 0, deletions: 0, hunks: 0 } };
}
