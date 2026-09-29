import { describe, expect, test } from 'bun:test';

import type { DiffReviewTargetInput } from './types.ts';
import { validateDiffReviewTargetList } from './validate-targets.ts';

function source(targetId: string, patch = 'diff'): DiffReviewTargetInput {
  return { kind: 'source', targetId, label: targetId, patch };
}

function markdown(targetId: string): DiffReviewTargetInput {
  return {
    kind: 'markdown',
    targetId,
    label: targetId,
    original: 'a',
    current: 'b',
    normalizeInputs: true,
  };
}

describe('DiffReview state target validation', () => {
  test('accepts an empty target list', () => {
    const result = validateDiffReviewTargetList([]);
    expect(result).toEqual({ ok: true, value: [] });
  });

  test('accepts a mix of valid source and markdown targets, preserving order', () => {
    const targets = [source('a'), markdown('b'), source('c')];
    const result = validateDiffReviewTargetList(targets);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.map((target) => target.targetId)).toEqual(['a', 'b', 'c']);
  });

  test('rejects an unrecognized kind discriminant with invalid-target', () => {
    const bad = { kind: 'binary', targetId: 'a', label: 'A' } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid-target',
        path: '/targets/0/kind',
        message: expect.any(String),
      },
    });
  });

  test('rejects a non-string targetId with invalid-target', () => {
    const bad = { ...source('a'), targetId: 42 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error).toEqual({
      code: 'invalid-target',
      path: '/targets/0/targetId',
      message: expect.any(String),
    });
  });

  test('rejects a non-string patch on a source target with invalid-target', () => {
    const bad = { ...source('a'), patch: 123 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-target');
    expect(result.error.path).toBe('/targets/0/patch');
  });

  test('rejects a non-string original/current on a markdown target with invalid-target', () => {
    const bad = { ...markdown('a'), current: 7 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-target');
    expect(result.error.path).toBe('/targets/0/current');
  });

  test('rejects a non-boolean normalizeInputs on a markdown target with invalid-target', () => {
    const bad = { ...markdown('a'), normalizeInputs: 'yes' } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-target');
    expect(result.error.path).toBe('/targets/0/normalizeInputs');
  });

  test('rejects a duplicate targetId with duplicate-id, pointing at the second occurrence', () => {
    const result = validateDiffReviewTargetList([source('same'), markdown('same')]);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'duplicate-id',
        path: '/targets/1/targetId',
        message: expect.any(String),
      },
    });
  });

  test('reports the first error in array order when multiple targets are invalid', () => {
    const bad1 = { ...source('a'), targetId: 1 } as unknown as DiffReviewTargetInput;
    const bad2 = { ...source('b'), targetId: 2 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad1, bad2]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/targets/0/targetId');
  });

  test('reports the first error in schema-field order within one target (kind before targetId)', () => {
    const bad = { kind: 7, targetId: 7 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/targets/0/kind');
  });

  test('rejects an empty label string', () => {
    const bad = { ...source('a'), label: '' };
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/targets/0/label');
  });

  test('rejects a non-string repositoryLabel', () => {
    const bad = { ...source('a'), repositoryLabel: 42 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/targets/0/repositoryLabel');
  });

  test('rejects a non-string baseRevisionLabel', () => {
    const bad = { ...source('a'), baseRevisionLabel: 42 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/targets/0/baseRevisionLabel');
  });

  test('rejects a non-string headRevisionLabel', () => {
    const bad = { ...source('a'), headRevisionLabel: 42 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/targets/0/headRevisionLabel');
  });

  test('rejects a non-string original on a markdown target', () => {
    const bad = { ...markdown('a'), original: 42 } as unknown as DiffReviewTargetInput;
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/targets/0/original');
  });

  test('rejects an empty targetId string', () => {
    const bad = source('');
    const result = validateDiffReviewTargetList([bad]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-target');
    expect(result.error.path).toBe('/targets/0/targetId');
  });

  test('rejects a non-array input at the root', () => {
    const result = validateDiffReviewTargetList(
      'not-an-array' as unknown as DiffReviewTargetInput[],
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('invalid-target');
    expect(result.error.path).toBe('/targets');
  });
});
