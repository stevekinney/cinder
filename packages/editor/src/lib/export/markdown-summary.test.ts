// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
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
      status: 'anchored',
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
  describe('basic structure', () => {
    test('returns empty message when no changes or feedback', () => {
      const state = createState({
        original: 'Same content',
        current: 'Same content',
        threads: [],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toBe('No changes or feedback to report.');
    });

    test('does not include statistics section', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Statistics');
    });

    test('does not include Review Summary header', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('# Review Summary');
    });

    test('returns correct stats object', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.stats.threadCount).toBe(1);
    });
  });

  describe('document changes section', () => {
    test('includes changes when content differs', () => {
      const state = createState({
        original: 'Hello world',
        current: 'Hello universe',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('## Changes Made');
      expect(result.stats.changeCount).toBeGreaterThan(0);
    });

    test('includes explanatory text for changes', () => {
      const state = createState({
        original: 'Hello world',
        current: 'Hello universe',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('The following edits were made');
    });

    test('omits changes section when content is identical', () => {
      const state = createState({
        original: 'Same content',
        current: 'Same content',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Changes Made');
      expect(result.stats.changeCount).toBe(0);
    });

    test('shows diff format with + and - prefixes', () => {
      const state = createState({
        original: 'Old line',
        current: 'New line',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('-Old line');
      expect(result.markdown).toContain('+New line');
    });

    test('calculates line range correctly when additions are present', () => {
      const state = createState({
        original: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
        current: 'Line 1\nModified 2\nNew Line A\nNew Line B\nLine 3\nLine 4\nLine 5',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toMatch(/### Lines 1-4/);
      expect(result.markdown).not.toMatch(/### Lines 1-[5-9]/);
    });
  });

  describe('feedback section', () => {
    test('includes feedback section when threads exist', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('## Feedback');
    });

    test('includes explanatory text for feedback', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('may require action');
    });

    test('omits feedback section when no threads', () => {
      const state = createState({ threads: [] });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Feedback');
    });

    test('shows thread anchor quote in heading', () => {
      const state = createState({
        threads: [createThread({ quote: 'important text' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('### On "important text"');
    });

    test('uses document-level heading for empty quotes', () => {
      const thread = createThread({ quote: '' });
      // Clear the quote to simulate document-level comment
      thread.anchor.quote = '';
      const state = createState({ threads: [thread] });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('### Document-level feedback');
    });

    test('does not include author IDs by default', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('user-123');
    });

    test('includes author IDs when option is true', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state, { includeAuthorIds: true });

      expect(result.markdown).toContain('user-123');
    });

    test('does not include timestamps by default', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      // Should not contain ISO timestamp format in parentheses
      expect(result.markdown).not.toMatch(/\(\d{4}-\d{2}-\d{2}T/);
    });

    test('includes timestamps when option is true', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state, { includeTimestamps: true });

      // Should contain ISO timestamp format
      expect(result.markdown).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

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
