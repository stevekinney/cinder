import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';
import { flushSync } from 'svelte';

import type { WorkflowState, WorkflowTimelineEntry } from '@lostgradient/weft';
import { QueryClient } from '@tanstack/svelte-query';

import type { FleetEventFrame } from '../../../lib/live-source/fleet-event-source.svelte.ts';
import TimelineTabHarness from './timeline-tab.test-harness.svelte';
import { WorkflowLiveObservations } from './timeline/workflow-live-observations.svelte.ts';

function workflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'wf-1',
    type: 'trip-booking-saga',
    status: 'running',
    input: {},
    versionTuple: { workflowVersion: '1' },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function entry(overrides: Partial<WorkflowTimelineEntry>): WorkflowTimelineEntry {
  return {
    step: 1,
    operationType: 'activity',
    operationLabel: 'doThing',
    inputSummary: '{}',
    timestamp: 1_000,
    status: 'completed',
    ...overrides,
  };
}

class InertFleet {
  caughtUp = false;
  #handler: ((frame: FleetEventFrame) => void) | null = null;

  subscribe(onFrame: (frame: FleetEventFrame) => void): () => void {
    this.#handler = onFrame;
    return () => {
      this.#handler = null;
    };
  }

  emit(frame: FleetEventFrame): void {
    this.#handler?.(frame);
  }
}

function inertQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function baseClient(
  entries: WorkflowTimelineEntry[],
  pendingItems: ReadonlyArray<{
    token: string;
    operationId: string;
    activityName: string;
    step: number;
    attempt: number;
    createdAt: number;
  }> = [],
) {
  return {
    getTimeline: async () => entries,
    operations: {
      'weft.workflows.activities.pending.list': async () => ({ items: pendingItems }),
    },
    activity: {
      complete: async () => {},
      completeExceptionally: async () => {},
    },
  };
}

