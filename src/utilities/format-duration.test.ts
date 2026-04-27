import { beforeAll, describe, expect, test } from 'bun:test';

import { formatDuration } from './format-duration.ts';

beforeAll(() => {
  if (process.env.TZ !== 'UTC') {
    throw new Error(
      'format-duration.test.ts requires TZ=UTC. Run via `bun run test`, not bare `bun test`.',
    );
  }
});

describe('formatDuration (single-arg)', () => {
  test('0ms', () => {
    expect(formatDuration(0)).toBe('0ms');
  });

  test('1ms', () => {
    expect(formatDuration(1)).toBe('1ms');
  });

  test('999ms (just below 1s boundary)', () => {
    expect(formatDuration(999)).toBe('999ms');
  });

  test('exactly 1s', () => {
    expect(formatDuration(1_000)).toBe('1s');
  });

  test('1500ms floors to 1s', () => {
    expect(formatDuration(1_500)).toBe('1s');
  });

  test('exactly 60s rolls into minutes', () => {
    expect(formatDuration(60_000)).toBe('1m');
  });

  test('2m 30s', () => {
    expect(formatDuration(150_000)).toBe('2m 30s');
  });

  test('exactly 1 hour', () => {
    expect(formatDuration(3_600_000)).toBe('1h');
  });

  test('1h 5m', () => {
    expect(formatDuration(3_900_000)).toBe('1h 5m');
  });

  test('exactly 24 hours rolls into days', () => {
    expect(formatDuration(86_400_000)).toBe('1d');
  });

  test('2d 3h', () => {
    expect(formatDuration(2 * 86_400_000 + 3 * 3_600_000)).toBe('2d 3h');
  });

  test('negative input returns "-"', () => {
    expect(formatDuration(-5)).toBe('-');
  });

  test('null returns "-"', () => {
    expect(formatDuration(null)).toBe('-');
  });
});

describe('formatDuration (start/end pair)', () => {
  test('returns "-" if start is null', () => {
    expect(formatDuration(null, 1_000)).toBe('-');
  });

  test('returns "-" if end is null', () => {
    expect(formatDuration(0, null)).toBe('-');
  });

  test('computes elapsed from numeric start/end', () => {
    expect(formatDuration(0, 5_000)).toBe('5s');
  });

  test('accepts ISO strings', () => {
    expect(formatDuration('2026-04-15T12:00:00.000Z', '2026-04-15T12:30:00.000Z')).toBe('30m');
  });

  test('accepts Date objects', () => {
    expect(
      formatDuration(new Date('2026-04-15T12:00:00.000Z'), new Date('2026-04-15T13:00:00.000Z')),
    ).toBe('1h');
  });
});
