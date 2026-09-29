import { describe, expect, test } from 'bun:test';

import type { RunStep, RunStepBranchGroup, RunStepTimelineEntry } from '@lostgradient/cinder';
import type { WorkflowTimelineEntry } from '@lostgradient/weft';

import {
  compensatedActivityName,
  isDegradedCoordinationEntry,
  mapTimelineToSteps,
  stepNumberFromRunStepId,
  timelineEntryLabel,
} from './timeline-mapping.ts';

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

function asStep(value: RunStepTimelineEntry | undefined): RunStep {
  if (value === undefined || 'kind' in value) throw new Error('expected a plain step');
  return value;
}

function asBranch(value: RunStepTimelineEntry | undefined): RunStepBranchGroup {
  if (value === undefined || !('kind' in value) || value.kind !== 'branch') {
    throw new Error('expected a branch group');
  }
  return value;
}

describe('timelineEntryLabel', () => {
  test('activity uses the activity name verbatim', () => {
    expect(
      timelineEntryLabel(entry({ operationType: 'activity', operationLabel: 'chargeCard' })),
    ).toBe('chargeCard');
  });

  test('wait-signal is prefixed with "Signal"', () => {
    expect(
      timelineEntryLabel(entry({ operationType: 'wait-signal', operationLabel: 'advance' })),
    ).toBe('Signal: advance');
  });

  test('child-workflow is prefixed with "Child"', () => {
    expect(
      timelineEntryLabel(
        entry({ operationType: 'child-workflow', operationLabel: 'validate-shipment' }),
      ),
    ).toBe('Child: validate-shipment');
  });

  test('race shows the structural label and branch count from inputSummary', () => {
    expect(
      timelineEntryLabel(
        entry({
          operationType: 'race',
          operationLabel: 'race',
          inputSummary: '{"operationCount":2}',
        }),
      ),
    ).toBe('Race · 2 branches');
  });

  test('speculate has no operationCount in its inputSummary, so no count is shown', () => {
    expect(
      timelineEntryLabel(
        entry({
          operationType: 'speculate',
          operationLabel: 'speculate',
          inputSummary: '{"branch":"speculative"}',
        }),
      ),
    ).toBe('Speculate');
  });

  test('an unrecognized structural operation type falls back to operationLabel, not a fabricated title', () => {
    expect(
      timelineEntryLabel(
        entry({ operationType: 'some-future-op', operationLabel: 'some-future-op' }),
      ),
    ).toBe('some-future-op');
  });
});

