import { requiredValue } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import type { CommentAnchor } from '../comments/types.js';
import type {
  DraftComment,
  PersistedDraftComment,
  PersistedReviewSession,
  ReviewSession,
} from './types.js';
import {
  clearSession,
  createSession,
  fromPersistedDraftComment,
  fromPersistedSession,
  submitSession,
  toPersistedDraftComment,
  toPersistedSession,
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

    expect('from' in (requiredValue(persisted.draftComments[0]).anchor ?? {})).toBe(false);
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
    expect(requiredValue(restored.draftComments[0]).anchor?.from).toBe(0);
  });
});
