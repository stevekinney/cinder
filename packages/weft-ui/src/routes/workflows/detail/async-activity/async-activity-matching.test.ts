import { describe, expect, test } from 'bun:test';

import type { WorkflowTimelineEntry } from '@lostgradient/weft';

import type { PendingAsyncActivityObservation } from '../timeline/workflow-live-observations.svelte.ts';
import { attachPendingActivitiesToSteps } from './async-activity-matching.ts';

function entry(overrides: Partial<WorkflowTimelineEntry>): WorkflowTimelineEntry {
  return {
    step: 1,
    operationType: 'activity',
    operationLabel: 'printShippingLabel',
    inputSummary: '{}',
    timestamp: 1_000,
    status: 'running',
    ...overrides,
  };
}

function pending(
  overrides: Partial<PendingAsyncActivityObservation> = {},
): PendingAsyncActivityObservation {
  return {
    token: 'tok-1',
    operationId: 'op-1',
    activityName: 'printShippingLabel',
    attempt: 1,
    observedAt: 1_000,
    ...overrides,
  };
}

describe('attachPendingActivitiesToSteps', () => {
  test('links to the single running step with a matching activity name', () => {
    const entries = [
      entry({ step: 1, operationLabel: 'printShippingLabel', status: 'running' }),
      entry({ step: 2, operationLabel: 'notifyEmail', status: 'completed' }),
    ];

    const [attached] = attachPendingActivitiesToSteps([pending()], entries);

    expect(attached?.stepId).toBe('step-1');
  });

  test('prefers the authoritative operation step when it is available', () => {
    const entries = [
      entry({ step: 3, operationLabel: 'sameName', status: 'running' }),
      entry({ step: 8, operationLabel: 'sameName', status: 'running' }),
    ];

    const [attached] = attachPendingActivitiesToSteps(
      [pending({ activityName: 'sameName', step: 8 })],
      entries,
    );

    expect(attached?.stepId).toBe('step-8');
  });

  test('leaves it unattached when no running step matches the activity name', () => {
    const entries = [entry({ step: 1, operationLabel: 'printShippingLabel', status: 'completed' })];

    const [attached] = attachPendingActivitiesToSteps([pending()], entries);

    expect(attached?.stepId).toBeNull();
  });

  test('leaves it unattached when multiple running steps share the activity name (never guesses)', () => {
    const entries = [
      entry({ step: 1, operationLabel: 'printShippingLabel', status: 'running' }),
      entry({ step: 5, operationLabel: 'printShippingLabel', status: 'running' }),
    ];

    const [attached] = attachPendingActivitiesToSteps([pending()], entries);

    expect(attached?.stepId).toBeNull();
  });

  test('a coordinator-degraded entry (race/parallel/speculate) never matches — operationType is not activity', () => {
    const entries = [
      entry({ step: 1, operationType: 'race', operationLabel: 'race', status: 'running' }),
    ];

    const [attached] = attachPendingActivitiesToSteps([pending()], entries);

    expect(attached?.stepId).toBeNull();
  });

  test('empty pending list returns empty', () => {
    expect(attachPendingActivitiesToSteps([], [])).toEqual([]);
  });
});
