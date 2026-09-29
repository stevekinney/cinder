import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';
import { flushSync } from 'svelte';

import type { WorkflowState, WorkflowTimelineEntry } from '@lostgradient/weft';
import { QueryClient } from '@tanstack/svelte-query';

import type { FleetEventFrame } from '../../../lib/live-source/fleet-event-source.svelte.ts';
import TimelineTabHarness from './timeline-tab.test-harness.svelte';
import { WorkflowLiveObservations } from './timeline/workflow-live-observations.svelte.ts';

class InertFleet {
  caughtUp = false;

  subscribe(_onFrame: (frame: FleetEventFrame) => void): () => void {
    return () => {};
  }
}

function workflow(id: string): WorkflowState {
  return {
    id,
    type: 'trip-booking-saga',
    status: 'running',
    input: {},
    versionTuple: { workflowVersion: '1' },
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

function entries(length: number, failedCount = 0): WorkflowTimelineEntry[] {
  return Array.from({ length }, (_, index) => ({
    step: index + 1,
    operationType: 'activity',
    operationLabel: `step-${index + 1}`,
    inputSummary: '{}',
    timestamp: 1_000,
    status: index < failedCount ? 'failed' : 'completed',
  }));
}

function renderTimeline(id: string, timeline: WorkflowTimelineEntry[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const liveObservations = new WorkflowLiveObservations(new InertFleet(), queryClient, id);
  return render(TimelineTabHarness, {
    props: {
      client: {
        getTimeline: async () => timeline,
        operations: {
          'weft.workflows.activities.pending.list': async () => ({ items: [] }),
        },
        activity: {
          complete: async () => {},
          completeExceptionally: async () => {},
        },
      },
      workflow: workflow(id),
      liveObservations,
      finalizerStatus: null,
    },
  });
}

/**
 * Role queries for the pagination controls, scoped to the tab's
 * `Timeline pagination` landmark. Every page past the threshold mounts 200
 * `RunStepTimeline` rows, each carrying two buttons (the row's `Select
 * <label>` control and its collapsible `Input` trigger). An unscoped
 * `getByRole('button', { name })` computes the accessible name of all ~400 of
 * them before discarding the misses, and each name reads computed style from
 * freshly mounted nodes—about 3s per query after every page change on a
 * loaded host, which pushed this file past bun's 5000ms per-test budget.
 * Finding the landmark first touches one element; the scoped query then
 * touches the three pagination buttons and the jump-to-step input.
 */
function paginationControls(
  getByRole: (role: 'navigation', options: { name: string }) => HTMLElement,
) {
  return within(getByRole('navigation', { name: 'Timeline pagination' }));
}

describe('TimelineTab pagination', () => {
  test('renders no pagination landmark at or below the threshold', async () => {
    const { getByText, queryByRole } = renderTimeline('wf-unpaginated', entries(3));

    await waitFor(() => expect(getByText('step-3')).not.toBeNull());
    expect(queryByRole('navigation', { name: 'Timeline pagination' })).toBeNull();
  });

  test('supports Previous, Next, and jump-to-step beyond the threshold', async () => {
    const { getByText, getByRole, queryByText } = renderTimeline('wf-paginated', entries(501));

    await waitFor(() => expect(getByText('step-1')).not.toBeNull());
    expect(getByText('Page 1 of 3')).not.toBeNull();
    expect(
      paginationControls(getByRole)
        .getByRole('button', { name: 'Previous' })
        .hasAttribute('disabled'),
    ).toBe(true);

    await fireEvent.click(paginationControls(getByRole).getByRole('button', { name: 'Next' }));
    flushSync();
    expect(getByText('Page 2 of 3')).not.toBeNull();
    expect(queryByText('step-1')?.outerHTML ?? null).toBeNull();
    expect(getByText('step-201')).not.toBeNull();

    await fireEvent.click(paginationControls(getByRole).getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(getByText('step-1')).not.toBeNull());

    const jumpInput = paginationControls(getByRole).getByRole('textbox', { name: 'Jump to step' });
    await fireEvent.input(jumpInput, { target: { value: '450' } });
    await fireEvent.keyDown(jumpInput, { key: 'Enter' });

    await waitFor(() => {
      expect(getByText('Page 3 of 3')).not.toBeNull();
      expect(getByText('step-450')).not.toBeNull();
    });
  });

  test('a narrowing quick filter resets an out-of-range page', async () => {
    // Reach page 4 of 4 via jump-to-step rather than three sequential
    // `Next` clicks: Previous/Next navigation is already exercised by
    // 'supports Previous, Next, and jump-to-step beyond the threshold'
    // above, and each intermediate click forces a full re-render of a
    // 200-row `RunStepTimeline` page that this test's own assertion (the
    // quick filter's page-reset behavior) does not need. This was the
    // dominant cost behind this test's runtime — see COR-1321.
    const { getByText, getByRole } = renderTimeline('wf-filtered-pagination', entries(601, 501));

    await waitFor(() => expect(getByText('Page 1 of 4')).not.toBeNull());
    const jumpInput = paginationControls(getByRole).getByRole('textbox', { name: 'Jump to step' });
    await fireEvent.input(jumpInput, { target: { value: '601' } });
    await fireEvent.keyDown(jumpInput, { key: 'Enter' });
    await waitFor(() => expect(getByText('Page 4 of 4')).not.toBeNull());

    await fireEvent.click(getByRole('radio', { name: 'Failed' }));

    await waitFor(() => {
      expect(getByText('Page 1 of 3')).not.toBeNull();
      expect(getByText('step-1')).not.toBeNull();
    });
  });

  test('an invalid jump-to-step value is a no-op', async () => {
    const { getByText, getByRole } = renderTimeline('wf-paginated-invalid', entries(501));

    await waitFor(() => expect(getByText('step-1')).not.toBeNull());
    const jumpInput = paginationControls(getByRole).getByRole('textbox', { name: 'Jump to step' });
    await fireEvent.input(jumpInput, { target: { value: 'not-a-number' } });
    await fireEvent.keyDown(jumpInput, { key: 'Enter' });

    expect(getByText('Page 1 of 3')).not.toBeNull();
  });
});
