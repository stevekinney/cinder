import { describe, expect, test } from 'bun:test';

import { throwingRejectionOf } from '@lostgradient/testing';
import {
  finalizerQueryKey,
  getFinalizerStatus,
  getScheduleProvenance,
  scheduleProvenanceQueryKey,
  type WorkflowFinalizerClient,
  type WorkflowScheduleProvenanceClient,
} from './workflow-observability.ts';

function finalizerClientReturning(output: unknown): WorkflowFinalizerClient {
  return { operations: { 'weft.workflows.finalizer.get': async () => output } };
}

function scheduleProvenanceClientReturning(output: unknown): WorkflowScheduleProvenanceClient {
  return { operations: { 'weft.workflows.scheduleprovenance.get': async () => output } };
}

describe('getFinalizerStatus', () => {
  test('null passes through as null (no finalizer work recorded)', async () => {
    expect(await getFinalizerStatus(finalizerClientReturning(null), 'wf_1')).toBeNull();
  });

  test('a well-formed pending status parses through', async () => {
    expect(
      await getFinalizerStatus(
        finalizerClientReturning({ status: 'pending', attempts: 0 }),
        'wf_1',
      ),
    ).toEqual({ status: 'pending', attempts: 0 });
  });

  test('a well-formed failed status parses through with its error', async () => {
    const value = { status: 'failed' as const, attempts: 3, failedAt: 1, error: 'boom' };
    expect(await getFinalizerStatus(finalizerClientReturning(value), 'wf_1')).toEqual(value);
  });

  test('an unexpected shape throws rather than silently fabricating a status', async () => {
    expect(
      await throwingRejectionOf(
        getFinalizerStatus(finalizerClientReturning({ status: 'not-a-real-status' }), 'wf_1'),
      ),
    ).toThrow(TypeError);
  });

  test('a bare string throws rather than silently fabricating a status', async () => {
    expect(
      await throwingRejectionOf(getFinalizerStatus(finalizerClientReturning('running'), 'wf_1')),
    ).toThrow(TypeError);
  });
});

describe('getScheduleProvenance', () => {
  test('null passes through as null (not a schedule-launched run)', async () => {
    expect(await getScheduleProvenance(scheduleProvenanceClientReturning(null), 'wf_1')).toBeNull();
  });

  test('a well-formed provenance record parses through, occurrence optional', async () => {
    expect(
      await getScheduleProvenance(
        scheduleProvenanceClientReturning({ scheduleId: 'nightly-cleanup' }),
        'wf_1',
      ),
    ).toEqual({ scheduleId: 'nightly-cleanup' });

    expect(
      await getScheduleProvenance(
        scheduleProvenanceClientReturning({ scheduleId: 'nightly-cleanup', occurrence: 1_000 }),
        'wf_1',
      ),
    ).toEqual({ scheduleId: 'nightly-cleanup', occurrence: 1_000 });
  });

  test('an unexpected shape throws rather than silently fabricating provenance', async () => {
    expect(
      await throwingRejectionOf(
        getScheduleProvenance(scheduleProvenanceClientReturning({}), 'wf_1'),
      ),
    ).toThrow(TypeError);
  });
});

describe('query keys', () => {
  test('finalizerQueryKey/scheduleProvenanceQueryKey are stable, id-scoped tuples', () => {
    expect(finalizerQueryKey('wf_1')).toEqual(['workflows', 'finalizer', 'wf_1']);
    expect(scheduleProvenanceQueryKey('wf_1')).toEqual([
      'workflows',
      'schedule-provenance',
      'wf_1',
    ]);
  });
});
