import { describe, expect, test } from 'bun:test';

import type { WorkflowTimelineEntry } from '@lostgradient/weft';

import { signalHistoryFromTimeline } from './workflow-timeline-data.ts';

function entry(overrides: Partial<WorkflowTimelineEntry>): WorkflowTimelineEntry {
  return {
    step: 1,
    operationType: 'activity',
    operationLabel: 'doThing',
    inputSummary: '{}',
    timestamp: 1000,
    status: 'completed',
    ...overrides,
  };
}

describe('signalHistoryFromTimeline', () => {
  test('extracts only wait-signal entries, in timeline order', () => {
    const entries = [
      entry({
        step: 1,
        operationType: 'wait-signal',
        operationLabel: 'advance',
        status: 'completed',
      }),
      entry({ step: 2, operationType: 'activity', operationLabel: 'recordStep' }),
      entry({
        step: 3,
        operationType: 'wait-signal',
        operationLabel: 'advance',
        status: 'running',
      }),
    ];

    const rows = signalHistoryFromTimeline(entries);

    expect(rows).toEqual([
      { step: 1, name: 'advance', status: 'completed', timestamp: 1000 },
      { step: 3, name: 'advance', status: 'running', timestamp: 1000 },
    ]);
  });

  test('empty timeline yields no rows', () => {
    expect(signalHistoryFromTimeline([])).toEqual([]);
  });

  test('a timeline with no wait-signal entries yields no rows', () => {
    const entries = [entry({ operationType: 'activity' }), entry({ operationType: 'sleep' })];
    expect(signalHistoryFromTimeline(entries)).toEqual([]);
  });
});
