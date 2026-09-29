import { describe, expect, test } from 'bun:test';

import { render } from '@testing-library/svelte';

import type { WorkerSummary } from './worker-catalog-types.ts';
import WorkerListView from './worker-list-view.svelte';

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

describe('WorkerListView', () => {
  test('no workers connected renders the empty state, not the table', () => {
    const { getByText, queryByRole } = render(WorkerListView, {
      props: { workers: [] },
    });

    expect(getByText('No workers connected')).not.toBeNull();
    expect(queryByRole('table')).toBeNull();
  });

  test('workers connected render the table with each worker row', () => {
    const { getByText, getByTitle, queryByText } = render(WorkerListView, {
      props: {
        workers: [
          worker({
            id: 'wkr_running',
            queue: 'primary',
            deploymentName: 'api-prod',
            inFlight: 2,
            concurrency: 5,
          }),
          worker({ id: 'wkr_no_deployment', queue: 'secondary', inFlight: 0, concurrency: 3 }),
        ],
      },
    });

    expect(queryByText('No workers connected')).toBeNull();
    expect(getByText('api-prod')).not.toBeNull();
    expect(getByText('—')).not.toBeNull();
    expect(getByText('primary')).not.toBeNull();
    expect(getByText('secondary')).not.toBeNull();
    expect(getByText('2/5')).not.toBeNull();
    expect(getByText('0/3')).not.toBeNull();
    expect(getByTitle('wkr_running')).not.toBeNull();
  });
});
