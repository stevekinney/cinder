import { describe, expect, test } from 'bun:test';

import { render } from '@testing-library/svelte';

import type { ScopeGate } from '../../lib/scopes.svelte.ts';
import FleetView from './fleet-view.svelte';
import type { WorkerDeploymentSummary, WorkerSummary } from './worker-catalog-types.ts';

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

function deployment(overrides: Partial<WorkerDeploymentSummary> = {}): WorkerDeploymentSummary {
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

const OPEN_GATE: ScopeGate = { disabled: false, title: undefined };

describe('FleetView — deployment groups empty state', () => {
  test('a genuinely empty fleet (no workers at all) names connecting a RemoteWorker as the next step', () => {
    const { getByText, queryByText } = render(FleetView, {
      props: {
        workers: [],
        deployments: [],
        adminGate: OPEN_GATE,
        onDrainDeployment: () => {},
        onResumeDeployment: () => {},
      },
    });

    expect(getByText('No workers connected')).not.toBeNull();
    expect(
      getByText(
        'Connect a RemoteWorker to this queue to see it here — see the SDK docs for `RemoteWorker`.',
      ),
    ).not.toBeNull();
    expect(queryByText('No deployment metadata')).toBeNull();
  });

  test('workers connected but none reporting deployment metadata keeps the mechanics explanation', () => {
    const { getByText, queryByText } = render(FleetView, {
      props: {
        workers: [worker()],
        deployments: [],
        adminGate: OPEN_GATE,
        onDrainDeployment: () => {},
        onResumeDeployment: () => {},
      },
    });

    expect(getByText('No deployment metadata')).not.toBeNull();
    expect(
      getByText(
        "Connected workers haven't reported a deploymentName/buildId — they still appear in the Workers tab.",
      ),
    ).not.toBeNull();
    expect(queryByText('No workers connected')).toBeNull();
  });

  test('deployments present render the deployment list, not an empty state', () => {
    const { getByText, queryByText } = render(FleetView, {
      props: {
        workers: [worker()],
        deployments: [deployment()],
        adminGate: OPEN_GATE,
        onDrainDeployment: () => {},
        onResumeDeployment: () => {},
      },
    });

    expect(getByText('api-prod')).not.toBeNull();
    expect(queryByText('No deployment metadata')).toBeNull();
    expect(queryByText('No workers connected')).toBeNull();
  });
});
