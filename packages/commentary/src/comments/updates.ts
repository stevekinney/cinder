/**
 * Pure update helpers for thread and comment state management.
 *
 * All functions are pure (no side effects, no ID/timestamp generation).
 * They return new arrays/objects for Svelte 5 reactivity.
 * The `changed` flag indicates whether the operation had any effect.
 *
 * @module
 */

import type { Comment, Thread } from './types.js';

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of an update operation.
 * @template T - Optional value type returned with the result
 */
export type UpdateResult<T = undefined> = {
  /** The updated threads array */
  threads: Thread[];
  /** Whether the operation made any changes */
  changed: boolean;
  /** Optional value from the operation (e.g., created comment) */
  value?: T;
};

// ============================================================================
// Visibility Helpers
// ============================================================================

/**
 * Check if a comment is visible (not soft-deleted).
 */
export function isCommentVisible(comment: Comment): boolean {
  return !comment.deletedAt;
}

/**
 * Get visible (non-deleted) comments from a thread.
 */
export function getVisibleComments(thread: Thread): Comment[] {
  return thread.comments.filter(isCommentVisible);
}

// ============================================================================
// Thread Operations
// ============================================================================

/**
 * Add a new thread to the threads array.
 *
 * @param threads - Current threads array
 * @param thread - The thread to add (caller provides complete Thread with ID/timestamps)
 */
export function addThread(threads: Thread[], thread: Thread): UpdateResult {
  return {
    threads: [...threads, thread],
    changed: true,
  };
}

/**
 * Delete a thread from the threads array.
 *
 * No-op if thread does not exist.
 *
 * @param threads - Current threads array
 * @param threadId - ID of the thread to delete
 */
export function deleteThread(threads: Thread[], threadId: string): UpdateResult {
  const exists = threads.some((t) => t.id === threadId);
  if (!exists) {
    return { threads, changed: false };
  }

  return {
    threads: threads.filter((t) => t.id !== threadId),
    changed: true,
  };
}

// ============================================================================
// Comment Operations
// ============================================================================

/**
 * Add a comment to an existing thread.
 *
 * No-op if thread does not exist.
 *
 * @param threads - Current threads array
 * @param threadId - ID of the thread to add the comment to
 * @param comment - The comment to add (caller provides complete Comment with ID/timestamps)
 */
export function addComment(
  threads: Thread[],
  threadId: string,
  comment: Comment,
): UpdateResult<{ comment: Comment }> {
  const exists = threads.some((t) => t.id === threadId);
  if (!exists) {
    return { threads, changed: false };
  }

  return {
    threads: threads.map((thread) => {
      if (thread.id !== threadId) return thread;
      return {
        ...thread,
        comments: [...thread.comments, comment],
      };
    }),
    changed: true,
    value: { comment },
  };
}

/**
 * Update an existing comment's body and mentions.
 *
 * No-op if thread/comment does not exist or comment is deleted.
 *
 * @param threads - Current threads array
 * @param threadId - ID of the thread containing the comment
 * @param commentId - ID of the comment to update
 * @param update - The update with body, mentions, and editedAt (caller provides timestamp)
 */
export function updateComment(
  threads: Thread[],
  threadId: string,
  commentId: string,
  update: { body: string; mentions?: string[]; editedAt: string },
): UpdateResult {
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) {
    return { threads, changed: false };
  }

  const comment = thread.comments.find((c) => c.id === commentId);
  if (!comment || comment.deletedAt) {
    return { threads, changed: false };
  }

  return {
    threads: threads.map((t) => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        comments: t.comments.map((c) => {
          if (c.id !== commentId) return c;

          const updatedComment: Comment = {
            ...c,
            body: update.body,
            editedAt: update.editedAt,
          };

          if (update.mentions !== undefined) {
            updatedComment.mentions = update.mentions;
          }

          return updatedComment;
        }),
      };
    }),
    changed: true,
  };
}

/**
 * Delete a comment from a thread.
 *
 * Soft delete sets deletedAt timestamp.
 * Hard delete removes the comment from the array.
 *
 * No-op if thread/comment does not exist, or if soft-deleting an already deleted comment.
 *
 * @param threads - Current threads array
 * @param threadId - ID of the thread containing the comment
 * @param commentId - ID of the comment to delete
 * @param options - Delete options with soft flag and deletedAt timestamp (for soft delete)
 */
export function deleteComment(
  threads: Thread[],
  threadId: string,
  commentId: string,
  options: { soft: boolean; deletedAt?: string },
): UpdateResult {
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) {
    return { threads, changed: false };
  }

  const comment = thread.comments.find((c) => c.id === commentId);
  if (!comment) {
    return { threads, changed: false };
  }

  // For soft delete, no-op if already deleted or if deletedAt not provided
  if (options.soft) {
    if (comment.deletedAt || !options.deletedAt) {
      return { threads, changed: false };
    }

    const { deletedAt } = options;

    // Soft delete: set deletedAt
    return {
      threads: threads.map((t) => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          comments: t.comments.map((c) => {
            if (c.id !== commentId) return c;
            return { ...c, deletedAt };
          }),
        };
      }),
      changed: true,
    };
  }

  // Hard delete: remove from array
  return {
    threads: threads.map((t) => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        comments: t.comments.filter((c) => c.id !== commentId),
      };
    }),
    changed: true,
  };
}

/**
 * Restore a soft-deleted comment.
 *
 * Removes the deletedAt timestamp.
 *
 * No-op if thread/comment does not exist or comment is not deleted.
 *
 * @param threads - Current threads array
 * @param threadId - ID of the thread containing the comment
 * @param commentId - ID of the comment to restore
 */
export function restoreComment(
  threads: Thread[],
  threadId: string,
  commentId: string,
): UpdateResult {
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) {
    return { threads, changed: false };
  }

  const comment = thread.comments.find((c) => c.id === commentId);
  if (!comment || !comment.deletedAt) {
    return { threads, changed: false };
  }

  return {
    threads: threads.map((t) => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        comments: t.comments.map((c) => {
          if (c.id !== commentId) return c;
          // Remove deletedAt using delete for clean omission
          const { deletedAt: _deletedAt, ...restored } = c;
          return restored;
        }),
      };
    }),
    changed: true,
  };
}
