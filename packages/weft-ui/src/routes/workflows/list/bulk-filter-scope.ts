/**
 * Client-side mirror of weft's `assertScopedBulkWorkflowFilter`
 * (`weft/src/core/bulk-workflow-filter.ts`, plan §9.2 T8.1). The server
 * rejects `weft.workflows.bulk.{cancel,signal,retryfailed,delete,tags}`
 * dry-runs with `InvalidParams` when the filter carries none of
 * status/type/tags/attributes/a ≥3-character `idPrefix` — a filter with only
 * a date range, for example, is rejected because it can't bound the affected
 * set to anything short of "everything in that range." This module answers
 * the same question client-side so the bulk-selection bar can disable its
 * actions with a reason BEFORE firing a dry-run that would just 400, rather
 * than showing the user a raw fault after the fact.
 *
 * Deliberately excludes `failureCategory` and the three time-range fields,
 * matching the server exactly (weft's own comment: "setting failureCategory
 * on a non-failed workflow is permitted by the engine, so 'delete every
 * workflow whose failureCategory is X' would be a footgun" — time ranges
 * have the same problem and must be paired with one of the real scoping
 * dimensions).
 *
 * `purge-workflows.ts` skips this assertion server-side (an empty filter
 * purges every terminal workflow engine-wide) — the bulk-selection bar
 * still applies this same gate to the Purge action as a deliberate
 * client-side safety rail, not because the wire contract requires it. See
 * `bulk-purge-dialog.svelte`'s module doc.
 */
import type { AttributeFilter } from '../../../lib/attribute-filters.ts';
import type { WorkflowListQuery } from '../../../lib/filters.ts';

const ID_PREFIX_MIN_LENGTH = 3;

function hasScopedStatus(filter: WorkflowListQuery): boolean {
  if (filter.status === undefined) return false;
  return Array.isArray(filter.status) ? filter.status.length > 0 : filter.status.length > 0;
}

function hasScopedType(filter: WorkflowListQuery): boolean {
  return filter.type !== undefined && filter.type.trim().length > 0;
}

function hasScopedTags(filter: WorkflowListQuery): boolean {
  return (filter.tags?.length ?? 0) > 0;
}

function hasScopedAttribute(attribute: AttributeFilter): boolean {
  return attribute.key.trim().length > 0;
}

function hasScopedAttributes(filter: WorkflowListQuery): boolean {
  return (filter.attributes ?? []).some(hasScopedAttribute);
}

function hasScopedIdPrefix(filter: WorkflowListQuery): boolean {
  return (filter.idPrefix?.length ?? 0) >= ID_PREFIX_MIN_LENGTH;
}

/**
 * `true` when `filter` carries at least one of the dimensions weft's own
 * `assertScopedBulkWorkflowFilter` requires — the same test the server runs
 * on every scoped bulk dry-run before it will report a `matched` count.
 */
export function isBulkOperationScoped(filter: WorkflowListQuery): boolean {
  return (
    hasScopedStatus(filter) ||
    hasScopedType(filter) ||
    hasScopedTags(filter) ||
    hasScopedAttributes(filter) ||
    hasScopedIdPrefix(filter)
  );
}

/** Disable-with-reason copy for an unscoped filter (plan §10 disable-with-reason convention). */
export const BULK_FILTER_UNSCOPED_REASON =
  'Add a status, type, tag, attribute, or ID prefix (3+ characters) filter to enable bulk actions';
