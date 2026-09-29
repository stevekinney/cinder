import { describe, expect, test } from 'bun:test';

import type { WorkflowStatus } from '@lostgradient/weft';

import { STATUS_DISPLAY_ORDER, statusToneInfo } from './status-tone.ts';

const ALL_STATUSES: readonly WorkflowStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timed-out',
  'suspended',
];

describe('statusToneInfo', () => {
  test('maps every WorkflowStatus to a label and tone', () => {
    for (const status of ALL_STATUSES) {
      const info = statusToneInfo(status);
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.tone.length).toBeGreaterThan(0);
    }
  });

  test('failed and timed-out both map to the danger tone', () => {
    expect(statusToneInfo('failed').tone).toBe('danger');
    expect(statusToneInfo('timed-out').tone).toBe('danger');
  });

  test('running maps to the success tone', () => {
    expect(statusToneInfo('running').tone).toBe('success');
  });
});

describe('STATUS_DISPLAY_ORDER', () => {
  test('contains every WorkflowStatus exactly once', () => {
    expect(STATUS_DISPLAY_ORDER.length).toBe(ALL_STATUSES.length);
    for (const status of ALL_STATUSES) {
      expect(STATUS_DISPLAY_ORDER.filter((entry) => entry === status).length).toBe(1);
    }
  });

  test('lists running before the terminal failure states', () => {
    expect(STATUS_DISPLAY_ORDER.indexOf('running')).toBeLessThan(
      STATUS_DISPLAY_ORDER.indexOf('failed'),
    );
    expect(STATUS_DISPLAY_ORDER.indexOf('running')).toBeLessThan(
      STATUS_DISPLAY_ORDER.indexOf('timed-out'),
    );
  });
});
