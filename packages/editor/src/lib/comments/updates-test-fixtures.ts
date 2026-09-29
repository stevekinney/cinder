import type { Comment, CommentAnchor, Thread } from './types.ts';

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

export function createTestComment(overrides?: Partial<Comment>): Comment {
  return {
    id: 'comment-1',
    threadId: 'thread-1',
    authorId: 'user-1',
    body: 'Test comment',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createTestThread(overrides?: Partial<Thread>): Thread {
  return {
    id: 'thread-1',
    anchor: createTestAnchor(),
    comments: [createTestComment()],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}
