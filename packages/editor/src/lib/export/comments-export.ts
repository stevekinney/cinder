/**
 * Generate LLM-optimized exports of comment threads.
 *
 * Provides two export formats:
 * 1. Markdown: Human and LLM readable format with blockquotes for highlighted text
 * 2. JSON: Structured format for programmatic consumption
 *
 * Both formats support:
 * - Text-anchored comments (with highlighted text and location)
 * - Document-level comments (general feedback on the entire document)
 */

import type { PersistedAnchor, PersistedThread, ReviewState } from '../comments/types.js';
import type {
  CommentsExportOptions,
  CommentsExportResult,
  CommentsJSONOptions,
  CommentsJSONResult,
  ExportedComment,
  ExportedSelection,
  ExportedThread,
} from './types.js';

/**
 * Check if an anchor is a document-level anchor.
 * Duplicated from comments/types to avoid circular dependency — keep the two in
 * step. The quote-less case covers reviews persisted before `getState()`
 * recorded `type`; see the original for why that shape can only be a document
 * anchor.
 */
function isDocumentAnchor(anchor: PersistedAnchor): boolean {
  if (anchor.type === 'document') return true;
  return anchor.type === undefined && !anchor.quote;
}

/**
 * Check whether a thread's quoted text is missing from the document.
 *
 * Every position an orphaned anchor carries (`lastKnownOffset`,
 * `originalPosition`) describes where the text used to be, and the quote
 * describes text that is no longer there. Presenting either as current invites
 * a reader, human or model, to apply the feedback at a location that now holds
 * something else. Document-level anchors are excluded because they are never
 * re-anchored, so their status says nothing about the document.
 */
function isOrphanedAnchor(anchor: PersistedAnchor): boolean {
  return anchor.status === 'orphaned' && !isDocumentAnchor(anchor);
}

/**
 * Generate an LLM-optimized Markdown export of comment threads.
 *
 * Supports both text-anchored comments (with blockquoted selections) and
 * document-level comments (general feedback on the entire document).
 *
 * @param state - The current review state
 * @param options - Configuration options for export generation
 * @returns CommentsExportResult with Markdown string and statistics
 *
 * @example
 * ```typescript
 * const result = generateCommentsExport(state);
 * // Send result.markdown to an LLM for analysis
 * console.log(`Exported ${result.stats.commentCount} comments`);
 * ```
 */
export function generateCommentsExport(
  state: ReviewState,
  options: CommentsExportOptions = {},
): CommentsExportResult {
  const { includeTimestamps = true, includeAuthorIds = true } = options;

  // Filter to threads with visible (non-deleted) comments
  const threads = state.threads.filter((thread) => {
    return thread.comments.some((comment) => !comment.deletedAt);
  });

  if (threads.length === 0) {
    return {
      markdown: '# Comments\n\nNo comments to export.',
      stats: {
        threadCount: 0,
        commentCount: 0,
        documentCommentCount: 0,
      },
    };
  }

  // Separate document-level and text-anchored threads
  const documentThreads = threads.filter((t) => isDocumentAnchor(t.anchor));
  const textThreads = threads.filter((t) => !isDocumentAnchor(t.anchor));

  const lines: string[] = [];
  let totalCommentCount = 0;
  let documentCommentCount = 0;

  // Header with brief explanation for LLM
  lines.push('# Review Comments\n');

  // Document-level comments first
  if (documentThreads.length > 0) {
    lines.push('## Document-Level Comments\n');
    lines.push('General feedback about the entire document:\n');

    for (const thread of documentThreads) {
      const visibleComments = thread.comments.filter((c) => !c.deletedAt);
      if (visibleComments.length === 0) continue;

      documentCommentCount += visibleComments.length;
      totalCommentCount += visibleComments.length;

      lines.push(formatDocumentThread(visibleComments, { includeTimestamps, includeAuthorIds }));
    }
  }

  // Text-anchored comments
  if (textThreads.length > 0) {
    if (documentThreads.length > 0) {
      lines.push('## Text-Anchored Comments\n');
    }

    lines.push('Comments on specific text selections:\n');

    // Sort text threads by position (line number or offset)
    const sortedThreads = textThreads.toSorted((a, b) => {
      const lineA = a.anchor.originalPosition?.line ?? a.anchor.lastKnownOffset ?? 0;
      const lineB = b.anchor.originalPosition?.line ?? b.anchor.lastKnownOffset ?? 0;
      return lineA - lineB;
    });

    for (const thread of sortedThreads) {
      const visibleComments = thread.comments.filter((c) => !c.deletedAt);
      if (visibleComments.length === 0) continue;

      totalCommentCount += visibleComments.length;

      // Generate thread entry
      lines.push(formatThread(thread, visibleComments, { includeTimestamps, includeAuthorIds }));
    }
  }

  // Add summary at the end
  lines.push('---\n');
  lines.push(`**Total threads:** ${threads.length}`);
  lines.push(`**Total comments:** ${totalCommentCount}`);
  if (documentCommentCount > 0) {
    lines.push(`**Document-level comments:** ${documentCommentCount}`);
  }

  return {
    markdown: lines.join('\n'),
    stats: {
      threadCount: threads.length,
      commentCount: totalCommentCount,
      documentCommentCount,
    },
  };
}

