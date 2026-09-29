import { requiredValue } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import type { CommentAnchor } from '../comments/types.js';
import type { DraftComment, ReviewSession } from './types.js';
import {
  addDraftComment,
  clearReviewOutcome,
  deleteDraftComment,
  findDraftComment,
  setReviewOutcome,
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
    expect(requiredValue(result.session.draftComments[0]).id).toBe('existing');
    expect(requiredValue(result.session.draftComments[1]).id).toBe('new');
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

    expect(requiredValue(result.session.draftComments[0]).anchor).toBeDefined();
    expect(requiredValue(result.session.draftComments[0]).threadId).toBeUndefined();
  });

  test('handles draft reply (reply to existing thread)', () => {
    const session = createTestSession();
    const draftReply = createTestDraftReply({ id: 'draft-reply-1' });
    const result = addDraftComment(session, draftReply);

    expect(requiredValue(result.session.draftComments[0]).threadId).toBe('existing-thread-1');
    expect(requiredValue(result.session.draftComments[0]).anchor).toBeUndefined();
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

    expect(requiredValue(result.session.draftComments[0]).body).toBe('Updated body');
    expect(requiredValue(result.session.draftComments[0]).mentions).toEqual(['alice']);
    expect(requiredValue(result.session.draftComments[0]).updatedAt).toBe(
      '2024-01-02T00:00:00.000Z',
    );
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

    expect(requiredValue(result.session.draftComments[0]).anchor).toBeDefined();
    expect(requiredValue(result.session.draftComments[0]).authorId).toBe('user-1');
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
    expect(requiredValue(result.session.draftComments[0]).id).toBe('comment-2');
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
