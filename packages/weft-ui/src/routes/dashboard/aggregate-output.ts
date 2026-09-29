/**
 * `weft.workflows.aggregate`'s wire output shape, named locally rather than
 * relied on structurally from the call site. The generated catalog-
 * operation type resolves `groups[number].key` to `unknown` instead of the
 * real `string | null` (verified empirically: `client.operations['weft.
 * workflows.aggregate'](...)`'s inferred return type has `key: unknown`
 * regardless of an explicit `Awaited<ReturnType<...>>` annotation at the
 * call site) — a generation gap in `@lostgradient/weft`'s typed operation
 * client for this particular union-typed field, not something this module
 * can fix upstream from the console. Mirrors `aggregateWorkflowsOutput`
 * (`weft/src/server/operations/aggregate-workflows.ts`), which isn't a
 * public `@lostgradient/weft` export either. Verified against real output
 * via a `LocalClient` probe against seeded fixtures (this track's final
 * report has the transcript).
 *
 * `parseWorkflowAggregateResult` re-validates the `unknown`-typed field at
 * the query boundary (CLAUDE.md: "validate input at the boundary where it
 * enters a subsystem") rather than scattering `unknown` narrowing across
 * every consumer of the aggregate data.
 */
export interface WorkflowAggregateGroup {
  readonly key: string | null;
  readonly count: number;
}

export interface WorkflowAggregateResult {
  readonly total: number;
  readonly groups: readonly WorkflowAggregateGroup[];
  readonly truncated: boolean;
}

/** The minimal shape this module trusts TypeScript to have gotten right (everything except `key`). */
interface RawAggregateGroup {
  readonly key: unknown;
  readonly count: number;
}

interface RawAggregateResult {
  readonly total: number;
  readonly groups: readonly RawAggregateGroup[];
  readonly truncated: boolean;
}

/**
 * Narrows a raw `weft.workflows.aggregate` response's `groups[].key` from
 * `unknown` to `string | null`. Groups whose `key` is neither never occur
 * in practice (the server always groups by a string key or `null` for "no
 * value") — dropped defensively rather than thrown, so a future wire change
 * degrades to an undercount instead of breaking the dashboard.
 */
export function parseWorkflowAggregateResult(raw: RawAggregateResult): WorkflowAggregateResult {
  const groups: WorkflowAggregateGroup[] = [];
  for (const group of raw.groups) {
    if (typeof group.key === 'string' || group.key === null) {
      groups.push({ key: group.key, count: group.count });
    }
  }
  return { total: raw.total, groups, truncated: raw.truncated };
}
