import { describe, expect, test } from 'bun:test';

import {
  buildEnumPatch,
  detectEnumSource,
  isEnumLikeOneOf,
  readEnumDescriptions,
  readEnumValues,
} from './enum-composition.ts';

describe('isEnumLikeOneOf', () => {
  test('true for a oneOf of bare const branches with no descriptions', () => {
    expect(isEnumLikeOneOf([{ const: 'draft' }, { const: 'published' }])).toBe(true);
  });

  test('true for a mix of const-only and const+description branches', () => {
    expect(
      isEnumLikeOneOf([{ const: 'draft', description: 'Not visible' }, { const: 'published' }]),
    ).toBe(true);
  });

  test('false for a real composition branch (extra keyword)', () => {
    expect(isEnumLikeOneOf([{ const: 'draft' }, { type: 'integer', minimum: 1 }])).toBe(false);
  });

  test('false when a branch mixes const with an unrelated keyword', () => {
    expect(isEnumLikeOneOf([{ const: 'draft', type: 'string' }])).toBe(false);
  });

  test('false for an empty oneOf', () => {
    expect(isEnumLikeOneOf([])).toBe(false);
  });

  test('false when oneOf is absent', () => {
    expect(isEnumLikeOneOf(undefined)).toBe(false);
  });
});

describe('detectEnumSource', () => {
  test('detects a bare enum array', () => {
    expect(detectEnumSource({ enum: ['a', 'b'] })).toBe('enum');
  });

  test('detects an enum-like oneOf', () => {
    expect(detectEnumSource({ oneOf: [{ const: 'a', description: 'A' }] })).toBe('oneOf');
  });

  test('prefers enum when both are somehow present', () => {
    expect(
      detectEnumSource({ enum: ['a'], oneOf: [{ const: 'b', description: 'B' }] }),
    ).toBe('enum');
  });

  test('null for a real composition', () => {
    expect(detectEnumSource({ oneOf: [{ type: 'string' }, { type: 'integer' }] })).toBe(null);
  });

  test('null for neither', () => {
    expect(detectEnumSource({ type: 'string' })).toBe(null);
  });
});

describe('readEnumValues / readEnumDescriptions', () => {
  test('reads values and empty descriptions from a bare enum', () => {
    expect(readEnumValues({ enum: ['a', 'b'] }, 'enum')).toEqual(['a', 'b']);
    expect(readEnumDescriptions({ enum: ['a', 'b'] }, 'enum')).toEqual(['', '']);
  });

  test('reads values and descriptions from an enum-like oneOf, defaulting missing descriptions to empty', () => {
    const schema = { oneOf: [{ const: 'a', description: 'A' }, { const: 'b' }] };
    expect(readEnumValues(schema, 'oneOf')).toEqual(['a', 'b']);
    expect(readEnumDescriptions(schema, 'oneOf')).toEqual(['A', '']);
  });

  test('returns empty arrays when source is null', () => {
    expect(readEnumValues({}, null)).toEqual([]);
    expect(readEnumDescriptions({}, null)).toEqual([]);
  });
});

describe('buildEnumPatch', () => {
  test('demotes to a bare enum when no description is present', () => {
    expect(buildEnumPatch(['a', 'b'], ['', ''])).toEqual({
      enum: ['a', 'b'],
      oneOf: undefined,
    });
  });

  test('promotes to oneOf when any description is present', () => {
    expect(buildEnumPatch(['a', 'b'], ['A', ''])).toEqual({
      enum: undefined,
      oneOf: [{ const: 'a', description: 'A' }, { const: 'b' }],
    });
  });

  test('trims description whitespace and treats whitespace-only as absent', () => {
    expect(buildEnumPatch(['a', 'b'], ['  A  ', '   '])).toEqual({
      enum: undefined,
      oneOf: [{ const: 'a', description: 'A' }, { const: 'b' }],
    });
  });

  test('demotes back to enum once every description is cleared', () => {
    expect(buildEnumPatch(['a', 'b'], ['', ''])).toEqual({
      enum: ['a', 'b'],
      oneOf: undefined,
    });
  });

  test('handles object values with member-order-insensitive equality unaffected — passes values through untouched', () => {
    const objectValue = { b: 2, a: 1 };
    expect(buildEnumPatch([objectValue], ['note'])).toEqual({
      enum: undefined,
      oneOf: [{ const: objectValue, description: 'note' }],
    });
  });
});
