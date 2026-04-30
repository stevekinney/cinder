// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
import { describe, expect, test } from 'bun:test';
import type { CommentAnchor } from '../comments/types.js';
import type {
  DraftComment,
  PersistedDraftComment,
  PersistedReviewSession,
  ReviewSession,
} from './types.js';
import {
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
} from './updates.js';

// ============================================================================
// Test Constants
// ============================================================================

const TEST_TIMESTAMP = '2024-01-15T12:00:00.000Z';

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

describe('addDraftComment', () => {
  test('adds draft comment to empty session', () => {
    const session = createTestSession();
    const comment = createTestDraftComment();
    const result = addDraftComment(session, comment);

    expect(result.session.draftComments).toHaveLength(1);
    expect(result.session.draftComments[0]).toBe(comment);
    expect(result.changed).toBe(true);
    expect(result.value?.comment).toBe(comment);
  });

  test('appends draft comment to existing comments', () => {
    const existingComment = createTestDraftComment({ id: 'existing' });
    const session = createTestSession({ draftComments: [existingComment] });
    const newComment = createTestDraftComment({ id: 'new' });
    const result = addDraftComment(session, newComment);

    expect(result.session.draftComments).toHaveLength(2);
    expect(result.session.draftComments[0].id).toBe('existing');
    expect(result.session.draftComments[1].id).toBe('new');
  });

  test('updates session updatedAt to comment createdAt', () => {
    const session = createTestSession({ updatedAt: '2024-01-01T00:00:00.000Z' });
    const comment = createTestDraftComment({ createdAt: '2024-01-02T00:00:00.000Z' });
    const result = addDraftComment(session, comment);

    expect(result.session.updatedAt).toBe('2024-01-02T00:00:00.000Z');
  });

  test('handles draft thread (new thread with anchor)', () => {
    const session = createTestSession();
    const draftThread = createTestDraftThread({ id: 'draft-thread-1' });
    const result = addDraftComment(session, draftThread);

    expect(result.session.draftComments[0].anchor).toBeDefined();
    expect(result.session.draftComments[0].threadId).toBeUndefined();
  });

  test('handles draft reply (reply to existing thread)', () => {
    const session = createTestSession();
    const draftReply = createTestDraftReply({ id: 'draft-reply-1' });
    const result = addDraftComment(session, draftReply);

    expect(result.session.draftComments[0].threadId).toBe('existing-thread-1');
    expect(result.session.draftComments[0].anchor).toBeUndefined();
  });
});

