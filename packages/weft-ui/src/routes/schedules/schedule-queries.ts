/**
 * Data-fetching + mutation helpers for the Schedules domain (Track B, plan
 * §4, §9.3). Plain, framework-free functions over `HttpClient` — the
 * `.svelte` files wire these into `createQuery`/`createMutation`
 * (`@tanstack/svelte-query`); this module stays unit-testable without a DOM.
 *
 * List queries reuse the frozen `queryKeys.schedules.list` from
 * `src/lib/query.ts` (T1.5's shared key, already registered with
 * `keepPreviousData` there). `scheduleDetailQueryKey` is this track's own
 * addition — `src/lib/query.ts` didn't define one — kept in the same tuple
 * shape (`['schedules', 'detail', id]`) the frozen module's own
 * `workflows.detail`/`schedules.list` keys use, per PROJECT-BRIEF: "if
 * something genuinely blocks you … make the smallest local workaround"
 * rather than editing the frozen file for one missing key.
 */
import type {
  Duration,
  HttpClient,
  PaginatedResult,
  ScheduleFilter,
  ScheduleOptions,
  ScheduleOverlapPolicy,
  ScheduleRevisionPolicy,
  ScheduleSpec,
  ScheduleSummary,
  ScheduleUpdateOptions,
  WorkflowSummary,
} from '@lostgradient/weft';

import type { QueryKey } from '@tanstack/svelte-query';

export function scheduleDetailQueryKey(id: string): QueryKey {
  return ['schedules', 'detail', id] as const;
}

export function scheduleRunHistoryQueryKey(id: string): QueryKey {
  return ['schedules', 'run-history', id] as const;
}

const SCHEDULE_RUN_HISTORY_LIMIT = 10;

/**
 * `GET /api/v1/workflows?scheduleId=…` (`weft.workflows.list`'s `scheduleId`
 * filter) — the schedule's most recently launched runs, newest first (the
 * operation's documented "engine default ordering" is `createdAt`
 * descending; verified against `weft/src/core/engine/listing.ts`). Added by
 * weft#759 ("Expose schedule run history", weft 0.13+) closing weft#735,
 * which this console filed after finding no way to query which workflow
 * runs a schedule had launched — see `schedule-detail.svelte`'s "Recent
 * runs" panel, the sole consumer.
 */
export function fetchScheduleRunHistory(
  client: Pick<HttpClient, 'list'>,
  scheduleId: string,
): Promise<PaginatedResult<WorkflowSummary>> {
  return client.list({ scheduleId, limit: SCHEDULE_RUN_HISTORY_LIMIT });
}

/** `GET /api/v1/schedules` — page of schedule summaries. */
export function fetchScheduleList(
  client: Pick<HttpClient, 'listSchedules'>,
  filter: ScheduleFilter,
): Promise<PaginatedResult<ScheduleSummary>> {
  return client.listSchedules(filter);
}

/** `GET /api/v1/schedules/:id` — `null` when no schedule with that id exists. */
export function fetchScheduleDetail(
  client: Pick<HttpClient, 'getSchedule'>,
  id: string,
): Promise<ScheduleSummary | null> {
  return client.getSchedule(id);
}

/**
 * The one call the registry-driven workflow picker needs (plan §9.3:
 * "workflow picker from registry"), narrowed to its exact shape rather than
 * `Pick<HttpClient, 'operations'>` — the full `operations` catalog type
 * requires every one of its ~50 typed methods to be present even on a
 * structural stub, which defeats testing this in isolation. A real
 * `HttpClient` satisfies this narrower interface structurally.
 *
 * `activeRevisions` is typed `unknown` (matching the generated catalog's
 * own output type for this operation — its free-form registry snapshot
 * isn't deeply typed there either), so `fetchRegisteredWorkflowTypes`
 * narrows it with a runtime guard before reading keys off it. Reading
 * `activeRevisions` (a `name -> revision` map, v2 — WFT-6) rather than
 * `workflows` (now a `WorkflowRevisionManifest[]`) is deliberate: it is
 * exactly the currently-active workflow-name set the picker wants, with no
 * need to filter the manifest array by revision itself.
 */