/**
 * Generate a JSON export of comment threads.
 *
 * Provides a structured format for programmatic consumption, with separate
 * handling for text-anchored and document-level comments.
 *
 * @param state - The current review state
 * @param options - Configuration options for export generation
 * @returns CommentsJSONResult with JSON string, data object, and statistics
 */
export function generateCommentsJSON(
  state: ReviewState,
  options: CommentsJSONOptions = {},
): CommentsJSONResult {
  const { includeTimestamps = true, includeAuthorIds = true } = options;

  // Filter to threads with visible (non-deleted) comments
  const threads = state.threads.filter((thread) => {
    return thread.comments.some((comment) => !comment.deletedAt);
  });

  const exportedThreads: ExportedThread[] = [];
  let totalCommentCount = 0;
  let documentThreadCount = 0;

  for (const thread of threads) {
    const visibleComments = thread.comments.filter((c) => !c.deletedAt);
    if (visibleComments.length === 0) continue;

    totalCommentCount += visibleComments.length;
    const isDocument = isDocumentAnchor(thread.anchor);
    if (isDocument) documentThreadCount++;

    const exportedComments: ExportedComment[] = visibleComments.map((comment) => {
      const exported: ExportedComment = {
        id: comment.id,
        body: comment.body,
      };
      if (includeAuthorIds) exported.authorId = comment.authorId;
      if (includeTimestamps) {
        exported.createdAt = comment.createdAt;
        if (comment.editedAt) exported.updatedAt = comment.editedAt;
      }
      return exported;
    });

    const exportedThread: ExportedThread = {
      id: thread.id,
      type: isDocument ? 'document' : 'text',
      comments: exportedComments,
    };

    // Add selection info for text-anchored threads. An orphaned thread keeps
    // its comments and its quote, but reports both the status and the fact that
    // the offsets are historical rather than a place to act on.
    if (!isDocument) {
      if (isOrphanedAnchor(thread.anchor)) {
        exportedThread.status = 'orphaned';
        const lastKnownSelection = buildLastKnownSelection(thread.anchor);
        if (lastKnownSelection) exportedThread.lastKnownSelection = lastKnownSelection;
      } else {
        const selection: ExportedSelection = {
          text: thread.anchor.quote,
          from: thread.anchor.lastKnownOffset ?? 0,
          to: (thread.anchor.lastKnownOffset ?? 0) + thread.anchor.quote.length,
        };
        if (thread.anchor.originalPosition) {
          selection.line = thread.anchor.originalPosition.line;
          selection.column = thread.anchor.originalPosition.column;
        }
        exportedThread.selection = selection;
      }
    }

    exportedThreads.push(exportedThread);
  }

  const data = { threads: exportedThreads };

  return {
    json: JSON.stringify(data, null, 2),
    data,
    stats: {
      threadCount: exportedThreads.length,
      commentCount: totalCommentCount,
      documentThreadCount,
    },
  };
}

/**
 * Describe where an orphaned thread's quote was last seen, or `undefined` when
 * the anchor records no offset at all.
 *
 * `lastKnownOffset` is optional, so a review persisted before it was recorded
 * carries none. Defaulting it to `0` would report the quote as last seen at the
 * very start of the document — a claim nothing on the anchor supports, and one
 * a consumer cannot check, because the quote is by definition no longer in the
 * text to search for. `originalPosition.offset` is a genuine historical offset
 * in the same `doc.textBetween()` space, and is the same fallback re-anchoring
 * uses when `lastKnownOffset` is missing. When neither exists the whole object
 * is omitted, leaving the absence consumers already handle for document-level
 * threads rather than a fabricated range.
 */
