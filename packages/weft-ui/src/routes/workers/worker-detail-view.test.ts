import { describe, expect, test } from 'bun:test';

import { fireEvent, render } from '@testing-library/svelte';

import type { ScopeGate } from '../../lib/scopes.svelte.ts';
import type { WorkerSummary } from './worker-catalog-types.ts';
import WorkerDetailView from './worker-detail-view.svelte';

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

const OPEN_GATE: ScopeGate = { disabled: false, title: undefined };
const DISABLED_GATE: ScopeGate = { disabled: true, title: 'Requires system:admin' };

describe('WorkerDetailView — health badge and drain banner', () => {
  test('an active worker shows Healthy or Stale (heartbeat-derived), no drain banner', () => {
    const { getByText, queryByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'active', heartbeatAgeMs: 1_000 }),
        adminGate: OPEN_GATE,
        onDrain: () => {},
        onResume: () => {},
      },
    });

    expect(getByText('Healthy')).not.toBeNull();
    expect(queryByText(/Draining —/)).toBeNull();
  });

  test('a draining worker shows the Draining badge and the warning callout with in-flight count', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'draining', inFlight: 3 }),
        adminGate: OPEN_GATE,
        onDrain: () => {},
        onResume: () => {},
      },
    });

    expect(getByText('Draining')).not.toBeNull();
    expect(
      getByText(/Draining — finishing 3 in-flight tasks, accepting no new work\./),
    ).not.toBeNull();
  });

  test('a draining worker with exactly one in-flight task uses the singular "task" noun', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'draining', inFlight: 1 }),
        adminGate: OPEN_GATE,
        onDrain: () => {},
        onResume: () => {},
      },
    });

    expect(
      getByText(/Draining — finishing 1 in-flight task, accepting no new work\./),
    ).not.toBeNull();
  });

  test('a drained worker shows the Drained badge', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'drained' }),
        adminGate: OPEN_GATE,
        onDrain: () => {},
        onResume: () => {},
      },
    });

    expect(getByText('Drained')).not.toBeNull();
  });

  test('an active worker with a stale heartbeat is promoted to the Stale badge', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'active', heartbeatAgeMs: 200_000 }),
        adminGate: OPEN_GATE,
        onDrain: () => {},
        onResume: () => {},
      },
    });

    expect(getByText('Stale')).not.toBeNull();
  });
});

describe('WorkerDetailView — drain/resume action', () => {
  test('an active worker shows a Drain button that calls onDrain when the gate is open', async () => {
    let drained = false;
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'active' }),
        adminGate: OPEN_GATE,
        onDrain: () => {
          drained = true;
        },
        onResume: () => {
          throw new Error('must not be called');
        },
      },
    });

    await fireEvent.click(getByText('Drain'));
    expect(drained).toBe(true);
  });

  test('a draining worker shows a Resume button that calls onResume when the gate is open', async () => {
    let resumed = false;
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'draining' }),
        adminGate: OPEN_GATE,
        onDrain: () => {
          throw new Error('must not be called');
        },
        onResume: () => {
          resumed = true;
        },
      },
    });

    await fireEvent.click(getByText('Resume'));
    expect(resumed).toBe(true);
  });

  test('when the admin gate is disabled, the button is disabled and labeled per health (Drain for active)', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'active' }),
        adminGate: DISABLED_GATE,
        onDrain: () => {
          throw new Error('must not be called while disabled');
        },
        onResume: () => {},
      },
    });

    const button = getByText('Drain').closest('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
  });

  test('when the admin gate is disabled for a draining worker, the button is disabled and labeled Resume', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ health: 'draining' }),
        adminGate: DISABLED_GATE,
        onDrain: () => {},
        onResume: () => {
          throw new Error('must not be called while disabled');
        },
      },
    });

    const button = getByText('Resume').closest('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
  });
});

describe('WorkerDetailView — connection and activities panels', () => {
  test('renders queue, build identity, and concurrency in the connection panel', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({
          queue: 'payments',
          buildId: '#123',
          inFlight: 2,
          concurrency: 8,
        }),
        adminGate: OPEN_GATE,
        onDrain: () => {},
        onResume: () => {},
      },
    });

    expect(getByText('payments')).not.toBeNull();
    expect(getByText('#123')).not.toBeNull();
    expect(getByText('2 / 8')).not.toBeNull();
  });

  test('missing build identity falls back to the em dash placeholder', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        // `worker()`'s defaults already omit optional `buildId`, so this
        // exercises the `?? '—'` fallback directly.
        worker: worker(),
        adminGate: OPEN_GATE,
        onDrain: () => {},
        onResume: () => {},
      },
    });

    expect(getByText('—')).not.toBeNull();
  });

  test('renders one badge per reported activity', () => {
    const { getByText } = render(WorkerDetailView, {
      props: {
        worker: worker({ activities: ['Workflow.chargeCard', 'Workflow.sendEmail'] }),
        adminGate: OPEN_GATE,
        onDrain: () => {},
        onResume: () => {},
      },
    });

    expect(getByText('Workflow.chargeCard')).not.toBeNull();
    expect(getByText('Workflow.sendEmail')).not.toBeNull();
  });
});
