import { describe, expect, test } from 'bun:test';
import type { DraftComment, ReviewSession } from './types.js';
import {
  addDraftComment,
  clearReviewOutcome,
  clearSession,
  deleteDraftComment,
  setReviewOutcome,
  submitSession,
  updateDraftComment,
} from './updates.js';

const TEST_TIMESTAMP = '2024-01-15T12:00:00.000Z';

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
    const original = createTestSession({ draftComments: [createTestDraftComment()] });
    const result = clearSession(original, TEST_TIMESTAMP);

    expect(result.session).not.toBe(original);
  });

  test('submitSession returns new session object', () => {
    const original = createTestSession();
    const result = submitSession(original, 'approve', TEST_TIMESTAMP);

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
