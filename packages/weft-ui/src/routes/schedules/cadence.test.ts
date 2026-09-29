import { describe, expect, test } from 'bun:test';

import {
  cadenceToScheduleValue,
  describeCadence,
  describeCronExpression,
  describeIntervalMs,
  intervalMsToScheduleValue,
  scheduleValueToWireSpec,
} from './cadence.ts';

describe('describeCronExpression', () => {
  test('every-N-minutes step', () => {
    expect(describeCronExpression('*/5 * * * *')).toBe('Every 5 minutes');
    expect(describeCronExpression('*/30 * * * *')).toBe('Every 30 minutes');
  });

  test('a 1-minute step reads "Every minute", not "Every 1 minutes"', () => {
    expect(describeCronExpression('*/1 * * * *')).toBe('Every minute');
  });

  test('every-N-hours step', () => {
    expect(describeCronExpression('0 */2 * * *')).toBe('Every 2 hours');
  });

  test('minute pinned to 0, hour wildcard reads "Every hour"', () => {
    expect(describeCronExpression('0 * * * *')).toBe('Every hour');
  });

  test('minute pinned to a non-zero value, hour wildcard', () => {
    expect(describeCronExpression('15 * * * *')).toBe('Every hour at :15');
  });

  test('daily at a fixed time', () => {
    expect(describeCronExpression('0 2 * * *')).toBe('Every day at 02:00');
    expect(describeCronExpression('0 3 * * *')).toBe('Every day at 03:00');
  });

  test('weekly on a numeric day-of-week', () => {
    expect(describeCronExpression('0 9 * * 1')).toBe('Mondays at 09:00');
    expect(describeCronExpression('0 9 * * 0')).toBe('Sundays at 09:00');
  });

  test('weekly on a named day-of-week alias', () => {
    expect(describeCronExpression('0 9 * * MON')).toBe('Mondays at 09:00');
    expect(describeCronExpression('30 17 * * fri')).toBe('Fridays at 17:30');
  });

  test('monthly on a fixed day-of-month', () => {
    expect(describeCronExpression('0 6 1 * *')).toBe('Monthly on day 1 at 06:00');
  });

  test('falls back to raw cron for shapes outside the bounded set', () => {
    expect(describeCronExpression('*/15 9-17 * * 1-5')).toBe('Cron · */15 9-17 * * 1-5');
  });

  test('falls back to raw cron for a malformed (wrong field count) expression', () => {
    expect(describeCronExpression('* * *')).toBe('Cron · * * *');
  });
});

describe('describeIntervalMs', () => {
  test('reduces to the largest evenly-dividing unit', () => {
    expect(describeIntervalMs(60_000)).toBe('Every minute');
    expect(describeIntervalMs(5 * 60_000)).toBe('Every 5 minutes');
    expect(describeIntervalMs(3_600_000)).toBe('Every hour');
    expect(describeIntervalMs(2 * 3_600_000)).toBe('Every 2 hours');
    expect(describeIntervalMs(86_400_000)).toBe('Every day');
    expect(describeIntervalMs(7 * 86_400_000)).toBe('Every week');
  });

  test('falls back to milliseconds for a non-dividing value', () => {
    expect(describeIntervalMs(1_500)).toBe('Every 1500ms');
  });
});

describe('describeCadence', () => {
  test('prefers intervalMs over cronExpression when both are somehow present', () => {
    expect(describeCadence({ intervalMs: 60_000, cronExpression: '0 * * * *' })).toBe(
      'Every minute',
    );
  });

  test('falls back to cronExpression when intervalMs is absent', () => {
    expect(describeCadence({ cronExpression: '0 2 * * *' })).toBe('Every day at 02:00');
  });

  test('reports "Unknown cadence" when neither field is present', () => {
    expect(describeCadence({})).toBe('Unknown cadence');
  });
});

describe('scheduleValueToWireSpec', () => {
  test('cron mode passes the expression through as `cron`', () => {
    expect(scheduleValueToWireSpec({ mode: 'cron', expression: '0 2 * * *' })).toEqual({
      cron: '0 2 * * *',
    });
  });

  test('interval mode resolves to a millisecond number for every supported unit', () => {
    expect(scheduleValueToWireSpec({ mode: 'interval', every: 15, unit: 'minutes' })).toEqual({
      every: 900_000,
    });
    expect(scheduleValueToWireSpec({ mode: 'interval', every: 2, unit: 'hours' })).toEqual({
      every: 7_200_000,
    });
    expect(scheduleValueToWireSpec({ mode: 'interval', every: 1, unit: 'days' })).toEqual({
      every: 86_400_000,
    });
    expect(scheduleValueToWireSpec({ mode: 'interval', every: 1, unit: 'weeks' })).toEqual({
      every: 604_800_000,
    });
  });
});

describe('intervalMsToScheduleValue', () => {
  test('reduces to the largest whole Cinder-supported unit', () => {
    expect(intervalMsToScheduleValue(604_800_000)).toEqual({
      mode: 'interval',
      every: 1,
      unit: 'weeks',
    });
    expect(intervalMsToScheduleValue(86_400_000)).toEqual({
      mode: 'interval',
      every: 1,
      unit: 'days',
    });
    expect(intervalMsToScheduleValue(7_200_000)).toEqual({
      mode: 'interval',
      every: 2,
      unit: 'hours',
    });
    expect(intervalMsToScheduleValue(300_000)).toEqual({
      mode: 'interval',
      every: 5,
      unit: 'minutes',
    });
  });

  test('falls back to a rounded minute count for a non-dividing value', () => {
    expect(intervalMsToScheduleValue(90_000)).toEqual({
      mode: 'interval',
      every: 2,
      unit: 'minutes',
    });
  });
});

describe('cadenceToScheduleValue', () => {
  test('rehydrates a cron cadence', () => {
    expect(cadenceToScheduleValue({ cronExpression: '0 2 * * *' })).toEqual({
      mode: 'cron',
      expression: '0 2 * * *',
    });
  });

  test('rehydrates an interval cadence', () => {
    expect(cadenceToScheduleValue({ intervalMs: 300_000 })).toEqual({
      mode: 'interval',
      every: 5,
      unit: 'minutes',
    });
  });

  test('defaults to every-15-minutes when neither field is present', () => {
    expect(cadenceToScheduleValue({})).toEqual({ mode: 'interval', every: 15, unit: 'minutes' });
  });
});
