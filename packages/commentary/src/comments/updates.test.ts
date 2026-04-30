// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
import { describe, expect, test } from 'bun:test';
import type { Comment, CommentAnchor, Thread } from './types.js';
import {
  addComment,
  addThread,
  deleteComment,
  deleteThread,
  getVisibleComments,
  isCommentVisible,
  restoreComment,
  updateComment,
} from './updates.js';

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

function createTestComment(overrides?: Partial<Comment>): Comment {
  return {
    id: 'comment-1',
    threadId: 'thread-1',
    authorId: 'user-1',
    body: 'Test comment',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createTestThread(overrides?: Partial<Thread>): Thread {
  return {
    id: 'thread-1',
    anchor: createTestAnchor(),
    comments: [createTestComment()],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// Visibility Helpers
// ============================================================================

describe('isCommentVisible', () => {
  test('returns true for non-deleted comment', () => {
    const comment = createTestComment();
    expect(isCommentVisible(comment)).toBe(true);
  });

  test('returns false for deleted comment', () => {
    const comment = createTestComment({ deletedAt: '2024-01-02T00:00:00.000Z' });
    expect(isCommentVisible(comment)).toBe(false);
  });
});

describe('getVisibleComments', () => {
  test('returns all comments when none are deleted', () => {
    const thread = createTestThread({
      comments: [createTestComment({ id: 'c1' }), createTestComment({ id: 'c2' })],
    });
    expect(getVisibleComments(thread)).toHaveLength(2);
  });

  test('filters out deleted comments', () => {
    const thread = createTestThread({
      comments: [
        createTestComment({ id: 'c1' }),
        createTestComment({ id: 'c2', deletedAt: '2024-01-02T00:00:00.000Z' }),
        createTestComment({ id: 'c3' }),
      ],
    });
    const visible = getVisibleComments(thread);
    expect(visible).toHaveLength(2);
    expect(visible.map((c) => c.id)).toEqual(['c1', 'c3']);
  });

  test('returns empty array when all comments are deleted', () => {
    const thread = createTestThread({
      comments: [createTestComment({ id: 'c1', deletedAt: '2024-01-02T00:00:00.000Z' })],
    });
    expect(getVisibleComments(thread)).toEqual([]);
  });
});

// ============================================================================
// Thread Operations
// ============================================================================

describe('addThread', () => {
  test('adds thread to empty array', () => {
    const thread = createTestThread();
    const result = addThread([], thread);
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]).toBe(thread);
    expect(result.changed).toBe(true);
  });

  test('appends thread to existing array', () => {
    const existing = createTestThread({ id: 'thread-1' });
    const newThread = createTestThread({ id: 'thread-2' });
    const result = addThread([existing], newThread);
    expect(result.threads).toHaveLength(2);
    expect(result.threads[1].id).toBe('thread-2');
    expect(result.changed).toBe(true);
  });

  test('returns new array (immutable)', () => {
    const original: Thread[] = [];
    const result = addThread(original, createTestThread());
    expect(result.threads).not.toBe(original);
  });
});

describe('deleteThread', () => {
  test('removes existing thread', () => {
    const threads = [createTestThread({ id: 'thread-1' }), createTestThread({ id: 'thread-2' })];
    const result = deleteThread(threads, 'thread-1');
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0].id).toBe('thread-2');
    expect(result.changed).toBe(true);
  });

  test('returns unchanged when thread not found', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const result = deleteThread(threads, 'nonexistent');
    expect(result.threads).toBe(threads);
    expect(result.changed).toBe(false);
  });

  test('returns empty array when deleting last thread', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const result = deleteThread(threads, 'thread-1');
    expect(result.threads).toEqual([]);
    expect(result.changed).toBe(true);
  });
});

// ============================================================================
// Comment Operations
// ============================================================================

describe('addComment', () => {
  test('adds comment to existing thread', () => {
    const threads = [createTestThread({ id: 'thread-1', comments: [] })];
    const comment = createTestComment({ id: 'new-comment' });
    const result = addComment(threads, 'thread-1', comment);
    expect(result.threads[0].comments).toHaveLength(1);
    expect(result.threads[0].comments[0].id).toBe('new-comment');
    expect(result.changed).toBe(true);
    expect(result.value?.comment).toBe(comment);
  });

  test('returns unchanged when thread not found', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const comment = createTestComment();
    const result = addComment(threads, 'nonexistent', comment);
    expect(result.threads).toBe(threads);
    expect(result.changed).toBe(false);
    expect(result.value).toBeUndefined();
  });

  test('appends to existing comments', () => {
    const existingComment = createTestComment({ id: 'existing' });
    const threads = [createTestThread({ id: 'thread-1', comments: [existingComment] })];
    const newComment = createTestComment({ id: 'new' });
    const result = addComment(threads, 'thread-1', newComment);
    expect(result.threads[0].comments).toHaveLength(2);
    expect(result.threads[0].comments[0].id).toBe('existing');
    expect(result.threads[0].comments[1].id).toBe('new');
  });
});

