import { describe, expect, test } from 'bun:test';

import { computeDiffReviewSnapshotId } from './identity.ts';
import type { DiffReviewMarkdownTargetInput, DiffReviewSourceTargetInput } from './types.ts';

function sourceTarget(patch: string, overrides: Partial<DiffReviewSourceTargetInput> = {}) {
  return {
    kind: 'source' as const,
    targetId: 'target-1',
    label: 'Target one',
    patch,
    ...overrides,
  };
}

function markdownTarget(
  original: string,
  current: string,
  normalizeInputs: boolean,
  overrides: Partial<DiffReviewMarkdownTargetInput> = {},
) {
  return {
    kind: 'markdown' as const,
    targetId: 'target-1',
    label: 'Target one',
    original,
    current,
    normalizeInputs,
    ...overrides,
  };
}

describe('DiffReview state identity', () => {
  test('produces a lowercase 64-character hex digest', () => {
    const id = computeDiffReviewSnapshotId(sourceTarget('diff --git a/x b/x'));
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic for identical source input', () => {
    const a = computeDiffReviewSnapshotId(sourceTarget('patch-a'));
    const b = computeDiffReviewSnapshotId(sourceTarget('patch-a'));
    expect(a).toBe(b);
  });

  test('is deterministic for identical markdown input', () => {
    const a = computeDiffReviewSnapshotId(markdownTarget('one', 'two', true));
    const b = computeDiffReviewSnapshotId(markdownTarget('one', 'two', true));
    expect(a).toBe(b);
  });

  test('differs when source patch text differs', () => {
    const a = computeDiffReviewSnapshotId(sourceTarget('patch-a'));
    const b = computeDiffReviewSnapshotId(sourceTarget('patch-b'));
    expect(a).not.toBe(b);
  });

  test('differs when markdown normalizeInputs differs, all else equal', () => {
    const normalized = computeDiffReviewSnapshotId(markdownTarget('one', 'two', true));
    const raw = computeDiffReviewSnapshotId(markdownTarget('one', 'two', false));
    expect(normalized).not.toBe(raw);
  });

  test('a source patch and a markdown target never collide even with overlapping text', () => {
    const source = computeDiffReviewSnapshotId(sourceTarget('shared'));
    const markdown = computeDiffReviewSnapshotId(markdownTarget('shared', 'shared', true));
    expect(source).not.toBe(markdown);
  });

  test('is not affected by label, path, revision labels, or targetId', () => {
    const base = computeDiffReviewSnapshotId(sourceTarget('patch-a'));
    const relabeled = computeDiffReviewSnapshotId(
      sourceTarget('patch-a', {
        targetId: 'a-completely-different-id',
        label: 'A completely different label',
        repositoryLabel: 'some/repo',
        baseRevisionLabel: 'main',
        headRevisionLabel: 'feature',
      }),
    );
    expect(relabeled).toBe(base);
  });

  test('preserves CRLF vs LF as distinct identity', () => {
    const lf = computeDiffReviewSnapshotId(sourceTarget('line one\nline two'));
    const crlf = computeDiffReviewSnapshotId(sourceTarget('line one\r\nline two'));
    expect(lf).not.toBe(crlf);
  });

  test('preserves Unicode content as distinct identity', () => {
    const plain = computeDiffReviewSnapshotId(sourceTarget('cafe'));
    const accented = computeDiffReviewSnapshotId(sourceTarget('café'));
    expect(plain).not.toBe(accented);
  });

  test('handles lone surrogate code units deterministically without throwing', () => {
    const loneSurrogate = 'before \ud800 after';
    const a = computeDiffReviewSnapshotId(sourceTarget(loneSurrogate));
    const b = computeDiffReviewSnapshotId(sourceTarget(loneSurrogate));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    // A lone surrogate is distinguishable from the literal replacement character: JSON.stringify
    // escapes the surrogate to `\ud800` rather than collapsing it the way a raw TextEncoder pass
    // would, so the two inputs must not hash identically.
    const replacementCharacter = computeDiffReviewSnapshotId(sourceTarget('before � after'));
    expect(a).not.toBe(replacementCharacter);
  });

  test('reusing a targetId/revision label with different content still changes identity', () => {
    const first = computeDiffReviewSnapshotId(
      sourceTarget('v1', { headRevisionLabel: 'head-abc' }),
    );
    const second = computeDiffReviewSnapshotId(
      sourceTarget('v2', { headRevisionLabel: 'head-abc' }),
    );
    expect(first).not.toBe(second);
  });
});
