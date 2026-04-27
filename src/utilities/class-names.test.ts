import { describe, expect, test } from 'bun:test';

import { classNames } from './class-names.ts';

describe('classNames', () => {
  test('joins truthy strings with a space', () => {
    expect(classNames('a', 'b', 'c')).toBe('a b c');
  });

  test('drops null, undefined, and false', () => {
    expect(classNames('a', null, undefined, false, 'b')).toBe('a b');
  });

  test('drops empty strings', () => {
    expect(classNames('a', '', 'b')).toBe('a b');
  });

  test('returns empty string when every input is falsy', () => {
    expect(classNames(null, undefined, false, '')).toBe('');
  });

  test('returns empty string for no inputs', () => {
    expect(classNames()).toBe('');
  });
});
