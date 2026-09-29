import { describe, expect, test } from 'bun:test';

import {
  inputJsonError,
  jitterError,
  ScheduleFormState,
  scheduleIdError,
} from './schedule-form-state.svelte.ts';

describe('scheduleIdError', () => {
  test('an empty id is valid — means auto-generate', () => {
    expect(scheduleIdError('')).toBeUndefined();
  });

  test('a normal id is valid', () => {
    expect(scheduleIdError('nightly-rollup')).toBeUndefined();
  });

  test('rejects an id over 128 characters', () => {
    expect(scheduleIdError('a'.repeat(129))).toBe('Must be at most 128 characters.');
  });

  test('accepts an id at exactly the 128 character limit', () => {
    expect(scheduleIdError('a'.repeat(128))).toBeUndefined();
  });

  test('rejects an id containing a control character', () => {
    expect(scheduleIdError(`bad${String.fromCharCode(7)}id`)).toBe(
      'Must not contain control characters.',
    );
  });
});

describe('jitterError', () => {
  test('an empty jitter string is valid — means no jitter', () => {
    expect(jitterError('')).toBeUndefined();
    expect(jitterError('   ')).toBeUndefined();
  });

  test('accepts every documented duration unit', () => {
    for (const value of ['30s', '5m', '1h', '250ms', '2 days', '1.5h']) {
      expect(jitterError(value)).toBeUndefined();
    }
  });

  test('rejects an unrecognized format', () => {
    expect(jitterError('soon')).toBe('Use a duration like "30s", "5m", or "1h".');
    expect(jitterError('5')).toBe('Use a duration like "30s", "5m", or "1h".');
  });
});

describe('inputJsonError', () => {
  test('accepts valid JSON, including the empty object', () => {
    expect(inputJsonError('{}')).toBeUndefined();
    expect(inputJsonError('{"warehouseId":"wh-1"}')).toBeUndefined();
    expect(inputJsonError('null')).toBeUndefined();
  });

  test('rejects malformed JSON', () => {
    expect(inputJsonError('{not json')).toBe('Must be valid JSON.');
  });
});

describe('ScheduleFormState', () => {
  test('defaults to an empty, invalid draft (no workflow type chosen)', () => {
    const form = new ScheduleFormState();
    expect(form.workflowType).toBe('');
    expect(form.inputText).toBe('{}');
    expect(form.overlap).toBe('skip');
    expect(form.cadence).toEqual({ mode: 'interval', every: 15, unit: 'minutes' });
    expect(form.revisionPolicy).toBe('active-at-fire');
    expect(form.initialRevisionPolicy).toBe('active-at-fire');
    expect(form.isValid).toBe(false);
    expect(form.errors.workflowType).toBe('Choose a workflow type.');
  });

  test('applies every field from an init snapshot', () => {
    const form = new ScheduleFormState({
      id: 'nightly-rollup',
      workflowType: 'report-gen',
      inputText: '{"day":"today"}',
      cadence: { mode: 'cron', expression: '0 2 * * *' },
      overlap: 'queue',
      jitterText: '30s',
      backfill: true,
      startPaused: true,
      revisionPolicy: 'pinned',
    });

    expect(form.id).toBe('nightly-rollup');
    expect(form.workflowType).toBe('report-gen');
    expect(form.inputText).toBe('{"day":"today"}');
    expect(form.cadence).toEqual({ mode: 'cron', expression: '0 2 * * *' });
    expect(form.overlap).toBe('queue');
    expect(form.jitterText).toBe('30s');
    expect(form.backfill).toBe(true);
    expect(form.startPaused).toBe(true);
    expect(form.revisionPolicy).toBe('pinned');
    expect(form.initialRevisionPolicy).toBe('pinned');
    expect(form.isValid).toBe(true);
  });

  test('is invalid when any single field is invalid', () => {
    const form = new ScheduleFormState({ workflowType: 'report-gen', inputText: '{bad' });
    expect(form.isValid).toBe(false);
    expect(form.errors.input).toBe('Must be valid JSON.');
    expect(form.errors.workflowType).toBeUndefined();
  });

  test('parsedInput reflects the current inputText, undefined when invalid', () => {
    const form = new ScheduleFormState({ workflowType: 'report-gen' });
    form.inputText = '{"warehouseId":"wh-1"}';
    expect(form.parsedInput).toEqual({ warehouseId: 'wh-1' });

    form.inputText = 'not json';
    expect(form.parsedInput).toBeUndefined();
  });

  describe('toCreateArgs', () => {
    test('omits id and jitter when both are blank', () => {
      const form = new ScheduleFormState({
        workflowType: 'report-gen',
        cadence: { mode: 'cron', expression: '0 2 * * *' },
      });

      expect(form.toCreateArgs()).toEqual({
        workflowType: 'report-gen',
        input: {},
        spec: { cron: '0 2 * * *' },
        overlap: 'skip',
        backfill: false,
        revisionPolicy: 'active-at-fire',
      });
    });

    test('includes a trimmed id and jitter when both are set', () => {
      const form = new ScheduleFormState({
        workflowType: 'report-gen',
        id: '  nightly-rollup  ',
        jitterText: '  30s  ',
        cadence: { mode: 'interval', every: 5, unit: 'minutes' },
        overlap: 'cancel-running',
        backfill: true,
      });

      expect(form.toCreateArgs()).toEqual({
        workflowType: 'report-gen',
        input: {},
        spec: { every: 300_000 },
        overlap: 'cancel-running',
        backfill: true,
        revisionPolicy: 'active-at-fire',
        id: 'nightly-rollup',
        jitter: '30s',
      });
    });

    test('includes a non-default revisionPolicy from init', () => {
      const form = new ScheduleFormState({
        workflowType: 'report-gen',
        cadence: { mode: 'cron', expression: '0 2 * * *' },
        revisionPolicy: 'pinned',
      });

      expect(form.toCreateArgs().revisionPolicy).toBe('pinned');
    });
  });

  describe('toUpdateRevisionPolicy', () => {
    test('returns undefined when unchanged from the initial policy (active-at-fire)', () => {
      const form = new ScheduleFormState({ workflowType: 'report-gen' });
      expect(form.toUpdateRevisionPolicy()).toBeUndefined();
    });

    test('returns undefined when unchanged from the initial policy (pinned)', () => {
      const form = new ScheduleFormState({ workflowType: 'report-gen', revisionPolicy: 'pinned' });
      expect(form.toUpdateRevisionPolicy()).toBeUndefined();
    });

    test('returns the new value when switched from active-at-fire to pinned', () => {
      const form = new ScheduleFormState({ workflowType: 'report-gen' });
      form.revisionPolicy = 'pinned';
      expect(form.toUpdateRevisionPolicy()).toBe('pinned');
    });

    test('returns the new value when switched from pinned to active-at-fire', () => {
      const form = new ScheduleFormState({ workflowType: 'report-gen', revisionPolicy: 'pinned' });
      form.revisionPolicy = 'active-at-fire';
      expect(form.toUpdateRevisionPolicy()).toBe('active-at-fire');
    });

    test('returns undefined again if switched away and back to the initial value', () => {
      const form = new ScheduleFormState({ workflowType: 'report-gen' });
      form.revisionPolicy = 'pinned';
      form.revisionPolicy = 'active-at-fire';
      expect(form.toUpdateRevisionPolicy()).toBeUndefined();
    });
  });
});
