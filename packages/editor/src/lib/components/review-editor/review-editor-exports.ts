/**
 * Pure export utilities for ReviewEditor.
 *
 * These functions work with ReviewState and don't require reactive context.
 * They are stateless wrappers around the core export functions from @cinder/commentary/export.
 *
 * @module
 */

import type { ReviewState, Thread } from '../../comments/index.ts';
import {
  generateCommentsExport,
  generateMarkdownSummary,
  generateUnifiedDiff,
  type MarkdownSummaryOptions,
  type MarkdownSummaryResult,
  type UnifiedDiffOptions,
  type UnifiedDiffResult,
} from '../../export/index.ts';

/**
 * FormData structure returned by buildFormData().
 * Matches the hidden input values for form participation.
 */
export type ReviewFormData = {
  /** Original/baseline content */
  original: string;
  /** Current edited content */
  current: string;
  /** Serialized comment threads as JSON */
  comments: string;
  /** Unified diff between original and current */
  diff: string;
  /** LLM-optimized summary markdown */
  summary: string;
};

/**
 * Build form data from review state.
 *
 * This pure function creates the same data structure that would be submitted
 * via hidden form inputs. Use for programmatic API submissions.
 *
 * @param state - The current review state
 * @returns Form data object matching hidden input values
 */
export function buildFormData(state: ReviewState): ReviewFormData {
  return {
    original: state.original ?? '',
    current: state.content,
    comments: JSON.stringify(state.threads),
    diff: generateUnifiedDiff(state).diff,
    summary: generateMarkdownSummary(state).markdown,
  };
}

/**
 * Build form data from individual values.
 *
 * Use this when you have the raw values but not a full ReviewState.
 *
 * @param original - Original/baseline content
 * @param current - Current content
 * @param threads - Comment threads
 * @returns Form data object matching hidden input values
 */
export function buildFormDataFromValues(
  original: string,
  current: string,
  threads: Thread[],
): ReviewFormData {
  const state: ReviewState = {
    schemaVersion: 4,
    content: current,
    original,
    threads: threads.map((t) => ({
      ...t,
      anchor: {
        quote: t.anchor.quote,
        prefix: t.anchor.prefix,
        suffix: t.anchor.suffix,
        status: t.anchor.status,
        blockId: t.anchor.blockId,
        originalPosition: t.anchor.originalPosition,
        originalQuote: t.anchor.originalQuote,
        lastKnownOffset: t.anchor.lastKnownOffset,
      },
    })),
    updatedAt: new Date().toISOString(),
  };

  return buildFormData(state);
}

/**
 * Export an LLM-optimized Markdown summary of the review.
 *
 * @param state - The review state to export
 * @param options - Optional formatting options
 * @returns Summary result with markdown content
 */
export function exportMarkdownSummary(
  state: ReviewState,
  options?: MarkdownSummaryOptions,
): MarkdownSummaryResult {
  return generateMarkdownSummary(state, options);
}

/**
 * Export a Git-compatible unified diff.
 *
 * @param state - The review state to export
 * @param options - Optional diff options (filename, context lines)
 * @returns Diff result that can be applied with `git apply`
 */
export function exportUnifiedDiff(
  state: ReviewState,
  options?: UnifiedDiffOptions,
): UnifiedDiffResult {
  return generateUnifiedDiff(state, options);
}

/**
 * Export comments as markdown.
 *
 * @param state - The review state to export
 * @returns Markdown-formatted comments
 */
export function exportCommentsMarkdown(state: ReviewState): string {
  return generateCommentsExport(state).markdown;
}

/**
 * Get summary content without the heading.
 *
 * The heading is useful for clipboard exports but redundant in UI previews
 * since the view tab already indicates this is a summary.
 *
 * @param state - The review state
 * @returns Summary markdown without "# Review Summary" heading
 */
export function getSummaryContentWithoutHeading(state: ReviewState): string {
  const result = generateMarkdownSummary(state);
  return result.markdown.replace(/^# Review Summary\n+/, '');
}
