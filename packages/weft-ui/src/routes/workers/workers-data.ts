/**
 * Query/mutation wiring for the Workers/Queues/Diagnostics surface (Track C,
 * plan §4, §9.4). Plain, framework-free functions over the narrow slice of
 * `HttpClient` each one needs — `.svelte` files wire these into
 * `createQuery`/`createMutation` (`@tanstack/svelte-query`), following the
 * same split `reviews-data.ts`/`schedule-queries.ts` established: logic here
 * stays unit-testable without a DOM, `.svelte` files stay thin.
 *
 * None of the three list queries take reactive params (`weft.workers.list`
 * and `weft.task.queues.list` accept `{}`; `weft.tasks.diagnostics` always
 * runs with the same server-mirrored defaults — `worker-catalog-types.ts`'s
 * `DEFAULT_TASK_DIAGNOSTICS_INPUT`), so their option getters use stable
 * keys. Task detail reads its selected operation inside a reactive getter.
 *
 * All three poll every 30s (plan §5.3: "the default for low-churn surfaces
 * … workers ~30s") as the baseline freshness guarantee; `index.svelte`
 * layers an opt-in subscription to the shell's ONE shared `FleetEventSource`
 * (`getFleetEventSource()`, `src/app/engine-status.svelte.ts`) on top for
 * instant invalidation on `worker:connected`/`worker:disconnected`. The
 * toggle only gates that subscription — it never opens a second connection —
 * per plan §5's ≤3-connection budget: "one fleet SSE … never per-row/
 * per-surface connections".
 */
import type { HttpClient } from '@lostgradient/weft';

import {
  createMutation,
  createQuery,
  type CreateMutationResult,
  type CreateQueryResult,
  type QueryClient,
} from '@tanstack/svelte-query';

import { queryKeys } from '../../lib/query.ts';
import {
  DEFAULT_TASK_DIAGNOSTICS_INPUT,
  type TaskDiagnosticsOutput,
  type TaskLedgerDetail,
  type WorkersListOutput,
} from './worker-catalog-types.ts';
import {
  parseWorkerDiagnosticsResponse,
  parseWorkerRegistrationRejections,
  type WorkerManifestDiagnostics,
  type WorkerRegistrationRejection,
} from './worker-manifest-diagnostics.ts';

const REFETCH_INTERVAL_MS = 30_000;

type WorkersOperations = Pick<HttpClient, 'operations'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const TASK_LEDGER_STATES = new Set([
  'queued',
  'leased',
  'completing',
  'cancelling',
  'terminal',
  'deadLettered',
]);

const REQUIRED_TASK_LEDGER_STRING_FIELDS = [
  'operationId',
  'workflowType',
  'activityName',
  'queue',
] as const;

function hasRequiredTaskLedgerStrings(value: Record<string, unknown>): boolean {
  return REQUIRED_TASK_LEDGER_STRING_FIELDS.every((field) => typeof value[field] === 'string');
}

function hasRequiredTaskLedgerNumbers(value: Record<string, unknown>): boolean {
  return ['visibilityTimeoutMilliseconds', 'createdAt', 'attempt'].every(
    (field) => typeof value[field] === 'number',
  );
}

function hasValidTaskLedgerHeaderKeys(value: Record<string, unknown>): boolean {
  return (
    Array.isArray(value['headerKeys']) &&
    value['headerKeys'].every((key) => typeof key === 'string')
  );
}

/** Validates the generated operation's currently-unknown output at the Console trust boundary. */
export function parseTaskLedgerDetail(value: unknown): TaskLedgerDetail {
  if (!isTaskLedgerDetail(value)) {
    throw new Error('Weft returned a malformed task ledger response.');
  }
  return value;
}

function isTaskLedgerDetail(value: unknown): value is TaskLedgerDetail {
  if (
    !isRecord(value) ||
    typeof value['state'] !== 'string' ||
    !TASK_LEDGER_STATES.has(value['state']) ||
    !hasRequiredTaskLedgerStrings(value) ||
    !hasRequiredTaskLedgerNumbers(value) ||
    !hasValidTaskLedgerHeaderKeys(value)
  ) {
    return false;
  }
  return true;
}

/** Reads exactly one authoritative durable ledger record. */
export function taskLedgerDetailQuery(client: WorkersOperations, operationId: () => string) {
  return createQuery(() => ({
    queryKey: queryKeys.tasks.detail(operationId()),
    queryFn: async () => {
      const selectedOperationId = operationId();
      return parseTaskLedgerDetail(
        await client.operations['weft.tasks.get']({ operationId: selectedOperationId }),
      );
    },
    enabled: operationId().length > 0,
    refetchInterval: REFETCH_INTERVAL_MS,
  }));
}

/** `GET /v1/workers` (`system:read`) — fleet + deployment rollup + routing policy. */
export function workersListQuery(client: WorkersOperations): CreateQueryResult<WorkersListOutput> {
  return createQuery(() => ({
    queryKey: queryKeys.workers.list(),
    queryFn: () => client.operations['weft.workers.list']({}),
    refetchInterval: REFETCH_INTERVAL_MS,
  }));
}

