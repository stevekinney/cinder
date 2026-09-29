/**
 * Converts the list track's URL-backed `WorkflowListQuery` into the wire
 * shape every bulk workflow operation's `filter` field expects
 * (`weft/src/server/operations/bulk-filter-helpers.ts`
 * `bulkListFilterInputSchema`, plan §9.2 T8.1).
 *
 * `limit`/`offset` are deliberately dropped: those are this LIST's page
 * bounds, not a bound on what the bulk operation should affect. A bulk
 * action's whole point is to act on every workflow matching the filter, not
 * just the current page (design `Weft Patterns.dc.html`'s Tier-3 mock:
 * "Operates on all 47 workflows matching the filter — not just the visible
 * page"). `includeFailureCategory` is a REST projection flag with no bulk
 * equivalent and is dropped for the same reason.
 */
import type { FailureCategory, WorkflowStatus } from '@lostgradient/weft';

import type { AttributeScalar } from '../../../lib/attribute-filters.ts';
import type { TimeRange, WorkflowListQuery } from '../../../lib/filters.ts';

/**
 * Wire-format scalar for one attribute filter bound. Mirrors
 * `attribute-filters.ts`'s `scalarToQueryValue`: a `Date` has no wire
 * representation of its own, so it serializes to epoch milliseconds — the
 * same numeric form the engine's indexed range comparisons expect. In
 * practice `WorkflowListQuery.attributes` read from the URL never contains a
 * `Date` (`parseAttributeFilters` only ever produces string/number/boolean),
 * so this is defensive normalization, not a path this module's own callers
 * exercise today.
 */
function toWireScalar(value: AttributeScalar): string | number | boolean {
  return value instanceof Date ? value.getTime() : value;
}

function isScalarArray(
  value: AttributeScalar | readonly AttributeScalar[],
): value is readonly AttributeScalar[] {
  return Array.isArray(value);
}

function toWireScalarArray(
  value: AttributeScalar | readonly AttributeScalar[],
): (string | number | boolean) | (string | number | boolean)[] {
  return isScalarArray(value) ? value.map(toWireScalar) : toWireScalar(value);
}

export interface BulkFilterAttributeInput {
  readonly key: string;
  readonly value?: string | number | boolean | (string | number | boolean)[];
  readonly gt?: string | number | boolean;
  readonly lt?: string | number | boolean;
  readonly gte?: string | number | boolean;
  readonly lte?: string | number | boolean;
}

/**
 * The `filter` shape every `weft.workflows.bulk.*` / `weft.workflows.purge`
 * operation input accepts. Field VALUE types are deliberately plain (never
 * `| undefined`) so this satisfies the generated client's
 * `exactOptionalPropertyTypes`-checked input types — an omitted key, not an
 * explicit `undefined` value, is how "not set" is expressed on the wire.
 */
export interface BulkListFilterInput {
  readonly status?: WorkflowStatus | WorkflowStatus[];
  readonly type?: string;
  readonly tags?: readonly string[];
  readonly attributes?: readonly BulkFilterAttributeInput[];
  readonly idPrefix?: string;
  readonly failureCategory?: FailureCategory | FailureCategory[];
  readonly createdAt?: BulkTimeRange;
  readonly updatedAt?: BulkTimeRange;
  readonly executionDeadline?: BulkTimeRange;
}

interface BulkTimeRange {
  readonly gte?: number;
  readonly gt?: number;
  readonly lte?: number;
  readonly lt?: number;
}

function toBulkTimeRange(range: TimeRange): BulkTimeRange {
  return {
    ...(range.gte !== undefined ? { gte: range.gte } : {}),
    ...(range.gt !== undefined ? { gt: range.gt } : {}),
    ...(range.lte !== undefined ? { lte: range.lte } : {}),
    ...(range.lt !== undefined ? { lt: range.lt } : {}),
  };
}

function toWireAttribute(attribute: {
  key: string;
  value?: AttributeScalar | readonly AttributeScalar[];
  gt?: AttributeScalar;
  lt?: AttributeScalar;
  gte?: AttributeScalar;
  lte?: AttributeScalar;
}): BulkFilterAttributeInput {
  return {
    key: attribute.key,
    ...(attribute.value !== undefined ? { value: toWireScalarArray(attribute.value) } : {}),
    ...(attribute.gt !== undefined ? { gt: toWireScalar(attribute.gt) } : {}),
    ...(attribute.lt !== undefined ? { lt: toWireScalar(attribute.lt) } : {}),
    ...(attribute.gte !== undefined ? { gte: toWireScalar(attribute.gte) } : {}),
    ...(attribute.lte !== undefined ? { lte: toWireScalar(attribute.lte) } : {}),
  };
}

/** Converts the current list filter into the bulk-operation `filter` field, dropping page bounds (module doc). */
export function toBulkListFilterInput(filter: WorkflowListQuery): BulkListFilterInput {
  return {
    ...(filter.status !== undefined ? { status: filter.status } : {}),
    ...(filter.type !== undefined ? { type: filter.type } : {}),
    ...(filter.tags !== undefined ? { tags: filter.tags } : {}),
    ...(filter.attributes !== undefined
      ? { attributes: filter.attributes.map(toWireAttribute) }
      : {}),
    ...(filter.idPrefix !== undefined ? { idPrefix: filter.idPrefix } : {}),
    ...(filter.failureCategory !== undefined ? { failureCategory: filter.failureCategory } : {}),
    ...(filter.createdAt !== undefined ? { createdAt: toBulkTimeRange(filter.createdAt) } : {}),
    ...(filter.updatedAt !== undefined ? { updatedAt: toBulkTimeRange(filter.updatedAt) } : {}),
    ...(filter.executionDeadline !== undefined
      ? { executionDeadline: toBulkTimeRange(filter.executionDeadline) }
      : {}),
  };
}
