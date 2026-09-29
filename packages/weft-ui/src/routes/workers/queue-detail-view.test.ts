import { describe, expect, test } from 'bun:test';

import { fireEvent, render } from '@testing-library/svelte';

import type { ScopeGate } from '../../lib/scopes.svelte.ts';
import QueueDetailView from './queue-detail-view.svelte';
import type {
  StandardTaskDiagnosticItem,
  TaskQueueHealth,
  WorkerSummary,
} from './worker-catalog-types.ts';

function queue(overrides: Partial<TaskQueueHealth> = {}): TaskQueueHealth {
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

function worker(overrides: Partial<WorkerSummary> = {}): WorkerSummary {
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

function deadLetterItem(
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

const OPEN_GATE: ScopeGate = { disabled: false, title: undefined };
const DISABLED_GATE: ScopeGate = { disabled: true, title: 'Requires system:admin' };

describe('QueueDetailView — strategy panel', () => {
  test('renders the routing and scheduling policy', () => {
    const { getByText } = render(QueueDetailView, {
      props: {
        queue: queue({ schedulingPolicy: 'fifo' }),
        routingPolicy: 'round-robin',
        workersOnQueue: [],
        deadLetteredItems: [],
        adminGate: OPEN_GATE,
        onClearDeadLetter: () => {},
      },
    });

    expect(getByText('round-robin')).not.toBeNull();
    expect(getByText('fifo')).not.toBeNull();
  });
});

describe('QueueDetailView — dead letter panel', () => {
  test('no dead-lettered items shows the empty message, no diagnostics badge in the header', () => {
    const { getByText, queryByText } = render(QueueDetailView, {
      props: {
        queue: queue(),
        routingPolicy: 'least-loaded',
        workersOnQueue: [],
        deadLetteredItems: [],
        adminGate: OPEN_GATE,
        onClearDeadLetter: () => {},
      },
    });

    expect(getByText('No dead-lettered tasks on this queue.')).not.toBeNull();
    expect(queryByText('0 diagnostics')).toBeNull();
  });

  test('dead-lettered items render a row per item with the header count badge', async () => {
    const { getByText, getAllByRole, getAllByText } = render(QueueDetailView, {
      props: {
        queue: queue(),
        routingPolicy: 'least-loaded',
        workersOnQueue: [],
        deadLetteredItems: [
          deadLetterItem({ operationId: 'op_a', activityName: 'ChargeCard' }),
          deadLetterItem({ operationId: 'op_b', activityName: 'SendEmail' }),
        ],
        adminGate: OPEN_GATE,
        onClearDeadLetter: () => {},
      },
    });

    expect(getByText('2 diagnostics')).not.toBeNull();
    expect(getByText('2 tasks')).not.toBeNull();
    expect(getByText('ChargeCard')).not.toBeNull();
    expect(getByText('SendEmail')).not.toBeNull();
    expect(getAllByText('Clear').length).toBe(2);
    await fireEvent.click(getAllByRole('button', { name: 'Inspect ledger' })[0]!);
  });

  test('distinguishes delayed and failed-adoption recovery diagnostics', () => {
    const { getByText } = render(QueueDetailView, {
      props: {
        queue: queue(),
        routingPolicy: 'least-loaded',
        workersOnQueue: [],
        deadLetteredItems: [],
        diagnosticItems: [
          {
            kind: 'delayed',
            state: 'queued',
            operationId: 'op_delayed',
            queue: 'default',
            availableAt: 1_700_000_100_000,
            retryCount: 0,
            requeueCount: 0,
            evidence: ['available in 100 seconds'],
          },
          {
            kind: 'unadopted-terminal',
            state: 'resolved',
            operationId: 'op_unadopted',
            workflowId: 'wf_unadopted',
            queue: 'default',
            terminalAt: 1_700_000_000_000,
            adopted: false,
            evidence: ['terminal result is awaiting workflow adoption'],
          },
        ],
        adminGate: OPEN_GATE,
        onClearDeadLetter: () => {},
      },
    });

    expect(getByText('Delayed')).not.toBeNull();
    expect(getByText('Unadopted terminal')).not.toBeNull();
    expect(getByText('2 diagnostics')).not.toBeNull();
  });

  test('clicking Clear invokes onClearDeadLetter with the item operationId when the admin gate is open', async () => {
    let cleared: string | undefined;
    const { getByText } = render(QueueDetailView, {
      props: {
        queue: queue(),
        routingPolicy: 'least-loaded',
        workersOnQueue: [],
        deadLetteredItems: [deadLetterItem({ operationId: 'op_target' })],
        adminGate: OPEN_GATE,
        onClearDeadLetter: (operationId) => {
          cleared = operationId;
        },
      },
    });

    await fireEvent.click(getByText('Clear'));
    expect(cleared).toBe('op_target');
  });

  test('the Clear button is disabled with a tooltip title when the admin gate is closed', () => {
    const { getByText } = render(QueueDetailView, {
      props: {
        queue: queue(),
        routingPolicy: 'least-loaded',
        workersOnQueue: [],
        deadLetteredItems: [deadLetterItem()],
        adminGate: DISABLED_GATE,
        onClearDeadLetter: () => {
          throw new Error('must not be called while the gate is disabled');
        },
      },
    });

    const button = getByText('Clear').closest('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
  });
});

describe('QueueDetailView — workers on this queue', () => {
  test('no connected workers shows the explanatory message', () => {
    const { getByText } = render(QueueDetailView, {
      props: {
        queue: queue(),
        routingPolicy: 'least-loaded',
        workersOnQueue: [],
        deadLetteredItems: [],
        adminGate: OPEN_GATE,
        onClearDeadLetter: () => {},
      },
    });

    expect(getByText('No connected workers are polling this queue.')).not.toBeNull();
  });

  test('connected workers render a row each with health badge and in-flight ratio', () => {
    const { getByText, queryByText } = render(QueueDetailView, {
      props: {
        queue: queue(),
        routingPolicy: 'least-loaded',
        workersOnQueue: [
          worker({ id: 'wkr_active', health: 'active', inFlight: 2, concurrency: 4 }),
          worker({ id: 'wkr_draining', health: 'draining', inFlight: 1, concurrency: 4 }),
        ],
        deadLetteredItems: [],
        adminGate: OPEN_GATE,
        onClearDeadLetter: () => {},
      },
    });

    expect(getByText('2/4')).not.toBeNull();
    expect(getByText('1/4')).not.toBeNull();
    expect(getByText('Draining')).not.toBeNull();
    expect(queryByText('No connected workers are polling this queue.')).toBeNull();
  });
});
