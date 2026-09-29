import { describe, expect, test } from 'bun:test';

import {
  createdDatePresetToTimeRange,
  denormalizeWorkflowStatusFilter,
  normalizeWorkflowStatusFilter,
  timeRangeToCreatedDatePreset,
  toggleWorkflowStatus,
} from './workflow-list-filters.ts';

describe('toggleWorkflowStatus', () => {
  test('adds a status not yet present', () => {
    expect(toggleWorkflowStatus(['running'], 'failed')).toEqual(['running', 'failed']);
  });

  test('removes a status already present', () => {
    expect(toggleWorkflowStatus(['running', 'failed'], 'running')).toEqual(['failed']);
  });

  test('never mutates the input array', () => {
    const input: readonly ['running'] = ['running'];
    toggleWorkflowStatus(input, 'failed');
    expect(input).toEqual(['running']);
  });
});

describe('normalizeWorkflowStatusFilter / denormalizeWorkflowStatusFilter', () => {
  test('normalize: undefined -> []', () => {
    expect(normalizeWorkflowStatusFilter(undefined)).toEqual([]);
  });

  test('normalize: a bare value -> single-entry array', () => {
    expect(normalizeWorkflowStatusFilter('running')).toEqual(['running']);
  });

  test('normalize: an array passes through (copied)', () => {
    expect(normalizeWorkflowStatusFilter(['running', 'failed'])).toEqual(['running', 'failed']);
  });

  test('denormalize: [] -> undefined', () => {
    expect(denormalizeWorkflowStatusFilter([])).toBeUndefined();
  });

  test('denormalize: one entry -> a bare value', () => {
    expect(denormalizeWorkflowStatusFilter(['running'])).toBe('running');
  });

  test('denormalize: multiple entries -> an array', () => {
    expect(denormalizeWorkflowStatusFilter(['running', 'failed'])).toEqual(['running', 'failed']);
  });

  test('round-trips through normalize/denormalize', () => {
    expect(
      denormalizeWorkflowStatusFilter(normalizeWorkflowStatusFilter(undefined)),
    ).toBeUndefined();
    expect(denormalizeWorkflowStatusFilter(normalizeWorkflowStatusFilter('running'))).toBe(
      'running',
    );
    expect(
      denormalizeWorkflowStatusFilter(normalizeWorkflowStatusFilter(['running', 'failed'])),
    ).toEqual(['running', 'failed']);
  });
});

describe('createdDatePresetToTimeRange / timeRangeToCreatedDatePreset', () => {
  const now = Date.parse('2026-07-20T12:00:00.000Z');

  test('"all" has no time range', () => {
    expect(createdDatePresetToTimeRange('all', now)).toBeUndefined();
  });

  test('each preset builds a gte window back from now', () => {
    expect(createdDatePresetToTimeRange('24h', now)).toEqual({ gte: now - 86_400_000 });
    expect(createdDatePresetToTimeRange('7d', now)).toEqual({ gte: now - 7 * 86_400_000 });
    expect(createdDatePresetToTimeRange('30d', now)).toEqual({ gte: now - 30 * 86_400_000 });
  });

  test('round-trips every preset back through the inference', () => {
    for (const preset of ['24h', '7d', '30d'] as const) {
      const range = createdDatePresetToTimeRange(preset, now);
      expect(timeRangeToCreatedDatePreset(range, now)).toBe(preset);
    }
  });

  test('no range infers "all"', () => {
    expect(timeRangeToCreatedDatePreset(undefined, now)).toBe('all');
  });

  test('a range with an upper bound is not a known preset', () => {
    expect(timeRangeToCreatedDatePreset({ gte: now - 86_400_000, lte: now }, now)).toBe('all');
  });

  test('a gte outside every preset window is not a known preset', () => {
    expect(timeRangeToCreatedDatePreset({ gte: now - 999_999_999 }, now)).toBe('all');
  });
});
