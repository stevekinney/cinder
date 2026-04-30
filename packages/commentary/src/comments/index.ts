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
} from './types.js';

export type {
  AnchorStatus,
  // Anchor types
  AnchorType,
  AnchorUpdate,
  // Comment types
  Comment,
  CommentAnchor,
  CommentCreateEvent,
  CommentDeleteEvent,
  CommentUpdateEvent,
  CreateCommentInput,
  CreateThreadInput,
  PersistedAnchor,
  PersistedThread,
  ReanchorResult,
  // Review state
  ReviewState,
  RuntimeAnchor,
  TextQuoteAnchor,
  // Thread types
  Thread,
  // Event types (DEP-40: added new lifecycle events)
  ThreadCreateEvent,
  ThreadDeleteEvent,
  UpdateCommentInput,
} from './types.js';

// Re-anchoring algorithm (DEP-39)
export { findAllOccurrences, fuzzyReanchor, reanchorQuote, scoreContextMatch } from './reanchor.js';

export type { ReanchorInput } from './reanchor.js';

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
} from './updates.js';

export type { UpdateResult } from './updates.js';

// Mention extraction (DEP-40)
export { extractMentions } from './mentions.js';