describe('isDegradedCoordinationEntry', () => {
  test('race, parallel, and speculate are degraded', () => {
    expect(isDegradedCoordinationEntry(entry({ operationType: 'race' }))).toBe(true);
    expect(isDegradedCoordinationEntry(entry({ operationType: 'parallel' }))).toBe(true);
    expect(isDegradedCoordinationEntry(entry({ operationType: 'speculate' }))).toBe(true);
  });

  test('a plain activity is not degraded', () => {
    expect(isDegradedCoordinationEntry(entry({ operationType: 'activity' }))).toBe(false);
  });

  test('coordinator metadata is no longer degraded', () => {
    expect(
      isDegradedCoordinationEntry(
        entry({
          operationType: 'race',
          branches: [
            {
              index: 0,
              operationId: 'op-winner',
              operationType: 'activity',
              operationLabel: 'winner',
              outcome: 'won',
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe('compensatedActivityName', () => {
  test('extracts the forward activity name from a compensate: label', () => {
    expect(
      compensatedActivityName(
        entry({ operationType: 'activity', operationLabel: 'compensate:reserveHotel' }),
      ),
    ).toBe('reserveHotel');
  });

  test('a plain activity is not a compensation', () => {
    expect(
      compensatedActivityName(entry({ operationType: 'activity', operationLabel: 'reserveHotel' })),
    ).toBeNull();
  });

  test('a non-activity operation type is never a compensation, even with a matching label', () => {
    expect(
      compensatedActivityName(
        entry({ operationType: 'wait-signal', operationLabel: 'compensate:x' }),
      ),
    ).toBeNull();
  });
});

describe('mapTimelineToSteps', () => {
  test('maps a plain sequential timeline in order', () => {
    const entries = [
      entry({ step: 1, operationLabel: 'reserveFlight', status: 'completed', duration: 5 }),
      entry({ step: 2, operationLabel: 'reserveHotel', status: 'running', timestamp: 2_000 }),
    ];

    const steps = mapTimelineToSteps(entries);

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ id: 'step-1', label: 'reserveFlight', status: 'succeeded' });
    expect(asStep(steps[0]).duration).toBe('5ms');
    expect(steps[1]).toMatchObject({ id: 'step-2', label: 'reserveHotel', status: 'running' });
    expect(asStep(steps[1]).duration).toBeUndefined();
  });

  test('links a saga compensation step to its forward step by id (the trip-booking-saga fixture shape)', () => {
    const entries = [
      entry({ step: 1, operationLabel: 'reserveFlight', status: 'completed' }),
      entry({ step: 2, operationLabel: 'reserveHotel', status: 'completed' }),
      entry({ step: 3, operationLabel: 'chargeTripCard', status: 'failed' }),
      entry({ step: 4, operationLabel: 'compensate:reserveHotel', status: 'completed' }),
      entry({ step: 5, operationLabel: 'compensate:reserveFlight', status: 'failed' }),
    ];

    const steps = mapTimelineToSteps(entries);

    expect(asStep(steps[3])).toMatchObject({ id: 'step-4', compensates: 'step-2' });
    expect(asStep(steps[4])).toMatchObject({ id: 'step-5', compensates: 'step-1' });
    // The step it compensates is unaffected — its own status is untouched.
    expect(steps[1]).toMatchObject({ id: 'step-2', status: 'succeeded' });
  });

  test('an unmatched compensate: name renders in place with no compensates link (never guesses)', () => {
    const entries = [
      entry({ step: 1, operationLabel: 'compensate:neverHappened', status: 'completed' }),
    ];

    const steps = mapTimelineToSteps(entries);

    expect(asStep(steps[0]).compensates).toBeUndefined();
  });

  test('a degraded coordination entry gets an explanatory detail panel', () => {
    const entries = [
      entry({
        step: 1,
        operationType: 'race',
        operationLabel: 'race',
        inputSummary: '{"operationCount":2}',
        status: 'completed',
      }),
    ];

    const steps = mapTimelineToSteps(entries);
    const noteDetail = asStep(steps[0]).details?.find(
      (detail) => detail.label === 'About this step',
    );
    expect(noteDetail).toMatchObject({ type: 'text' });
    if (noteDetail?.type !== 'text') throw new Error('Expected explanatory detail to be text.');
    expect(noteDetail.content).toContain('did not include per-branch detail');
  });

  test('maps race branch keys, winner emphasis, loser settlement, and errors', () => {
    const steps = mapTimelineToSteps([
      entry({
        step: 1,
        operationType: 'race',
        operationLabel: 'race',
        inputSummary: '{"operationCount":2}',
        branches: [
          {
            index: 0,
            key: 'fast',
            operationId: 'op-fast',
            operationType: 'activity',
            operationLabel: 'fastCandidate',
            outcome: 'won',
          },
          {
            index: 1,
            key: 'slow',
            operationId: 'op-slow',
            operationType: 'activity',
            operationLabel: 'slowCandidate',
            outcome: 'lost',
            errorSummary: '[REDACTED]',
          },
        ],
      }),
    ]);

    expect(steps[0]).toMatchObject({
      kind: 'branch',
      id: 'step-1',
      label: 'Race · 2 branches',
    });
    const branch = asBranch(steps[0]);
    expect(branch.lanes).toMatchObject([
      { id: 'step-1-branch-0-lane', label: 'fast', outcome: 'won' },
      { id: 'step-1-branch-1-lane', label: 'slow', outcome: 'lost' },
    ]);
    expect(branch.lanes[0]?.steps[0]).toMatchObject({
      id: 'step-1-branch-0',
      label: 'fastCandidate',
      status: 'succeeded',
    });
    expect(branch.lanes[1]?.steps[0]).toMatchObject({ status: 'failed' });
    expect(branch.lanes[1]?.steps[0]?.details).toContainEqual({
      id: 'step-1-branch-1-error',
      label: 'Error',
      type: 'text',
      content: '[REDACTED]',
    });
  });

  test('maps bounded branch omission count into the group label', () => {
    const steps = mapTimelineToSteps([
      entry({
        operationType: 'parallel',
        branches: [],
        branchesOmitted: 4,
      }),
    ]);

    expect(steps[0]).toMatchObject({ kind: 'branch', label: 'All (parallel) · 4 more omitted' });
  });

  test('maps speculative children and rolled-back outcome to rewound steps', () => {
    const steps = mapTimelineToSteps([
      entry({
        operationType: 'speculate',
        children: [
          {
            index: 0,
            operationId: 'op-pass',
            operationType: 'activity',
            operationLabel: 'pass',
            outcome: 'fulfilled',
          },
          {
            index: 1,
            operationId: 'op-fail',
            operationType: 'activity',
            operationLabel: 'fail',
            outcome: 'rejected',
            errorSummary: '[REDACTED]',
          },
        ],
        childrenOmitted: 1,
        speculationOutcome: 'rolled-back',
      }),
    ]);

    expect(steps[0]).toMatchObject({
      kind: 'branch',
      label: 'Speculate · rolled-back · 1 more omitted',
    });
    const branch = asBranch(steps[0]);
    expect(branch.lanes).toHaveLength(2);
    expect(branch.lanes[0]?.outcome).toBe('settled');
    expect(branch.lanes[0]?.steps[0]).toMatchObject({ rewound: true, status: 'succeeded' });
    expect(branch.lanes[1]?.steps[0]).toMatchObject({ rewound: true, status: 'failed' });
  });

  test('a failed step labels its output detail "Error"', () => {
    const entries = [entry({ step: 1, status: 'failed', outputSummary: '"boom"' })];

    const steps = mapTimelineToSteps(entries);
    expect(asStep(steps[0]).details?.find((detail) => detail.id === 'step-1-output')?.label).toBe(
      'Error',
    );
  });

  test('empty timeline maps to an empty step list', () => {
    expect(mapTimelineToSteps([])).toEqual([]);
  });
});

describe('stepNumberFromRunStepId', () => {
  test('round-trips a mapped step id', () => {
    expect(stepNumberFromRunStepId('step-42')).toBe(42);
  });

  test('resolves a branch-lane step id to its parent coordination step number', () => {
    // Minted by `mapCoordinatorEntry` for a `race`/`all`/`speculate` branch —
    // the engine only checkpoints at the coordination entry's own step, so
    // selecting a branch row should filter Events to that parent step (WFC-7
    // follow-up: this used to return `null`, silently no-op-ing the Events
    // filter while the UI still claimed "filtered to this step").
    expect(stepNumberFromRunStepId('step-3-branch-0')).toBe(3);
    expect(stepNumberFromRunStepId('step-3-branch-12')).toBe(3);
  });

  test('returns null for an id this module did not mint', () => {
    expect(stepNumberFromRunStepId('branch-race')).toBeNull();
    expect(stepNumberFromRunStepId('step-')).toBeNull();
    expect(stepNumberFromRunStepId('not-a-step')).toBeNull();
    expect(stepNumberFromRunStepId('step-3-branch-')).toBeNull();
    expect(stepNumberFromRunStepId('step-3-branch-x')).toBeNull();
  });
});
