import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import {
  duplicateCommentIdStateFixture,
  duplicateTargetIdFixtures,
  invalidTargetKindFixture,
  invalidTargetPatchFixture,
  invalidTimestampStateFixture,
  repeatedPathTargetFixtures,
  unknownTopLevelKeyStateFixture,
  unsupportedVersionStateFixture,
  validMarkdownTargetFixture,
  validSerializedStateFixture,
  validSourceTargetFixture,
} from './fixtures.ts';
import { restoreDiffReviewState } from './restore.ts';
import type { DiffReviewTargetInput } from './types.ts';

describe('DiffReview state fixtures', () => {
  test('valid source and markdown target fixtures create successfully', () => {
    expect(createDiffReviewState([validSourceTargetFixture]).ok).toBe(true);
    expect(createDiffReviewState([validMarkdownTargetFixture]).ok).toBe(true);
  });

  test('repeated-path target fixtures create successfully as distinct targets', () => {
    const result = createDiffReviewState(repeatedPathTargetFixtures);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.targets.map((t) => t.targetId)).toEqual(['left', 'right']);
  });

  test('invalid target-kind fixture fails with invalid-target', () => {
    const result = createDiffReviewState([
      invalidTargetKindFixture as unknown as DiffReviewTargetInput,
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-target');
  });

  test('invalid target-patch fixture fails with invalid-target', () => {
    const result = createDiffReviewState([
      invalidTargetPatchFixture as unknown as DiffReviewTargetInput,
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-target');
  });

  test('duplicate target id fixtures fail with duplicate-id', () => {
    const result = createDiffReviewState(duplicateTargetIdFixtures);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('duplicate-id');
  });

  test('the valid serialized-state fixture restores successfully against its matching target', () => {
    const result = restoreDiffReviewState(validSerializedStateFixture, [validSourceTargetFixture]);
    expect(result.ok).toBe(true);
  });

  test('the unsupported-version fixture fails with unsupported-version', () => {
    const result = restoreDiffReviewState(unsupportedVersionStateFixture, [
      validSourceTargetFixture,
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('unsupported-version');
  });

  test('the unknown-top-level-key fixture fails with invalid-record', () => {
    const result = restoreDiffReviewState(unknownTopLevelKeyStateFixture, [
      validSourceTargetFixture,
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-record');
  });

  test('the duplicate-comment-id fixture fails with duplicate-id', () => {
    const result = restoreDiffReviewState(duplicateCommentIdStateFixture, [
      validSourceTargetFixture,
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('duplicate-id');
  });

  test('the invalid-timestamp fixture fails with invalid-timestamp', () => {
    const result = restoreDiffReviewState(invalidTimestampStateFixture, [validSourceTargetFixture]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-timestamp');
  });
});

// Note: `validSerializedStateFixture`'s target record pins an illustrative `snapshotId` of
// `'a'.repeat(64)` rather than `validSourceTargetFixture`'s real computed hash, so restoring the
// two together always (correctly) latches the fixture comment outdated. None of the assertions
// above inspect `outdated`, so that mismatch is intentional and harmless here.
