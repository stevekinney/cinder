/**
 * Review session types for batch review submission (DEP-44).
 *
 * These types support:
 * - Draft comments that aren't visible until submission
 * - Review outcomes (approve / request changes / comment-only)
 * - Batch submission with all draft items
 * - Session persistence across page navigations
 *
 * @module
 */

import type { CommentAnchor, PersistedAnchor } from '../shared/anchor-types.js';

// ============================================================================
// Review Outcome Types
// ============================================================================

/**
 * Review submission outcome, matching GitHub's review types.
 *
 * - 'approve': Approves the changes
 * - 'request_changes': Requests changes before approval
 * - 'comment': Comment-only (neither approve nor request changes)
 */
export type ReviewOutcome = 'approve' | 'request_changes' | 'comment';

/**
 * Review session status lifecycle.
 *
 * - 'drafting': Session is active, accumulating draft items
 * - 'submitted': Session has been submitted as a batch
 */
export type ReviewSessionStatus = 'drafting' | 'submitted';

// ============================================================================
// Draft Comment Types
// ============================================================================

/**
 * A draft comment that hasn't been submitted yet.
 *
 * Draft comments can either:
 * 1. Create a new thread (anchor is defined, threadId is undefined)
 * 2. Reply to an existing thread (threadId is defined, anchor is undefined)
 */
export interface DraftComment {
  /** Unique identifier (client-generated) */
  id: string;

  /**
   * Parent thread ID when replying to an existing thread.
   * Undefined when creating a new thread.
   */
  threadId?: string | undefined;

  /**
   * Anchor for new threads.
   * Required when threadId is undefined, otherwise undefined.
   */
  anchor?: CommentAnchor | undefined;

  /** Comment body (Markdown) */
  body: string;

  /** Author user ID */
  authorId: string;

  /** User IDs mentioned in the comment */
  mentions?: string[] | undefined;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Persisted form of DraftComment (strips runtime anchor positions).
 */
export interface PersistedDraftComment {
  id: string;
  threadId?: string | undefined;
  anchor?: PersistedAnchor | undefined;
  body: string;
  authorId: string;
  mentions?: string[] | undefined;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Review Session Types
// ============================================================================

/**
 * Complete review session state.
 *
 * A session accumulates draft comments until the user submits the review
 * as a batch. The session also tracks the selected review outcome
 * (approve, request changes, or comment-only).
 */
export interface ReviewSession {
  /** Session ID */
  id: string;

  /** Current session status */
  status: ReviewSessionStatus;

  /** Selected review outcome (set before submission) */
  outcome?: ReviewOutcome | undefined;

  /** Draft comments (new threads and replies to existing threads) */
  draftComments: DraftComment[];

  /** When the session started (ISO 8601) */
  startedAt: string;

  /** Last update timestamp for conflict resolution (ISO 8601) */
  updatedAt: string;

  /** When the session was submitted (ISO 8601), if status is 'submitted' */
  submittedAt?: string | undefined;
}

/**
 * Persisted form of ReviewSession (for storage).
 * Uses persisted forms of draft items that strip runtime positions.
 */
export interface PersistedReviewSession {
  id: string;
  status: ReviewSessionStatus;
  outcome?: ReviewOutcome | undefined;
  draftComments: PersistedDraftComment[];
  startedAt: string;
  updatedAt: string;
  submittedAt?: string | undefined;
}

// ============================================================================
// Draft Counts
// ============================================================================

/**
 * Counts of pending draft items in a session.
 */
export interface DraftCounts {
  /** Number of draft comments that create new threads */
  threads: number;

  /** Number of draft comments that reply to existing threads */
  replies: number;

  /** Total count of all draft items */
  total: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event payload when a draft thread is created.
 * Emitted when user creates a new comment thread while a session is active.
 */
export interface DraftThreadCreateEvent {
  /** Request ID for correlation */
  requestId: string;

  /** The anchor where the thread was created */
  anchor: CommentAnchor;

  /** The initial comment body */
  body: string;

  /** The author ID */
  authorId: string;

  /** User IDs mentioned in the comment */
  mentions?: string[];
}

/**
 * Event payload when a draft comment (reply) is created.
 * Emitted when user replies to an existing thread while a session is active.
 */
export interface DraftCommentCreateEvent {
  /** Request ID for correlation */
  requestId: string;

  /** The existing thread ID receiving the reply */
  threadId: string;

  /** The comment body */
  body: string;

  /** The author ID */
  authorId: string;

  /** User IDs mentioned in the comment */
  mentions?: string[];
}

/**
 * Event payload when a draft comment is updated.
 */
export interface DraftCommentUpdateEvent {
  /** The draft comment ID being updated */
  commentId: string;

  /** The new comment body */
  body: string;

  /** User IDs mentioned in the updated comment */
  mentions?: string[];
}

/**
 * Event payload when a draft comment is deleted.
 */
export interface DraftCommentDeleteEvent {
  /** The draft comment ID being deleted */
  commentId: string;
}

/**
 * Event payload when the review outcome is changed.
 */
export interface ReviewOutcomeChangeEvent {
  /** The new outcome */
  outcome: ReviewOutcome;
}

/**
 * Event payload when a review is submitted.
 * Contains the complete session with all draft items for batch processing.
 */
export interface ReviewSubmitEvent {
  /** The complete session being submitted */
  session: ReviewSession;

  /** The selected review outcome */
  outcome: ReviewOutcome;

  /** Optional summary body for the review */
  summaryBody?: string;
}

/**
 * Event payload when a review is discarded.
 */
export interface ReviewDiscardEvent {
  /** The session ID being discarded */
  sessionId: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a draft comment creates a new thread (has anchor, no threadId).
 */
export function isDraftThread(
  comment: DraftComment,
): comment is DraftComment & { anchor: CommentAnchor; threadId: undefined } {
  return comment.anchor !== undefined && comment.threadId === undefined;
}

/**
 * Check if a draft comment is a reply to an existing thread (has threadId, no anchor).
 */
export function isDraftReply(
  comment: DraftComment,
): comment is DraftComment & { threadId: string; anchor: undefined } {
  return comment.threadId !== undefined && comment.anchor === undefined;
}
