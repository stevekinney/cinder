// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
/**
 * Tests for LLM-optimized comments export functionality.
 */

import { describe, expect, test } from 'bun:test';
import type { PersistedThread, ReviewState } from '../comments/types.js';
import { generateCommentsExport } from './comments-export';

/** Create a minimal ReviewState for testing */
function createState(threads: PersistedThread[] = []): ReviewState {
  return {
    schemaVersion: 4,
    content: '# Test Document\n\nThis is a test document with some content.',
    original: '# Test Document\n\nThis is a test document with some content.',
    threads,
    updatedAt: new Date().toISOString(),
  };
}

/** Create a thread for testing */
function createThread(overrides: Partial<PersistedThread> = {}): PersistedThread {
  return {
    id: 'thread-1',
    createdAt: '2024-01-15T10:00:00Z',
    anchor: {
      quote: 'test document',
      prefix: 'This is a ',
      suffix: ' with some',
      status: 'anchored',
      originalQuote: 'test document',
      lastKnownOffset: 50,
      originalPosition: {
        offset: 50,
        line: 3,
        column: 11,
      },
    },
    comments: [
      {
        id: 'comment-1',
        threadId: 'thread-1',
        authorId: 'user-1',
        body: 'This needs clarification.',
        createdAt: '2024-01-15T10:00:00Z',
      },
    ],
    ...overrides,
  };
}

