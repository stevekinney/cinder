import { describe, expect, test } from 'bun:test';

import type { WorkflowTimelineEntry } from '@lostgradient/weft';

import {
  alignTimelinesForDivergence,
  divergedForkedStepIds,
  divergedOriginalStepIds,
} from './divergence.ts';

function entry(overrides: Partial<WorkflowTimelineEntry>): WorkflowTimelineEntry {
  return {
    step: 1,
    operationType: 'activity',
    operationLabel: 'doThing',
    inputSummary: '{}',
    timestamp: 1_000,
    status: 'completed',
    ...overrides,
  };
}

describe('alignTimelinesForDivergence', () => {
  test('identical timelines through the fork point are all "same"', () => {
    const original = [
      entry({ step: 1, operationLabel: 'a' }),
      entry({ step: 2, operationLabel: 'b' }),
    ];
    const forked = [
      entry({ step: 1, operationLabel: 'a' }),
      entry({ step: 2, operationLabel: 'b' }),
    ];

    const rows = alignTimelinesForDivergence(original, forked);

    expect(rows.map((row) => row.kind)).toEqual(['same', 'same']);
  });

  test('a step present only in the forked run past the fork point is "forked-only"', () => {
    const original = [entry({ step: 1, operationLabel: 'a' })];
    const forked = [
      entry({ step: 1, operationLabel: 'a' }),
      entry({ step: 2, operationLabel: 'c' }),
    ];

    const rows = alignTimelinesForDivergence(original, forked);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ step: 2, kind: 'forked-only', original: null });
  });

  test('a step present only in the original is "original-only"', () => {
    const original = [
      entry({ step: 1, operationLabel: 'a' }),
      entry({ step: 2, operationLabel: 'b' }),
    ];
    const forked = [entry({ step: 1, operationLabel: 'a' })];

    const rows = alignTimelinesForDivergence(original, forked);

    expect(rows[1]).toMatchObject({ step: 2, kind: 'original-only', forked: null });
  });

  test('the same step number with a different operation label or status is "diverged"', () => {
    const original = [entry({ step: 2, operationLabel: 'chargeCard', status: 'failed' })];
    const forked = [entry({ step: 2, operationLabel: 'chargeCard', status: 'completed' })];

    const rows = alignTimelinesForDivergence(original, forked);

    expect(rows[0]?.kind).toBe('diverged');
  });

  test('rows are sorted ascending by step regardless of input order', () => {
    const original = [entry({ step: 3 }), entry({ step: 1 })];
    const forked = [entry({ step: 2 })];

    const rows = alignTimelinesForDivergence(original, forked);

    expect(rows.map((row) => row.step)).toEqual([1, 2, 3]);
  });
});

describe('divergedOriginalStepIds / divergedForkedStepIds', () => {
  test("collects only diverged/one-sided rows, in each timeline's own step-id space", () => {
    const original = [
      entry({ step: 1, operationLabel: 'a' }),
      entry({ step: 2, operationLabel: 'b', status: 'failed' }),
    ];
    const forked = [
      entry({ step: 1, operationLabel: 'a' }),
      entry({ step: 2, operationLabel: 'b', status: 'completed' }),
      entry({ step: 3, operationLabel: 'c' }),
    ];

    const rows = alignTimelinesForDivergence(original, forked);

    expect(divergedOriginalStepIds(rows)).toEqual(new Set(['step-2']));
    expect(divergedForkedStepIds(rows)).toEqual(new Set(['step-2', 'step-3']));
  });
});
