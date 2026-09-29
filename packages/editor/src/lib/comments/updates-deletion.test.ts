import { requiredValue } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { createTestComment, createTestThread } from './updates-test-fixtures.ts';
import { deleteComment, getVisibleComments, restoreComment } from './updates.ts';

describe('deleteComment', () => {
  describe('soft delete', () => {
    test('sets deletedAt timestamp', () => {
      const threads = [
        createTestThread({
          id: 'thread-1',
          comments: [createTestComment({ id: 'comment-1' })],
        }),
      ];
      const result = deleteComment(threads, 'thread-1', 'comment-1', {
        soft: true,
        deletedAt: '2024-01-02T00:00:00.000Z',
      });
      expect(requiredValue(requiredValue(result.threads[0]).comments[0]).deletedAt).toBe(
        '2024-01-02T00:00:00.000Z',
      );
      expect(requiredValue(result.threads[0]).comments).toHaveLength(1);
      expect(result.changed).toBe(true);
    });

    test('returns unchanged when already deleted', () => {
      const threads = [
        createTestThread({
          id: 'thread-1',
          comments: [createTestComment({ id: 'comment-1', deletedAt: '2024-01-02T00:00:00.000Z' })],
        }),
      ];
      const result = deleteComment(threads, 'thread-1', 'comment-1', {
        soft: true,
        deletedAt: '2024-01-03T00:00:00.000Z',
      });
      expect(result.changed).toBe(false);
    });

    // Regression: CommentDeleteEvent is `{ threadId, commentId, soft }` — no
    // deletedAt — so the obvious consumer wiring omits it. deleteComment used to
    // bail in that case, silently no-opping the primary deletion path while
    // ReviewEditor had already announced "Comment deleted" to screen readers.
    test('stamps the current time when a soft delete omits deletedAt', () => {
      const threads = [
        createTestThread({
          id: 'thread-1',
          comments: [createTestComment({ id: 'comment-1' })],
        }),
      ];
      const before = Date.now();
      const result = deleteComment(threads, 'thread-1', 'comment-1', { soft: true });
      const after = Date.now();

      expect(result.changed).toBe(true);
      const { deletedAt } = requiredValue(requiredValue(result.threads[0]).comments[0]);
      expect(typeof deletedAt).toBe('string');
      // Stamped by the reducer, so assert it is a real ISO instant from this moment.
      if (typeof deletedAt !== 'string') throw new TypeError('Expected deletedAt to be a string');
      expect(deletedAt).toBe(new Date(deletedAt).toISOString());
      const stamped = Date.parse(deletedAt);
      expect(stamped).toBeGreaterThanOrEqual(before);
      expect(stamped).toBeLessThanOrEqual(after);

      // The comment stays in the array but drops out of the visible set.
      expect(requiredValue(result.threads[0]).comments).toHaveLength(1);
      expect(getVisibleComments(requiredValue(result.threads[0]))).toHaveLength(0);
    });

    test('an explicit deletedAt still wins over the stamped default', () => {
      const threads = [
        createTestThread({
          id: 'thread-1',
          comments: [createTestComment({ id: 'comment-1' })],
        }),
      ];
      const result = deleteComment(threads, 'thread-1', 'comment-1', {
        soft: true,
        deletedAt: '2020-01-01T00:00:00.000Z',
      });
      expect(requiredValue(requiredValue(result.threads[0]).comments[0]).deletedAt).toBe(
        '2020-01-01T00:00:00.000Z',
      );
    });

    test('still returns unchanged for an already-deleted comment when deletedAt is omitted', () => {
      const threads = [
        createTestThread({
          id: 'thread-1',
          comments: [createTestComment({ id: 'comment-1', deletedAt: '2024-01-02T00:00:00.000Z' })],
        }),
      ];
      const result = deleteComment(threads, 'thread-1', 'comment-1', { soft: true });
      expect(result.changed).toBe(false);
      expect(result.threads).toBe(threads);
      expect(requiredValue(requiredValue(result.threads[0]).comments[0]).deletedAt).toBe(
        '2024-01-02T00:00:00.000Z',
      );
    });
  });

  describe('hard delete', () => {
    test('removes comment from array', () => {
      const threads = [
        createTestThread({
          id: 'thread-1',
          comments: [createTestComment({ id: 'c1' }), createTestComment({ id: 'c2' })],
        }),
      ];
      const result = deleteComment(threads, 'thread-1', 'c1', { soft: false });
      expect(requiredValue(result.threads[0]).comments).toHaveLength(1);
      expect(requiredValue(requiredValue(result.threads[0]).comments[0]).id).toBe('c2');
      expect(result.changed).toBe(true);
    });

    test('can hard delete already soft-deleted comment', () => {
      const threads = [
        createTestThread({
          id: 'thread-1',
          comments: [createTestComment({ id: 'comment-1', deletedAt: '2024-01-02T00:00:00.000Z' })],
        }),
      ];
      const result = deleteComment(threads, 'thread-1', 'comment-1', { soft: false });
      expect(requiredValue(result.threads[0]).comments).toHaveLength(0);
      expect(result.changed).toBe(true);
    });
  });

  test('returns unchanged when thread not found', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const result = deleteComment(threads, 'nonexistent', 'comment-1', { soft: true });
    expect(result.changed).toBe(false);
  });

  test('returns unchanged when comment not found', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const result = deleteComment(threads, 'thread-1', 'nonexistent', { soft: true });
    expect(result.changed).toBe(false);
  });
});

describe('restoreComment', () => {
  test('removes deletedAt from soft-deleted comment', () => {
    const threads = [
      createTestThread({
        id: 'thread-1',
        comments: [createTestComment({ id: 'comment-1', deletedAt: '2024-01-02T00:00:00.000Z' })],
      }),
    ];
    const result = restoreComment(threads, 'thread-1', 'comment-1');
    expect(requiredValue(requiredValue(result.threads[0]).comments[0]).deletedAt).toBeUndefined();
    expect(result.changed).toBe(true);
  });

  test('returns unchanged when comment is not deleted', () => {
    const threads = [
      createTestThread({
        id: 'thread-1',
        comments: [createTestComment({ id: 'comment-1' })],
      }),
    ];
    const result = restoreComment(threads, 'thread-1', 'comment-1');
    expect(result.changed).toBe(false);
  });

  test('returns unchanged when thread not found', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const result = restoreComment(threads, 'nonexistent', 'comment-1');
    expect(result.changed).toBe(false);
  });

  test('returns unchanged when comment not found', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const result = restoreComment(threads, 'thread-1', 'nonexistent');
    expect(result.changed).toBe(false);
  });
});

// ============================================================================
// Immutability Checks
