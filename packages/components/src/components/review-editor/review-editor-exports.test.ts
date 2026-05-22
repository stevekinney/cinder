import { describe, expect, test } from 'bun:test';

import type { ReviewState, Thread } from 'cinder/commentary/comments';

import { setupHappyDom } from '../../test/happy-dom.ts';

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

  test('builds form data from raw values and persisted thread anchors', () => {
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
    const parsedComments = JSON.parse(result.comments) as Thread[];

    expect(parsedComments[0]?.anchor.quote).toBe('test text');
    expect(parsedComments[0]?.anchor.prefix).toBe('pre');
    expect(parsedComments[0]?.anchor.suffix).toBe('suf');
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
