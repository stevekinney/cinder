/**
 * Typed `ListFilter` ↔ `URLSearchParams` round-trip serializer (plan §4,
 * T1.3). Frozen after the Phase 1 Foundation gate — see PROJECT-BRIEF
 * "Shared contracts". The query-string grammar mirrors weft's REST parser
 * verbatim (`weft/src/server/operations/list-filter-query-extractor.ts`),
 * not the plan prose's shorthand naming — ground truth wins:
 * `status` (repeated) · `type` · `tag` (repeated, AND) ·
 * `attr.<name>[.gt|.lt|.gte|.lte]` (see `attribute-filters.ts`) ·
 * `id_prefix` · `failure_category` (repeated, OR) ·
 * `created_at_{gte,gt,lte,lt}` / `updated_at_*` / `execution_deadline_*` ·
 * `include=failureCategory` (repeated) · `limit` / `offset`.
 */
import type { FailureCategory, ListFilter, WorkflowStatus } from '@lostgradient/weft';

import {
  appendAttributeFilter,
  parseAttributeFilters,
  type AttributeFilter,
} from './attribute-filters.ts';

export type TimeRange = NonNullable<ListFilter['createdAt']>;

/**
 * Console-level filter: weft's `ListFilter` plus the REST `ListOptions`
 * projection flag. `attributes` is narrowed to string-keyed entries — the
 * console has no typed workflow registry to produce `SearchAttributeHandle`
 * values from, so every attribute filter it builds (from the URL or the
 * query-builder UI, plan §10.3) is keyed by the observed attribute name.
 */
export interface WorkflowListQuery extends Omit<ListFilter, 'attributes'> {
  attributes?: readonly AttributeFilter[];
  includeFailureCategory?: boolean;
}

const TIME_RANGE_PREFIXES = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  executionDeadline: 'execution_deadline',
} as const satisfies Record<'createdAt' | 'updatedAt' | 'executionDeadline', string>;

function appendTimeRange(
  params: URLSearchParams,
  prefix: string,
  range: TimeRange | undefined,
): void {
  if (!range) return;
  if (range.gte !== undefined) params.set(`${prefix}_gte`, String(range.gte));
  if (range.gt !== undefined) params.set(`${prefix}_gt`, String(range.gt));
  if (range.lte !== undefined) params.set(`${prefix}_lte`, String(range.lte));
  if (range.lt !== undefined) params.set(`${prefix}_lt`, String(range.lt));
}

function parseTimeRange(params: URLSearchParams, prefix: string): TimeRange | undefined {
  const range: TimeRange = {};
  const gte = params.get(`${prefix}_gte`);
  if (gte !== null && Number.isFinite(Number(gte))) range.gte = Number(gte);
  const gt = params.get(`${prefix}_gt`);
  if (gt !== null && Number.isFinite(Number(gt))) range.gt = Number(gt);
  const lte = params.get(`${prefix}_lte`);
  if (lte !== null && Number.isFinite(Number(lte))) range.lte = Number(lte);
  const lt = params.get(`${prefix}_lt`);
  if (lt !== null && Number.isFinite(Number(lt))) range.lt = Number(lt);
  return Object.keys(range).length > 0 ? range : undefined;
}

function appendMultiValue<T extends string>(
  params: URLSearchParams,
  name: string,
  value: T | readonly T[] | undefined,
): void {
  if (value === undefined) return;
  for (const entry of Array.isArray(value) ? value : [value]) {
    params.append(name, entry);
  }
}

function appendAllTimeRanges(params: URLSearchParams, filter: WorkflowListQuery): void {
  appendTimeRange(params, TIME_RANGE_PREFIXES.createdAt, filter.createdAt);
  appendTimeRange(params, TIME_RANGE_PREFIXES.updatedAt, filter.updatedAt);
  appendTimeRange(params, TIME_RANGE_PREFIXES.executionDeadline, filter.executionDeadline);
}

/** Serializes a console filter into the REST query-string grammar. */
export function serializeWorkflowListFilter(filter: WorkflowListQuery): URLSearchParams {
  const params = new URLSearchParams();

  appendMultiValue(params, 'status', filter.status);
  if (filter.type !== undefined) params.set('type', filter.type);
  if (filter.tags !== undefined) {
    for (const tag of filter.tags) params.append('tag', tag);
  }
  for (const attribute of filter.attributes ?? []) appendAttributeFilter(params, attribute);
  if (filter.idPrefix !== undefined) params.set('id_prefix', filter.idPrefix);
  appendMultiValue(params, 'failure_category', filter.failureCategory);
  appendAllTimeRanges(params, filter);
  if (filter.includeFailureCategory) params.append('include', 'failureCategory');
  if (filter.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter.offset !== undefined) params.set('offset', String(filter.offset));

  return params;
}

function parseSingleOrMultiValue<T extends string>(
  params: URLSearchParams,
  name: string,
): T | T[] | undefined {
  const values: T[] = params.getAll(name).filter((value): value is T => typeof value === 'string');
  const [first] = values;
  if (values.length === 1 && first !== undefined) return first;
  if (values.length > 1) return values;
  return undefined;
}

function parseAllTimeRanges(params: URLSearchParams, filter: WorkflowListQuery): void {
  const createdAt = parseTimeRange(params, TIME_RANGE_PREFIXES.createdAt);
  if (createdAt) filter.createdAt = createdAt;
  const updatedAt = parseTimeRange(params, TIME_RANGE_PREFIXES.updatedAt);
  if (updatedAt) filter.updatedAt = updatedAt;
  const executionDeadline = parseTimeRange(params, TIME_RANGE_PREFIXES.executionDeadline);
  if (executionDeadline) filter.executionDeadline = executionDeadline;
}

function parseIncludeAndPagination(params: URLSearchParams, filter: WorkflowListQuery): void {
  if (params.getAll('include').includes('failureCategory')) filter.includeFailureCategory = true;

  const limit = params.get('limit');
  if (limit !== null && Number.isFinite(Number(limit))) filter.limit = Number(limit);
  const offset = params.get('offset');
  if (offset !== null && Number.isFinite(Number(offset))) filter.offset = Number(offset);
}

/** Parses the REST query-string grammar back into a console filter. */
export function parseWorkflowListFilter(params: URLSearchParams): WorkflowListQuery {
  const filter: WorkflowListQuery = {};

  const status = parseSingleOrMultiValue<WorkflowStatus>(params, 'status');
  if (status !== undefined) filter.status = status;

  const type = params.get('type');
  if (type !== null) filter.type = type;

  const tags = params.getAll('tag');
  if (tags.length > 0) filter.tags = tags;

  const attributeFilters = parseAttributeFilters(params);
  if (attributeFilters.length > 0) filter.attributes = attributeFilters;

  const idPrefix = params.get('id_prefix');
  if (idPrefix !== null) filter.idPrefix = idPrefix;

  const failureCategory = parseSingleOrMultiValue<FailureCategory>(params, 'failure_category');
  if (failureCategory !== undefined) filter.failureCategory = failureCategory;

  parseAllTimeRanges(params, filter);
  parseIncludeAndPagination(params, filter);

  return filter;
}
