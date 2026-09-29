import Ajv from 'ajv';
import { describe, expect, test } from 'bun:test';

import {
  documentThreadsFixture,
  maliciousContentFixture,
  markdownTargetsFixture,
  twoSourceTargetsFixture,
} from './diff-review-export-fixtures.js';
import { diffReviewExportJsonSchema } from './diff-review-export-schema.js';
import { exportDiffReviewJson, exportDiffReviewMarkdown } from './diff-review-export.js';

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(diffReviewExportJsonSchema);

function unwrapJson(result: ReturnType<typeof exportDiffReviewJson>): string {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

function unwrapMarkdown(result: ReturnType<typeof exportDiffReviewMarkdown>): string {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('DiffReview export JSON', () => {
  test('uses two-space indentation and exactly one trailing newline', () => {
    const json = unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture));
    expect(json.endsWith('\n')).toBe(true);
    expect(json.endsWith('\n\n')).toBe(false);
    expect(json).toContain('{\n  "schemaVersion": 1,');
  });

  test('parses as valid JSON', () => {
    const json = unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture));
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('schemaVersion is 1', () => {
    const parsed = JSON.parse(unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture)));
    expect(parsed.schemaVersion).toBe(1);
  });

  test('validates against the versioned JSON Schema contract, for every fixture', () => {
    for (const state of [
      twoSourceTargetsFixture,
      markdownTargetsFixture,
      maliciousContentFixture,
    ]) {
      const parsed = JSON.parse(unwrapJson(exportDiffReviewJson(state)));
      const valid = validate(parsed);
      expect(valid, JSON.stringify(validate.errors)).toBe(true);
    }
  });

  test('validates against the schema with existing document threads included', () => {
    const parsed = JSON.parse(
      unwrapJson(
        exportDiffReviewJson(twoSourceTargetsFixture, { documentThreads: documentThreadsFixture }),
      ),
    );
    const valid = validate(parsed);
    expect(valid, JSON.stringify(validate.errors)).toBe(true);
  });

  test('an unresolved-only export also validates against the same schema', () => {
    const parsed = JSON.parse(
      unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture, { scope: 'unresolved' })),
    );
    expect(validate(parsed)).toBe(true);
  });

  test('repeated exports of identical input and options produce byte-identical output', () => {
    const first = unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture));
    const second = unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture));
    expect(first).toBe(second);
  });

  test('retains captured anchor context without loss (raw mapping, coordinate space, paths)', () => {
    const parsed = JSON.parse(unwrapJson(exportDiffReviewJson(markdownTargetsFixture)));
    const normalized = parsed.records.find(
      (r: { commentId?: string }) => r.commentId === 'comment-normalized',
    );
    expect(normalized.rawMapping).toEqual({ status: 'unavailable', reason: 'normalization' });
    expect(normalized.anchor.coordinateSpace).toBe('normalized-markdown');
    const raw = parsed.records.find((r: { commentId?: string }) => r.commentId === 'comment-raw');
    expect(raw.rawMapping).toEqual({ status: 'exact' });
  });

  test('retains full captured anchor context without loss: target kind, hunk occurrence, and untrimmed selected/context text', () => {
    // twoSourceTargetsFixture's "comment-resolved" captures three context lines on each side and
    // hunk occurrence 0; the contract requires the JSON to retain this "without loss" — the
    // Markdown export's two-line-trimmed quote must not be the only place this data survives.
    const parsed = JSON.parse(unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture)));
    const resolved = parsed.records.find(
      (r: { commentId?: string }) => r.commentId === 'comment-resolved',
    );
    expect(resolved.targetKind).toBe('source');
    expect(resolved.anchor.hunkOccurrence).toBe(0);
    expect(resolved.anchor.selectedText).toBe('function shared() {\n  return 1;\n}');
    expect(resolved.anchor.contextBefore).toEqual(['// before-3', '// before-2', '// before-1']);
    expect(resolved.anchor.contextAfter).toEqual(['// after-1', '// after-2', '// after-3']);

    const fileComment = parsed.records.find(
      (r: { commentId?: string }) => r.commentId === 'comment-file',
    );
    expect(fileComment.targetKind).toBe('source');
  });

  describe('semantic completeness and Markdown/JSON agreement', () => {
    test('every saved comment appears exactly once in the default (all) export', () => {
      const parsed = JSON.parse(unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture)));
      const ids = parsed.records
        .filter((r: { recordKind: string }) => r.recordKind === 'diff')
        .map((r: { commentId: string }) => r.commentId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.sort()).toEqual(twoSourceTargetsFixture.comments.map((c) => c.id).sort());
    });

    test('Markdown and JSON agree on IDs, bodies, location, and state', () => {
      const markdown = unwrapMarkdown(exportDiffReviewMarkdown(twoSourceTargetsFixture));
      const parsed = JSON.parse(unwrapJson(exportDiffReviewJson(twoSourceTargetsFixture)));

      for (const record of parsed.records) {
        expect(markdown).toContain(`### Comment ${record.commentId}`);
        expect(markdown).toContain(record.body);
        expect(markdown).toContain(record.snapshotId);

        // State: Markdown's resolved/outdated words agree with JSON's own booleans.
        const expectedResolution = record.resolved ? 'resolved' : 'open';
        const expectedCurrency = record.outdated ? 'outdated (verification needed)' : 'current';
        expect(markdown).toContain(`State: ${expectedResolution}, ${expectedCurrency}`);

        // Location: the anchor's discriminant and, for a range, its side and exact bounds.
        if (record.anchor.kind === 'file') {
          expect(markdown).toContain('Location: file comment');
        } else {
          expect(markdown).toContain(record.anchor.coordinateSpace);
          expect(markdown).toContain(`Location: ${record.anchor.side} side`);
          const range =
            record.anchor.startLine === record.anchor.endLine
              ? `line ${record.anchor.startLine}`
              : `lines ${record.anchor.startLine}–${record.anchor.endLine}`;
          expect(markdown).toContain(range);
        }
      }
    });

    test('a document thread and its diff comments both appear, once each, across formats', () => {
      const markdown = unwrapMarkdown(
        exportDiffReviewMarkdown(twoSourceTargetsFixture, {
          documentThreads: documentThreadsFixture,
        }),
      );
      const parsed = JSON.parse(
        unwrapJson(
          exportDiffReviewJson(twoSourceTargetsFixture, {
            documentThreads: documentThreadsFixture,
          }),
        ),
      );

      const documentRecords = parsed.records.filter(
        (r: { recordKind: string }) => r.recordKind === 'document',
      );
      expect(documentRecords).toHaveLength(2);

      for (const record of documentRecords) {
        expect(markdown).toContain(`### Document thread ${record.threadId}`);
        for (const message of record.messages) {
          expect(markdown.split(message.body).length - 1).toBe(1);
        }
      }

      // The deleted initial message never appears anywhere in either format.
      expect(markdown).not.toContain('This message was later deleted.');
      expect(JSON.stringify(parsed)).not.toContain('This message was later deleted.');
      // The fully deleted thread is dropped from both formats.
      expect(markdown).not.toContain('thread-fully-deleted');
      expect(JSON.stringify(parsed)).not.toContain('thread-fully-deleted');
    });

    test('unresolved-only scope still includes every existing document thread (always open)', () => {
      const parsed = JSON.parse(
        unwrapJson(
          exportDiffReviewJson(twoSourceTargetsFixture, {
            scope: 'unresolved',
            documentThreads: documentThreadsFixture,
          }),
        ),
      );
      const documentRecords = parsed.records.filter(
        (r: { recordKind: string }) => r.recordKind === 'document',
      );
      expect(documentRecords).toHaveLength(2);
      expect(parsed.totals.open).toBeGreaterThanOrEqual(2);
    });
  });
});