/** `GET /v1/task-queues` (`system:read`). */
export function taskQueuesListQuery(client: WorkersOperations) {
  return createQuery(() => ({
    queryKey: queryKeys.queues.list(),
    queryFn: () => client.operations['weft.task.queues.list']({}),
    refetchInterval: REFETCH_INTERVAL_MS,
  }));
}

/** `GET /v1/tasks/diagnostics` (`system:read`), server-mirrored default thresholds. */
export function taskDiagnosticsQuery(
  client: WorkersOperations,
): CreateQueryResult<TaskDiagnosticsOutput> {
  return createQuery(() => ({
    queryKey: queryKeys.diagnostics(),
    queryFn: () => client.operations['weft.tasks.diagnostics'](DEFAULT_TASK_DIAGNOSTICS_INPUT),
    refetchInterval: REFETCH_INTERVAL_MS,
  }));
}

/** Runtime-validated canonical manifest detail for one connected worker. */
export async function loadWorkerManifestDiagnostics(
  client: WorkersOperations,
  workerId: string,
): Promise<WorkerManifestDiagnostics | null> {
  const response = await client.operations['weft.workers.diagnostics']({ workerId });
  return parseWorkerDiagnosticsResponse(response);
}

/** Canonical manifest detail for the current connected fleet, ordered by worker id. */
export async function loadFleetManifestDiagnostics(
  client: WorkersOperations,
  workerIds: readonly string[],
): Promise<readonly WorkerManifestDiagnostics[]> {
  const diagnostics = await Promise.all(
    workerIds.toSorted().map((workerId) => loadWorkerManifestDiagnostics(client, workerId)),
  );
  return diagnostics.filter((entry): entry is WorkerManifestDiagnostics => entry !== null);
}

/** Bounded, server-owned evidence for recently rejected registration attempts. */
export async function loadWorkerRegistrationRejections(
  client: WorkersOperations,
  limit = 25,
): Promise<readonly WorkerRegistrationRejection[]> {
  const response = await client.operations['weft.workers.rejections']({ limit });
  return parseWorkerRegistrationRejections(response);
}

/** Invalidate every worker surface affected by fleet events or administrative mutations. */
export function invalidateWorkerSurfaceQueries(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.workers.list() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.queues.list() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics() });
  void queryClient.invalidateQueries({ queryKey: ['workers', 'manifests'] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.workers.rejections() });
}

export interface DrainWorkerVariables {
  readonly workerId: string;
  readonly reason?: string;
}

/** `POST /v1/workers/:id/drain` (`system:admin`). */
export function drainWorkerMutation(
  client: WorkersOperations,
  onSettled: () => void,
): CreateMutationResult<unknown, Error, DrainWorkerVariables> {
  return createMutation(() => ({
    mutationFn: (variables: DrainWorkerVariables) =>
      client.operations['weft.workers.drain'](variables),
    onSettled,
  }));
}

/** `DELETE /v1/workers/:id/drain` (`system:admin`). */
export function resumeWorkerMutation(
  client: WorkersOperations,
  onSettled: () => void,
): CreateMutationResult<unknown, Error, { workerId: string }> {
  return createMutation(() => ({
    mutationFn: (variables: { workerId: string }) =>
      client.operations['weft.workers.resume'](variables),
    onSettled,
  }));
}

export interface DrainDeploymentVariables {
  readonly deploymentName: string;
  readonly reason?: string;
}

/** `POST /v1/worker-deployments/:name/drain` (`system:admin`). */
export function drainDeploymentMutation(
  client: WorkersOperations,
  onSettled: () => void,
): CreateMutationResult<unknown, Error, DrainDeploymentVariables> {
  return createMutation(() => ({
    mutationFn: (variables: DrainDeploymentVariables) =>
      client.operations['weft.worker.deployments.drain'](variables),
    onSettled,
  }));
}

/** `DELETE /v1/worker-deployments/:name/drain` (`system:admin`). */
export function resumeDeploymentMutation(
  client: WorkersOperations,
  onSettled: () => void,
): CreateMutationResult<unknown, Error, { deploymentName: string }> {
  return createMutation(() => ({
    mutationFn: (variables: { deploymentName: string }) =>
      client.operations['weft.worker.deployments.resume'](variables),
    onSettled,
  }));
}

/** Generated `DELETE /v1/tasks/diagnostics/dead-letter/:operationId` (`system:admin`). */
export function clearDeadLetterMutation(
  client: WorkersOperations,
  onSettled: () => void,
): CreateMutationResult<unknown, Error, { operationId: string }> {
  return createMutation(() => ({
    mutationFn: ({ operationId }: { operationId: string }) =>
      client.operations['weft.tasks.diagnostics.deadletters.clear']({ operationId }),
    onSettled,
  }));
}
