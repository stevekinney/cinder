import { describe, expect, test } from 'bun:test';

import type { WorkflowTimelineEntry } from '@lostgradient/weft';

import {
  filterTimelineEntries,
  needsTimelinePagination,
  timelineEntriesForPage,
  timelinePageCount,
  timelinePageForStep,
  timelinePageForStepIndex,
  timelineQuickFilterLabel,
} from './timeline-filters.ts';

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

describe('filterTimelineEntries', () => {
  const entries = [
    entry({
      step: 1,
      operationType: 'activity',
      operationLabel: 'reserveFlight',
      status: 'completed',
    }),
    entry({ step: 2, operationType: 'activity', operationLabel: 'chargeCard', status: 'failed' }),
    entry({ step: 3, operationType: 'race', operationLabel: 'race', status: 'running' }),
    entry({
      step: 4,
      operationType: 'activity',
      operationLabel: 'compensate:reserveFlight',
      status: 'completed',
    }),
  ];

  test('all returns every entry', () => {
    expect(filterTimelineEntries(entries, 'all')).toHaveLength(4);
  });

  test('failed matches failed and timed-out', () => {
    const timedOut = entry({ step: 5, status: 'timed-out' });
    const result = filterTimelineEntries([...entries, timedOut], 'failed');
    expect(result.map((e) => e.step)).toEqual([2, 5]);
  });

  test('running matches only running steps', () => {
    expect(filterTimelineEntries(entries, 'running').map((e) => e.step)).toEqual([3]);
  });

  test('coordination matches race/parallel/speculate', () => {
    expect(filterTimelineEntries(entries, 'coordination').map((e) => e.step)).toEqual([3]);
  });

  test('saga matches compensate: activity entries only', () => {
    expect(filterTimelineEntries(entries, 'saga').map((e) => e.step)).toEqual([4]);
  });
});

describe('timelineQuickFilterLabel', () => {
  test('has a label for every filter', () => {
    expect(timelineQuickFilterLabel('all')).toBe('All steps');
    expect(timelineQuickFilterLabel('failed')).toBe('Failed');
  });
});

describe('pagination', () => {
  test('needsTimelinePagination is false at and below the threshold', () => {
    expect(needsTimelinePagination(500)).toBe(false);
    expect(needsTimelinePagination(220)).toBe(false);
  });

  test('needsTimelinePagination is true above the threshold', () => {
    expect(needsTimelinePagination(501)).toBe(true);
  });

  test('timelinePageCount divides by the page size, rounding up', () => {
    expect(timelinePageCount(220)).toBe(2);
    expect(timelinePageCount(400)).toBe(2);
    expect(timelinePageCount(401)).toBe(3);
    expect(timelinePageCount(0)).toBe(1);
  });

  test('timelineEntriesForPage slices in step order and clamps out-of-range indices', () => {
    const long = Array.from({ length: 450 }, (_, index) => entry({ step: index + 1 }));

    expect(timelineEntriesForPage(long, 0)).toHaveLength(200);
    expect(timelineEntriesForPage(long, 0)[0]?.step).toBe(1);
    expect(timelineEntriesForPage(long, 2)).toHaveLength(50);
    expect(timelineEntriesForPage(long, 99)).toHaveLength(50); // clamped to the last page
  });

  test('timelinePageForStepIndex maps a zero-based index to its page', () => {
    expect(timelinePageForStepIndex(0)).toBe(0);
    expect(timelinePageForStepIndex(199)).toBe(0);
    expect(timelinePageForStepIndex(200)).toBe(1);
  });

  test('timelinePageForStep resolves a step number to a page, or null when absent', () => {
    const long = Array.from({ length: 450 }, (_, index) => entry({ step: index + 1 }));

    expect(timelinePageForStep(long, 1)).toBe(0);
    expect(timelinePageForStep(long, 250)).toBe(1);
    expect(timelinePageForStep(long, 999)).toBeNull();
  });
});
