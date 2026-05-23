import { describe, expect, test } from 'bun:test';

import {
  compareTimeParts,
  displayHourFromTwentyFourHour,
  isTimePartsInRange,
  normalizeTimeStep,
  normalizeTimeString,
  parseTimeString,
  rangeValues,
  resolveHourCycle,
  serializeTimeParts,
  twentyFourHourFromDisplayHour,
} from './time-parts.ts';

describe('time parts helpers', () => {
  test('parses HH:MM values', () => {
    expect(parseTimeString('09:30')).toEqual({ hours: 9, minutes: 30, seconds: 0 });
  });

  test('parses HH:MM:SS values', () => {
    expect(parseTimeString('09:30:45')).toEqual({ hours: 9, minutes: 30, seconds: 45 });
  });

  test('rejects invalid values', () => {
    expect(parseTimeString('24:00')).toBeNull();
    expect(parseTimeString('09:99')).toBeNull();
    expect(parseTimeString('not-a-time')).toBeNull();
  });

  test('normalizes time strings', () => {
    expect(normalizeTimeString('09:30', false)).toBe('09:30');
    expect(normalizeTimeString('09:30:45', true)).toBe('09:30:45');
  });

  test('serializes values with optional seconds', () => {
    const value = { hours: 9, minutes: 30, seconds: 45 };
    expect(serializeTimeParts(value, false)).toBe('09:30');
    expect(serializeTimeParts(value, true)).toBe('09:30:45');
  });

  test('compares times and checks ranges', () => {
    const early = { hours: 8, minutes: 0, seconds: 0 };
    const late = { hours: 9, minutes: 0, seconds: 0 };

    expect(compareTimeParts(early, late)).toBeLessThan(0);
    expect(isTimePartsInRange(late, early, { hours: 10, minutes: 0, seconds: 0 })).toBe(true);
    expect(isTimePartsInRange(early, late, null)).toBe(false);
  });

  test('maps between 24-hour and 12-hour displays', () => {
    expect(displayHourFromTwentyFourHour(0, 'h12')).toEqual({ hour: 12, period: 'AM' });
    expect(displayHourFromTwentyFourHour(13, 'h12')).toEqual({ hour: 1, period: 'PM' });
    expect(twentyFourHourFromDisplayHour(12, 'AM')).toBe(0);
    expect(twentyFourHourFromDisplayHour(1, 'PM')).toBe(13);
  });

  test('maps h11 and h24 display semantics distinctly', () => {
    expect(displayHourFromTwentyFourHour(0, 'h11')).toEqual({ hour: 0, period: 'AM' });
    expect(displayHourFromTwentyFourHour(12, 'h11')).toEqual({ hour: 0, period: 'PM' });
    expect(displayHourFromTwentyFourHour(0, 'h24')).toEqual({ hour: 24, period: null });
    expect(twentyFourHourFromDisplayHour(0, 'PM', 'h11')).toBe(12);
  });

  test('resolves explicit hour cycle first', () => {
    expect(resolveHourCycle('h23', 'en-US')).toBe('h23');
  });

  test('normalizes steps to values the picker columns can represent', () => {
    expect(normalizeTimeStep(90, false)).toBe(60);
    expect(normalizeTimeStep(300, false)).toBe(300);
    expect(normalizeTimeStep(0, true)).toBe(1);
    expect(normalizeTimeStep(15, true)).toBe(15);
    expect(normalizeTimeStep(90, true)).toBe(60);
    expect(normalizeTimeStep(Number.NaN, false)).toBe(60);
  });

  test('generates inclusive stepped ranges without special-case branches', () => {
    expect(rangeValues(15, 59)).toEqual([0, 15, 30, 45]);
    expect(rangeValues(60, 59)).toEqual([0]);
  });
});
