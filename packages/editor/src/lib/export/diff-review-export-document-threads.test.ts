import { describe, expect, test } from 'bun:test';

import { validateDiffReviewExportDocumentThreads } from './diff-review-export-document-threads.js';

describe('DiffReview export document threads validation', () => {
  test('accepts an empty array', () => {
    expect(validateDiffReviewExportDocumentThreads([])).toEqual({ ok: true, value: [] });
  });

  test('rejects a non-array input', () => {
    const result = validateDiffReviewExportDocumentThreads({});
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-record', path: '/documentThreads', message: expect.any(String) },
    });
  });

  test('rejects a non-object thread element', () => {
    const result = validateDiffReviewExportDocumentThreads(['not-an-object']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0');
  });

  test('rejects a thread missing a required field', () => {
    const result = validateDiffReviewExportDocumentThreads([
      { targetId: 't', threadId: 'th', messages: [] },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/createdAt');
  });

  test('rejects a thread missing anchor (contract: "document-text or document-level anchor variant")', () => {
    const result = validateDiffReviewExportDocumentThreads([
      { targetId: 't', threadId: 'th', createdAt: '2026-01-01T00:00:00.000Z', messages: [] },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/anchor');
  });

  test('rejects an anchor with an unrecognized kind', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'text' },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/anchor/kind');
  });

  test('accepts a document-level anchor with no other keys', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(true);
  });

  test('rejects a document-level anchor carrying an extra key', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document', quote: 'nope' },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/anchor/quote');
  });

  test('accepts a document-text anchor with quote, prefix, and suffix', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: {
          kind: 'document-text',
          quote: 'the quoted text',
          prefix: 'before ',
          suffix: ' after',
        },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(true);
  });

  test('accepts a document-text anchor with null prefix/suffix', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document-text', quote: 'the quoted text', prefix: null, suffix: null },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(true);
  });

  test('rejects a document-text anchor with a non-string quote', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document-text', quote: 42, prefix: null, suffix: null },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/anchor/quote');
  });

  test('rejects a document-text anchor missing prefix/suffix', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document-text', quote: 'q' },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/anchor/prefix');
  });

  test('rejects an empty-string threadId', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/threadId');
  });

  test('rejects a non-array messages field', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: 'nope',
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/messages');
  });

  test('rejects a non-object message element', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [null],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/messages/0');
  });

  test('rejects a message with a non-string body', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [{ id: 'm1', body: 42, createdAt: '2026-01-01T00:00:00.000Z' }],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/messages/0/body');
  });

  test('rejects a message with an invalid deletedAt type', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [{ id: 'm1', body: 'hi', createdAt: '2026-01-01T00:00:00.000Z', deletedAt: 42 }],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/messages/0/deletedAt');
  });

  test('accepts a message with a null deletedAt', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [
          { id: 'm1', body: 'hi', createdAt: '2026-01-01T00:00:00.000Z', deletedAt: null },
        ],
      },
    ]);
    expect(result.ok).toBe(true);
  });

  test('accepts a fully valid thread with multiple messages', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't',
        threadId: 'th',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [
          { id: 'm1', body: 'hi', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'm2', body: 'there', createdAt: '2026-01-01T00:01:00.000Z' },
        ],
      },
    ]);
    expect(result.ok).toBe(true);
  });

  test('validates in order, failing atomically on the first bad element rather than the last', () => {
    const result = validateDiffReviewExportDocumentThreads([
      {
        targetId: 't1',
        threadId: 'th1',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [],
      },
      {
        targetId: 't2',
        threadId: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        anchor: { kind: 'document' },
        messages: [],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/1/threadId');
  });
});
