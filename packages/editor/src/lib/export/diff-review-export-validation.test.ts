import { describe, expect, test } from 'bun:test';

import {
  duplicateCommentIdStateFixture,
  invalidTimestampStateFixture,
  unknownTopLevelKeyStateFixture,
  unsupportedVersionStateFixture,
} from '../diff-review-state/fixtures.js';
import type { DiffReviewState } from '../diff-review-state/index.js';
import { emptyReviewFixture, twoSourceTargetsFixture } from './diff-review-export-fixtures.js';
import { exportDiffReviewJson, exportDiffReviewMarkdown } from './diff-review-export.js';

describe('DiffReview export invalid input', () => {
  test('rejects an unsupported state version atomically, with no partial Markdown', () => {
    const result = exportDiffReviewMarkdown(
      unsupportedVersionStateFixture as unknown as DiffReviewState,
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'unsupported-version',
        path: '/version',
        message: expect.any(String),
      },
    });
  });

  test('rejects an unsupported state version atomically, with no partial JSON', () => {
    const result = exportDiffReviewJson(
      unsupportedVersionStateFixture as unknown as DiffReviewState,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe('unsupported-version');
  });

  test('rejects an unknown top-level state key', () => {
    const result = exportDiffReviewMarkdown(unknownTopLevelKeyStateFixture);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe('invalid-record');
  });

  test('rejects a duplicate comment id', () => {
    const result = exportDiffReviewJson(duplicateCommentIdStateFixture);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe('duplicate-id');
  });

  test('rejects a noncanonical comment timestamp', () => {
    const result = exportDiffReviewJson(invalidTimestampStateFixture);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe('invalid-timestamp');
  });

  test('blocks export on a pending (nonempty) draft, for both formats', () => {
    const stateWithDraft: DiffReviewState = {
      ...twoSourceTargetsFixture,
      drafts: [
        {
          draftId: 'draft-1',
          targetId: 'left',
          anchor: { kind: 'file', fileOccurrence: 0 },
          capturedContext: twoSourceTargetsFixture.comments[0]!.capturedContext,
          body: 'Still writing this...',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          outdated: false,
        },
      ],
    };

    const markdown = exportDiffReviewMarkdown(stateWithDraft);
    const json = exportDiffReviewJson(stateWithDraft);
    expect(markdown).toEqual({
      ok: false,
      error: { code: 'drafts-pending', path: '/drafts', message: expect.any(String) },
    });
    expect(json.ok).toBe(false);
  });

  test('a whitespace-only draft does not block export (not "pending")', () => {
    const stateWithWhitespaceDraft: DiffReviewState = {
      ...emptyReviewFixture,
      targets: twoSourceTargetsFixture.targets,
      drafts: [
        {
          draftId: 'draft-ws',
          targetId: 'left',
          anchor: { kind: 'file', fileOccurrence: 0 },
          capturedContext: twoSourceTargetsFixture.comments[0]!.capturedContext,
          body: '   \n  ',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          outdated: false,
        },
      ],
    };

    const result = exportDiffReviewMarkdown(stateWithWhitespaceDraft);
    expect(result.ok).toBe(true);
  });

  test('rejects a malformed documentThreads entry atomically, before touching diff comments', () => {
    const result = exportDiffReviewMarkdown(twoSourceTargetsFixture, {
      // @ts-expect-error deliberately malformed for the test
      documentThreads: [{ targetId: 'doc-1', threadId: 'thread-1', createdAt: 'not-a-date' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe('invalid-record');
    expect(result.error.path).toMatch(/^\/documentThreads\/0/);
  });

  test('rejects a documentThreads entry with an unknown key', () => {
    const result = exportDiffReviewJson(twoSourceTargetsFixture, {
      documentThreads: [
        {
          targetId: 'doc-1',
          threadId: 'thread-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          messages: [],
          // @ts-expect-error deliberately malformed for the test
          extra: true,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.path).toBe('/documentThreads/0/extra');
  });

  test('an empty review (no targets, no comments) exports successfully with zero totals', () => {
    const result = exportDiffReviewMarkdown(emptyReviewFixture);
    expect(result.ok).toBe(true);
  });
});
