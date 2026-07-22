/**
 * Comment and thread types for the Markdown Review Editor.
 *
 * These types support:
 * - TextQuoteSelector-style anchoring (survives edits via quote + context)
 * - Runtime position tracking (ProseMirror positions)
 * - Serialization for persistence
 *
 * Threads have no lifecycle status - they exist until deleted.
 * When anchor text is deleted, threads are automatically removed.
 *
 * @module
 */

import type { PersistedReviewSession } from '../session/types.js';
import type {
  AnchorStatus,
  CommentAnchor,
  PersistedAnchor,
  TextQuoteAnchor,
} from '../shared/anchor-types.js';

// Re-export anchor types from shared module (breaks circular dependency)
export type {
  AnchorStatus,
  AnchorType,
  CommentAnchor,
  PersistedAnchor,
  RuntimeAnchor,
  TextQuoteAnchor,
} from '../shared/anchor-types.js';

// ============================================================================
// Comment Types
// ============================================================================

/**
 * A single comment within a thread.
 */
export interface Comment {
  /** Unique identifier */
  id: string;

  /** Parent thread ID */
  threadId: string;

  /** Author user ID */
  authorId: string;

  /** Comment content (Markdown) */
  body: string;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last edit timestamp (ISO 8601), if edited */
  editedAt?: string | undefined;

  /** User IDs mentioned in the comment */
  mentions?: string[] | undefined;

  /** Soft delete timestamp (ISO 8601), if deleted */
  deletedAt?: string | undefined;
}

/**
 * Input for creating a new comment.
 */
export type CreateCommentInput = Pick<Comment, 'body' | 'authorId'> & {
  mentions?: string[];
};

/**
 * Input for updating an existing comment.
 */
export type UpdateCommentInput = Pick<Comment, 'body'> & {
  mentions?: string[];
};

// ============================================================================
// Thread Types
// ============================================================================

/**
 * A comment thread anchored to a document location.
 *
 * Threads have no status - they exist until deleted.
 * There is no "resolved" state; to dismiss a thread, delete it.
 */
export interface Thread {
  /** Unique identifier */
  id: string;

  /** Anchor to document location */
  anchor: CommentAnchor;

  /** Comments in chronological order */
  comments: Comment[];

  /** Creation timestamp (ISO 8601) */
  createdAt: string;
}

/**
 * Thread data for persistence (uses persisted anchor).
 */
export interface PersistedThread extends Omit<Thread, 'anchor'> {
  anchor: PersistedAnchor;
}

/**
 * Input for creating a new thread.
 */
export interface CreateThreadInput {
  /** Anchor location */
  anchor: CommentAnchor;

  /** Initial comment */
  initialComment: CreateCommentInput;
}

// ============================================================================
// Review State Types
// ============================================================================

/**
 * Complete review state for serialization.
 *
 * This is the top-level type for persisting and hydrating review sessions.
 *
 * Schema versions:
 * - v1: Original schema (DEP-39)
 * - v2: Added soft-delete support (DEP-40)
 * - v3: Reserved (previously suggestions)
 * - v4: Added reviewSession for batch review submission (DEP-44), front matter support (DEP-61)
 */
export interface ReviewState {
  /** Schema version for migrations (all versions are additive, no breaking changes) */
  schemaVersion: 1 | 2 | 3 | 4;

  /** Current document content as full Markdown, including front matter when present */
  content: string;

  /** Original/baseline content for diff comparison */
  original?: string | undefined;

  /** All threads in the review (includes soft-deleted comments for audit trail) */
  threads: PersistedThread[];

  /**
   * Review session for batch submission mode (v4+).
   * Contains draft comments that are submitted as a batch
   * with a review outcome (approve / request changes / comment-only).
   * When undefined or missing, treated as no active session for backwards compatibility.
   */
  reviewSession?: PersistedReviewSession | undefined;

  /**
   * Parsed front matter data (v4+).
   * When undefined or null, document has no front matter.
   */
  frontMatter?: Record<string, unknown> | null | undefined;

  /**
   * Raw front matter YAML string without delimiters (v4+).
   * Preserved for round-trip fidelity when data is unchanged.
   */
  frontMatterRaw?: string | null | undefined;

  /** Last modified timestamp (ISO 8601) */
  updatedAt: string;
}

// Re-export review session types for convenience
export type { PersistedReviewSession } from '../session/types.js';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event payload when a new thread is created.
 * Parent uses requestId to correlate optimistic updates with backend responses.
 */
export interface ThreadCreateEvent {
  /** Unique request ID for correlating optimistic updates */
  requestId: string;

  /** The anchor where the thread was created */
  anchor: CommentAnchor;

