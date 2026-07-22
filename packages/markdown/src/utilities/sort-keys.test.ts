/**
 * Unit tests for sortKeys utility.
 *
 * DEP-565: Coverage hardening for @lostgradient/markdown.
 */

import { describe, expect, it } from 'bun:test';
import { sortKeys } from './sort-keys.js';

describe('sortKeys', () => {
  it('sorts top-level object keys alphabetically', () => {
    const result = sortKeys({ z: 1, a: 2, m: 3 });
    expect(Object.keys(result as Record<string, unknown>)).toEqual(['a', 'm', 'z']);
  });

  it('sorts nested object keys recursively', () => {
    const result = sortKeys({ z: 1, a: { y: 2, b: 3 } });
    const typed = result as Record<string, unknown>;
    expect(Object.keys(typed)).toEqual(['a', 'z']);
    expect(Object.keys(typed.a as Record<string, unknown>)).toEqual(['b', 'y']);
  });

  it('preserves array order while sorting object elements within arrays', () => {
    const result = sortKeys([
      { z: 1, a: 2 },
      { c: 3, b: 4 },
    ]);
    const typed = result as Record<string, unknown>[];
    expect(typed).toHaveLength(2);
    expect(Object.keys(typed[0])).toEqual(['a', 'z']);
    expect(Object.keys(typed[1])).toEqual(['b', 'c']);
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
    const typed = result as Record<string, unknown>;
    expect(typed['1']).toBe('c');
    expect(typed['2']).toBe('b');
    expect(typed['10']).toBe('a');
  });

  it('handles deeply nested structures', () => {
    const result = sortKeys({
      z: { y: { x: { w: 1, a: 2 } } },
      a: 3,
    });
    const typed = result as Record<string, unknown>;
    expect(Object.keys(typed)).toEqual(['a', 'z']);
    const deep = (typed.z as Record<string, unknown>).y as Record<string, unknown>;
    const deepest = deep.x as Record<string, unknown>;
    expect(Object.keys(deepest)).toEqual(['a', 'w']);
  });

  it('handles arrays containing primitives without modification', () => {
    const result = sortKeys([3, 1, 2]);
    expect(result).toEqual([3, 1, 2]);
  });

  it('handles arrays containing mixed types', () => {
    const result = sortKeys([42, 'hello', null, { b: 1, a: 2 }]);
    const typed = result as unknown[];
    expect(typed[0]).toBe(42);
    expect(typed[1]).toBe('hello');
    expect(typed[2]).toBeNull();
    expect(Object.keys(typed[3] as Record<string, unknown>)).toEqual(['a', 'b']);
  });
});
