/**
 * Pure update helpers for review session state management.
 *
 * All functions are pure (no side effects, no ID/timestamp generation).
 * They return new objects for Svelte 5 reactivity.
 * The `changed` flag indicates whether the operation had any effect.
 *
 * @module
 */

import type { PersistedAnchor } from '../comments/types.js';
import type {
  DraftComment,
  DraftCounts,
  PersistedDraftComment,
  PersistedReviewSession,
  ReviewOutcome,
  ReviewSession,
} from './types.js';

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of a session update operation.
 * @template T - Optional value type returned with the result
 */
export type SessionUpdateResult<T = undefined> = {
  /** The updated session */
  session: ReviewSession;
  /** Whether the operation made any changes */
  changed: boolean;
  /** Optional value from the operation */
  value?: T;
};

// ============================================================================
// Draft Comment Operations
// ============================================================================

/**
 * Add a draft comment to the session.
 *
 * The comment can either create a new thread (has anchor, no threadId)
 * or reply to an existing thread (has threadId, no anchor).
 *
 * @param session - Current session
 * @param comment - The draft comment to add (caller provides complete DraftComment)
 */
export function addDraftComment(
  session: ReviewSession,
  comment: DraftComment,
): SessionUpdateResult<{ comment: DraftComment }> {
  // Ensure session updatedAt never goes backwards
  const updatedAt =
    session.updatedAt && session.updatedAt > comment.createdAt
      ? session.updatedAt
      : comment.createdAt;

  return {
    session: {
      ...session,
      draftComments: [...session.draftComments, comment],
      updatedAt,
    },
    changed: true,
    value: { comment },
  };
}

/**
 * Update a draft comment's body and mentions.
 *
 * No-op if comment does not exist.
 *
 * @param session - Current session
 * @param commentId - ID of the draft comment to update
 * @param update - The update with body, mentions, and updatedAt (caller provides timestamp)
 */
export function updateDraftComment(
  session: ReviewSession,
  commentId: string,
  update: { body: string; mentions?: string[]; updatedAt: string },
): SessionUpdateResult {
  const exists = session.draftComments.some((c) => c.id === commentId);
  if (!exists) {
    return { session, changed: false };
  }

  return {
    session: {
      ...session,
      draftComments: session.draftComments.map((c) => {
        if (c.id !== commentId) return c;

        const updatedComment: DraftComment = {
          ...c,
          body: update.body,
          updatedAt: update.updatedAt,
        };

        if (update.mentions !== undefined) {
          updatedComment.mentions = update.mentions;
        }

        return updatedComment;
      }),
      updatedAt: update.updatedAt,
    },
    changed: true,
  };
}

/**
 * Delete a draft comment from the session.
 *
 * No-op if comment does not exist.
 *
 * @param session - Current session
 * @param commentId - ID of the draft comment to delete
 * @param updatedAt - Timestamp for the update (caller provides)
 */
export function deleteDraftComment(
  session: ReviewSession,
  commentId: string,
  updatedAt: string,
): SessionUpdateResult {
  const exists = session.draftComments.some((c) => c.id === commentId);
  if (!exists) {
    return { session, changed: false };
  }

  return {
    session: {
      ...session,
      draftComments: session.draftComments.filter((c) => c.id !== commentId),
      updatedAt,
    },
    changed: true,
  };
}

/**
 * Find a draft comment by ID.
 *
 * @param session - Current session
 * @param commentId - ID of the draft comment to find
 */
export function findDraftComment(
  session: ReviewSession,
  commentId: string,
): DraftComment | undefined {
  return session.draftComments.find((c) => c.id === commentId);
}

// ============================================================================
// Outcome Operations
// ============================================================================

/**
 * Set the review outcome.
 *
 * @param session - Current session
 * @param outcome - The review outcome to set
 * @param updatedAt - Timestamp for the update (caller provides)
 */
export function setReviewOutcome(
  session: ReviewSession,
  outcome: ReviewOutcome,
  updatedAt: string,
): SessionUpdateResult {
  if (session.outcome === outcome) {
    return { session, changed: false };
  }

  return {
    session: {
      ...session,
      outcome,
      updatedAt,
    },
    changed: true,
  };
}

/**
 * Clear the review outcome.
 *
 * @param session - Current session
 * @param updatedAt - Timestamp for the update (caller provides)
 */
export function clearReviewOutcome(session: ReviewSession, updatedAt: string): SessionUpdateResult {
  if (session.outcome === undefined) {
    return { session, changed: false };
  }

  // Destructure to omit outcome property entirely
  const { outcome: _, ...rest } = session;

  return {
    session: {
      ...rest,
      updatedAt,
    },
    changed: true,
  };
}

// ============================================================================
// Count Helpers
// ============================================================================

/**
 * Get counts of draft items in the session.
 *
 * @param session - Current session
 */
export function getDraftCounts(session: ReviewSession): DraftCounts {
  const threads = session.draftComments.filter(
    (c) => c.anchor !== undefined && c.threadId === undefined,
  ).length;
  const replies = session.draftComments.filter(
    (c) => c.threadId !== undefined && c.anchor === undefined,
  ).length;

  return {
    threads,
    replies,
    total: threads + replies,
  };
}

/**
 * Get draft comments that create new threads (have anchor, no threadId).
 *
 * @param session - Current session
 */
export function getDraftThreads(session: ReviewSession): DraftComment[] {
  return session.draftComments.filter((c) => c.anchor !== undefined && c.threadId === undefined);
}

/**
 * Get draft comments that are replies to existing threads (have threadId, no anchor).
 *
 * @param session - Current session
 */
