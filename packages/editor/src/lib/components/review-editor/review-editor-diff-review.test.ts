/**
 * Pure-function coverage for ReviewEditor's opt-in diff-review integration
 * (COR-512 / DR-7). These helpers have no DOM/rune dependency, so they run
 * under plain `bun:test` and cover the "ReviewEditor diff comments" suite's
 * data-shape rules without mounting the component.
 */

import { describe, expect, test } from 'bun:test';

import type { Thread } from '../../comments/index.ts';
import { createDiffReviewState } from '../../diff-review-state/index.ts';
import {
  buildReviewEditorDiffReviewTarget,
  diffReviewStatesEqual,
  projectReviewEditorDocumentThreads,
} from './review-editor-diff-review.ts';
import reviewEditorSchema from './review-editor.schema.ts';

describe('ReviewEditor diff comments: buildReviewEditorDiffReviewTarget', () => {
  test('builds a single markdown target keyed by the editor id', () => {
    const target = buildReviewEditorDiffReviewTarget('doc-1', 'before', 'after');
    expect(target).toEqual({
      targetId: 'doc-1',
      kind: 'markdown',
      label: 'Document diff',
      original: 'before',
      current: 'after',
      normalizeInputs: true,
    });
  });

  test('forwards an explicit normalizeInputs override', () => {
    const target = buildReviewEditorDiffReviewTarget('doc-1', 'before', 'after', false);
    expect(target.normalizeInputs).toBe(false);
  });
});

describe('ReviewEditor diff comments: diffReviewStatesEqual', () => {
  test('is true for two states built from identical inputs', () => {
    const targets = [
      {
        targetId: 'doc-1',
        kind: 'markdown' as const,
        label: 'Document diff',
        original: 'a',
        current: 'b',
        normalizeInputs: true,
      },
    ];
    const first = createDiffReviewState(targets);
    const second = createDiffReviewState(targets);
    if (!first.ok || !second.ok) throw new Error('setup failed');
    expect(diffReviewStatesEqual(first.value, second.value)).toBe(true);
  });

  test('is false once a field differs', () => {
    const targets = [
      {
        targetId: 'doc-1',
        kind: 'markdown' as const,
        label: 'Document diff',
        original: 'a',
        current: 'b',
        normalizeInputs: true,
      },
    ];
    const first = createDiffReviewState(targets);
    if (!first.ok) throw new Error('setup failed');
    const second = { ...first.value, reviewNote: 'changed' };
    expect(diffReviewStatesEqual(first.value, second)).toBe(false);
  });
});

describe('ReviewEditor diff comments: projectReviewEditorDocumentThreads', () => {
  function makeThread(overrides: Partial<Thread> = {}): Thread {
    return {
      id: 'thread-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      anchor: {
        type: 'text',
        quote: 'quoted text',
        prefix: 'before ',
        suffix: ' after',
        status: 'anchored',
        from: 0,
        to: 0,
      },
      comments: [
        {
          id: 'comment-1',
          threadId: 'thread-1',
          authorId: 'reviewer',
          body: 'Looks good',
          createdAt: '2026-01-01T00:00:01.000Z',
        },
      ],
      ...overrides,
    };
  }

  test('projects a text-anchored thread into the document-text variant', () => {
    const [record] = projectReviewEditorDocumentThreads('doc-1', [makeThread()]);
    expect(record).toEqual({
      targetId: 'doc-1',
      threadId: 'thread-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      anchor: { kind: 'document-text', quote: 'quoted text', prefix: 'before ', suffix: ' after' },
      messages: [{ id: 'comment-1', body: 'Looks good', createdAt: '2026-01-01T00:00:01.000Z' }],
    });
  });

  test('projects a document-level anchor into the document variant', () => {
    const thread = makeThread({
      anchor: {
        type: 'document',
        quote: '',
        prefix: '',
        suffix: '',
        status: 'anchored',
        from: 0,
        to: 0,
      },
    });
    const [record] = projectReviewEditorDocumentThreads('doc-1', [thread]);
    expect(record?.anchor).toEqual({ kind: 'document' });
  });

  test('carries a soft-deleted message deletedAt through, for the exporter to drop', () => {
    const thread = makeThread({
      comments: [
        {
          id: 'comment-1',
          threadId: 'thread-1',
          authorId: 'reviewer',
          body: 'deleted',
          createdAt: '2026-01-01T00:00:01.000Z',
          deletedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });
    const [record] = projectReviewEditorDocumentThreads('doc-1', [thread]);
    expect(record?.messages[0]).toEqual({
      id: 'comment-1',
      body: 'deleted',
      createdAt: '2026-01-01T00:00:01.000Z',
      deletedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('empty thread list projects to an empty array', () => {
    expect(projectReviewEditorDocumentThreads('doc-1', [])).toEqual([]);
  });
});

test('ReviewEditor schema artifacts include the public diff-review props', async () => {
  const jsonSchema = await Bun.file(new URL('./review-editor.schema.json', import.meta.url)).json();
  expect(jsonSchema).toEqual(reviewEditorSchema);
  const documentedProps = new Set([
    ...Object.keys(reviewEditorSchema.properties),
    ...(reviewEditorSchema.metadata?.unsupportedProps?.map(({ name }) => name) ?? []),
  ]);
  expect(documentedProps.has('diffReviewState')).toBe(true);
  expect(documentedProps.has('onDiffReviewStateChange')).toBe(true);
  const readme = await Bun.file(new URL('./README.md', import.meta.url)).text();
  const documentedOpaqueProps = [
    ...readme.matchAll(/^\| `([^`]+)`[ \t]*\|[ \t]*`\(opaque\)`[ \t]*\|/gm),
  ].map(([, name]) => name);
  expect(documentedOpaqueProps).toEqual(
    reviewEditorSchema.metadata?.unsupportedProps?.map(({ name }) => name) ?? [],
  );
});