describe('updateComment', () => {
  test('updates comment body and mentions', () => {
    const threads = [
      createTestThread({
        id: 'thread-1',
        comments: [createTestComment({ id: 'comment-1', body: 'Original' })],
      }),
    ];
    const result = updateComment(threads, 'thread-1', 'comment-1', {
      body: 'Updated body',
      mentions: ['alice'],
      editedAt: '2024-01-02T00:00:00.000Z',
    });
    expect(result.threads[0].comments[0].body).toBe('Updated body');
    expect(result.threads[0].comments[0].mentions).toEqual(['alice']);
    expect(result.threads[0].comments[0].editedAt).toBe('2024-01-02T00:00:00.000Z');
    expect(result.changed).toBe(true);
  });

  test('returns unchanged when thread not found', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const result = updateComment(threads, 'nonexistent', 'comment-1', {
      body: 'Updated',
      editedAt: '2024-01-02T00:00:00.000Z',
    });
    expect(result.threads).toBe(threads);
    expect(result.changed).toBe(false);
  });

  test('returns unchanged when comment not found', () => {
    const threads = [createTestThread({ id: 'thread-1' })];
    const result = updateComment(threads, 'thread-1', 'nonexistent', {
      body: 'Updated',
      editedAt: '2024-01-02T00:00:00.000Z',
    });
    expect(result.threads).toBe(threads);
    expect(result.changed).toBe(false);
  });

  test('returns unchanged when comment is deleted', () => {
    const threads = [
      createTestThread({
        id: 'thread-1',
        comments: [createTestComment({ id: 'comment-1', deletedAt: '2024-01-02T00:00:00.000Z' })],
      }),
    ];
    const result = updateComment(threads, 'thread-1', 'comment-1', {
      body: 'Updated',
      editedAt: '2024-01-03T00:00:00.000Z',
    });
    expect(result.changed).toBe(false);
  });
});

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
      expect(result.threads[0].comments[0].deletedAt).toBe('2024-01-02T00:00:00.000Z');
      expect(result.threads[0].comments).toHaveLength(1);
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

    test('returns unchanged when deletedAt not provided for soft delete', () => {
      const threads = [
        createTestThread({
          id: 'thread-1',
          comments: [createTestComment({ id: 'comment-1' })],
        }),
      ];
      const result = deleteComment(threads, 'thread-1', 'comment-1', { soft: true });
      expect(result.changed).toBe(false);
      expect(result.threads[0].comments[0].deletedAt).toBeUndefined();
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
      expect(result.threads[0].comments).toHaveLength(1);
      expect(result.threads[0].comments[0].id).toBe('c2');
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
      expect(result.threads[0].comments).toHaveLength(0);
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
    expect(result.threads[0].comments[0].deletedAt).toBeUndefined();
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
// ============================================================================

describe('immutability', () => {
  test('addThread returns new array', () => {
    const original: Thread[] = [];
    const result = addThread(original, createTestThread());
    expect(result.threads).not.toBe(original);
  });

  test('deleteThread returns new array when changed', () => {
    const original = [createTestThread({ id: 'thread-1' })];
    const result = deleteThread(original, 'thread-1');
    expect(result.threads).not.toBe(original);
  });

  test('addComment returns new thread and comments array', () => {
    const original = [createTestThread({ id: 'thread-1', comments: [] })];
    const result = addComment(original, 'thread-1', createTestComment());
    expect(result.threads[0]).not.toBe(original[0]);
    expect(result.threads[0].comments).not.toBe(original[0].comments);
  });

  test('updateComment returns new comment object', () => {
    const original = [
      createTestThread({
        id: 'thread-1',
        comments: [createTestComment({ id: 'comment-1' })],
      }),
    ];
    const result = updateComment(original, 'thread-1', 'comment-1', {
      body: 'Updated',
      editedAt: '2024-01-02T00:00:00.000Z',
    });
    expect(result.threads[0].comments[0]).not.toBe(original[0].comments[0]);
  });
});
