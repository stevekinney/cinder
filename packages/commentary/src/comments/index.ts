/**
 * Comment and thread system for the Markdown Review Editor.
 *
 * @module
 */

export {
  ANCHOR_CONTEXT_LENGTH,
  createDocumentAnchor,
  createTextQuoteAnchor,
  // Utilities
  generateId,
  isDocumentAnchor,
  isTextAnchor,
  timestamp,
  type AnchorStatus,
  // Anchor types
  type AnchorType,
  type AnchorUpdate,
  // Comment types
  type Comment,
  type CommentAnchor,
  type CommentCreateEvent,
  type CommentDeleteEvent,
  type CommentUpdateEvent,
  type CreateCommentInput,
  type CreateThreadInput,
  type PersistedAnchor,
  type PersistedThread,
  type ReanchorResult,
  // Review state
  type ReviewState,
  type RuntimeAnchor,
  type TextQuoteAnchor,
  // Thread types
  type Thread,
  // Event types (DEP-40: added new lifecycle events)
  type ThreadCreateEvent,
  type ThreadDeleteEvent,
  type UpdateCommentInput,
} from './types.js';

// Re-anchoring algorithm (DEP-39)
export {
  findAllOccurrences,
  fuzzyReanchor,
  reanchorQuote,
  scoreContextMatch,
  type ReanchorInput,
} from './reanchor.js';

// Pure update helpers (DEP-40)
export {
  addComment,
  addThread,
  deleteComment,
  deleteThread,
  getVisibleComments,
  isCommentVisible,
  restoreComment,
  updateComment,
  type UpdateResult,
} from './updates.js';

// Mention extraction (DEP-40)
export { extractMentions } from './mentions.js';
