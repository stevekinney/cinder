/**
 * Workflow list filter bar — pure helpers (plan §9.2 T2.1). Status
 * multi-toggle set handling and the "created" date-preset ↔ `TimeRange`
 * mapping, split out of `workflow-list-filters.svelte` so the value
 * conversions are unit-testable without mounting `FacetedFilterBar`.
 */
import type { WorkflowStatus } from '@lostgradient/weft';

import type { TimeRange } from '../../../lib/filters.ts';

/** Toggles one status in/out of the current multi-select set, returning a new array (never mutates). */
export function toggleWorkflowStatus(
  current: readonly WorkflowStatus[],
  status: WorkflowStatus,
): WorkflowStatus[] {
  return current.includes(status)
    ? current.filter((existing) => existing !== status)
    : [...current, status];
}

/** Normalizes `ListFilter.status` (a single value, an array, or absent) into a plain array for the toggle-chip row. */
export function normalizeWorkflowStatusFilter(
  status: WorkflowStatus | readonly WorkflowStatus[] | undefined,
): WorkflowStatus[] {
  if (status === undefined) return [];
  // `Array.isArray`'s type predicate is `arg is any[]`, which doesn't
  // reliably narrow a `readonly T[]` out of a union in the `else` branch —
  // `typeof status === 'string'` narrows cleanly instead, since every
  // `WorkflowStatus` is a string literal.
  return typeof status === 'string' ? [status] : [...status];
}

/** Denormalizes a status array back to `ListFilter.status`'s shape: `undefined` when empty, a bare value when exactly one, else an array. Keeps the URL/filter object minimal instead of always writing a 1-element array. */
export function denormalizeWorkflowStatusFilter(
  statuses: readonly WorkflowStatus[],
): WorkflowStatus | WorkflowStatus[] | undefined {
  if (statuses.length === 0) return undefined;
  return statuses.length === 1 ? statuses[0] : [...statuses];
}

export type CreatedDatePreset = 'all' | '24h' | '7d' | '30d';

const PRESET_WINDOW_MS: Readonly<Record<Exclude<CreatedDatePreset, 'all'>, number>> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};
const DATE_PRESETS = ['24h', '7d', '30d'] as const;

export const CREATED_DATE_PRESET_LABEL: Readonly<Record<CreatedDatePreset, string>> = {
  all: 'All time',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

/** Builds the `createdAt` `TimeRange` for a preset, or `undefined` for `'all'` (no filter). `now` is injected for deterministic tests. */
export function createdDatePresetToTimeRange(
  preset: CreatedDatePreset,
  now: number = Date.now(),
): TimeRange | undefined {
  if (preset === 'all') return undefined;
  return { gte: now - PRESET_WINDOW_MS[preset] };
}

/**
 * Infers which preset (if any) a `createdAt` range matches, for restoring
 * the selector's display state from a shared/reloaded URL. Matches within
 * a small tolerance (`toleranceMs`) since the range was computed from
 * `Date.now()` at write time and is read back later; an exact `lt`/`lte`
 * present, or a `gte` outside every preset's window, reads as `'all'`
 * (no exact preset applies) rather than guessing.
 */
export function timeRangeToCreatedDatePreset(
  range: TimeRange | undefined,
  now: number = Date.now(),
  toleranceMs = 60_000,
): CreatedDatePreset {
  if (!range || range.gte === undefined) return 'all';
  if (range.lt !== undefined || range.lte !== undefined || range.gt !== undefined) return 'all';

  for (const preset of DATE_PRESETS) {
    const expected = now - PRESET_WINDOW_MS[preset];
    if (Math.abs(range.gte - expected) <= toleranceMs) return preset;
  }
  return 'all';
}
