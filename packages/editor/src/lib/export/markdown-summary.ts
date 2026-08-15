/**
 * Generate LLM-optimized Markdown summary from ReviewState.
 *
 * Produces a structured Markdown document that an LLM can parse
 * to understand what feedback was given and what actions to take.
 *
 * Design principles:
 * - Action-oriented: Organize by "what to do" not "what data exists"
 * - Minimal noise: No timestamps, author IDs, or statistics by default
 * - Clear structure: Direct edits vs comments requiring action
 */

import { computeLineDiff } from '@lostgradient/markdown/diff/line-diff';
import type { PersistedThread, ReviewState } from '../comments/types.js';
import { normalizeDocument } from './normalize-document.js';
import {
  buildSourceLineMap,
  identitySourceLineMap,
  mapNormalizedLineNumber,
} from './source-line-map.js';
import type { MarkdownSummaryOptions, MarkdownSummaryResult } from './types.js';

/**
 * Generate an LLM-optimized Markdown summary from review state.
 *
 * The output is structured for actionability:
 * - "Changes Made" shows direct edits already applied to the document
 * - "Feedback" shows comments on specific text that need attention
 *
 * @param state - The current review state
 * @param options - Configuration options for summary generation
 * @returns MarkdownSummaryResult with Markdown string and statistics
 *
 * @example
 * ```typescript
 * const result = generateMarkdownSummary(state);
 * // Send result.markdown to an LLM for revision
 * ```
 */
export function generateMarkdownSummary(
  state: ReviewState,
  options: MarkdownSummaryOptions = {},
): MarkdownSummaryResult {
  const {
    // Defaults optimized for LLM consumption - minimal noise
    includeTimestamps = false,
    includeAuthorIds = false,
    contextLines = 2,
    // Mirrors generateUnifiedDiff's own default: without this, a document
    // whose front matter and body are byte-identical to another can still be
    // reported as a real edit purely from CRLF or blank-line formatting
    // differences that normalizeDocument treats as equivalent everywhere else
    // in this package (cinder#1318).
    normalizeInputs = true,
  } = options;

  const sections: string[] = [];
  let changeCount = 0;
  let threadCount = 0;

  // Document Changes Section
  const originalContent = state.original ?? '';
  const currentContent = state.content;

  // Normalize both inputs the same way generateUnifiedDiff does, so the two
  // exports agree about whether an edit happened. Without this,
  // computeLineDiff runs on raw strings with no CRLF handling and no
  // front-matter awareness, and can disagree with generateUnifiedDiff about
  // documents that are semantically identical.
  //
  // Deliberately NOT mirroring generateUnifiedDiff's own normalizeInputs:
  // false branch here, which still folds CRLF to LF even with normalization
  // "off" — a pre-existing wrinkle in that function, not a contract this new
  // option needs to inherit. `normalizeInputs: false` promises a raw,
  // verbatim comparison (see MarkdownSummaryOptions' doc comment); honoring
  // that for CRLF as well as Markdown canonicalization is what makes the
  // option's own contract true rather than only true for some formatting
  // differences and not others.
  const original = normalizeInputs ? normalizeDocument(originalContent) : originalContent;
  const current = normalizeInputs ? normalizeDocument(currentContent) : currentContent;

  if (original !== current) {
    // `### Lines X-Y` below is computed against `original` -- the
    // *normalized* document -- but reported to the caller as a line number
    // in their own `state.original`. Normalization can change the line
    // count (collapsed blank runs, a dropped front-matter separator, a
    // folded Setext underline), so map back to source before rendering the
    // heading (cinder#1324). `normalizeInputs: false` needs no mapping:
    // `original` above is the caller's own text, so the identity map is
    // exact.
    const originalLineMap = normalizeInputs
      ? buildSourceLineMap(originalContent.replace(/\r\n?/g, '\n'), original)
      : identitySourceLineMap(original);
    const changesSection = generateChangesSection(original, current, contextLines, originalLineMap);
    if (changesSection.markdown) {
      sections.push(changesSection.markdown);
      changeCount = changesSection.changeCount;
    }
  }

  // Comment Threads Section - only include threads with visible (non-deleted) comments
  const visibleThreads = state.threads.filter((thread) => {
    return thread.comments.some((comment) => !comment.deletedAt);
  });

  if (visibleThreads.length > 0) {
    const threadsSection = generateThreadsSection(visibleThreads, {
      includeTimestamps,
      includeAuthorIds,
    });
    sections.push(threadsSection.markdown);
    threadCount = threadsSection.threadCount;
  }

  // Build final output
  let markdown: string;
  if (sections.length === 0) {
    markdown = 'No changes or feedback to report.';
  } else {
    markdown = sections.join('\n');
  }

  return {
    markdown,
    stats: {
      changeCount,
      threadCount,
    },
  };
}

/**
 * Generate the document changes section.
 */
