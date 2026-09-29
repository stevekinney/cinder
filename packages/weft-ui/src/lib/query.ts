/**
 * `QueryClient` factory + query-key helpers (plan §4, T1.5). Frozen after the
 * Phase 1 Foundation gate — see PROJECT-BRIEF "Shared contracts".
 *
 * TanStack Query owns all server state (plan §1.5); this module is the one
 * place that decides its defaults so every domain track builds
 * `createQuery`/`createMutation` calls against the same retry/placeholder/
 * error-reporting behavior instead of re-deciding it per call site.
 *
 * ## Where a fault surfaces (three paths, not one)
 *
 * This client intentionally never sets `throwOnError` on queries — a query
 * failure is meant to degrade the surface to its last-known cached state
 * (plan §5), not unmount it — so `<FaultBoundary>` (`src/app/fault-boundary.svelte`)
 * does NOT see query errors; it only catches exceptions thrown while
 * rendering (a rendering bug, not a wire fault). Route components read
 * `$query.error` directly and pass it through `classifyFault`/`faultTreatment`
 * (`./faults.ts`) to render the same six-treatment `FaultDisplay` banner
 * inline. Mutation failures are the one path this module owns end-to-end:
 * the `mutations.onError` default below reports them as a toast via
 * `showFault`. Three distinct delivery mechanisms for the same
 * classification — not competing ones.
 */
import type { ReviewListFilter, ScheduleFilter } from '@lostgradient/weft';

import { keepPreviousData, QueryClient, type QueryKey } from '@tanstack/svelte-query';

import { showFault } from '../app/toast-host.svelte';
import { classifyFault, faultTreatment } from './faults.ts';
import type { WorkflowListQuery } from './filters.ts';

/** `group_by` grammar for `weft.workflows.aggregate` (plan §4, Appendix A) — not a public `@lostgradient/weft` export, so named here. */
export type WorkflowAggregateGroupBy =
  'status' | 'type' | 'failureCategory' | `attribute:${string}`;

/**
 * Query-key builders for every domain (plan §4, list verbatim). Each key is
 * a `readonly` tuple so it hashes stably for TanStack Query's cache and stays
 * assignable wherever a plain `QueryKey` is expected.
 */
export const queryKeys = {
  workflows: {
    list: (filter: WorkflowListQuery) => ['workflows', 'list', filter] as const,
    detail: (id: string) => ['workflows', 'detail', id] as const,
    events: (id: string, cursor?: string) => ['workflows', 'events', id, cursor] as const,
    aggregate: (groupBy: WorkflowAggregateGroupBy, filter: WorkflowListQuery) =>
      ['workflows', 'aggregate', groupBy, filter] as const,
  },
  schedules: {
    list: (filter: ScheduleFilter) => ['schedules', 'list', filter] as const,
  },
  workers: {
    list: () => ['workers', 'list'] as const,
    manifests: (workerIds: readonly string[]) => ['workers', 'manifests', workerIds] as const,
    manifest: (workerId: string) => ['workers', 'manifest', workerId] as const,
    rejections: () => ['workers', 'rejections'] as const,
  },
  queues: {
    list: () => ['queues', 'list'] as const,
  },
  diagnostics: () => ['diagnostics'] as const,
  tasks: {
    detail: (operationId: string) => ['tasks', 'detail', operationId] as const,
  },
  reviews: {
    list: (filter: ReviewListFilter) => ['reviews', 'list', filter] as const,
  },
  registry: () => ['registry'] as const,
  /** `weft.realms.diagnostics` (COR-243) — host-wide, no query params. */
  realms: () => ['realms'] as const,
  retention: () => ['retention'] as const,
  metrics: () => ['metrics'] as const,
  principal: () => ['principal'] as const,
  /** The five `weft.workflows.revisions.*`/`weft.workflows.active.get` catalog operations (WFT-11/WFT-115) — per-workflow-name keys, additive (WFT-115). */
  catalog: {
    revisions: (name: string) => ['catalog', 'revisions', name] as const,
    active: (name: string) => ['catalog', 'active', name] as const,
    sources: (pagination: { readonly limit: number; readonly offset: number }) =>
      ['catalog', 'sources', pagination] as const,
    /**
     * `weft.catalog.diagnostics` (WFT-116) — per-`(name, revision)`, since
     * that operation answers for one exact key. The `name` segment sits
     * before `revision` so a mutation touching one workflow can invalidate
     * every revision's diagnostics at once with the
     * `['catalog', 'diagnostics', name]` prefix.
     */
    diagnostics: (name: string, revision: string) =>
      ['catalog', 'diagnostics', name, revision] as const,
  },
} as const;