function buildLastKnownSelection(anchor: PersistedAnchor): ExportedSelection | undefined {
  const offset = anchor.lastKnownOffset ?? anchor.originalPosition?.offset;
  if (offset === undefined) return undefined;

  const selection: ExportedSelection = {
    text: anchor.quote,
    from: offset,
    to: offset + anchor.quote.length,
  };
  if (anchor.originalPosition) {
    selection.line = anchor.originalPosition.line;
    selection.column = anchor.originalPosition.column;
  }
  return selection;
}

/**
 * Format a single text-anchored thread with all its visible comments.
 * Uses blockquotes for the highlighted text per plan requirements.
 */
function formatThread(
  thread: PersistedThread,
  visibleComments: PersistedThread['comments'],
  options: { includeTimestamps: boolean; includeAuthorIds: boolean },
): string {
  const lines: string[] = [];
  const { anchor } = thread;

  // Header with location information
  const locationInfo = formatLocation(anchor);

  lines.push(`### ${locationInfo}\n`);

  // Highlighted text using blockquote (per plan requirements)
  if (anchor.quote) {
    // Split quote into lines and blockquote each
    const quoteLines = anchor.quote.split('\n');
    for (const quoteLine of quoteLines) {
      lines.push(`> ${quoteLine}`);
    }
    lines.push('');
  }

  // Position details for precise reference. For an orphaned thread the same
  // numbers are still worth printing as a hint about where the text used to
  // live, but only once they are labelled as history.
  if (isOrphanedAnchor(anchor)) {
    lines.push(`*${formatLastKnownPosition(anchor)}*\n`);
  } else if (anchor.originalPosition) {
    const { line, column } = anchor.originalPosition;
    const range = anchor.lastKnownOffset !== undefined ? `offset ${anchor.lastKnownOffset}` : '';
    lines.push(`*Position: Line ${line}, Column ${column}${range ? ` (${range})` : ''}*\n`);
  }

  // Comments section
  for (const comment of visibleComments) {
    const author = options.includeAuthorIds ? comment.authorId : 'Reviewer';
    const timestamp = options.includeTimestamps ? formatTimestamp(comment.createdAt) : '';

    lines.push(`**${author}**${timestamp}:`);
    lines.push(comment.body);
    lines.push('');
  }

  lines.push('---\n');

  return lines.join('\n');
}

/**
 * Format a document-level thread (general feedback, no highlighted text).
 */
function formatDocumentThread(
  visibleComments: PersistedThread['comments'],
  options: { includeTimestamps: boolean; includeAuthorIds: boolean },
): string {
  const lines: string[] = [];

  for (const comment of visibleComments) {
    const author = options.includeAuthorIds ? comment.authorId : 'Reviewer';
    const timestamp = options.includeTimestamps ? formatTimestamp(comment.createdAt) : '';

    lines.push(`**${author}**${timestamp}:`);
    lines.push(comment.body);
    lines.push('');
  }

  lines.push('---\n');

  return lines.join('\n');
}

/**
 * Format location information for a thread.
 */
function formatLocation(anchor: PersistedThread['anchor']): string {
  if (isOrphanedAnchor(anchor)) {
    return 'Comment on text no longer in the document';
  }

  if (anchor.originalPosition) {
    const { line, column } = anchor.originalPosition;
    return `Comment at Line ${line}:${column}`;
  }

  if (anchor.lastKnownOffset !== undefined) {
    return `Comment at offset ${anchor.lastKnownOffset}`;
  }

  return 'Comment (location unknown)';
}

/**
 * Describe where an orphaned thread's quote was last seen.
 *
 * The sentence leads with the absence rather than the coordinates so that a
 * reader skimming italics cannot mistake the numbers for a current position.
 */
function formatLastKnownPosition(anchor: PersistedThread['anchor']): string {
  const missing = 'This text was not found in the current document.';

  if (anchor.originalPosition) {
    const { line, column } = anchor.originalPosition;
    const offset =
      anchor.lastKnownOffset !== undefined ? ` (offset ${anchor.lastKnownOffset})` : '';
    return `${missing} Last known position: Line ${line}, Column ${column}${offset}`;
  }

  if (anchor.lastKnownOffset !== undefined) {
    return `${missing} Last known position: offset ${anchor.lastKnownOffset}`;
  }

  return missing;
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    // Use a short format that's still parseable
    return ` (${date.toISOString().split('T')[0]})`;
  } catch {
    return '';
  }
}
