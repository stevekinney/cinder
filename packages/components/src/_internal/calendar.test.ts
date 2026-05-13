/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import {
  addDays,
  addMonths,
  addYears,
  buildMonthMatrix,
  dayOfWeekHeaders,
  endOfMonth,
  firstDayOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  serializeDate,
  startOfMonth,
  validateLocale,
} from './calendar.ts';

const weekdays = [0, 1, 2, 3, 4, 5, 6];

describe('firstDayOfWeek', () => {
  test('returns Sunday for Sunday-first locales', () => {
    expect(firstDayOfWeek('en-US')).toBe(0);
    expect(firstDayOfWeek('ja-JP')).toBe(0);
  });

  test('returns Monday for Monday-first locales', () => {
    expect(firstDayOfWeek('de-DE')).toBe(1);
    expect(firstDayOfWeek('fr-FR')).toBe(1);
  });

  test('returns a valid weekday for environment-dependent locale data', () => {
    expect(weekdays).toContain(firstDayOfWeek('ar-SA'));
  });

  test('does not throw for undefined locale', () => {
    expect(weekdays).toContain(firstDayOfWeek(undefined));
  });
});

describe('dayOfWeekHeaders', () => {
  test('returns exactly seven entries with label and full', () => {
    const headers = dayOfWeekHeaders('en-US');

    expect(headers).toHaveLength(7);
    expect(headers.every((h) => typeof h.label === 'string' && typeof h.full === 'string')).toBe(
      true,
    );
  });

  test('starts with Monday for de-DE', () => {
    const [firstHeader] = dayOfWeekHeaders('de-DE');

    expect(firstHeader?.label).toContain('Mo');
  });

  test('starts with Sunday for en-US', () => {
    const [firstHeader] = dayOfWeekHeaders('en-US');

    expect(firstHeader?.label === 'Su' || firstHeader?.label?.includes('Sun')).toBe(true);
  });

  test('full name is longer than short label', () => {
    const [firstHeader] = dayOfWeekHeaders('en-US');

    expect((firstHeader?.full?.length ?? 0) > (firstHeader?.label?.length ?? 0)).toBe(true);
  });
});

describe('buildMonthMatrix', () => {
  test('always returns six rows of seven columns', () => {
    const matrix = buildMonthMatrix(new Date(2026, 1, 1), 'en-US');

    expect(matrix).toHaveLength(6);
    expect(matrix.every((week) => week.length === 7)).toBe(true);
    expect(matrix.flat()).toHaveLength(42);
  });

  test('starts February 2026 on the first day for Sunday-first locales', () => {
    const matrix = buildMonthMatrix(new Date(2026, 1, 1), 'en-US');

    expect(isSameDay(matrix[0]?.[0] ?? new Date(NaN), new Date(2026, 1, 1))).toBe(true);
  });

  test('starts February 2026 on January 26 for Monday-first locales', () => {
    const matrix = buildMonthMatrix(new Date(2026, 1, 1), 'de-DE');

    expect(isSameDay(matrix[0]?.[0] ?? new Date(NaN), new Date(2026, 0, 26))).toBe(true);
  });

  test('normalizes every cell to noon', () => {
    const matrix = buildMonthMatrix(new Date(2026, 1, 1), 'en-US');

    expect(matrix.flat().every((cell) => cell.getHours() === 12)).toBe(true);
  });
});

describe('month boundaries', () => {
  test('startOfMonth returns the first day at noon', () => {
    const result = startOfMonth(new Date(2026, 1, 20, 23, 30));

    expect(isSameDay(result, new Date(2026, 1, 1))).toBe(true);
    expect(result.getHours()).toBe(12);
  });

  test('endOfMonth returns the last day at noon', () => {
    const result = endOfMonth(new Date(2026, 1, 1, 1, 30));

    expect(isSameDay(result, new Date(2026, 1, 28))).toBe(true);
    expect(result.getHours()).toBe(12);
  });
});

describe('isSameDay', () => {
  test('returns true for the same local day with different times', () => {
    expect(isSameDay(new Date(2026, 2, 8, 0, 1), new Date(2026, 2, 8, 23, 59))).toBe(true);
  });

  test('returns false for different local days', () => {
    expect(isSameDay(new Date(2026, 2, 8), new Date(2026, 2, 9))).toBe(false);
  });
});

describe('isBefore and isAfter', () => {
  test('earlier dates are before later dates', () => {
    expect(isBefore(new Date(2026, 0, 31), new Date(2026, 1, 1))).toBe(true);
  });

  test('later dates are after earlier dates', () => {
    expect(isAfter(new Date(2026, 1, 1), new Date(2026, 0, 31))).toBe(true);
  });
});

describe('addDays', () => {
  test('crosses month boundaries and normalizes to noon', () => {
    const result = addDays(new Date(2026, 0, 30, 23, 59), 3);

    expect(isSameDay(result, new Date(2026, 1, 2))).toBe(true);
    expect(result.getHours()).toBe(12);
  });
});

describe('addMonths', () => {
  test('clamps January 31 to February 28 in non-leap years and normalizes to noon', () => {
    const result = addMonths(new Date(2026, 0, 31, 23, 59), 1);

    expect(isSameDay(result, new Date(2026, 1, 28))).toBe(true);
    expect(result.getHours()).toBe(12);
  });

  test('clamps January 31 to February 29 in leap years', () => {
    expect(isSameDay(addMonths(new Date(2024, 0, 31), 1), new Date(2024, 1, 29))).toBe(true);
  });
});

describe('addYears', () => {
  test('clamps leap day to February 28 in non-leap years and normalizes to noon', () => {
    const result = addYears(new Date(2024, 1, 29, 23, 59), 1);

    expect(isSameDay(result, new Date(2025, 1, 28))).toBe(true);
    expect(result.getHours()).toBe(12);
  });
});

describe('serializeDate', () => {
  test('serializes local calendar fields as YYYY-MM-DD', () => {
    expect(serializeDate(new Date(2026, 2, 8))).toBe('2026-03-08');
  });
});

describe('DST edge cases', () => {
  test('adds days across the spring DST boundary using local calendar fields', () => {
    const result = addDays(new Date(2026, 2, 7), 1);

    expect(isSameDay(result, new Date(2026, 2, 8))).toBe(true);
  });
});

describe('validateLocale', () => {
  test('returns a canonical string for valid BCP-47 tags', () => {
    expect(typeof validateLocale('en-US')).toBe('string');
  });

  test('returns undefined for invalid or empty locales', () => {
    expect(validateLocale('en_US')).toBeUndefined();
    expect(validateLocale('')).toBeUndefined();
    expect(validateLocale('not_a_locale!!')).toBeUndefined();
  });
});