describe('updateDraftComment', () => {
  test('updates comment body and mentions', () => {
    const comment = createTestDraftComment({ id: 'comment-1', body: 'Original' });
    const session = createTestSession({ draftComments: [comment] });
    const result = updateDraftComment(session, 'comment-1', {
      body: 'Updated body',
      mentions: ['alice'],
      updatedAt: '2024-01-02T00:00:00.000Z',
    });

    expect(result.session.draftComments[0].body).toBe('Updated body');
    expect(result.session.draftComments[0].mentions).toEqual(['alice']);
    expect(result.session.draftComments[0].updatedAt).toBe('2024-01-02T00:00:00.000Z');
    expect(result.changed).toBe(true);
  });

  test('updates session updatedAt', () => {
    const comment = createTestDraftComment({ id: 'comment-1' });
    const session = createTestSession({
      draftComments: [comment],
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const result = updateDraftComment(session, 'comment-1', {
      body: 'Updated',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });

    expect(result.session.updatedAt).toBe('2024-01-02T00:00:00.000Z');
  });

  test('returns unchanged when comment not found', () => {
    const session = createTestSession();
    const result = updateDraftComment(session, 'nonexistent', {
      body: 'Updated',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });

    expect(result.session).toBe(session);
    expect(result.changed).toBe(false);
  });

  test('preserves other comment properties', () => {
    const comment = createTestDraftComment({
      id: 'comment-1',
      anchor: createTestAnchor(),
      authorId: 'user-1',
    });
    const session = createTestSession({ draftComments: [comment] });
    const result = updateDraftComment(session, 'comment-1', {
      body: 'Updated',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });

    expect(result.session.draftComments[0].anchor).toBeDefined();
    expect(result.session.draftComments[0].authorId).toBe('user-1');
  });
});

describe('deleteDraftComment', () => {
  test('removes existing comment', () => {
    const comments = [
      createTestDraftComment({ id: 'comment-1' }),
      createTestDraftComment({ id: 'comment-2' }),
    ];
    const session = createTestSession({ draftComments: comments });
    const result = deleteDraftComment(session, 'comment-1', TEST_TIMESTAMP);

    expect(result.session.draftComments).toHaveLength(1);
    expect(result.session.draftComments[0].id).toBe('comment-2');
    expect(result.changed).toBe(true);
  });

  test('returns unchanged when comment not found', () => {
    const session = createTestSession();
    const result = deleteDraftComment(session, 'nonexistent', TEST_TIMESTAMP);

    expect(result.session).toBe(session);
    expect(result.changed).toBe(false);
  });

  test('returns empty array when deleting last comment', () => {
    const session = createTestSession({
      draftComments: [createTestDraftComment({ id: 'comment-1' })],
    });
    const result = deleteDraftComment(session, 'comment-1', TEST_TIMESTAMP);

    expect(result.session.draftComments).toEqual([]);
    expect(result.changed).toBe(true);
  });

  test('uses provided timestamp for updatedAt', () => {
    const session = createTestSession({
      draftComments: [createTestDraftComment({ id: 'comment-1' })],
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const result = deleteDraftComment(session, 'comment-1', '2024-01-15T15:00:00.000Z');

    expect(result.session.updatedAt).toBe('2024-01-15T15:00:00.000Z');
  });
});

describe('findDraftComment', () => {
  test('finds existing comment', () => {
    const comment = createTestDraftComment({ id: 'comment-1' });
    const session = createTestSession({ draftComments: [comment] });
    const found = findDraftComment(session, 'comment-1');

    expect(found).toBe(comment);
  });

  test('returns undefined when not found', () => {
    const session = createTestSession();
    const found = findDraftComment(session, 'nonexistent');

    expect(found).toBeUndefined();
  });
});

// ============================================================================
// Outcome Operations
// ============================================================================

describe('setReviewOutcome', () => {
  test('sets outcome on session', () => {
    const session = createTestSession();
    const result = setReviewOutcome(session, 'approve', TEST_TIMESTAMP);

    expect(result.session.outcome).toBe('approve');
    expect(result.changed).toBe(true);
  });

  test('changes existing outcome', () => {
    const session = createTestSession({ outcome: 'approve' });
    const result = setReviewOutcome(session, 'request_changes', TEST_TIMESTAMP);

    expect(result.session.outcome).toBe('request_changes');
    expect(result.changed).toBe(true);
  });

  test('returns unchanged when outcome is the same', () => {
    const session = createTestSession({ outcome: 'approve' });
    const result = setReviewOutcome(session, 'approve', TEST_TIMESTAMP);

    expect(result.session).toBe(session);
    expect(result.changed).toBe(false);
  });

  test('supports all outcome types', () => {
    const session = createTestSession();

    const approveResult = setReviewOutcome(session, 'approve', TEST_TIMESTAMP);
    expect(approveResult.session.outcome).toBe('approve');

    const requestChangesResult = setReviewOutcome(session, 'request_changes', TEST_TIMESTAMP);
    expect(requestChangesResult.session.outcome).toBe('request_changes');

    const commentResult = setReviewOutcome(session, 'comment', TEST_TIMESTAMP);
    expect(commentResult.session.outcome).toBe('comment');
  });

  test('uses provided timestamp for updatedAt', () => {
    const session = createTestSession({ updatedAt: '2024-01-01T00:00:00.000Z' });
    const result = setReviewOutcome(session, 'approve', '2024-01-15T17:00:00.000Z');

    expect(result.session.updatedAt).toBe('2024-01-15T17:00:00.000Z');
  });
});

describe('clearReviewOutcome', () => {
  test('clears existing outcome', () => {
    const session = createTestSession({ outcome: 'approve' });
    const result = clearReviewOutcome(session, TEST_TIMESTAMP);

    expect(result.session.outcome).toBeUndefined();
    expect(result.changed).toBe(true);
  });

  test('returns unchanged when no outcome set', () => {
    const session = createTestSession();
    const result = clearReviewOutcome(session, TEST_TIMESTAMP);

    expect(result.session).toBe(session);
    expect(result.changed).toBe(false);
  });

  test('uses provided timestamp for updatedAt', () => {
    const session = createTestSession({
      outcome: 'approve',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const result = clearReviewOutcome(session, '2024-01-15T18:00:00.000Z');

    expect(result.session.updatedAt).toBe('2024-01-15T18:00:00.000Z');
  });
});

// ============================================================================
// Count Helpers
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

describe('clearSession', () => {
  test('clears all drafts and outcome', () => {
    const session = createTestSession({
      draftComments: [createTestDraftComment()],
      outcome: 'approve',
    });
    const result = clearSession(session, TEST_TIMESTAMP);

    expect(result.session.draftComments).toEqual([]);
    expect(result.session.outcome).toBeUndefined();
    expect(result.changed).toBe(true);
  });

  test('returns unchanged when session already empty', () => {
    const session = createTestSession();
    const result = clearSession(session, TEST_TIMESTAMP);

    expect(result.session).toBe(session);
    expect(result.changed).toBe(false);
  });

  test('preserves session id and startedAt timestamp', () => {
    const session = createTestSession({
      id: 'my-session',
      startedAt: '2024-01-01T00:00:00.000Z',
      draftComments: [createTestDraftComment()],
    });
    const result = clearSession(session, TEST_TIMESTAMP);

    expect(result.session.id).toBe('my-session');
    expect(result.session.startedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result.session.status).toBe('drafting');
  });

  test('uses provided timestamp for updatedAt', () => {
    const session = createTestSession({
      draftComments: [createTestDraftComment()],
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const result = clearSession(session, '2024-01-15T19:00:00.000Z');

    expect(result.session.updatedAt).toBe('2024-01-15T19:00:00.000Z');
  });
});

describe('createSession', () => {
  test('creates empty session with provided id and timestamp', () => {
    const session = createSession('new-session', '2024-01-15T00:00:00.000Z');

    expect(session.id).toBe('new-session');
    expect(session.status).toBe('drafting');
    expect(session.draftComments).toEqual([]);
    expect(session.outcome).toBeUndefined();
    expect(session.startedAt).toBe('2024-01-15T00:00:00.000Z');
    expect(session.updatedAt).toBe('2024-01-15T00:00:00.000Z');
  });
});

describe('submitSession', () => {
  test('marks session as submitted with outcome', () => {
    const session = createTestSession({
      draftComments: [createTestDraftComment()],
    });
    const result = submitSession(session, 'approve', '2024-01-15T12:00:00.000Z');

    expect(result.session.status).toBe('submitted');
    expect(result.session.outcome).toBe('approve');
    expect(result.session.submittedAt).toBe('2024-01-15T12:00:00.000Z');
    expect(result.session.updatedAt).toBe('2024-01-15T12:00:00.000Z');
    expect(result.changed).toBe(true);
  });

  test('returns unchanged when already submitted', () => {
    const session = createTestSession({
      status: 'submitted',
      submittedAt: '2024-01-15T12:00:00.000Z',
    });
    const result = submitSession(session, 'approve', '2024-01-16T12:00:00.000Z');

    expect(result.session).toBe(session);
    expect(result.changed).toBe(false);
  });

  test('preserves draft items in submitted session', () => {
    const comment = createTestDraftComment();
    const session = createTestSession({
      draftComments: [comment],
    });
    const result = submitSession(session, 'request_changes', '2024-01-15T12:00:00.000Z');

    expect(result.session.draftComments).toHaveLength(1);
  });
});

// ============================================================================
// Serialization Helpers
// ============================================================================

describe('toPersistedDraftComment', () => {
  test('strips runtime anchor positions', () => {
    const comment = createTestDraftThread({
      id: 'comment-1',
      anchor: createTestAnchor({ from: 100, to: 200 }),
    });
    const persisted = toPersistedDraftComment(comment);

    expect(persisted.id).toBe('comment-1');
    expect(persisted.anchor).toBeDefined();
    expect('from' in (persisted.anchor ?? {})).toBe(false);
    expect('to' in (persisted.anchor ?? {})).toBe(false);
  });

  test('preserves all other properties', () => {
    const comment = createTestDraftThread({
      id: 'comment-1',
      body: 'Test body',
      authorId: 'user-1',
      mentions: ['alice', 'bob'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });
    const persisted = toPersistedDraftComment(comment);

    expect(persisted.body).toBe('Test body');
    expect(persisted.authorId).toBe('user-1');
    expect(persisted.mentions).toEqual(['alice', 'bob']);
    expect(persisted.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(persisted.updatedAt).toBe('2024-01-02T00:00:00.000Z');
  });

  test('handles comment without anchor (reply)', () => {
    const comment = createTestDraftReply({ id: 'reply-1' });
    const persisted = toPersistedDraftComment(comment);

    expect(persisted.anchor).toBeUndefined();
    expect(persisted.threadId).toBe('existing-thread-1');
  });
});

describe('toPersistedSession', () => {
  test('converts full session to persisted format', () => {
    const session = createTestSession({
      id: 'session-1',
      status: 'drafting',
      outcome: 'approve',
      draftComments: [createTestDraftThread({ id: 'thread-1' })],
      startedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });
    const persisted = toPersistedSession(session);

    expect(persisted.id).toBe('session-1');
    expect(persisted.status).toBe('drafting');
    expect(persisted.outcome).toBe('approve');
    expect(persisted.draftComments).toHaveLength(1);
    expect(persisted.startedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(persisted.updatedAt).toBe('2024-01-02T00:00:00.000Z');
  });

  test('strips all runtime positions from nested items', () => {
    const session = createTestSession({
      draftComments: [createTestDraftThread({ anchor: createTestAnchor({ from: 100, to: 200 }) })],
    });
    const persisted = toPersistedSession(session);

    expect('from' in (persisted.draftComments[0].anchor ?? {})).toBe(false);
  });
});

describe('fromPersistedDraftComment', () => {
  test('restores runtime anchor positions as placeholders', () => {
    const persisted: PersistedDraftComment = {
      id: 'comment-1',
      anchor: {
        quote: 'test quote',
        prefix: 'prefix ',
        suffix: ' suffix',
        status: 'anchored',
      },
      body: 'Test body',
      authorId: 'user-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const restored = fromPersistedDraftComment(persisted);

    expect(restored.anchor?.from).toBe(0);
    expect(restored.anchor?.to).toBe(0);
  });

  test('preserves all stored properties', () => {
    const persisted: PersistedDraftComment = {
      id: 'comment-1',
      threadId: 'thread-1',
      body: 'Test body',
      authorId: 'user-1',
      mentions: ['alice'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };
    const restored = fromPersistedDraftComment(persisted);

    expect(restored.id).toBe('comment-1');
    expect(restored.threadId).toBe('thread-1');
    expect(restored.body).toBe('Test body');
    expect(restored.authorId).toBe('user-1');
    expect(restored.mentions).toEqual(['alice']);
  });
});

describe('fromPersistedSession', () => {
  test('restores full session from persisted format', () => {
    const persisted: PersistedReviewSession = {
      id: 'session-1',
      status: 'drafting',
      outcome: 'approve',
      draftComments: [
        {
          id: 'comment-1',
          anchor: { quote: 'test', prefix: '', suffix: '', status: 'anchored' },
          body: 'Test',
          authorId: 'user-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      startedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };
    const restored = fromPersistedSession(persisted);

    expect(restored.id).toBe('session-1');
    expect(restored.status).toBe('drafting');
    expect(restored.outcome).toBe('approve');
    expect(restored.draftComments).toHaveLength(1);
    expect(restored.draftComments[0].anchor?.from).toBe(0);
  });
});

// ============================================================================
// Immutability Checks
// ============================================================================

describe('immutability', () => {
  test('addDraftComment returns new session object', () => {
    const original = createTestSession();
    const result = addDraftComment(original, createTestDraftComment());

    expect(result.session).not.toBe(original);
    expect(result.session.draftComments).not.toBe(original.draftComments);
  });

  test('updateDraftComment returns new session and comment objects', () => {
    const original = createTestSession({
      draftComments: [createTestDraftComment({ id: 'comment-1' })],
    });
    const result = updateDraftComment(original, 'comment-1', {
      body: 'Updated',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });

    expect(result.session).not.toBe(original);
    expect(result.session.draftComments).not.toBe(original.draftComments);
    expect(result.session.draftComments[0]).not.toBe(original.draftComments[0]);
  });

  test('deleteDraftComment returns new session and array', () => {
    const original = createTestSession({
      draftComments: [createTestDraftComment({ id: 'comment-1' })],
    });
    const result = deleteDraftComment(original, 'comment-1', TEST_TIMESTAMP);

    expect(result.session).not.toBe(original);
    expect(result.session.draftComments).not.toBe(original.draftComments);
  });

  test('setReviewOutcome returns new session object', () => {
    const original = createTestSession();
    const result = setReviewOutcome(original, 'approve', TEST_TIMESTAMP);

    expect(result.session).not.toBe(original);
  });

  test('clearSession returns new session object', () => {
    const original = createTestSession({
      draftComments: [createTestDraftComment()],
    });
    const result = clearSession(original, TEST_TIMESTAMP);

    expect(result.session).not.toBe(original);
  });

  test('submitSession returns new session object', () => {
    const original = createTestSession();
    const result = submitSession(original, 'approve', '2024-01-15T12:00:00.000Z');

    expect(result.session).not.toBe(original);
  });

  test('unchanged operations return original session reference', () => {
    const original = createTestSession();

    expect(updateDraftComment(original, 'nonexistent', { body: 'x', updatedAt: 'x' }).session).toBe(
      original,
    );
    expect(deleteDraftComment(original, 'nonexistent', TEST_TIMESTAMP).session).toBe(original);
    expect(clearSession(original, TEST_TIMESTAMP).session).toBe(original);
    expect(clearReviewOutcome(original, TEST_TIMESTAMP).session).toBe(original);
  });
});
