/**
 * Proving test for the plain-`.ts` (no DOM) unit-test harness (plan §11.1,
 * T0.1) — also real coverage for the `format` helpers themselves.
 * `computeNextFires` coverage lives in `./cron-preview.test.ts` (split
 * alongside `./cron-preview.ts` — see that module's doc for why).
 */
import { describe, expect, test } from 'bun:test';

import { formatBytes, formatDuration, formatRelativeTime, truncateId } from './index.ts';

describe('truncateId', () => {
  test('truncates a long id to first8…last4', () => {
    expect(truncateId('wf_9f3c1a2b4d5e6f708192a3b4')).toBe('wf_9f3c1…a3b4');
  });

  test('leaves a short id unchanged', () => {
    expect(truncateId('short-id')).toBe('short-id');
  });
});

describe('formatDuration', () => {
  test('formats sub-second durations in ms', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  test('formats a multi-unit duration with at most two units', () => {
    expect(formatDuration(3_661_000)).toBe('1h 1m');
  });
});

describe('formatBytes', () => {
  test('formats bytes below 1024 verbatim', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  test('formats kilobytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-07-20T12:00:00.000Z');

  test('collapses anything within 5 seconds to "just now", past or future', () => {
    expect(formatRelativeTime(now - 4_000, now)).toBe('just now');
    expect(formatRelativeTime(now + 4_000, now)).toBe('just now');
    expect(formatRelativeTime(now, now)).toBe('just now');
  });

  test('the 5-second boundary itself is no longer "just now"', () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe('5s ago');
  });

  test('formats a past timestamp with "ago"', () => {
    expect(formatRelativeTime(now - 2 * 60_000, now)).toBe('2m ago');
  });

  test('formats a future timestamp with "in"', () => {
    expect(formatRelativeTime(now + 3 * 3_600_000, now)).toBe('in 3h');
  });

  test('defaults `now` to the current time when omitted', () => {
    expect(formatRelativeTime(Date.now())).toBe('just now');
  });
});
