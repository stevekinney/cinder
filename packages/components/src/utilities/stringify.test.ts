import { describe, expect, test } from 'bun:test';

import { stringify, stringifyOrNull } from './stringify.ts';

describe('stringify', () => {
  test('returns strings unchanged and empty values as an empty string', () => {
    expect(stringify('already formatted')).toBe('already formatted');
    expect(stringify(null)).toBe('');
    expect(stringify(undefined)).toBe('');
  });

  test('serializes JSON values with the requested indentation', () => {
    expect(stringify({ name: 'Cinder' }, 0)).toBe('{"name":"Cinder"}');
  });

  test('falls back for primitive values that JSON cannot serialize', () => {
    expect(stringify(1n)).toBe('1');
    expect(stringify(Symbol.for('demo'))).toBe('Symbol(demo)');
  });

  test('reports unserializable object values without throwing', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(stringify(circular)).toBe('[Unserializable value]');
  });
});

describe('stringifyOrNull', () => {
  test('returns null for empty and unserializable values', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(stringifyOrNull(null)).toBeNull();
    expect(stringifyOrNull(undefined)).toBeNull();
    expect(stringifyOrNull(circular)).toBeNull();
  });

  test('returns strings unchanged and serializes JSON values', () => {
    expect(stringifyOrNull('already formatted')).toBe('already formatted');
    expect(stringifyOrNull({ name: 'Cinder' }, 0)).toBe('{"name":"Cinder"}');
  });
});
