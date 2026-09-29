import { describe, expect, test } from 'bun:test';

import {
  defaultDiffReviewClock,
  defaultDiffReviewIdFactory,
  isCanonicalDiffReviewTimestamp,
  nextDiffReviewUpdatedAt,
} from './clock.ts';

describe('DiffReview state clock', () => {
  test('the default clock produces a canonical UTC ISO timestamp', () => {
    const now = defaultDiffReviewClock();
    expect(isCanonicalDiffReviewTimestamp(now)).toBe(true);
  });

  test('the default ID factory produces distinct nonempty strings', () => {
    const a = defaultDiffReviewIdFactory();
    const b = defaultDiffReviewIdFactory();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  test('accepts a canonical millisecond-precision UTC timestamp', () => {
    expect(isCanonicalDiffReviewTimestamp('2026-01-01T00:00:00.000Z')).toBe(true);
  });

  test('rejects a timestamp without a Z suffix', () => {
    expect(isCanonicalDiffReviewTimestamp('2026-01-01T00:00:00.000')).toBe(false);
  });

  test('rejects a timestamp with a numeric offset instead of Z', () => {
    expect(isCanonicalDiffReviewTimestamp('2026-01-01T00:00:00.000+00:00')).toBe(false);
  });

  test('rejects a timestamp missing millisecond precision', () => {
    expect(isCanonicalDiffReviewTimestamp('2026-01-01T00:00:00Z')).toBe(false);
  });

  test('rejects an out-of-range calendar date that Date would otherwise roll over', () => {
    // 2026-02-30 is not a real date; `new Date(...).toISOString()` rolls it to March,
    // which fails the round-trip check even though the regex shape looks canonical.
    expect(isCanonicalDiffReviewTimestamp('2026-02-30T00:00:00.000Z')).toBe(false);
  });

  test('rejects a non-string value', () => {
    expect(isCanonicalDiffReviewTimestamp(12345)).toBe(false);
    expect(isCanonicalDiffReviewTimestamp(undefined)).toBe(false);
    expect(isCanonicalDiffReviewTimestamp(null)).toBe(false);
  });

  describe('nextDiffReviewUpdatedAt (clock rollback rule)', () => {
    test('advances updatedAt when the clock moves forward', () => {
      const next = nextDiffReviewUpdatedAt('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      expect(next).toBe('2026-01-02T00:00:00.000Z');
    });

    test('holds updatedAt at its previous value when the clock rolls backward', () => {
      const next = nextDiffReviewUpdatedAt('2026-01-05T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
      expect(next).toBe('2026-01-05T00:00:00.000Z');
    });

    test('is stable when the clock repeats the previous value exactly', () => {
      const next = nextDiffReviewUpdatedAt('2026-01-05T00:00:00.000Z', '2026-01-05T00:00:00.000Z');
      expect(next).toBe('2026-01-05T00:00:00.000Z');
    });
  });
});