describe('additional coverage', () => {
  test('the Failed quick filter narrows the rendered steps', async () => {
    const liveObservations = new WorkflowLiveObservations(
      new InertFleet(),
      inertQueryClient(),
      'wf-1',
    );
    const entries = [
      entry({ step: 1, operationLabel: 'reserveFlight', status: 'completed' }),
      entry({ step: 2, operationLabel: 'chargeTripCard', status: 'failed' }),
    ];

    const { getByText, getByRole, queryByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient(entries),
        workflow: workflow({ id: 'wf-filter-1' }),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => expect(getByText('reserveFlight')).not.toBeNull());
    await fireEvent.click(getByRole('radio', { name: 'Failed' }));

    flushSync();
    expect(queryByText('reserveFlight')?.outerHTML ?? null).toBeNull();
    expect(getByText('chargeTripCard')).not.toBeNull();
  });

  test('shows the Finalizing badge when the durable finalizer field reports still-in-flight (weft#732 item 4)', async () => {
    const fleet = new InertFleet();
    const liveObservations = new WorkflowLiveObservations(fleet, inertQueryClient(), 'wf-1');

    const { getByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient([]),
        workflow: workflow({ status: 'cancelled' }),
        liveObservations,
        finalizerStatus: { status: 'running', attempts: 1, startedAt: 1 },
      },
    });

    await waitFor(() => expect(getByText('Finalizing')).not.toBeNull());
  });

  test('an unambiguous pending async activity badges the matching step', async () => {
    const fleet = new InertFleet();
    const liveObservations = new WorkflowLiveObservations(fleet, inertQueryClient(), 'wf-1');
    const entries = [
      entry({
        step: 1,
        operationType: 'activity',
        operationLabel: 'printShippingLabel',
        status: 'running',
      }),
    ];

    const { getByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient(entries, [
          {
            token: 'tok-1',
            operationId: 'op-1',
            activityName: 'printShippingLabel',
            step: 1,
            attempt: 1,
            createdAt: 1,
          },
        ]),
        workflow: workflow({ id: 'wf-1', status: 'running' }),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => {
      expect(getByText('printShippingLabel')).not.toBeNull();
      expect(getByText('Awaiting external completion')).not.toBeNull();
    });
  });

  test('an ambiguous (unattached) pending async activity shows in the standalone list instead of on a step', async () => {
    const fleet = new InertFleet();
    const liveObservations = new WorkflowLiveObservations(fleet, inertQueryClient(), 'wf-1');
    // No matching timeline entry at all — the observation stays unattached.
    const entries = [entry({ step: 1, operationLabel: 'unrelatedStep', status: 'completed' })];

    const { getByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient(entries, [
          {
            token: 'tok-1',
            operationId: 'op-1',
            activityName: 'printShippingLabel',
            step: 1,
            attempt: 1,
            createdAt: 1,
          },
        ]),
        workflow: workflow({ id: 'wf-1' }),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => {
      expect(getByText(/Couldn't link this to a single timeline step/)).not.toBeNull();
    });
  });

  test('the Coordination and Saga quick filters narrow the rendered steps', async () => {
    const liveObservations = new WorkflowLiveObservations(
      new InertFleet(),
      inertQueryClient(),
      'wf-1',
    );
    // `race` and `parallel` entries render their STRUCTURAL label ("Race" /
    // "All (parallel)"), not their raw `operationLabel` — see
    // `timeline-mapping.ts`'s `STRUCTURAL_OPERATION_LABEL`.
    const entries = [
      entry({ step: 1, operationType: 'race', operationLabel: 'raceProviders' }),
      entry({ step: 2, operationType: 'activity', operationLabel: 'compensate:refund' }),
      entry({ step: 3, operationType: 'activity', operationLabel: 'chargeCard' }),
    ];

    const { getByText, getByRole, queryByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient(entries),
        workflow: workflow({ id: 'wf-filter-coord' }),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => expect(getByText('Race')).not.toBeNull());
    await fireEvent.click(getByRole('radio', { name: 'Coordination' }));
    flushSync();
    expect(getByText('Race')).not.toBeNull();
    expect(queryByText('chargeCard')?.outerHTML ?? null).toBeNull();

    await fireEvent.click(getByRole('radio', { name: 'Saga' }));
    flushSync();
    expect(getByText('compensate:refund')).not.toBeNull();
    expect(queryByText('Race')?.outerHTML ?? null).toBeNull();
  });

  test('a cancelled workflow with a failed finalizer shows the cleanup-failed strip', async () => {
    const liveObservations = new WorkflowLiveObservations(
      new InertFleet(),
      inertQueryClient(),
      'wf-1',
    );

    const { getByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient([]),
        workflow: workflow({ status: 'cancelled' }),
        liveObservations,
        finalizerStatus: { status: 'failed', attempts: 2, failedAt: 1, error: 'boom' },
      },
    });

    await waitFor(() => expect(getByText(/cleanup failed/i)).not.toBeNull());
  });

  test('clicking Complete… on a step with an attached pending activity opens the async-activity drawer, and closing it clears the selection', async () => {
    const fleet = new InertFleet();
    const liveObservations = new WorkflowLiveObservations(fleet, inertQueryClient(), 'wf-1');
    const entries = [
      entry({
        step: 1,
        operationType: 'activity',
        operationLabel: 'printShippingLabel',
        status: 'running',
      }),
    ];

    const { getByText, getAllByRole, getByRole, queryByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient(entries, [
          {
            token: 'tok-drawer-1',
            operationId: 'op-1',
            activityName: 'printShippingLabel',
            step: 1,
            attempt: 1,
            createdAt: 1,
          },
        ]),
        workflow: workflow({ id: 'wf-drawer-1', status: 'running' }),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => expect(getByText('printShippingLabel')).not.toBeNull());
    const [completeButton] = getAllByRole('button', { name: 'Complete…' });
    if (!completeButton) throw new Error('expected a Complete… button');
    await fireEvent.click(completeButton);

    await waitFor(() => {
      expect(getByText('tok-drawer-1')).not.toBeNull();
    });

    await fireEvent.click(getByRole('button', { name: 'Close drawer' }));

    flushSync();
    expect(queryByText('tok-drawer-1')?.outerHTML ?? null).toBeNull();
  });
});
