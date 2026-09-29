import { describe, expect, test } from 'bun:test';

import type { WorkflowTimelineStatus } from '@lostgradient/weft';

import type { RunStepStatus } from '@lostgradient/cinder';

import { isTimelineStatusTerminal, timelineStepStatus } from './timeline-step-state.ts';

describe('timelineStepStatus', () => {
  test('maps every real WorkflowTimelineStatus value', () => {
    const cases: Array<[WorkflowTimelineStatus, RunStepStatus]> = [
      ['running', 'running'],
      ['completed', 'succeeded'],
      ['failed', 'failed'],
      ['cancelled', 'cancelled'],
      ['timed-out', 'timed-out'],
    ];

    for (const [input, expected] of cases) {
      expect(timelineStepStatus(input)).toBe(expected);
    }
  });
});

describe('isTimelineStatusTerminal', () => {
  test('running is not terminal', () => {
    expect(isTimelineStatusTerminal('running')).toBe(false);
  });

  test('every other status is terminal', () => {
    expect(isTimelineStatusTerminal('completed')).toBe(true);
    expect(isTimelineStatusTerminal('failed')).toBe(true);
    expect(isTimelineStatusTerminal('cancelled')).toBe(true);
    expect(isTimelineStatusTerminal('timed-out')).toBe(true);
  });
});
