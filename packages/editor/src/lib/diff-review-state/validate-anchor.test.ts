import { describe, expect, test } from 'bun:test';

import type { DiffReviewAnchor } from './types.ts';
import { validateDiffReviewAnchor } from './validate-anchor.ts';

const validRange: DiffReviewAnchor = {
  kind: 'range',
  fileOccurrence: 0,
  hunkOccurrence: 0,
  side: 'new',
  startLine: 4,
  endLine: 6,
  coordinateSpace: 'raw-source',
  selectedText: 'const x = 1;',
  contextBefore: ['a', 'b'],
  contextAfter: ['c'],
};

describe('DiffReview state anchor validation', () => {
  test('accepts a valid file anchor', () => {
    const result = validateDiffReviewAnchor({ kind: 'file', fileOccurrence: 2 }, '/anchor');
    expect(result).toEqual({ ok: true, value: { kind: 'file', fileOccurrence: 2 } });
  });

  test('rejects an unknown key on a file anchor', () => {
    const bad = { kind: 'file', fileOccurrence: 2, extra: 1 } as unknown as DiffReviewAnchor;
    const result = validateDiffReviewAnchor(bad, '/anchor');
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-anchor', path: '/anchor/extra', message: expect.any(String) },
    });
  });

  test('rejects an unknown key on a range anchor', () => {
    const bad = { ...validRange, extra: 1 } as unknown as DiffReviewAnchor;
    const result = validateDiffReviewAnchor(bad, '/anchor');
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-anchor', path: '/anchor/extra', message: expect.any(String) },
    });
  });

  test('accepts a valid range anchor', () => {
    const result = validateDiffReviewAnchor(validRange, '/anchor');
    expect(result).toEqual({ ok: true, value: validRange });
  });

  test('rejects a negative fileOccurrence on a file anchor', () => {
    const result = validateDiffReviewAnchor({ kind: 'file', fileOccurrence: -1 }, '/anchor');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error).toEqual({
      code: 'invalid-anchor',
      path: '/anchor/fileOccurrence',
      message: expect.any(String),
    });
  });

  test('rejects a negative fileOccurrence on a range anchor', () => {
    const result = validateDiffReviewAnchor({ ...validRange, fileOccurrence: -1 }, '/anchor');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/fileOccurrence');
  });

  test('rejects a non-object anchor', () => {
    const result = validateDiffReviewAnchor('not-an-object', '/anchor');
    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-anchor', path: '/anchor', message: expect.any(String) },
    });
  });

  test('rejects a negative hunkOccurrence on a range anchor', () => {
    const result = validateDiffReviewAnchor({ ...validRange, hunkOccurrence: -1 }, '/anchor');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/hunkOccurrence');
  });

  test('rejects an unrecognized side', () => {
    const bad = { ...validRange, side: 'both' } as unknown as DiffReviewAnchor;
    const result = validateDiffReviewAnchor(bad, '/anchor');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/side');
  });

  test('rejects a zero or negative startLine (one-based)', () => {
    const result = validateDiffReviewAnchor({ ...validRange, startLine: 0 }, '/anchor');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/startLine');
  });

  test('rejects endLine before startLine', () => {
    const result = validateDiffReviewAnchor(
      { ...validRange, startLine: 10, endLine: 5 },
      '/anchor',
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/endLine');
  });

  test('rejects an unrecognized coordinateSpace', () => {
    const bad = { ...validRange, coordinateSpace: 'ast' } as unknown as DiffReviewAnchor;
    const result = validateDiffReviewAnchor(bad, '/anchor');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/coordinateSpace');
  });

  test('rejects a non-string selectedText', () => {
    const bad = { ...validRange, selectedText: 42 } as unknown as DiffReviewAnchor;
    const result = validateDiffReviewAnchor(bad, '/anchor');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/selectedText');
  });

  test('accepts an empty selectedText, since an empty source line is selectable', () => {
    const result = validateDiffReviewAnchor({ ...validRange, selectedText: '' }, '/anchor');
    expect(result).toEqual({
      ok: true,
      value: { ...validRange, selectedText: '' },
    });
  });

  test('rejects more than three lines of leading context', () => {
    const result = validateDiffReviewAnchor(
      { ...validRange, contextBefore: ['1', '2', '3', '4'] },
      '/anchor',
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/contextBefore');
  });

  test('rejects more than three lines of trailing context', () => {
    const result = validateDiffReviewAnchor(
      { ...validRange, contextAfter: ['1', '2', '3', '4'] },
      '/anchor',
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/contextAfter');
  });

  test('rejects an unrecognized anchor kind', () => {
    const bad = { kind: 'blob' } as unknown as DiffReviewAnchor;
    const result = validateDiffReviewAnchor(bad, '/anchor');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.path).toBe('/anchor/kind');
  });
});
