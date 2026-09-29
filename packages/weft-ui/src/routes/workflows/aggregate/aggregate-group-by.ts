/**
 * Aggregate view group-by dimension handling (plan §9.2 T5.5, Appendix A
 * `weft.workflows.aggregate`). Pure module: URL/wire encoding, human labels,
 * and drill-through filter construction, all unit-testable without a
 * component tree. `aggregate-view.svelte` is the thin UI wrapper.
 */
import type { FailureCategory, WorkflowStatus } from '@lostgradient/weft';

import type { WorkflowAggregateGroupBy } from '../../../lib/query.ts';

/** `weft.workflows.aggregate`'s wire `groupBy` shape (Appendix A) — the fixed literals pass through; an attribute dimension is `{ attribute: name }`, not a template string. */
export type AggregateGroupByWire = 'status' | 'type' | 'failureCategory' | { attribute: string };

const FIXED_GROUP_BY_DIMENSIONS: readonly WorkflowAggregateGroupBy[] = [
  'status',
  'type',
  'failureCategory',
];

const ATTRIBUTE_PREFIX = 'attribute:';
const WORKFLOW_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timed-out',
  'suspended',
] as const;
const FAILURE_CATEGORIES = [
  'application',
  'timeout',
  'cancellation',
  'resource',
  'system',
] as const;
const WORKFLOW_STATUS_SET: ReadonlySet<string> = new Set(WORKFLOW_STATUSES);
const FAILURE_CATEGORY_SET: ReadonlySet<string> = new Set(FAILURE_CATEGORIES);

function attributeGroupBy(attribute: string): `attribute:${string}` {
  return `attribute:${attribute}`;
}

function isWorkflowStatus(value: string): value is WorkflowStatus {
  return WORKFLOW_STATUS_SET.has(value);
}

function isFailureCategory(value: string): value is FailureCategory {
  return FAILURE_CATEGORY_SET.has(value);
}

/** Parses a `group_by` URL/query-param value into the console's `WorkflowAggregateGroupBy`. Returns `null` for anything unrecognized (caller falls back to the default dimension). */
export function parseAggregateGroupBy(raw: string | null): WorkflowAggregateGroupBy | null {
  if (raw === null) return null;
  if (raw.startsWith(ATTRIBUTE_PREFIX)) {
    const attribute = raw.slice(ATTRIBUTE_PREFIX.length);
    // `startsWith` doesn't narrow a template-literal type for TypeScript;
    // the emptiness check just above is what actually proves `raw` matches
    // `attribute:${string}` (a non-empty suffix), so this cast is safe.
    return attribute.length > 0 ? attributeGroupBy(attribute) : null;
  }
  const fixed = FIXED_GROUP_BY_DIMENSIONS.find((candidate) => candidate === raw);
  return fixed ?? null;
}

/** The attribute name for an `attribute:<name>` dimension, or `null` for a fixed dimension. */
export function attributeGroupByName(groupBy: WorkflowAggregateGroupBy): string | null {
  return groupBy.startsWith(ATTRIBUTE_PREFIX) ? groupBy.slice(ATTRIBUTE_PREFIX.length) : null;
}

/** Converts the console's `WorkflowAggregateGroupBy` into the `weft.workflows.aggregate` operation's wire `groupBy` input. */
export function aggregateGroupByToWire(groupBy: WorkflowAggregateGroupBy): AggregateGroupByWire {
  const attribute = attributeGroupByName(groupBy);
  if (attribute !== null) return { attribute };
  if (groupBy === 'status' || groupBy === 'type' || groupBy === 'failureCategory') return groupBy;
  return 'type';
}

/** Human label for the group-by selector (Cinder `SegmentedControl` options). */
export function aggregateGroupByLabel(groupBy: WorkflowAggregateGroupBy): string {
  const attribute = attributeGroupByName(groupBy);
  if (attribute !== null) return attribute;
  if (groupBy === 'failureCategory') return 'Failure category';
  return groupBy === 'status' ? 'Status' : 'Type';
}

/** A group key's display label. `null` (weft's "workflows missing this dimension" bucket) reads as "(none)". */
export function aggregateGroupKeyLabel(key: string | null): string {
  return key ?? '(none)';
}

/**
 * The pre-filtered `ListFilter` fragment a group's row should link to
 * (plan §9.2: "each row links to a pre-filtered workflow list"). Returns
 * `null` for the `key === null` bucket ("workflows missing this attribute")
 * — `ListFilter` has no "attribute is absent" predicate to express that
 * drill-through, so those rows render as a label without a link rather than
 * linking to a filter that would silently mean something else.
 */
export function aggregateDrillThroughFilter(
  groupBy: WorkflowAggregateGroupBy,
  key: string | null,
):
  | { status: WorkflowStatus }
  | { type: string }
  | { failureCategory: FailureCategory }
  | { attributes: [{ key: string; value: string }] }
  | null {
  if (key === null) return null;

  const attribute = attributeGroupByName(groupBy);
  if (attribute !== null) return { attributes: [{ key: attribute, value: key }] };
  // `status`/`failureCategory` group keys are server-computed from the
  // matching workflows' own `WorkflowStatus`/`FailureCategory` fields
  // (`weft.workflows.aggregate`, Appendix A) — a non-null key for these two
  // dimensions is always one of those literal unions, never an arbitrary
  // string, so narrowing it back is safe.
  if (groupBy === 'status' && isWorkflowStatus(key)) {
    return { status: key };
  }
  if (groupBy === 'failureCategory' && isFailureCategory(key)) {
    return { failureCategory: key };
  }
  return { type: key };
}
