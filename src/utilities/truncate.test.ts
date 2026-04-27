import { beforeAll, describe, expect, test } from 'bun:test';

import { truncate } from './truncate.ts';

beforeAll(() => {
  if (process.env.TZ !== 'UTC') {
    throw new Error(
      'truncate.test.ts requires TZ=UTC. Run via `bun run test`, not bare `bun test`.',
    );
  }
});

describe('truncate', () => {
  test('returns empty string unchanged (length 0)', () => {
    expect(truncate('', 10)).toBe('');
  });

  test('returns input unchanged when length < maxLength', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });

  test('returns input unchanged when length === maxLength', () => {
    expect(truncate('exactly10!', 10)).toBe('exactly10!');
  });

  test('appends default ellipsis when length > maxLength', () => {
    // Default ellipsis is the single-character horizontal ellipsis (length 1).
    expect(truncate('hello world', 8)).toBe('hello w…');
  });

  test('appends custom ellipsis when length > maxLength', () => {
    expect(truncate('hello world', 8, '...')).toBe('hello...');
  });

  test('falls back to a hard slice when maxLength <= ellipsis length', () => {
    expect(truncate('hello world', 2, '...')).toBe('he');
  });

  test('falls back to a hard slice when maxLength === ellipsis length', () => {
    expect(truncate('hello world', 3, '...')).toBe('hel');
  });

  test('handles maxLength of 0 by slicing to empty', () => {
    expect(truncate('hello', 0)).toBe('');
  });

  test('preserves multi-character ellipsis math', () => {
    // 11 chars - 5-char ellipsis ("[...]") = 6-char prefix.
    expect(truncate('hello world', 11, '[...]')).toBe('hello world');
    expect(truncate('hello world!', 11, '[...]')).toBe('hello [...]');
  });
});
