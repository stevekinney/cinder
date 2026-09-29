import { describe, expect, test } from 'bun:test';
import type { CommentAnchor } from '../comments/types.js';
import type { DraftComment, ReviewSession } from './types.js';
import {
  getDraftCounts,
  getDraftReplies,
  getDraftRepliesForThread,
  getDraftThreads,
} from './updates.js';

// ============================================================================
// Test Constants
// ============================================================================

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestAnchor(overrides?: Partial<CommentAnchor>): CommentAnchor {
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

function createTestDraftComment(overrides?: Partial<DraftComment>): DraftComment {
  return {
    id: 'draft-comment-1',
    body: 'Test draft comment',
    authorId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createTestDraftThread(overrides?: Partial<DraftComment>): DraftComment {
  return createTestDraftComment({
    anchor: createTestAnchor(),
    threadId: undefined,
    ...overrides,
  });
}

function createTestDraftReply(overrides?: Partial<DraftComment>): DraftComment {
  return createTestDraftComment({
    threadId: 'existing-thread-1',
    anchor: undefined,
    ...overrides,
  });
}

function createTestSession(overrides?: Partial<ReviewSession>): ReviewSession {
  return {
    id: 'session-1',
    status: 'drafting',
    draftComments: [],
    startedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// Draft Comment Operations
// ============================================================================

describe('getDraftCounts', () => {
  test('returns zeros for empty session', () => {
    const session = createTestSession();
    const counts = getDraftCounts(session);

    expect(counts.threads).toBe(0);
    expect(counts.replies).toBe(0);
    expect(counts.total).toBe(0);
  });

  test('counts draft threads correctly', () => {
    const session = createTestSession({
      draftComments: [
        createTestDraftThread({ id: 'thread-1' }),
        createTestDraftThread({ id: 'thread-2' }),
      ],
    });
    const counts = getDraftCounts(session);

    expect(counts.threads).toBe(2);
    expect(counts.replies).toBe(0);
    expect(counts.total).toBe(2);
  });

  test('counts draft replies correctly', () => {
    const session = createTestSession({
      draftComments: [
        createTestDraftReply({ id: 'reply-1' }),
        createTestDraftReply({ id: 'reply-2' }),
        createTestDraftReply({ id: 'reply-3' }),
      ],
    });
    const counts = getDraftCounts(session);

    expect(counts.threads).toBe(0);
    expect(counts.replies).toBe(3);
    expect(counts.total).toBe(3);
  });

  test('counts mixed draft items correctly', () => {
    const session = createTestSession({
      draftComments: [
        createTestDraftThread({ id: 'thread-1' }),
        createTestDraftThread({ id: 'thread-2' }),
        createTestDraftReply({ id: 'reply-1' }),
      ],
    });
    const counts = getDraftCounts(session);

    expect(counts.threads).toBe(2);
    expect(counts.replies).toBe(1);
    expect(counts.total).toBe(3);
  });
});

describe('getDraftThreads', () => {
  test('returns only draft comments with anchors and no threadId', () => {
    const session = createTestSession({
      draftComments: [
        createTestDraftThread({ id: 'thread-1' }),
        createTestDraftReply({ id: 'reply-1' }),
        createTestDraftThread({ id: 'thread-2' }),
      ],
    });
    const threads = getDraftThreads(session);

    expect(threads).toHaveLength(2);
    expect(threads.map((t) => t.id)).toEqual(['thread-1', 'thread-2']);
  });

  test('returns empty array when no threads', () => {
    const session = createTestSession({
      draftComments: [createTestDraftReply({ id: 'reply-1' })],
    });
    const threads = getDraftThreads(session);

    expect(threads).toEqual([]);
  });
});

describe('getDraftReplies', () => {
  test('returns only draft comments with threadId', () => {
    const session = createTestSession({
      draftComments: [
        createTestDraftThread({ id: 'thread-1' }),
        createTestDraftReply({ id: 'reply-1' }),
        createTestDraftReply({ id: 'reply-2' }),
      ],
    });
    const replies = getDraftReplies(session);

    expect(replies).toHaveLength(2);
    expect(replies.map((r) => r.id)).toEqual(['reply-1', 'reply-2']);
  });
});

describe('getDraftRepliesForThread', () => {
  test('returns only replies for specific thread', () => {
    const session = createTestSession({
      draftComments: [
        createTestDraftReply({ id: 'reply-1', threadId: 'thread-A' }),
        createTestDraftReply({ id: 'reply-2', threadId: 'thread-B' }),
        createTestDraftReply({ id: 'reply-3', threadId: 'thread-A' }),
      ],
    });
    const replies = getDraftRepliesForThread(session, 'thread-A');

    expect(replies).toHaveLength(2);
    expect(replies.map((r) => r.id)).toEqual(['reply-1', 'reply-3']);
  });

  test('returns empty array when no replies for thread', () => {
    const session = createTestSession({
      draftComments: [createTestDraftReply({ id: 'reply-1', threadId: 'thread-A' })],
    });
    const replies = getDraftRepliesForThread(session, 'thread-B');

    expect(replies).toEqual([]);
  });
});

// ============================================================================
// Session Lifecycle
// ============================================================================