export interface RegistryProbeClient {
  readonly operations: {
    'weft.system.registry': (
      input: Record<string, never>,
    ) => Promise<{ readonly activeRevisions: unknown }>;
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sorted workflow type names from `GET /api/v1/registry` (`system:read`) for the create/edit form's workflow picker. */
export async function fetchRegisteredWorkflowTypes(
  client: RegistryProbeClient,
): Promise<readonly string[]> {
  const snapshot = await client.operations['weft.system.registry']({});
  const activeRevisions = isPlainObject(snapshot.activeRevisions) ? snapshot.activeRevisions : {};
  return Object.keys(activeRevisions).toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export interface CreateScheduleArgs {
  readonly workflowType: string;
  readonly input: unknown;
  readonly spec: ScheduleSpec;
  readonly id?: string;
  readonly description?: string;
  readonly overlap?: ScheduleOverlapPolicy;
  readonly backfill?: boolean;
  readonly jitter?: Duration;
  readonly revisionPolicy?: ScheduleRevisionPolicy;
}

/** The one `HttpClient.schedule()` shape `createSchedule` needs — narrowed past the real (overloaded, generic-name-inferring) signature so a plain test fake can satisfy it. A real `HttpClient` satisfies this structurally: its richer `ClientScheduleHandle` return value is assignable to `{ id: string }`. */
export interface ScheduleCreateClient {
  schedule(
    workflowType: string,
    input: unknown,
    spec: ScheduleSpec,
    options?: ScheduleOptions,
  ): Promise<{ readonly id: string }>;
}

/** `POST /api/v1/schedules` (`weft.schedules.create`) — returns the created schedule's id. */
export async function createSchedule(
  client: ScheduleCreateClient,
  args: CreateScheduleArgs,
): Promise<{ id: string }> {
  const handle = await client.schedule(args.workflowType, args.input, args.spec, {
    ...(args.id !== undefined ? { id: args.id } : {}),
    ...(args.description !== undefined ? { description: args.description } : {}),
    ...(args.overlap !== undefined ? { overlap: args.overlap } : {}),
    ...(args.backfill !== undefined ? { backfill: args.backfill } : {}),
    ...(args.jitter !== undefined ? { jitter: args.jitter } : {}),
    ...(args.revisionPolicy !== undefined ? { revisionPolicy: args.revisionPolicy } : {}),
  });
  return { id: handle.id };
}

/**
 * `PATCH /api/v1/schedules/:id` (`weft.schedules.update`).
 *
 * `options` is `ScheduleUpdateOptions` (`description | overlap | backfill |
 * jitter | revisionPolicy`), forwarded as-is. Callers pass
 * `ScheduleFormState.toUpdateOptions()`, which already applies the
 * omit-when-unchanged rule to every key: `undefined` (or an absent key)
 * preserves the schedule's current value, and that matters most for
 * `revisionPolicy: 'pinned'`, which is never a no-op server-side — it always
 * re-captures the pin against whatever is active at that moment.
 */
export function updateScheduleSpec(
  client: Pick<HttpClient, 'updateSchedule'>,
  id: string,
  spec: ScheduleSpec,
  options?: ScheduleUpdateOptions,
): Promise<void> {
  return client.updateSchedule(id, spec, options);
}

export function pauseSchedule(
  client: Pick<HttpClient, 'pauseSchedule'>,
  id: string,
): Promise<void> {
  return client.pauseSchedule(id);
}

export function resumeSchedule(
  client: Pick<HttpClient, 'resumeSchedule'>,
  id: string,
): Promise<void> {
  return client.resumeSchedule(id);
}

export function cancelSchedule(
  client: Pick<HttpClient, 'cancelSchedule'>,
  id: string,
): Promise<void> {
  return client.cancelSchedule(id);
}
