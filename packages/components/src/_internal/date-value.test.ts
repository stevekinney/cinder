import { describe, expect, test } from 'bun:test';

import type { DateValueGranularity } from './date-value.ts';
import { normalizeDateValue } from './date-value.ts';

describe('normalizeDateValue', () => {
  test('returns undefined for an undefined value', () => {
    expect(normalizeDateValue(undefined, 'day')).toBeUndefined();
  });

  test('returns undefined for an empty string', () => {
    expect(normalizeDateValue('', 'day')).toBeUndefined();
  });

  test('passes a valid day value through unchanged', () => {
    expect(normalizeDateValue('2024-06-15', 'day')).toBe('2024-06-15');
  });

  test('rejects an invalid date part (Feb 30 in a leap year)', () => {
    expect(normalizeDateValue('2024-02-30', 'day')).toBeUndefined();
  });

  test('accepts Feb 29 in a leap year', () => {
    expect(normalizeDateValue('2024-02-29', 'day')).toBe('2024-02-29');
  });

  test('rejects Feb 29 in a non-leap year', () => {
    expect(normalizeDateValue('2023-02-29', 'day')).toBeUndefined();
  });

  test('accepts a century leap year (2000)', () => {
    expect(normalizeDateValue('2000-02-29', 'day')).toBe('2000-02-29');
  });

  test('rejects a century non-leap year (1900)', () => {
    expect(normalizeDateValue('1900-02-29', 'day')).toBeUndefined();
  });

  test('rejects a month out of range', () => {
    expect(normalizeDateValue('2024-13-01', 'day')).toBeUndefined();
  });

  test('rejects a day out of range for a 30-day month', () => {
    expect(normalizeDateValue('2024-04-31', 'day')).toBeUndefined();
  });

  test('hour granularity pads to HH:00 and truncates minutes/seconds', () => {
    expect(normalizeDateValue('2024-06-15T09:30:15', 'hour')).toBe('2024-06-15T09:00');
  });

  test('hour granularity on a bare date defaults the time to 00:00', () => {
    expect(normalizeDateValue('2024-06-15', 'hour')).toBe('2024-06-15T00:00');
  });

  test('minute granularity keeps hour and minute, drops seconds', () => {
    expect(normalizeDateValue('2024-06-15T09:30:15', 'minute')).toBe('2024-06-15T09:30');
  });

  test('minute granularity pads a missing minute component', () => {
    // A time part with a valid HH:mm regex match always has both hour and
    // minute captured; this asserts the padding path directly.
    expect(normalizeDateValue('2024-06-15T09:05', 'minute')).toBe('2024-06-15T09:05');
  });

  test('second granularity pads a missing seconds component to :00', () => {
    expect(normalizeDateValue('2024-06-15T09:30', 'second')).toBe('2024-06-15T09:30:00');
  });

  test('second granularity keeps a fully specified time', () => {
    expect(normalizeDateValue('2024-06-15T09:30:45', 'second')).toBe('2024-06-15T09:30:45');
  });

  test('day granularity truncates any time part entirely', () => {
    expect(normalizeDateValue('2024-06-15T09:30:15', 'day')).toBe('2024-06-15');
  });

  test('rejects a malformed time part (hour out of range)', () => {
    expect(normalizeDateValue('2024-06-15T24:00', 'hour')).toBeUndefined();
  });

  test('rejects a malformed time part (minute out of range)', () => {
    expect(normalizeDateValue('2024-06-15T09:60', 'minute')).toBeUndefined();
  });

  test('rejects a malformed time part (second out of range)', () => {
    expect(normalizeDateValue('2024-06-15T09:30:60', 'second')).toBeUndefined();
  });

  test('rejects a value whose 11th character is not "T"', () => {
    expect(normalizeDateValue('2024-06-15X09:30', 'hour')).toBeUndefined();
  });

  const granularities: DateValueGranularity[] = ['day', 'hour', 'minute', 'second'];
  const representativeValues = [
    '2024-06-15',
    '2024-06-15T09:30',
    '2024-06-15T09:30:45',
    '2024-06-15T09:05:07',
  ];

  test.each(
    granularities.flatMap((granularity) =>
      representativeValues.map((value) => [value, granularity] as const),
    ),
  )('is idempotent for %s at %s granularity', (value, granularity) => {
    const once = normalizeDateValue(value, granularity);
    const twice = normalizeDateValue(once, granularity);
    expect(twice).toBe(once);
  });
});
