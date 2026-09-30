/**
 * List-scale active-versus-bound revision comparison (COR-15, follow-up to
 * WFT-117). `workflow-detail.svelte` already compares ONE record's persisted
 * `revision` against its type's active pointer with a single
 * `createQuery`; the workflow list, the children tab, and the lineage
 * panel's children preview show many rows at once, so this module fetches
 * the active pointer once per DISTINCT workflow type on the page (N rows
 * across M types issue exactly M `weft.workflows.active.get` calls), never
 * once per row.
 *
 * Every per-type query reuses `queryKeys.catalog.active(type)` verbatim —
 * the key `workflow-detail.svelte`, `workflow-revisions-panel.svelte`, and
 * `dynamic-source-panel.svelte` already share. TanStack Query therefore
 * deduplicates concurrent fetches across those consumers, and the
 * `invalidateQueries({ queryKey: queryKeys.catalog.active(name) })` the two
 * System panels already perform on activation refreshes these badges too;
 * no separate cache lifetime or invalidation mechanism exists here.
 *
 * Must be called during component initialisation (it creates queries).
 */
import { createQueries } from '@tanstack/svelte-query';

import { queryKeys } from './query.ts';
import {
  classifyRevisionAgainstActive,
  fetchActiveWorkflowRevision,
  type RevisionActiveComparison,
  type WorkflowActiveRevisionClient,
  type WorkflowCatalogActivePointerLike,
} from './workflow-revision.ts';

export interface ActiveRevisionComparisonsOptions {
  readonly client: WorkflowActiveRevisionClient;
  /** The rows currently shown. Only rows carrying a persisted `revision` need a comparison (an unpinned row classifies as `unpinned` without one), so only their types are fetched; duplicates are fine. */
  readonly rows: () => readonly {
    readonly type: string;
    readonly revision?: string | undefined;
  }[];
  /** Gate for the underlying operation's `workflows:read` scope. Defaults to enabled. */
  readonly enabled?: () => boolean;
}

export interface ActiveRevisionComparisons {
  /** How `revision` compares to `type`'s active pointer. `'unknown'` while loading, denied, never activated, or on any error. */
  compare(type: string, revision: string | undefined): RevisionActiveComparison;
}

/** The distinct, non-empty entries of `types`, in first-seen order. Exported for the dedup test. */
export function distinctWorkflowTypes(types: readonly string[]): readonly string[] {
  return [...new Set(types.filter((type) => type.length > 0))];
}

export function createActiveRevisionComparisons(
  options: ActiveRevisionComparisonsOptions,
): ActiveRevisionComparisons {
  const distinctTypes = $derived(
    distinctWorkflowTypes(
      options
        .rows()
        .filter((row) => row.revision !== undefined)
        .map((row) => row.type),
    ),
  );

  const results = createQueries(() => ({
    queries: distinctTypes.map((type) => ({
      queryKey: queryKeys.catalog.active(type),
      queryFn: () => fetchActiveWorkflowRevision(options.client, type),
      enabled: options.enabled?.() ?? true,
    })),
  }));

  /**
   * TanStack Query keeps the previous successful `data` across a failed
   * refetch, so `data` alone could present a last-known pointer as current
   * fact after, say, `workflows:read` was revoked mid-session. An errored
   * query therefore collapses to `undefined` ("unresolved"), exactly as
   * `workflow-detail.svelte`'s `resolvedActiveRevision` does.
   */
  const pointers = $derived.by(() => {
    const byType = new Map<string, WorkflowCatalogActivePointerLike | null | undefined>();
    distinctTypes.forEach((type, index) => {
      const result = results[index];
      byType.set(type, result === undefined || result.isError ? undefined : result.data);
    });
    return byType;
  });

  return {
    compare: (type, revision) => classifyRevisionAgainstActive(revision, pointers.get(type)),
  };
}
