/**
 * Shared test fixtures for review session tests.
 *
 * These factory functions create test data with sensible defaults
 * that can be overridden as needed.
 *
 * @module
 */

import type { CommentAnchor } from '../comments/types.js';
import type {
  DraftComment,
  PersistedDraftComment,
  PersistedReviewSession,
  ReviewSession,
} from './types.js';

// ============================================================================
// Anchor Fixtures
// ============================================================================

/**
 * Create a test CommentAnchor.
 */
export function createTestAnchor(overrides?: Partial<CommentAnchor>): CommentAnchor {
  return {
    quote: 'test quote',
    prefix: 'prefix ',
    suffix: ' suffix',
    from: 10,
    to: 20,
    status: 'anchored',
    ...overrides,
  };
}

// ============================================================================
// Draft Comment Fixtures
// ============================================================================

/**
 * Create a test DraftComment (base form - no anchor or threadId).
 */
export function createTestDraftComment(overrides?: Partial<DraftComment>): DraftComment {
  return {
    id: 'draft-comment-1',
    body: 'Test draft comment',
    authorId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Create a test DraftComment that starts a new thread (has anchor, no threadId).
 */
export function createTestDraftThread(overrides?: Partial<DraftComment>): DraftComment {
  const draft = createTestDraftComment({
    anchor: createTestAnchor(),
    ...overrides,
  });
  delete draft.threadId;
  return draft;
}

/**
 * Create a test DraftComment that replies to an existing thread (has threadId, no anchor).
 */
export function createTestDraftReply(overrides?: Partial<DraftComment>): DraftComment {
  const draft = createTestDraftComment({
    threadId: 'existing-thread-1',
    ...overrides,
  });
  delete draft.anchor;
  return draft;
}

// ============================================================================
// Review Session Fixtures
// ============================================================================

/**
 * Create a test ReviewSession.
 */
export function createTestSession(overrides?: Partial<ReviewSession>): ReviewSession {
  return {
    id: 'session-1',
    status: 'drafting',
    draftComments: [],
    startedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Create a test ReviewSession with some draft content.
 */
export function createTestSessionWithDrafts(overrides?: Partial<ReviewSession>): ReviewSession {
  return createTestSession({
    draftComments: [
      createTestDraftThread({ id: 'thread-draft-1' }),
      createTestDraftReply({ id: 'reply-draft-1' }),
    ],
    ...overrides,
  });
}

// ============================================================================
// Persisted Fixtures
// ============================================================================

/**
 * Create a test PersistedDraftComment (no runtime positions).
 */
export function createTestPersistedDraftComment(
  overrides?: Partial<PersistedDraftComment>,
): PersistedDraftComment {
  return {
    id: 'draft-comment-1',
    body: 'Test draft comment',
    authorId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Create a test PersistedReviewSession.
 */
export function createTestPersistedSession(
  overrides?: Partial<PersistedReviewSession>,
): PersistedReviewSession {
  return {
    id: 'session-1',
    status: 'drafting',
    draftComments: [],
    startedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}
