/**
 * `LiveSource` suite barrel (plan §5, T1.4). Frozen after the Phase 1
 * Foundation gate — see PROJECT-BRIEF "Shared contracts". Re-exports the
 * `LiveSource<Frame>` interface and its three implementations so consumers
 * keep importing from `./live-source` (or `$lib/live-source`) regardless of
 * which file inside this directory actually defines each piece.
 *
 * `cache-integration.ts` is intentionally NOT re-exported here — it pulls in
 * `@tanstack/svelte-query`, and a module that only needs `LiveSource`/
 * `WorkflowTailSource`/etc. (e.g. a pure-logic unit test) shouldn't have to
 * resolve that dependency. Import it directly:
 * `import { applyWorkflowTailFrame } from '$lib/live-source/cache-integration.ts'`.
 */
export type { LiveSource, LiveSourceStatus } from './types.ts';

export {
  FleetEventSource,
  type FleetEventFilter,
  type FleetEventFrame,
  type FleetEventSourceConfig,
} from './fleet-event-source.svelte.ts';

export {
  WorkflowTailSource,
  type WorkflowEventTailOpener,
  type WorkflowTailSourceOptions,
} from './workflow-tail-source.svelte.ts';

export { PollingSource, type PollingSourceOptions } from './polling-source.svelte.ts';

export { computeReconnectDelayMs } from './backoff.ts';

export {
  isTerminalWorkflowEventType,
  workflowStatusForEventType,
} from './workflow-lifecycle-events.ts';