  /** The initial comment body */
  body: string;

  /** The author ID */
  authorId: string;

  /** User IDs mentioned in the initial comment */
  mentions?: string[] | undefined;
}

/**
 * Event payload when a thread is deleted.
 */
export interface ThreadDeleteEvent {
  /** The thread ID being deleted */
  threadId: string;
}

/**
 * Event payload when a comment is added to an existing thread.
 * Parent uses requestId to correlate optimistic updates with backend responses.
 */
export interface CommentCreateEvent {
  /** Unique request ID for correlating optimistic updates */
  requestId: string;

  /** The thread ID receiving the comment */
  threadId: string;

  /** The comment body */
  body: string;

  /** The author ID */
  authorId: string;

  /** User IDs mentioned in the comment */
  mentions?: string[] | undefined;
}

/**
 * Event payload when a comment is updated.
 */
export interface CommentUpdateEvent {
  /** The thread ID containing the comment */
  threadId: string;

  /** The comment ID being updated */
  commentId: string;

  /** The new comment body */
  body: string;

  /** User IDs mentioned in the updated comment */
  mentions?: string[] | undefined;
}

/**
 * Event payload when a comment is deleted.
 */
export interface CommentDeleteEvent {
  /** The thread ID containing the comment */
  threadId: string;

  /** The comment ID being deleted */
  commentId: string;

  /** True for soft delete (sets deletedAt), false for hard delete */
  soft: boolean;
}

// ============================================================================
// Plugin Communication Types
// ============================================================================

/**
 * Update payload from anchor plugin to ReviewEditor.
 * Sent when anchor positions or status change due to document edits.
 */
export interface AnchorUpdate {
  /** Thread ID this update is for */
  threadId: string;

  /** New ProseMirror start position */
  from: number;

  /** New ProseMirror end position */
  to: number;

  /** Updated quote text (follows edits inside the anchor) */
  quote: string;

  /** Updated prefix context */
  prefix: string;

  /** Updated suffix context */
  suffix: string;

  /** Current anchor status */
  status: AnchorStatus;

  /** Updated text offset for disambiguation */
  lastKnownOffset?: number;
}

/**
 * Result of re-anchoring a quote in a document.
 * Returned by the reanchorQuote algorithm.
 *
 * When `found` is false, the quote could not be located in the document
 * and the thread should be deleted.
 */
export interface ReanchorResult {
  /** Whether the quote was found in the document */
  found: boolean;

  /** Text offset of anchor start (in doc.textBetween() coordinates). Only valid when found=true. */
  from: number;

  /** Text offset of anchor end (in doc.textBetween() coordinates). Only valid when found=true. */
  to: number;

  /** Confidence score (0-1) of the match. 0 when not found. */
  confidence: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generate a unique ID for threads and comments.
 * Uses crypto.randomUUID() when available, falls back to timestamp + random.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get current ISO timestamp.
 */
export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Context length for TextQuoteSelector prefix/suffix.
 */
export const ANCHOR_CONTEXT_LENGTH = 50;

/**
 * Create a TextQuoteAnchor from a selection.
 *
 * @param quote - The selected text
 * @param documentText - The full document text
 * @param startOffset - Character offset of selection start
 * @param endOffset - Character offset of selection end
 */
export function createTextQuoteAnchor(
  quote: string,
  documentText: string,
  startOffset: number,
  endOffset: number,
): TextQuoteAnchor {
  const prefixStart = Math.max(0, startOffset - ANCHOR_CONTEXT_LENGTH);
  const suffixEnd = Math.min(documentText.length, endOffset + ANCHOR_CONTEXT_LENGTH);

  return {
    quote,
    prefix: documentText.slice(prefixStart, startOffset),
    suffix: documentText.slice(endOffset, suffixEnd),
  };
}

/**
 * Create a document-level anchor (not anchored to specific text).
 *
 * Document-level comments are for general feedback about the entire document,
 * not tied to a specific text selection.
 */
export function createDocumentAnchor(): CommentAnchor {
  return {
    type: 'document',
    quote: '',
    prefix: '',
    suffix: '',
    from: 0,
    to: 0,
    status: 'anchored',
  };
}

/**
 * Check if an anchor is a document-level anchor.
 */
export function isDocumentAnchor(anchor: CommentAnchor | PersistedAnchor): boolean {
  return anchor.type === 'document';
}

/**
 * Check if an anchor is a text anchor (explicit 'text' type or undefined for backwards compat).
 */
export function isTextAnchor(anchor: CommentAnchor | PersistedAnchor): boolean {
  return anchor.type === 'text' || anchor.type === undefined;
}
