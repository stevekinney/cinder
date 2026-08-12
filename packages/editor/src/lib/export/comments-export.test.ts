// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
/**
 * Tests for LLM-optimized comments export functionality.
 */

import { describe, expect, test } from 'bun:test';
import type { PersistedThread, ReviewState } from '../comments/types.js';
import { generateCommentsExport, generateCommentsJSON } from './comments-export';

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

  describe('orphaned anchors', () => {
    test('labels the location as missing instead of a line number', () => {
      const thread = createThread({ anchor: { ...createThread().anchor, status: 'orphaned' } });
      const result = generateCommentsExport(createState([thread]));

      expect(result.markdown).toContain('### Comment on text no longer in the document');
      expect(result.markdown).not.toContain('### Comment at Line 3:11');
    });

    test('presents positions as last known rather than current', () => {
      const thread = createThread({ anchor: { ...createThread().anchor, status: 'orphaned' } });
      const result = generateCommentsExport(createState([thread]));

      expect(result.markdown).toContain(
        '*This text was not found in the current document. Last known position: Line 3, Column 11 (offset 50)*',
      );
      expect(result.markdown).not.toContain('*Position: Line 3, Column 11');
    });

    test('falls back to the offset when there is no original position', () => {
      const thread = createThread({
        anchor: {
          quote: 'test document',
          prefix: '',
          suffix: '',
          status: 'orphaned',
          lastKnownOffset: 50,
        },
      });
      const result = generateCommentsExport(createState([thread]));

      expect(result.markdown).toContain(
        '*This text was not found in the current document. Last known position: offset 50*',
      );
      expect(result.markdown).not.toContain('### Comment at offset 50');
    });

    test('reports the absence even with no positional data at all', () => {
      const thread = createThread({
        anchor: { quote: 'test document', prefix: '', suffix: '', status: 'orphaned' },
      });
      const result = generateCommentsExport(createState([thread]));

      expect(result.markdown).toContain('*This text was not found in the current document.*');
    });

    test('keeps the thread, its quote, and its comments', () => {
      const thread = createThread({ anchor: { ...createThread().anchor, status: 'orphaned' } });
      const result = generateCommentsExport(createState([thread]));

      expect(result.markdown).toContain('> test document');
      expect(result.markdown).toContain('This needs clarification.');
      expect(result.stats.threadCount).toBe(1);
      expect(result.stats.commentCount).toBe(1);
    });

    test('leaves anchored threads formatted exactly as before', () => {
      const result = generateCommentsExport(createState([createThread()]));

      expect(result.markdown).toContain('### Comment at Line 3:11');
      expect(result.markdown).toContain('*Position: Line 3, Column 11 (offset 50)*');
      expect(result.markdown).not.toContain('no longer in the document');
      expect(result.markdown).not.toContain('was not found in the current document');
    });

    test('ignores the status on a document-level anchor', () => {
      // Document anchors are never re-anchored, so their status says nothing
      // about whether the document still contains anything.
      const thread = createThread({
        anchor: { quote: '', prefix: '', suffix: '', type: 'document', status: 'orphaned' },
      });
      const result = generateCommentsExport(createState([thread]));

      expect(result.markdown).toContain('## Document-Level Comments');
      expect(result.markdown).not.toContain('no longer in the document');
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

describe('generateCommentsJSON', () => {
  describe('anchored threads', () => {
    test('emits the selection and nothing else new', () => {
      const result = generateCommentsJSON(createState([createThread()]));
      const [exported] = result.data.threads;

      // Key order and membership are the backwards-compatibility contract:
      // anything a consumer parses today must still be shaped the same way.
      expect(Object.keys(exported)).toEqual(['id', 'type', 'comments', 'selection']);
      expect(exported.selection).toEqual({
        text: 'test document',
        from: 50,
        to: 63,
        line: 3,
        column: 11,
      });
      expect(exported.status).toBeUndefined();
      expect(exported.lastKnownSelection).toBeUndefined();
    });

    test('leaves document-level threads without a selection or status', () => {
      const thread = createThread({
        anchor: { quote: '', prefix: '', suffix: '', type: 'document', status: 'anchored' },
      });
      const [exported] = generateCommentsJSON(createState([thread])).data.threads;

      expect(exported.type).toBe('document');
      expect(exported.selection).toBeUndefined();
      expect(exported.status).toBeUndefined();
    });
  });

  describe('orphaned threads', () => {
    test('reports the status instead of a current selection', () => {
      const thread = createThread({ anchor: { ...createThread().anchor, status: 'orphaned' } });
      const [exported] = generateCommentsJSON(createState([thread])).data.threads;

      expect(exported.status).toBe('orphaned');
      expect(exported.selection).toBeUndefined();
    });

    test('keeps the stale offsets under lastKnownSelection', () => {
      const thread = createThread({ anchor: { ...createThread().anchor, status: 'orphaned' } });
      const [exported] = generateCommentsJSON(createState([thread])).data.threads;

      expect(exported.lastKnownSelection).toEqual({
        text: 'test document',
        from: 50,
        to: 63,
        line: 3,
        column: 11,
      });
    });

    test('does not drop the thread or its comments', () => {
      const thread = createThread({ anchor: { ...createThread().anchor, status: 'orphaned' } });
      const result = generateCommentsJSON(createState([thread]));

      expect(result.stats.threadCount).toBe(1);
      expect(result.stats.commentCount).toBe(1);
      expect(result.data.threads[0].comments[0].body).toBe('This needs clarification.');
    });

    test('serializes the status into the JSON string', () => {
      const thread = createThread({ anchor: { ...createThread().anchor, status: 'orphaned' } });
      const parsed = JSON.parse(generateCommentsJSON(createState([thread])).json);

      expect(parsed.threads[0].status).toBe('orphaned');
      expect(parsed.threads[0].selection).toBeUndefined();
    });
  });
});
