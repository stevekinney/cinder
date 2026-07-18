import { describe, expect, test } from 'bun:test';

import { stringify, stringifyOrNull } from './stringify.ts';

describe('stringification helpers', () => {
  test('preserves strings, empties nullish values, and serializes JSON', () => {
    expect(stringify('formatted')).toBe('formatted');
    expect(stringify(null)).toBe('');
    expect(stringify(undefined)).toBe('');
    expect(stringify({ package: 'chat' }, 0)).toBe('{"package":"chat"}');
  });

  test('falls back safely for values JSON cannot serialize', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(stringify(1n)).toBe('1');
    expect(stringify(Symbol.for('chat'))).toBe('Symbol(chat)');
    expect(stringify(() => {})).toBe('[Unserializable value]');
    expect(stringify(circular)).toBe('[Unserializable value]');
  });

  test('stringifyOrNull distinguishes failure from successful serialization', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(stringifyOrNull(null)).toBeNull();
    expect(stringifyOrNull(undefined)).toBeNull();
    expect(stringifyOrNull('formatted')).toBe('formatted');
    expect(stringifyOrNull({ package: 'chat' }, 0)).toBe('{"package":"chat"}');
    expect(stringifyOrNull(circular)).toBeNull();
  });
});
