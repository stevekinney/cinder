import { describe, expect, test } from 'bun:test';

import {
  PENDING_ASYNC_ACTIVITY_OPERATION,
  pendingAsyncActivitiesQueryKey,
  pendingAsyncActivityObservations,
} from './async-activity-query.ts';

describe('pending async activity query', () => {
  test('uses the shipped operation name and workflow-scoped cache key', () => {
    expect(PENDING_ASYNC_ACTIVITY_OPERATION).toBe('weft.workflows.activities.pending.list');
    expect(pendingAsyncActivitiesQueryKey('wf-1')).toEqual([
      'workflows',
      'pending-async-activities',
      'wf-1',
    ]);
  });

  test('preserves the durable item metadata needed for authoritative step matching', () => {
    expect(
      pendingAsyncActivityObservations([
        {
          token: 'async-act:v1:wf-1:1:1',
          operationId: 'op-1',
          activityName: 'printShippingLabel',
          step: 1,
          attempt: 1,
          createdAt: 1_000,
        },
      ]),
    ).toEqual([
      {
        token: 'async-act:v1:wf-1:1:1',
        operationId: 'op-1',
        activityName: 'printShippingLabel',
        step: 1,
        attempt: 1,
        observedAt: 1_000,
      },
    ]);
  });
});