function generateChangesSection(
  original: string,
  current: string,
  contextLines: number,
  originalLineMap: number[],
): { markdown: string; changeCount: number } {
  const lineDiffs = computeLineDiff(original, current);

  // Find change ranges
  const changeRanges: { start: number; end: number }[] = [];
  let currentRange: { start: number; end: number } | null = null;

  for (let i = 0; i < lineDiffs.length; i++) {
    const diff = lineDiffs[i];
    if (!diff) continue;

    const isChange = diff.type !== 'same';

    if (isChange) {
      if (currentRange === null) {
        currentRange = { start: i, end: i };
      } else {
        currentRange.end = i;
      }
    } else if (currentRange !== null) {
      // Check if we should merge with next change (within context distance)
      const nextChangeIndex = lineDiffs.findIndex((d, idx) => idx > i && d.type !== 'same');
      if (nextChangeIndex !== -1 && nextChangeIndex - currentRange.end <= contextLines * 2 + 1) {
        // Continue the current range
        continue;
      }
      changeRanges.push(currentRange);
      currentRange = null;
    }
  }

  if (currentRange !== null) {
    changeRanges.push(currentRange);
  }

  if (changeRanges.length === 0) {
    return { markdown: '', changeCount: 0 };
  }

  const lines: string[] = ['## Changes Made\n'];
  lines.push('The following edits were made to the document:\n');
  let changeCount = 0;

  for (const range of changeRanges) {
    // Add context before
    const contextStart = Math.max(0, range.start - contextLines);
    const contextEnd = Math.min(lineDiffs.length - 1, range.end + contextLines);

    // Calculate the normalized-space original line number (1-based) that
    // `contextStart` starts at, by counting how many original-side lines
    // precede it -- same technique `buildHunk` in unified-diff.ts uses.
    let normalizedOriginalLineNumber = 1;

    for (let i = 0; i < contextStart; i++) {
      const diff = lineDiffs[i];
      if (!diff) continue;

      if (diff.type === 'same' || diff.type === 'removed' || diff.type === 'modified') {
        normalizedOriginalLineNumber++;
      }
    }

    const startNormalizedLine = normalizedOriginalLineNumber;

    // Find the *last* original-side line displayed in this range (not just
    // a count): with a collapsed run inside the display range, "start +
    // count - 1" arithmetic in normalized-space would still be wrong once
    // mapped back to source, since normalized-space and source-space counts
    // can differ within the same range (cinder#1324).
    let originalLinesInDisplayRange = 0;
    let endNormalizedLine = startNormalizedLine;
    let runningNormalizedLine = startNormalizedLine;
    for (let i = contextStart; i <= contextEnd; i++) {
      const diff = lineDiffs[i];
      if (!diff) continue;

      if (diff.type === 'same' || diff.type === 'removed' || diff.type === 'modified') {
        originalLinesInDisplayRange++;
        endNormalizedLine = runningNormalizedLine;
        runningNormalizedLine++;
      }
    }

    const startOriginalLine = mapNormalizedLineNumber(originalLineMap, startNormalizedLine);
    const endOriginalLine =
      originalLinesInDisplayRange > 0
        ? mapNormalizedLineNumber(originalLineMap, endNormalizedLine)
        : startOriginalLine;

    lines.push(`### Lines ${startOriginalLine}-${endOriginalLine}\n`);
    lines.push('```diff');

    for (let i = contextStart; i <= contextEnd; i++) {
      const diff = lineDiffs[i];
      if (!diff) continue;

      switch (diff.type) {
        case 'same':
          lines.push(` ${diff.text}`);
          break;
        case 'added':
          lines.push(`+${diff.text}`);
          changeCount++;
          break;
        case 'removed':
          lines.push(`-${diff.text}`);
          changeCount++;
          break;
        case 'modified':
          lines.push(`-${diff.oldText}`);
          lines.push(`+${diff.newText}`);
          changeCount++;
          break;
      }
    }

    lines.push('```\n');
  }

  return { markdown: lines.join('\n'), changeCount };
}

/**
 * Generate the comment threads section.
 */
function generateThreadsSection(
  threads: PersistedThread[],
  options: { includeTimestamps: boolean; includeAuthorIds: boolean },
): { markdown: string; threadCount: number } {
  const lines: string[] = ['## Feedback\n'];
  lines.push('The following comments were made and may require action:\n');

  for (const thread of threads) {
    const visibleComments = thread.comments.filter((c) => !c.deletedAt);
    if (visibleComments.length === 0) continue;

    // Show what text the comment is about. The summary carries no line numbers,
    // so an orphaned thread's only misleading signal is the bare quote implying
    // the text is still there to act on; say that it isn't.
    const quote = thread.anchor.quote;
    if (quote) {
      const missing = thread.anchor.status === 'orphaned' ? ' (no longer in the document)' : '';
      lines.push(`### On "${truncate(quote, 60)}"${missing}\n`);
    } else {
      // Document-level comment
      lines.push(`### Document-level feedback\n`);
    }

    for (const comment of visibleComments) {
      let prefix = '';
      if (options.includeAuthorIds) {
        prefix = `**${comment.authorId}:** `;
      }
      if (options.includeTimestamps) {
        prefix += `(${comment.createdAt}) `;
      }

      // Format comment body as blockquote
      const bodyLines = comment.body.split('\n');
      lines.push(`${prefix}> ${bodyLines.join('\n> ')}`);
      lines.push('');
    }
  }

  return {
    markdown: lines.join('\n'),
    threadCount: threads.length,
  };
}

/**
 * Truncate text to a maximum length.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
