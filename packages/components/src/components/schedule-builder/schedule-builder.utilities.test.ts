import { describe, expect, test } from 'bun:test';

import type { ScheduleValue } from './schedule-builder.types.ts';
import {
  CRON_FIELDS,
  INTERVAL_UNITS,
  WEEKDAYS,
  cronFieldsValid,
  defaultScheduleValue,
  describeValue,
  joinCron,
  lowerDailyAt,
  lowerEveryN,
  lowerMonthlyOnDay,
  lowerWeeklyAt,
  parseTime,
  splitCron,
  validateCronField,
  valueToCronFields,
  valueToInterval,
} from './schedule-builder.utilities.ts';

describe('schedule-builder utilities', () => {
  describe('constants', () => {
    test('INTERVAL_UNITS lists the four supported units in order', () => {
      expect(INTERVAL_UNITS).toEqual(['minutes', 'hours', 'days', 'weeks']);
    });

    test('WEEKDAYS has seven entries with cron day-of-week values 0-6', () => {
      expect(WEEKDAYS).toHaveLength(7);
      const values = WEEKDAYS.map((day) => day.value).toSorted((a, b) => a - b);
      expect(values).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    test('CRON_FIELDS has five fields with names, ranges, and hints', () => {
      expect(CRON_FIELDS).toHaveLength(5);
      expect(CRON_FIELDS.map((field) => field.name)).toEqual([
        'Minute',
        'Hour',
        'Day of month',
        'Month',
        'Day of week',
      ]);
    });
  });

  describe('defaultScheduleValue', () => {
    test('returns an interval of every 15 minutes', () => {
      expect(defaultScheduleValue()).toEqual({ mode: 'interval', every: 15, unit: 'minutes' });
    });
  });

  describe('validateCronField', () => {
    test('accepts a wildcard', () => {
      expect(validateCronField('*', 0)).toBeUndefined();
    });

    test('accepts a step against the wildcard', () => {
      expect(validateCronField('*/15', 0)).toBeUndefined();
    });

    test('accepts a step against a range', () => {
      expect(validateCronField('1-10/2', 0)).toBeUndefined();
    });

    test('rejects a non-positive step', () => {
      expect(validateCronField('*/0', 0)).toBe('Step must be a positive integer.');
    });

    test('rejects a non-integer step', () => {
      expect(validateCronField('*/1.5', 0)).toBe('Not a valid cron token.');
    });

    test('rejects a step whose range is out of bounds', () => {
      expect(validateCronField('50-70/2', 0)).toBe('Range out of 0–59.');
    });

    test('accepts a plain range', () => {
      expect(validateCronField('1-5', 0)).toBeUndefined();
    });

    test('rejects a range that is out of bounds', () => {
      expect(validateCronField('1-99', 0)).toBe('Out of range (0–59).');
    });

    test('rejects a range whose start is after its end', () => {
      expect(validateCronField('10-5', 0)).toBe('Range start is after its end.');
    });

    test('accepts a plain in-range number', () => {
      expect(validateCronField('30', 0)).toBeUndefined();
    });

    test('rejects a plain out-of-range number', () => {
      expect(validateCronField('99', 0)).toBe('Out of range (0–59).');
    });

    test('accepts a comma-separated list where every part is valid', () => {
      expect(validateCronField('1,2,3', 0)).toBeUndefined();
    });

    test('rejects a comma-separated list with an empty item', () => {
      expect(validateCronField('1,,3', 0)).toBe('Empty list item.');
    });

    test('rejects a comma-separated list with one invalid part', () => {
      expect(validateCronField('1,99,3', 0)).toBe('Out of range (0–59).');
    });

    test('rejects an empty string', () => {
      expect(validateCronField('', 0)).toBe('Required.');
    });

    test('rejects a whitespace-only string', () => {
      expect(validateCronField('   ', 0)).toBe('Required.');
    });

    test('rejects junk text', () => {
      expect(validateCronField('nope', 0)).toBe('Not a valid cron token.');
    });

    test('rejects an unknown field index', () => {
      expect(validateCronField('5', 99)).toBe('Unknown field.');
    });

    test('trims surrounding whitespace before validating', () => {
      expect(validateCronField('  30  ', 0)).toBeUndefined();
    });

    describe('field ranges', () => {
      test('Minute (index 0) accepts 0-59 and rejects 60', () => {
        expect(validateCronField('59', 0)).toBeUndefined();
        expect(validateCronField('60', 0)).toBe('Out of range (0–59).');
      });

      test('Hour (index 1) accepts 0-23 and rejects 24', () => {
        expect(validateCronField('23', 1)).toBeUndefined();
        expect(validateCronField('24', 1)).toBe('Out of range (0–23).');
      });

      test('Day of month (index 2) accepts 1-31 and rejects 0 and 32', () => {
        expect(validateCronField('31', 2)).toBeUndefined();
        expect(validateCronField('0', 2)).toBe('Out of range (1–31).');
        expect(validateCronField('32', 2)).toBe('Out of range (1–31).');
      });

      test('Month (index 3) accepts 1-12 and rejects 0 and 13', () => {
        expect(validateCronField('12', 3)).toBeUndefined();
        expect(validateCronField('0', 3)).toBe('Out of range (1–12).');
        expect(validateCronField('13', 3)).toBe('Out of range (1–12).');
      });

      test('Day of week (index 4) accepts 0-6 and rejects 7', () => {
        expect(validateCronField('6', 4)).toBeUndefined();
        expect(validateCronField('7', 4)).toBe('Out of range (0–6 (Sun–Sat)).');
      });
    });
  });

  describe('cronFieldsValid', () => {
    test('returns true when all five fields are individually valid', () => {
      expect(cronFieldsValid(['*', '*', '*', '*', '*'])).toBe(true);
      expect(cronFieldsValid(['0', '9', '1', '1', '1'])).toBe(true);
    });

    test('returns false when any field is invalid', () => {
      expect(cronFieldsValid(['*', '99', '*', '*', '*'])).toBe(false);
    });

    test('returns false when there are not exactly five fields', () => {
      expect(cronFieldsValid(['*', '*', '*', '*'])).toBe(false);
      expect(cronFieldsValid(['*', '*', '*', '*', '*', '*'])).toBe(false);
      expect(cronFieldsValid([])).toBe(false);
    });
  });

  describe('joinCron / splitCron', () => {
    test('joinCron trims and space-joins five fields', () => {
      expect(joinCron([' 0 ', '9', '*', '*', '*'])).toBe('0 9 * * *');
    });

    test('splitCron parses a full five-field expression', () => {
      expect(splitCron('0 9 * * 1')).toEqual(['0', '9', '*', '*', '1']);
    });

    test('splitCron pads a short expression with wildcards', () => {
      expect(splitCron('0 9')).toEqual(['0', '9', '*', '*', '*']);
      expect(splitCron('')).toEqual(['*', '*', '*', '*', '*']);
    });

    test('splitCron collapses extra internal whitespace', () => {
      expect(splitCron('0    9   *  *   1')).toEqual(['0', '9', '*', '*', '1']);
    });

    test('splitCron and joinCron round-trip a normalized expression', () => {
      const expression = '15 3 1 * *';
      expect(joinCron(splitCron(expression))).toBe(expression);
    });
  });

  describe('parseTime', () => {
    test('parses a valid HH:MM string', () => {
      expect(parseTime('09:30')).toEqual({ hour: 9, minute: 30 });
    });

    test('parses a single-digit hour', () => {
      expect(parseTime('9:05')).toEqual({ hour: 9, minute: 5 });
    });

    test('clamps an hour above 23', () => {
      expect(parseTime('99:00')).toEqual({ hour: 23, minute: 0 });
    });

    test('clamps a minute above 59', () => {
      expect(parseTime('10:99')).toEqual({ hour: 10, minute: 59 });
    });

    test('defaults to 00:00 for an empty string', () => {
      expect(parseTime('')).toEqual({ hour: 0, minute: 0 });
    });

    test('defaults to 00:00 for a malformed string', () => {
      expect(parseTime('not-a-time')).toEqual({ hour: 0, minute: 0 });
    });

    test('trims surrounding whitespace', () => {
      expect(parseTime('  09:30  ')).toEqual({ hour: 9, minute: 30 });
    });
  });

  describe('lowerEveryN', () => {
    test('lowers a positive integer and unit to an interval value', () => {
      expect(lowerEveryN(15, 'minutes')).toEqual({ mode: 'interval', every: 15, unit: 'minutes' });
      expect(lowerEveryN(2, 'hours')).toEqual({ mode: 'interval', every: 2, unit: 'hours' });
    });

    test('falls back to 1 for a non-positive every value', () => {
      expect(lowerEveryN(0, 'minutes')).toEqual({ mode: 'interval', every: 1, unit: 'minutes' });
      expect(lowerEveryN(-5, 'minutes')).toEqual({ mode: 'interval', every: 1, unit: 'minutes' });
    });

    test('falls back to 1 for a non-integer every value', () => {
      expect(lowerEveryN(1.5, 'minutes')).toEqual({ mode: 'interval', every: 1, unit: 'minutes' });
    });
  });

  describe('lowerDailyAt', () => {
    test('lowers a time to a daily cron expression', () => {
      expect(lowerDailyAt('09:30')).toEqual({ mode: 'cron', expression: '30 9 * * *' });
    });

    test('defaults to midnight for an empty time', () => {
      expect(lowerDailyAt('')).toEqual({ mode: 'cron', expression: '0 0 * * *' });
    });
  });

  describe('lowerWeeklyAt', () => {
    test('lowers selected days and a time to a weekly cron expression', () => {
      expect(lowerWeeklyAt([1, 3, 5], '09:00')).toEqual({
        mode: 'cron',
        expression: '0 9 * * 1,3,5',
      });
    });

    test('sorts unordered days before joining', () => {
      expect(lowerWeeklyAt([5, 1, 3], '09:00')).toEqual({
        mode: 'cron',
        expression: '0 9 * * 1,3,5',
      });
    });

    test('falls back to every day (wildcard) when no days are selected', () => {
      expect(lowerWeeklyAt([], '09:00')).toEqual({ mode: 'cron', expression: '0 9 * * *' });
    });

    test('does not mutate the input days array', () => {
      const days = [3, 1, 2];
      lowerWeeklyAt(days, '09:00');
      expect(days).toEqual([3, 1, 2]);
    });
  });

  describe('lowerMonthlyOnDay', () => {
    test('lowers a day and time to a monthly cron expression', () => {
      expect(lowerMonthlyOnDay(15, '09:00')).toEqual({
        mode: 'cron',
        expression: '0 9 15 * *',
      });
    });

    test('clamps a day below 1 up to 1', () => {
      expect(lowerMonthlyOnDay(0, '09:00')).toEqual({ mode: 'cron', expression: '0 9 1 * *' });
      expect(lowerMonthlyOnDay(-5, '09:00')).toEqual({ mode: 'cron', expression: '0 9 1 * *' });
    });

    test('clamps a day above 31 down to 31', () => {
      expect(lowerMonthlyOnDay(45, '09:00')).toEqual({ mode: 'cron', expression: '0 9 31 * *' });
    });

    test('truncates a fractional day', () => {
      expect(lowerMonthlyOnDay(15.9, '09:00')).toEqual({
        mode: 'cron',
        expression: '0 9 15 * *',
      });
    });
  });

  describe('valueToCronFields', () => {
    test('splits an existing cron value into its five fields', () => {
      expect(valueToCronFields({ mode: 'cron', expression: '0 9 * * 1' })).toEqual([
        '0',
        '9',
        '*',
        '*',
        '1',
      ]);
    });

    test('lowers an interval of minutes to a minute-step wildcard', () => {
      expect(valueToCronFields({ mode: 'interval', every: 15, unit: 'minutes' })).toEqual([
        '*/15',
        '*',
        '*',
        '*',
        '*',
      ]);
    });

    test('lowers an interval of hours to an hour-step wildcard', () => {
      expect(valueToCronFields({ mode: 'interval', every: 2, unit: 'hours' })).toEqual([
        '0',
        '*/2',
        '*',
        '*',
        '*',
      ]);
    });

    test('seeds an honest neutral default (daily at midnight) for a days interval, not a misleading day-of-month step', () => {
      // A day-of-month `*/3` resets every month, so it is NOT "every 3 days" —
      // producing it here would silently change the schedule's cadence.
      expect(valueToCronFields({ mode: 'interval', every: 3, unit: 'days' })).toEqual([
        '0',
        '0',
        '*',
        '*',
        '*',
      ]);
    });

    test('seeds an honest neutral default (daily at midnight) for a weeks interval (no native cron equivalent)', () => {
      expect(valueToCronFields({ mode: 'interval', every: 2, unit: 'weeks' })).toEqual([
        '0',
        '0',
        '*',
        '*',
        '*',
      ]);
    });
  });

  describe('valueToInterval', () => {
    test('returns the interval unchanged when the value is already an interval', () => {
      const value: ScheduleValue = { mode: 'interval', every: 5, unit: 'hours' };
      expect(valueToInterval(value)).toEqual({ every: 5, unit: 'hours' });
    });

    test('recovers a minutes interval from a minute-step cron expression', () => {
      expect(valueToInterval({ mode: 'cron', expression: '*/15 * * * *' })).toEqual({
        every: 15,
        unit: 'minutes',
      });
    });

    test('recovers an hours interval from an hour-step cron expression', () => {
      expect(valueToInterval({ mode: 'cron', expression: '0 */2 * * *' })).toEqual({
        every: 2,
        unit: 'hours',
      });
    });

    test('does NOT recover a "days" unit from a day-of-month-step cron expression', () => {
      // A day-of-month `*/3` resets every month — it is not equivalent to "every
      // 3 days", and `valueToCronFields` never produces one for an interval
      // value, so recovering it here would be a lossy, misleading round-trip.
      expect(valueToInterval({ mode: 'cron', expression: '0 0 */3 * *' })).toBeUndefined();
    });

    test('returns undefined when month is fixed (not a pure interval)', () => {
      expect(valueToInterval({ mode: 'cron', expression: '0 0 1 6 *' })).toBeUndefined();
    });

    test('returns undefined when day-of-week is fixed (not a pure interval)', () => {
      expect(valueToInterval({ mode: 'cron', expression: '0 9 * * 1' })).toBeUndefined();
    });

    test('returns undefined for an hour-step expression whose minute is not 0', () => {
      expect(valueToInterval({ mode: 'cron', expression: '5 */2 * * *' })).toBeUndefined();
    });

    test('returns undefined for a day-of-month-step expression regardless of its time', () => {
      expect(valueToInterval({ mode: 'cron', expression: '0 9 */3 * *' })).toBeUndefined();
    });

    test('returns undefined for a fully wildcard expression (no step to recover)', () => {
      expect(valueToInterval({ mode: 'cron', expression: '* * * * *' })).toBeUndefined();
    });

    test('returns undefined for an arbitrary fixed-time daily cron expression', () => {
      expect(valueToInterval({ mode: 'cron', expression: '30 9 * * *' })).toBeUndefined();
    });
  });

  describe('describeValue', () => {
    test('describes an interval of 1 unit using singular phrasing', () => {
      expect(describeValue({ mode: 'interval', every: 1, unit: 'minutes' })).toBe('Every minute');
      expect(describeValue({ mode: 'interval', every: 1, unit: 'hours' })).toBe('Every hour');
      expect(describeValue({ mode: 'interval', every: 1, unit: 'days' })).toBe('Every day');
      expect(describeValue({ mode: 'interval', every: 1, unit: 'weeks' })).toBe('Every week');
    });

    test('describes an interval of more than 1 unit using plural phrasing', () => {
      expect(describeValue({ mode: 'interval', every: 15, unit: 'minutes' })).toBe(
        'Every 15 minutes',
      );
      expect(describeValue({ mode: 'interval', every: 2, unit: 'hours' })).toBe('Every 2 hours');
    });

    test('describes a daily cron expression', () => {
      expect(describeValue({ mode: 'cron', expression: '30 9 * * *' })).toBe('Daily at 09:30');
    });

    test('describes a weekly cron expression with a single day', () => {
      expect(describeValue({ mode: 'cron', expression: '0 9 * * 1' })).toBe(
        'Weekly on Monday at 09:00',
      );
    });

    test('describes a weekly cron expression with multiple days', () => {
      expect(describeValue({ mode: 'cron', expression: '0 9 * * 1,3,5' })).toBe(
        'Weekly on Monday, Wednesday, Friday at 09:00',
      );
    });

    test('describes a monthly cron expression', () => {
      expect(describeValue({ mode: 'cron', expression: '0 9 15 * *' })).toBe(
        'Monthly on day 15 at 09:00',
      );
    });

    test('falls back to a raw cron description for an expression matching no known shape', () => {
      expect(describeValue({ mode: 'cron', expression: '*/5 * * * *' })).toBe('Cron: */5 * * * *');
    });

    test('falls back to a raw cron description when both day-of-month and day-of-week are fixed', () => {
      expect(describeValue({ mode: 'cron', expression: '0 9 15 * 1' })).toBe('Cron: 0 9 15 * 1');
    });

    test('falls back to a raw cron description for an out-of-range day-of-week (does not alias 7 to Sunday)', () => {
      // CRON_FIELDS declares day-of-week as 0–6; this component does not treat
      // 7 as a Sunday alias the way some cron dialects do. A user-typed field
      // can never reach describeValue with a 7 (validateCronField rejects it),
      // but a consumer-supplied value can bypass that — describeValue must not
      // index DOW_NAMES with a wrapped, misleading weekday (`7 % 7` -> Sunday).
      expect(describeValue({ mode: 'cron', expression: '0 9 * * 7' })).toBe('Cron: 0 9 * * 7');
    });

    test('falls back to a raw cron description when any day in a multi-day list is out of range', () => {
      expect(describeValue({ mode: 'cron', expression: '0 9 * * 1,7' })).toBe('Cron: 0 9 * * 1,7');
    });
  });
});
