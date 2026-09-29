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

describe('TimelineTab', () => {
  test('shows an empty state with no timeline entries', async () => {
    const liveObservations = new WorkflowLiveObservations(
      new InertFleet(),
      inertQueryClient(),
      'wf-1',
    );

    const { getByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient([]),
        workflow: workflow(),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => expect(getByText('No timeline entries yet')).not.toBeNull());
  });

  test('renders steps in order with their labels', async () => {
    const liveObservations = new WorkflowLiveObservations(
      new InertFleet(),
      inertQueryClient(),
      'wf-1',
    );
    const entries = [
      entry({ step: 1, operationLabel: 'reserveFlight' }),
      entry({ step: 2, operationLabel: 'reserveHotel', status: 'running' }),
    ];

    const { getByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient(entries),
        workflow: workflow(),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => {
      expect(getByText('reserveFlight')).not.toBeNull();
      expect(getByText('reserveHotel')).not.toBeNull();
    });
  });

  test('clicking a step selects it and shows the linked-selection chip, Clear removes it', async () => {
    const liveObservations = new WorkflowLiveObservations(
      new InertFleet(),
      inertQueryClient(),
      'wf-1',
    );
    const entries = [entry({ step: 1, operationLabel: 'reserveFlight' })];

    const { getByText, queryByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient(entries),
        workflow: workflow({ id: 'wf-select-1' }),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => expect(getByText('reserveFlight')).not.toBeNull());
    await fireEvent.click(getByText('reserveFlight'));

    await waitFor(() => {
      expect(getByText('Selected — Events filtered to this step')).not.toBeNull();
    });

    await fireEvent.click(getByText('Clear'));

    flushSync();
    expect(queryByText('Selected — Events filtered to this step')?.outerHTML ?? null).toBeNull();
  });

  /**
   * WFC-7: selection's keyboard/ARIA control is Cinder's own now —
   * `RunStepTimeline`'s `selection-control` button, rendered because
   * `timeline-tab.svelte` passes `onStepSelect`. It's a native `<button>`
   * (reachable by Tab, activated by Enter/Space via the platform — no manual
   * keydown wiring needed), labeled `Select <step label>` and exposing
   * `aria-pressed`. This also guards against double-handling: Cinder's row
   * click and its selection-control button share one delegated handler
   * (verified against `run-step-timeline`'s source), so a single click
   * toggles exactly once — there is no app-owned row delegate left to fire
   * a second time.
   */
  test('the Cinder selection-control button toggles aria-pressed and the linked-selection chip on a single click', async () => {
    const liveObservations = new WorkflowLiveObservations(
      new InertFleet(),
      inertQueryClient(),
      'wf-1',
    );
    const entries = [entry({ step: 1, operationLabel: 'reserveFlight' })];

    const { getByRole, getByText, queryByText } = render(TimelineTabHarness, {
      props: {
        client: baseClient(entries),
        workflow: workflow({ id: 'wf-select-2' }),
        liveObservations,
        finalizerStatus: null,
      },
    });

    await waitFor(() => expect(getByText('reserveFlight')).not.toBeNull());
    const selectButton = getByRole('button', { name: 'Select reserveFlight' });
    expect(selectButton.getAttribute('aria-pressed')).toBe('false');

    await fireEvent.click(selectButton);

    await waitFor(() => {
      expect(getByText('Selected — Events filtered to this step')).not.toBeNull();
    });
    expect(getByRole('button', { name: 'Select reserveFlight' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    await fireEvent.click(getByRole('button', { name: 'Select reserveFlight' }));

    flushSync();
    expect(queryByText('Selected — Events filtered to this step')?.outerHTML ?? null).toBeNull();
    expect(getByRole('button', { name: 'Select reserveFlight' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});
