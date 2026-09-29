/**
 * Checkpoints tab data access (plan T3.3): `GET …/checkpoints` (list),
 * `GET …/checkpoints/:step` (one checkpoint's raw state), `GET
 * …/replay/:step` (`client.replayTo`, read-only reconstruction), and
 * `POST …/fork` (`client.fork`).
 *
 * `weft.workflows.checkpoints.list`/`.get` have no ergonomic `WeftClient`
 * method (verified against `weft/src/client/interface.ts` — only
 * `replayTo`/`fork` are ergonomic) — called via `client.operations[...]`
 * per plan §4 ("ergonomic methods first, `client.operations['weft.<name>']`
 * for the rest"). Both are `access: { kind: 'public' }`
 * (`weft/src/server/operations/{list-checkpoints,get-checkpoint-at}.ts`) —
 * no scope gate needed. `client.replayTo` (`weft.workflows.replay`)
 * requires `workflows:read`; `client.fork` (`weft.workflows.fork`) is
 * public — both verified against their operation definitions.
 *
 * Query keys are local to this module (matching `workflow-timeline-data.ts`'s
 * precedent) rather than added to the frozen `src/lib/query.ts` — that file
 * is Foundation-owned and closed after the Phase 1 gate.
 *
 * ## Why the results are runtime-validated, not just typed
 *
 * Both operations declare `outputSchema: z.unknown()` server-side (weft
 * intentionally loosens the wire contract for these — see the operation
 * definitions), and the GENERATED client catalog
 * (`weft/src/cli/generated/operation-client.generated.ts`, the actual
 * source of `HttpClient.operations[name]`'s return type) reads that zod
 * schema, not the operation's TS `Output` generic — so
 * `client.operations['weft.workflows.checkpoints.list']` is really typed to
 * return `Promise<unknown>`, not `Promise<CheckpointSummary[]>`. The real
 * shape (verified against `weft/src/core/engine/checkpoint-reads.ts` and a
 * live dev-harness curl) genuinely IS `CheckpointSummary[]`/`CheckpointState`
 * — this module validates that structurally at the boundary rather than
 * asserting it blindly, per this repo's `as`-cast policy.
 */
import type {
  CheckpointState,
  CheckpointSummary,
  ForkOptions,
  HttpClient,
  WorkflowReplay,
} from '@lostgradient/weft';
import type { QueryKey } from '@tanstack/svelte-query';

/**
 * Narrowed alternative to `Pick<HttpClient, 'fork'>` — this track only ever
 * reads `.id` off the returned handle (`fork-dialog.svelte`). `HttpClient`'s
 * real `fork()` resolves a full `ClientHandle` (`TypedEventTarget` +
 * `Disposable` + many methods), which is a heavier interface to construct
 * test doubles for than the data this UI actually consumes; a function
 * returning `Promise<ClientHandle>` is still structurally assignable here
 * (return types are covariant), so the real client works unchanged.
 */
export interface ForkClient {
  fork(workflowId: string, options?: ForkOptions): Promise<{ readonly id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCheckpointSummary(value: unknown): value is CheckpointSummary {
  return (
    isRecord(value) &&
    typeof value['step'] === 'number' &&
    typeof value['timestamp'] === 'number' &&
    typeof value['sizeBytes'] === 'number'
  );
}

function parseCheckpointSummaries(value: unknown): CheckpointSummary[] {
  if (!Array.isArray(value) || !value.every(isCheckpointSummary)) {
    throw new TypeError('weft.workflows.checkpoints.list returned an unexpected shape');
  }
  return value;
}

function isCheckpointState(value: unknown): value is CheckpointState {
  return (
    isRecord(value) &&
    typeof value['step'] === 'number' &&
    isRecord(value['locals']) &&
    isRecord(value['searchAttributes']) &&
    typeof value['version'] === 'string' &&
    typeof value['createdAt'] === 'number'
  );
}

function parseCheckpointState(value: unknown): CheckpointState {
  if (!isCheckpointState(value)) {
    throw new TypeError('weft.workflows.checkpoints.get returned an unexpected shape');
  }
  return value;
}

export function checkpointsListQueryKey(workflowId: string): QueryKey {
  return ['workflows', 'checkpoints', workflowId];
}

export function checkpointAtQueryKey(workflowId: string, step: number): QueryKey {
  return ['workflows', 'checkpoints', workflowId, step];
}

export function replayQueryKey(workflowId: string, step: number): QueryKey {
  return ['workflows', 'replay', workflowId, step];
}

/** Narrow surface this module needs off `client.operations` — the two checkpoint operations have no ergonomic method. Matches the REAL generated client type (`output: unknown`) — see module doc. */
export interface CheckpointsOperationsClient {
  readonly operations: {
    readonly 'weft.workflows.checkpoints.list': (input: { workflowId: string }) => Promise<unknown>;
    readonly 'weft.workflows.checkpoints.get': (input: {
      workflowId: string;
      step: number;
    }) => Promise<unknown>;
  };
}

export async function listCheckpoints(
  client: CheckpointsOperationsClient,
  workflowId: string,
): Promise<CheckpointSummary[]> {
  return parseCheckpointSummaries(
    await client.operations['weft.workflows.checkpoints.list']({ workflowId }),
  );
}

export async function getCheckpointAt(
  client: CheckpointsOperationsClient,
  workflowId: string,
  step: number,
): Promise<CheckpointState> {
  return parseCheckpointState(
    await client.operations['weft.workflows.checkpoints.get']({ workflowId, step }),
  );
}

export function replayWorkflow(
  client: Pick<HttpClient, 'replayTo'>,
  workflowId: string,
  step: number,
): Promise<WorkflowReplay | null> {
  return client.replayTo(workflowId, step);
}
