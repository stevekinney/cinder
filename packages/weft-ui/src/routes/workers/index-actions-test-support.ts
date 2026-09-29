import type {
  StandardTaskDiagnosticItem,
  TaskDiagnosticItem,
  TaskDiagnosticsSummary,
  TaskQueueHealth,
  WorkerDeploymentSummary,
  WorkerSummary,
} from './worker-catalog-types.ts';
import { ScriptedFetch } from './workers-route-test-support.test-support.ts';

export function worker(overrides: Partial<WorkerSummary> = {}): WorkerSummary {
  return {
    id: 'wkr_1',
    transport: 'websocket',
    queue: 'default',
    activities: ['Workflow.activity'],
    concurrency: 4,
    inFlight: 1,
    availableCapacity: 3,
    connectedAt: 0,
    lastHeartbeatAt: 0,
    startedAt: 0,
    heartbeatAgeMs: 1_000,
    capabilities: {},
    health: 'active',
    ...overrides,
  };
}

export function deployment(
  overrides: Partial<WorkerDeploymentSummary> = {},
): WorkerDeploymentSummary {
  return {
    activeWorkers: 1,
    buildId: '#4821',
    deploymentName: 'api-prod',
    drainedWorkers: 0,
    drainingWorkers: 0,
    health: 'active',
    inFlight: 1,
    oldestStartedAt: null,
    runtimeVersion: 'node 20',
    transports: ['websocket'],
    workers: 1,
    ...overrides,
  };
}

export function queue(overrides: Partial<TaskQueueHealth> = {}): TaskQueueHealth {
  return {
    queue: 'default',
    backlog: 0,
    oldestEnqueuedAt: null,
    oldestQueuedAgeMs: null,
    waitingPollers: 0,
    schedulingPolicy: 'priority',
    inFlight: 0,
    connectedWorkers: 1,
    ...overrides,
  };
}

export function diagnosticItem(
  overrides: Partial<StandardTaskDiagnosticItem> = {},
): StandardTaskDiagnosticItem {
  return {
    kind: 'dead-lettered',
    state: 'dead-lettered',
    retryCount: 5,
    requeueCount: 5,
    evidence: ['exhausted retries'],
    operationId: 'op_dead_1',
    activityName: 'ChargeCard',
    queue: 'default',
    deadLetteredAt: 1_700_000_000_000,
    ...overrides,
  };
}

export const EMPTY_DIAGNOSTICS_SUMMARY: TaskDiagnosticsSummary = {
  stuckQueued: 0,
  staleInflight: 0,
  retryStorms: 0,
  allWorkersAtCapacity: 0,
  deadLettered: 0,
  delayed: 0,
  unadoptedTerminal: 0,
};

/** Scripts every standing successful route the route root needs, with overridable fixtures. */
export function routeHappyPaths(
  scripted: ScriptedFetch,
  overrides: {
    workers?: readonly WorkerSummary[];
    deployments?: readonly WorkerDeploymentSummary[];
    queues?: readonly TaskQueueHealth[];
    diagnosticsItems?: readonly TaskDiagnosticItem[];
    diagnosticsSummary?: TaskDiagnosticsSummary;
  } = {},
): void {
  scripted.routeJsonRpcMethod('weft.workers.list', {
    items: overrides.workers ?? [worker()],
    deployments: overrides.deployments ?? [deployment()],
    routingPolicy: 'least-loaded',
  });
  scripted.routeJsonRpcMethod('weft.task.queues.list', {
    items: overrides.queues ?? [queue()],
  });
  scripted.routeJsonRpcMethod('weft.tasks.diagnostics', {
    items: overrides.diagnosticsItems ?? [],
    summary: overrides.diagnosticsSummary ?? EMPTY_DIAGNOSTICS_SUMMARY,
  });
  scripted.routeJsonRpcMethod('weft.workers.diagnostics', { worker: null });
  scripted.routeJsonRpcMethod('weft.workers.rejections', { items: [], limit: 25 });
}
