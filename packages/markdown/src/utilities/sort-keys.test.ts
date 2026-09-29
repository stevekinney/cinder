/**
 * Unit tests for sortKeys utility.
 *
 * DEP-565: Coverage hardening for @lostgradient/markdown.
 */

import { describe, expect, it } from 'bun:test';
import { sortKeys } from './sort-keys.js';

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected object');
  }
  return Object.fromEntries(Object.entries(value));
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected object array');
  }
  return value.map(record);
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return value;
}

describe('sortKeys', () => {
  it('sorts top-level object keys alphabetically', () => {
    const result = sortKeys({ z: 1, a: 2, m: 3 });
    expect(Object.keys(record(result))).toEqual(['a', 'm', 'z']);
  });

  it('sorts nested object keys recursively', () => {
    const result = sortKeys({ z: 1, a: { y: 2, b: 3 } });
    const typed = record(result);
    expect(Object.keys(typed)).toEqual(['a', 'z']);
    expect(Object.keys(record(typed['a']))).toEqual(['b', 'y']);
  });

  it('preserves array order while sorting object elements within arrays', () => {
    const result = sortKeys([
      { z: 1, a: 2 },
      { c: 3, b: 4 },
    ]);
    const typed = records(result);
    expect(typed).toHaveLength(2);
    expect(Object.keys(typed[0]!)).toEqual(['a', 'z']);
    expect(Object.keys(typed[1]!)).toEqual(['b', 'c']);
  });

  it('returns null as-is', () => {
    expect(sortKeys(null)).toBeNull();
  });

  it('returns undefined as-is', () => {
    expect(sortKeys(undefined)).toBeUndefined();
  });

  it('returns primitive string as-is', () => {
    expect(sortKeys('hello')).toBe('hello');
  });

  it('returns primitive number as-is', () => {
    expect(sortKeys(42)).toBe(42);
  });

  it('returns primitive boolean as-is', () => {
    expect(sortKeys(true)).toBe(true);
  });

  it('returns empty object as empty object', () => {
    const result = sortKeys({});
    expect(result).toEqual({});
  });

  it('handles numeric keys (V8 sorts integer-indexed keys numerically)', () => {
    // JavaScript engines sort integer-like keys numerically per spec,
    // so even after sortKeys reorders entries, Object.fromEntries
    // produces keys in numeric order: '1', '2', '10'.
    const result = sortKeys({ '10': 'a', '2': 'b', '1': 'c' });
    const typed = record(result);
    expect(typed['1']).toBe('c');
    expect(typed['2']).toBe('b');
    expect(typed['10']).toBe('a');
  });

  it('handles deeply nested structures', () => {
    const result = sortKeys({
      z: { y: { x: { w: 1, a: 2 } } },
      a: 3,
    });
    const typed = record(result);
    expect(Object.keys(typed)).toEqual(['a', 'z']);
    const deep = record(record(typed['z'])['y']);
    const deepest = record(deep['x']);
    expect(Object.keys(deepest)).toEqual(['a', 'w']);
  });

  it('handles arrays containing primitives without modification', () => {
    const result = sortKeys([3, 1, 2]);
    expect(result).toEqual([3, 1, 2]);
  });

  it('handles arrays containing mixed types', () => {
    const result = sortKeys([42, 'hello', null, { b: 1, a: 2 }]);
    const typed = array(result);
    expect(typed[0]!).toBe(42);
    expect(typed[1]!).toBe('hello');
    expect(typed[2]!).toBeNull();
    expect(Object.keys(record(typed[3]))).toEqual(['a', 'b']);
  });
});
