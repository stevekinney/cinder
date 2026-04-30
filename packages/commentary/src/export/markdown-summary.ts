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

import { computeLineDiff } from '@cinder/markdown/diff/line-diff';
import type { PersistedThread, ReviewState } from '../comments/types.js';
import type { MarkdownSummaryOptions, MarkdownSummaryResult } from './types';

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
  } = options;

  const sections: string[] = [];
  let changeCount = 0;
  let threadCount = 0;

  // Document Changes Section
  const original = state.original ?? '';
  const current = state.content;

  if (original !== current) {
    const changesSection = generateChangesSection(original, current, contextLines);
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

    // Calculate original line number (1-based)
    let originalLineNumber = 1;

    for (let i = 0; i < contextStart; i++) {
      const diff = lineDiffs[i];
      if (!diff) continue;

      if (diff.type === 'same' || diff.type === 'removed' || diff.type === 'modified') {
        originalLineNumber++;
      }
    }

    const startOriginalLine = originalLineNumber;

    // Calculate end line number by counting only lines that exist in the original
    let originalLinesInDisplayRange = 0;
    for (let i = contextStart; i <= contextEnd; i++) {
      const diff = lineDiffs[i];
      if (!diff) continue;

      if (diff.type === 'same' || diff.type === 'removed' || diff.type === 'modified') {
        originalLinesInDisplayRange++;
      }
    }

    const endOriginalLine =
      originalLinesInDisplayRange > 0
        ? startOriginalLine + originalLinesInDisplayRange - 1
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

    // Show what text the comment is about
    const quote = thread.anchor.quote;
    if (quote) {
      lines.push(`### On "${truncate(quote, 60)}"\n`);
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