export function getDraftReplies(session: ReviewSession): DraftComment[] {
  return session.draftComments.filter((c) => c.threadId !== undefined && c.anchor === undefined);
}

/**
 * Get draft replies for a specific thread.
 *
 * @param session - Current session
 * @param threadId - The thread ID to get replies for
 */
export function getDraftRepliesForThread(session: ReviewSession, threadId: string): DraftComment[] {
  return session.draftComments.filter((c) => c.threadId === threadId);
}

// ============================================================================
// Session Lifecycle
// ============================================================================

/**
 * Clear all drafts from the session.
 *
 * Removes all draft comments and resets outcome.
 *
 * @param session - Current session
 * @param updatedAt - Timestamp for the update (caller provides)
 */
export function clearSession(session: ReviewSession, updatedAt: string): SessionUpdateResult {
  const hasDrafts = session.draftComments.length > 0 || session.outcome !== undefined;

  if (!hasDrafts) {
    return { session, changed: false };
  }

  const { outcome: _outcome, ...sessionWithoutOutcome } = session;

  return {
    session: {
      ...sessionWithoutOutcome,
      draftComments: [],
      updatedAt,
    },
    changed: true,
  };
}

/**
 * Create a new empty session.
 *
 * @param id - Session ID (caller provides)
 * @param startedAt - Start timestamp (caller provides)
 */
export function createSession(id: string, startedAt: string): ReviewSession {
  return {
    id,
    status: 'drafting',
    draftComments: [],
    startedAt,
    updatedAt: startedAt,
  };
}

/**
 * Mark a session as submitted.
 *
 * @param session - Current session
 * @param outcome - The final review outcome
 * @param submittedAt - Submission timestamp (caller provides)
 */
export function submitSession(
  session: ReviewSession,
  outcome: ReviewOutcome,
  submittedAt: string,
): SessionUpdateResult {
  if (session.status === 'submitted') {
    return { session, changed: false };
  }

  return {
    session: {
      ...session,
      status: 'submitted',
      outcome,
      submittedAt,
      updatedAt: submittedAt,
    },
    changed: true,
  };
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Convert a draft comment to persisted format.
 * Strips runtime anchor positions (from/to).
 *
 * @param comment - Runtime draft comment
 */
export function toPersistedDraftComment(comment: DraftComment): PersistedDraftComment {
  let persistedAnchor: PersistedAnchor | undefined;

  if (comment.anchor) {
    const { anchor } = comment;

    // Strip runtime positions (from, to) from anchor
    persistedAnchor = {
      quote: anchor.quote,
      prefix: anchor.prefix,
      suffix: anchor.suffix,
      status: anchor.status,
    };

    if (anchor.type !== undefined) persistedAnchor.type = anchor.type;
    if (anchor.originalQuote !== undefined) persistedAnchor.originalQuote = anchor.originalQuote;
    if (anchor.lastKnownOffset !== undefined)
      persistedAnchor.lastKnownOffset = anchor.lastKnownOffset;
    if (anchor.blockId !== undefined) persistedAnchor.blockId = anchor.blockId;
    if (anchor.originalPosition !== undefined)
      persistedAnchor.originalPosition = anchor.originalPosition;
  }

  const persisted: PersistedDraftComment = {
    id: comment.id,
    body: comment.body,
    authorId: comment.authorId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };

  if (comment.threadId !== undefined) persisted.threadId = comment.threadId;
  if (persistedAnchor !== undefined) persisted.anchor = persistedAnchor;
  if (comment.mentions !== undefined) persisted.mentions = comment.mentions;

  return persisted;
}

/**
 * Convert a session to persisted format for storage.
 *
 * @param session - Runtime session
 */
export function toPersistedSession(session: ReviewSession): PersistedReviewSession {
  const persisted: PersistedReviewSession = {
    id: session.id,
    status: session.status,
    draftComments: session.draftComments.map(toPersistedDraftComment),
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
  };

  if (session.outcome !== undefined) persisted.outcome = session.outcome;
  if (session.submittedAt !== undefined) persisted.submittedAt = session.submittedAt;

  return persisted;
}

/**
 * Convert a persisted draft comment back to runtime format.
 * Initializes anchor positions to 0 (caller must re-anchor).
 *
 * @param persisted - Persisted draft comment
 */
export function fromPersistedDraftComment(persisted: PersistedDraftComment): DraftComment {
  const draftComment: DraftComment = {
    id: persisted.id,
    body: persisted.body,
    authorId: persisted.authorId,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
  };

  if (persisted.threadId !== undefined) draftComment.threadId = persisted.threadId;
  if (persisted.anchor !== undefined) {
    draftComment.anchor = {
      ...persisted.anchor,
      from: 0, // Placeholder, caller must re-anchor
      to: 0,
    };
  }
  if (persisted.mentions !== undefined) draftComment.mentions = persisted.mentions;

  return draftComment;
}

/**
 * Convert a persisted session back to runtime format.
 *
 * @param persisted - Persisted session
 */
export function fromPersistedSession(persisted: PersistedReviewSession): ReviewSession {
  const session: ReviewSession = {
    id: persisted.id,
    status: persisted.status,
    draftComments: persisted.draftComments.map(fromPersistedDraftComment),
    startedAt: persisted.startedAt,
    updatedAt: persisted.updatedAt,
  };

  if (persisted.outcome !== undefined) session.outcome = persisted.outcome;
  if (persisted.submittedAt !== undefined) session.submittedAt = persisted.submittedAt;

  return session;
}
