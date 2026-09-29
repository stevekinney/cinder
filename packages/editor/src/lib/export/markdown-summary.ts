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

import type { PersistedThread, ReviewState } from '../comments/types.js';
import { generateChangesSection } from './markdown-summary-changes.js';
import { normalizeDocument } from './normalize-document.js';
import { buildSourceLineMapCached, identitySourceLineMap } from './source-line-map.js';
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
  const originalContent = state.original ?? '';
  const currentContent = state.content;
  const original = normalizeInputs ? normalizeDocument(originalContent) : originalContent;
  const current = normalizeInputs ? normalizeDocument(currentContent) : currentContent;
  const changeCount = appendChangeSection(
    sections,
    originalContent,
    original,
    current,
    normalizeInputs,
    contextLines,
  );
  const threadCount = appendThreadSection(sections, state.threads, {
    includeTimestamps,
    includeAuthorIds,
  });
  const markdown =
    sections.length === 0 ? 'No changes or feedback to report.' : sections.join('\n');

  return {
    markdown,
    stats: {
      changeCount,
      threadCount,
    },
  };
}

function getVisibleThreads(threads: PersistedThread[]): PersistedThread[] {
  return threads.filter((thread) => thread.comments.some((comment) => !comment.deletedAt));
}

function appendChangeSection(
  sections: string[],
  originalContent: string,
  original: string,
  current: string,
  normalizeInputs: boolean,
  contextLines: number,
): number {
  const section = buildChangesSection(
    originalContent,
    original,
    current,
    normalizeInputs,
    contextLines,
  );
  if (!section.markdown) return 0;
  sections.push(section.markdown);
  return section.changeCount;
}

function appendThreadSection(
  sections: string[],
  threads: PersistedThread[],
  options: { includeTimestamps: boolean; includeAuthorIds: boolean },
): number {
  const visibleThreads = getVisibleThreads(threads);
  if (visibleThreads.length === 0) return 0;
  const section = generateThreadsSection(visibleThreads, options);
  sections.push(section.markdown);
  return section.threadCount;
}

function buildChangesSection(
  originalContent: string,
  original: string,
  current: string,
  normalizeInputs: boolean,
  contextLines: number,
): { markdown: string; changeCount: number } {
  if (original === current) return { markdown: '', changeCount: 0 };
  const lineMap = normalizeInputs
    ? buildSourceLineMapCached(originalContent.replace(/\r\n?/g, '\n'), original)
    : identitySourceLineMap(original);
  return generateChangesSection(original, current, contextLines, lineMap);
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
