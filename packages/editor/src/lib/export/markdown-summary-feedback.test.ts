/**
 * Tests for LLM Markdown summary export functionality.
 */

import { describe, expect, test } from 'bun:test';
import type { PersistedThread, ReviewState } from '../comments/types.js';
import { generateMarkdownSummary } from './markdown-summary';

/** Create a minimal ReviewState for testing */
function createState(
  options: {
    original?: string;
    current?: string;
    threads?: PersistedThread[];
  } = {},
): ReviewState {
  return {
    schemaVersion: 4,
    content: options.current ?? 'Current content',
    original: options.original ?? 'Original content',
    threads: options.threads ?? [],
    updatedAt: new Date().toISOString(),
  };
}

/** Create a test thread */
function createThread(
  options: {
    id?: string;
    quote?: string;
    line?: number;
    status?: 'anchored' | 'orphaned';
    comments?: Array<{ id: string; authorId: string; body: string; deletedAt?: string }>;
  } = {},
): PersistedThread {
  const now = new Date().toISOString();
  const threadId = options.id ?? 'thread-1';

  // Build comments with required fields filled in
  const comments = options.comments
    ? options.comments.map((c) => ({
        ...c,
        threadId,
        createdAt: now,
      }))
    : [
        {
          id: 'comment-1',
          threadId,
          authorId: 'user-123',
          body: 'Test comment',
          createdAt: now,
        },
      ];

  return {
    id: threadId,
    anchor: {
      quote: options.quote ?? 'selected text',
      prefix: 'before ',
      suffix: ' after',
      status: options.status ?? 'anchored',
      originalPosition: {
        offset: 0,
        line: options.line ?? 1,
        column: 1,
      },
    },
    comments,
    createdAt: now,
  };
}

describe('generateMarkdownSummary', () => {
  describe('soft-deleted comments', () => {
    test('excludes soft-deleted comments', () => {
      const thread = createThread({
        comments: [
          {
            id: 'visible',
            authorId: 'user-1',
            body: 'Visible comment',
          },
          {
            id: 'deleted',
            authorId: 'user-2',
            body: 'Deleted comment',
            deletedAt: new Date().toISOString(),
          },
        ],
      });
      const state = createState({ threads: [thread] });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('Visible comment');
      expect(result.markdown).not.toContain('Deleted comment');
    });

    test('excludes threads with only deleted comments', () => {
      const thread = createThread({
        comments: [
          {
            id: 'deleted',
            authorId: 'user-1',
            body: 'Deleted comment',
            deletedAt: new Date().toISOString(),
          },
        ],
      });
      const state = createState({ threads: [thread] });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Feedback');
    });
  });

  describe('orphaned anchors', () => {
    test('marks the quote as gone from the document', () => {
      const state = createState({
        threads: [createThread({ quote: 'vanished text', status: 'orphaned' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('### On "vanished text" (no longer in the document)');
    });

    test('still reports the feedback itself', () => {
      const state = createState({
        threads: [createThread({ quote: 'vanished text', status: 'orphaned' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('Test comment');
      expect(result.stats.threadCount).toBe(1);
    });

    test('leaves anchored threads unlabelled', () => {
      const state = createState({
        threads: [createThread({ quote: 'present text' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('### On "present text"\n');
      expect(result.markdown).not.toContain('no longer in the document');
    });

    test('claims no position for the vanished text', () => {
      // The summary is the one format that never printed coordinates, which is
      // why the quote heading was its only misleading signal. Keep it that way:
      // an orphan's stored offsets describe a document that no longer exists.
      const state = createState({
        original: 'Unchanged content',
        current: 'Unchanged content',
        threads: [createThread({ quote: 'vanished text', status: 'orphaned', line: 12 })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('offset');
      expect(result.markdown).not.toMatch(/Line \d+/);
      expect(result.markdown).not.toContain('position');
    });
  });

  describe('statistics (internal)', () => {
    test('counts changes correctly', () => {
      const state = createState({
        original: 'Line 1\nLine 2',
        current: 'Line 1\nModified',
      });
      const result = generateMarkdownSummary(state);

      expect(result.stats.changeCount).toBeGreaterThan(0);
    });

    test('counts threads correctly', () => {
      const state = createState({
        threads: [createThread({ id: 'thread-1' }), createThread({ id: 'thread-2' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.stats.threadCount).toBe(2);
    });
  });
});
