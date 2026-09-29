import { describe, expect, test } from 'bun:test';

import { toPersistedThreads, type ReviewState, type Thread } from '../../comments/index.ts';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const {
  buildFormData,
  buildFormDataFromValues,
  exportCommentsMarkdown,
  exportMarkdownSummary,
  exportUnifiedDiff,
  getSummaryContentWithoutHeading,
} = await import('./review-editor-exports.ts');

function createReviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    schemaVersion: 4,
    content: 'Current content',
    original: 'Original content',
    threads: [],
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createThread(overrides: Partial<Thread> = {}): Thread {
  const id = overrides.id ?? 'thread-1';

  return {
    id,
    createdAt: '2024-01-01T00:00:00.000Z',
    comments: [
      {
        id: 'comment-1',
        threadId: id,
        authorId: 'user-1',
        body: 'Test comment',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    anchor: {
      from: 0,
      to: 10,
      quote: 'Test quote',
      prefix: '',
      suffix: '',
      status: 'anchored',
      originalQuote: 'Test quote',
    },
    ...overrides,
  };
}

describe('review-editor export helpers', () => {
  test('builds form data from a review state', () => {
    const result = buildFormData(
      createReviewState({
        content: 'Current text',
        original: 'Original text',
        threads: [createThread({ id: 'test-thread' })],
      }),
    );

    expect(result.original).toBe('Original text');
    expect(result.current).toBe('Current text');
    expect(result.comments).toContain('test-thread');
    expect(result.diff).toContain('---');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  test('builds form data from raw values and preserves live thread positions', () => {
    const thread = createThread({
      anchor: {
        from: 5,
        to: 15,
        quote: 'test text',
        prefix: 'pre',
        suffix: 'suf',
        status: 'anchored',
        originalQuote: 'test text',
      },
    });

    const result = buildFormDataFromValues('Original', 'Current', [thread]);
    const comments = JSON.parse(result.comments) as Array<{
      anchor: { from?: number; to?: number; quote: string };
    }>;

    expect(comments[0]?.anchor.from).toBe(5);
    expect(comments[0]?.anchor.to).toBe(15);
    expect(result.comments).toContain('"quote":"test text"');
    expect(result.comments).toContain('"prefix":"pre"');
    expect(result.comments).toContain('"suffix":"suf"');
  });

  test('keeps persisted form state free of runtime positions', () => {
    const thread = createThread({
      anchor: {
        from: 5,
        to: 15,
        quote: 'test text',
        prefix: 'pre',
        suffix: 'suf',
        status: 'anchored',
        originalQuote: 'test text',
      },
    });

    const result = buildFormData(
      createReviewState({
        content: 'Current',
        original: 'Original',
        threads: toPersistedThreads([thread]),
      }),
    );
    const comments = JSON.parse(result.comments) as Array<{
      anchor: { from?: number; to?: number; quote: string };
    }>;

    expect(comments[0]?.anchor.from).toBeUndefined();
    expect(comments[0]?.anchor.to).toBeUndefined();
    expect(comments[0]?.anchor.quote).toBe('test text');
  });

  test('exports markdown summaries, unified diffs, and comments', () => {
    const state = createReviewState({
      content: 'Line 1\nLine 2 modified\nLine 3',
      original: 'Line 1\nLine 2\nLine 3',
      threads: [createThread()],
    });

    expect(exportMarkdownSummary(state).markdown).toContain('Changes Made');
    expect(exportUnifiedDiff(state).diff).toContain('+Line 2 modified');
    expect(exportCommentsMarkdown(state)).toContain('Test comment');
    expect(getSummaryContentWithoutHeading(state)).not.toMatch(/^# Review Summary/);
  });
});