describe('generateCommentsExport', () => {
  describe('basic functionality', () => {
    test('returns empty message when there are no threads', () => {
      const state = createState([]);
      const result = generateCommentsExport(state);

      expect(result.markdown).toContain('No comments to export');
      expect(result.stats.threadCount).toBe(0);
      expect(result.stats.commentCount).toBe(0);
    });

    test('exports a single thread with one comment', () => {
      const state = createState([createThread()]);
      const result = generateCommentsExport(state);

      expect(result.markdown).toContain('# Review Comments');
      expect(result.markdown).toContain('test document');
      expect(result.markdown).toContain('This needs clarification');
      expect(result.markdown).toContain('Line 3, Column 11');
      expect(result.stats.threadCount).toBe(1);
      expect(result.stats.commentCount).toBe(1);
    });

    test('exports multiple threads', () => {
      const thread1 = createThread();
      const thread2 = createThread({
        id: 'thread-2',
        anchor: {
          quote: 'some content',
          prefix: '',
          suffix: '',
          status: 'anchored',
          originalQuote: 'some content',
          lastKnownOffset: 100,
          originalPosition: {
            offset: 100,
            line: 5,
            column: 1,
          },
        },
        comments: [
          {
            id: 'comment-2',
            threadId: 'thread-2',
            authorId: 'user-2',
            body: 'Consider rewording this.',
            createdAt: '2024-01-15T11:00:00Z',
          },
        ],
      });

      const state = createState([thread1, thread2]);
      const result = generateCommentsExport(state);

      expect(result.stats.threadCount).toBe(2);
      expect(result.stats.commentCount).toBe(2);
      expect(result.markdown).toContain('This needs clarification');
      expect(result.markdown).toContain('Consider rewording this');
    });

    test('exports multiple comments in a single thread', () => {
      const thread = createThread({
        comments: [
          {
            id: 'comment-1',
            threadId: 'thread-1',
            authorId: 'user-1',
            body: 'First comment',
            createdAt: '2024-01-15T10:00:00Z',
          },
          {
            id: 'comment-2',
            threadId: 'thread-1',
            authorId: 'user-2',
            body: 'Second comment',
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
      });

      const state = createState([thread]);
      const result = generateCommentsExport(state);

      expect(result.stats.threadCount).toBe(1);
      expect(result.stats.commentCount).toBe(2);
      expect(result.markdown).toContain('First comment');
      expect(result.markdown).toContain('Second comment');
    });
  });

  describe('filtering', () => {
    test('excludes deleted comments', () => {
      const thread = createThread({
        comments: [
          {
            id: 'comment-1',
            threadId: 'thread-1',
            authorId: 'user-1',
            body: 'Visible comment',
            createdAt: '2024-01-15T10:00:00Z',
          },
          {
            id: 'comment-2',
            threadId: 'thread-1',
            authorId: 'user-1',
            body: 'Deleted comment',
            createdAt: '2024-01-15T10:30:00Z',
            deletedAt: '2024-01-15T11:00:00Z',
          },
        ],
      });

      const state = createState([thread]);
      const result = generateCommentsExport(state);

      expect(result.markdown).toContain('Visible comment');
      expect(result.markdown).not.toContain('Deleted comment');
      expect(result.stats.commentCount).toBe(1);
    });

    test('excludes threads with only deleted comments', () => {
      const thread = createThread({
        comments: [
          {
            id: 'comment-1',
            threadId: 'thread-1',
            authorId: 'user-1',
            body: 'Deleted comment',
            createdAt: '2024-01-15T10:00:00Z',
            deletedAt: '2024-01-15T11:00:00Z',
          },
        ],
      });

      const state = createState([thread]);
      const result = generateCommentsExport(state);

      expect(result.stats.threadCount).toBe(0);
    });
  });

  describe('formatting', () => {
    test('includes author ID when option is set', () => {
      const state = createState([createThread()]);
      const result = generateCommentsExport(state, { includeAuthorIds: true });

      expect(result.markdown).toContain('user-1');
    });

    test('uses generic author when option is false', () => {
      const state = createState([createThread()]);
      const result = generateCommentsExport(state, { includeAuthorIds: false });

      expect(result.markdown).not.toContain('user-1');
      expect(result.markdown).toContain('Reviewer');
    });

    test('includes timestamps when option is set', () => {
      const state = createState([createThread()]);
      const result = generateCommentsExport(state, { includeTimestamps: true });

      expect(result.markdown).toContain('2024-01-15');
    });

    test('excludes timestamps when option is false', () => {
      const state = createState([createThread()]);
      const result = generateCommentsExport(state, { includeTimestamps: false });

      // Should not have the date in parentheses after the author
      expect(result.markdown).not.toMatch(/\(2024-01-15\)/);
    });

    test('formats highlighted text in blockquote', () => {
      const state = createState([createThread()]);
      const result = generateCommentsExport(state);

      // Highlighted text is rendered as a blockquote
      expect(result.markdown).toContain('> test document');
    });

    test('shows position information', () => {
      const state = createState([createThread()]);
      const result = generateCommentsExport(state);

      // Position is shown as italicized text with line and column info
      expect(result.markdown).toContain('*Position:');
      expect(result.markdown).toContain('Line 3');
      expect(result.markdown).toContain('Column 11');
    });

    test('includes summary statistics at the end', () => {
      const state = createState([createThread()]);
      const result = generateCommentsExport(state);

      expect(result.markdown).toContain('**Total threads:** 1');
      expect(result.markdown).toContain('**Total comments:** 1');
    });
  });

  describe('sorting', () => {
    test('sorts threads by line number', () => {
      const thread1 = createThread({
        id: 'thread-1',
        anchor: {
          quote: 'later text',
          prefix: '',
          suffix: '',
          status: 'anchored',
          originalQuote: 'later text',
          lastKnownOffset: 100,
          originalPosition: { offset: 100, line: 10, column: 1 },
        },
        comments: [
          {
            id: 'c1',
            threadId: 'thread-1',
            authorId: 'user-1',
            body: 'Comment on later text',
            createdAt: '2024-01-15T10:00:00Z',
          },
        ],
      });

      const thread2 = createThread({
        id: 'thread-2',
        anchor: {
          quote: 'earlier text',
          prefix: '',
          suffix: '',
          status: 'anchored',
          originalQuote: 'earlier text',
          lastKnownOffset: 20,
          originalPosition: { offset: 20, line: 2, column: 1 },
        },
        comments: [
          {
            id: 'c2',
            threadId: 'thread-2',
            authorId: 'user-1',
            body: 'Comment on earlier text',
            createdAt: '2024-01-15T10:00:00Z',
          },
        ],
      });

      const state = createState([thread1, thread2]);
      const result = generateCommentsExport(state);

      // Earlier text should appear before later text
      const earlierIndex = result.markdown.indexOf('earlier text');
      const laterIndex = result.markdown.indexOf('later text');
      expect(earlierIndex).toBeLessThan(laterIndex);
    });
  });
});