/**
 * Query-key prefixes that identify a paginated/filtered list (plan §4:
 * "keepPreviousData placeholder for lists"). `workers.list`/`queues.list`
 * take no filter argument (Appendix A has no query params for either
 * endpoint) so there is nothing for `keepPreviousData` to smooth over — a
 * refetch of an unparameterized key isn't a "switched page/filter" the user
 * is waiting through. `diagnostics`/`registry`/`retention`/`metrics`/
 * `principal` are single-resource fetches, not lists, for the same reason.
 */
const LIST_QUERY_KEY_PREFIXES: readonly QueryKey[] = [
  ['workflows', 'list'],
  ['schedules', 'list'],
  ['reviews', 'list'],
  ['catalog', 'sources'],
];

const MAX_QUERY_RETRIES = 3;

/**
 * Retry predicate shared by every query (plan §4: "retry policy that never
 * retries 4xx faults"). `classifyFault` returning `null` means the error
 * never crossed the Weft fault wire — a network blip, a dropped connection —
 * which is transient and worth retrying. Of the six wire treatments, only
 * `internal` is: the other five describe the CURRENT state of the resource
 * or request (missing, conflicting, invalid, unauthorized, unsupported) and
 * retrying with the same input reproduces the identical fault. `Timeout`
 * (`FaultCode`) is bucketed under `internal` in `faults.ts` specifically so
 * it retries here — see that module's comment.
 */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;

  const treatment = classifyFault(error);
  return treatment === null || treatment.kind === 'internal';
}

/**
 * Builds the app's single `QueryClient` (plan §4). Defaults:
 *   - queries never retry a classified 4xx-shaped fault (`shouldRetryQuery`).
 *   - list queries (`LIST_QUERY_KEY_PREFIXES`) keep the previous page's data
 *     visible while refetching, instead of flashing to a loading state.
 *   - any mutation error is reported as a toast via the fault mapping
 *     (`showFault`) — call sites needing a different/additional treatment
 *     pass their own `onError` to `createMutation`, which runs alongside
 *     this default (TanStack Query calls both).
 *   - `notifyOnChangeProps: 'all'` disables TanStack Query's default
 *     "tracked properties" optimization, which only notifies subscribers
 *     when a result property that was actually READ on the previous render
 *     changes. Several route components derive booleans like `isLoading`
 *     from short-circuited expressions (`scopeGranted && query.isPending`)
 *     — once the left side goes false, the right side stops being read, so
 *     the tracked-properties set silently drops `isPending` and a later
 *     settle never notifies the component (confirmed empirically: the
 *     dashboard's critical-alerts band hangs on its loading skeleton
 *     forever after a query resolves, and stops hanging the moment
 *     anything else in the component unconditionally reads the same
 *     property). `'all'` trades a small amount of over-notification for
 *     correctness independent of which properties a given render happens
 *     to touch.
 */
export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        notifyOnChangeProps: 'all',
      },
      mutations: {
        onError: (error) => {
          showFault(faultTreatment(error));
        },
      },
    },
  });

  for (const prefix of LIST_QUERY_KEY_PREFIXES) {
    client.setQueryDefaults(prefix, { placeholderData: keepPreviousData });
  }

  return client;
}
