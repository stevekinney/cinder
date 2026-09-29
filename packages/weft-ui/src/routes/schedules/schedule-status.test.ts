import { describe, expect, test } from 'bun:test';

import { missedFireBadgeVariant, scheduleStatusDescriptor } from './schedule-status.ts';

describe('scheduleStatusDescriptor', () => {
  test('maps every ScheduleStatus to a descriptor', () => {
    expect(scheduleStatusDescriptor('active')).toEqual({
      variant: 'success',
      icon: 'play',
      label: 'Active',
    });
    expect(scheduleStatusDescriptor('paused')).toEqual({
      variant: 'neutral',
      icon: 'pause',
      label: 'Paused',
    });
    expect(scheduleStatusDescriptor('cancelled')).toEqual({
      variant: 'neutral',
      icon: 'circle-x',
      label: 'Cancelled',
    });
  });
});

describe('missedFireBadgeVariant', () => {
  test('is warning when missed fires are present', () => {
    expect(missedFireBadgeVariant(1)).toBe('warning');
    expect(missedFireBadgeVariant(5)).toBe('warning');
  });

  test('is neutral at zero', () => {
    expect(missedFireBadgeVariant(0)).toBe('neutral');
  });
});
