import { beforeAll, describe, expect, test } from 'bun:test';

import { formatDate, formatRelativeTime, formatTimestamp } from './format-date.ts';

beforeAll(() => {
  if (process.env.TZ !== 'UTC') {
    throw new Error(
      'format-date.test.ts requires TZ=UTC. Run via `bun run test`, not bare `bun test`.',
    );
  }
});

const FIXED_DATE = new Date('2026-04-15T12:34:56.000Z');

describe('formatDate', () => {
  test('formats with explicit defaults (en-US, UTC)', () => {
    // Intl.DateTimeFormat with no date-style options falls back to numeric M/D/Y.
    expect(formatDate(FIXED_DATE)).toBe('4/15/2026');
  });

  test('accepts ISO string input', () => {
    expect(formatDate('2026-04-15T12:34:56.000Z')).toBe('4/15/2026');
  });

  test('accepts numeric (epoch ms) input', () => {
    expect(formatDate(FIXED_DATE.getTime())).toBe('4/15/2026');
  });

  test('honors locale override', () => {
    // en-GB swaps day/month order.
    expect(formatDate(FIXED_DATE, 'en-GB')).toBe('15/04/2026');
  });

  test('honors options override (date and time, fixed time zone)', () => {
    const formatted = formatDate(FIXED_DATE, 'en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    // macOS/Linux Intl may emit "at" between date and time; match both forms.
    expect(formatted).toMatch(/^Apr 15, 2026.+12:34$/);
  });

  test('preserves UTC timeZone when only other options are overridden', () => {
    const result = formatDate(FIXED_DATE, 'en-US', { month: 'long' });
    // April in UTC — if system-tz bleed occurred, this could differ on machines with offset TZ
    expect(result).toBe('April');
  });

  test('time zone override shifts wall-clock display', () => {
    // 12:34 UTC is 08:34 in America/New_York (EDT, UTC-4) on 2026-04-15.
    const formatted = formatDate(FIXED_DATE, 'en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    expect(formatted).toBe('08:34');
  });
});

describe('formatRelativeTime', () => {
  test('returns "just now" for sub-minute deltas', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30_000)).toBe('just now');
  });

  test('returns minutes for sub-hour deltas', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5m ago');
  });

  test('returns hours for sub-day deltas', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3 * 3_600_000)).toBe('3h ago');
  });

  test('returns days for sub-week deltas', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 4 * 86_400_000)).toBe('4d ago');
  });

  test('returns weeks for sub-month deltas', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 2 * 604_800_000)).toBe('2w ago');
  });

  test('falls back to a localized date string past the month boundary', () => {
    const now = Date.now();
    const old = now - 90 * 86_400_000;
    const result = formatRelativeTime(old);
    expect(result).not.toMatch(/ago$/);
    expect(result.length).toBeGreaterThan(0);
  });

  test('accepts a Date instance', () => {
    expect(formatRelativeTime(new Date(Date.now() - 10_000))).toBe('just now');
  });
});

describe('formatTimestamp', () => {
  test('returns "-" for null', () => {
    expect(formatTimestamp(null)).toBe('-');
  });

  test('returns "-" for undefined', () => {
    expect(formatTimestamp(undefined)).toBe('-');
  });

  test('returns a non-empty string for a valid Date', () => {
    const result = formatTimestamp(FIXED_DATE);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('-');
  });

  test('accepts numeric epoch input', () => {
    const result = formatTimestamp(FIXED_DATE.getTime());
    expect(result.length).toBeGreaterThan(0);
  });

  test('accepts ISO string input', () => {
    const result = formatTimestamp('2026-04-15T12:34:56.000Z');
    expect(result.length).toBeGreaterThan(0);
  });
});
