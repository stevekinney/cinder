/**
 * Review session module for batch review submission.
 *
 * This module provides types and utilities for managing draft comments
 * and suggestions that are submitted as a batch with a review outcome.
 *
 * @module
 */

// Types
export type {
  DraftComment,
  DraftCommentCreateEvent,
  DraftCommentDeleteEvent,
  DraftCommentUpdateEvent,
  DraftCounts,
  DraftThreadCreateEvent,
  PersistedDraftComment,
  PersistedReviewSession,
  ReviewDiscardEvent,
  ReviewOutcome,
  ReviewOutcomeChangeEvent,
  ReviewSession,
  ReviewSessionStatus,
  ReviewSubmitEvent,
} from './types.js';

// Type guards
export { isDraftReply, isDraftThread } from './types.js';

// Update helpers
export {
  addDraftComment,
  clearReviewOutcome,
  clearSession,
  createSession,
  deleteDraftComment,
  findDraftComment,
  fromPersistedDraftComment,
  fromPersistedSession,
  getDraftCounts,
  getDraftReplies,
  getDraftRepliesForThread,
  getDraftThreads,
  setReviewOutcome,
  submitSession,
  toPersistedDraftComment,
  toPersistedSession,
  updateDraftComment,
  type SessionUpdateResult,
} from './updates.js';

// Persistence
export {
  STORAGE_KEY_PREFIX,
  clearAllPersistedSessions,
  clearPersistedSession,
  getStorageKey,
  hasPersistedSession,
  listPersistedSessions,
  loadSession,
  saveSession,
  validateSessionSchema,
} from './persistence.js';
