import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type {
  PaginatedResult,
  WorkflowScheduleProvenance,
  WorkflowState,
  WorkflowSummary,
} from '@lostgradient/weft';

import LineagePanelHarness from './lineage-panel.test-harness.svelte';

function workflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'wf_current',
    type: 'order-fulfillment',
    status: 'running',
    input: {},
    versionTuple: { workflowVersion: '1' },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function emptyChildren(): PaginatedResult<WorkflowSummary> {
  return { items: [], total: 0, offset: 0, limit: 5 };
}

function noProvenance(): Promise<WorkflowScheduleProvenance | null> {
  return Promise.resolve(null);
}

function baseClient(
  overrides: {
    get?: (id: string) => Promise<WorkflowState | null>;
    list?: () => Promise<PaginatedResult<WorkflowSummary>>;
    scheduleProvenance?: () => Promise<WorkflowScheduleProvenance | null>;
  } = {},
) {
  return {
    get: overrides.get ?? (async () => null),
    list: overrides.list ?? (async () => emptyChildren()),
    operations: {
      'weft.workflows.scheduleprovenance.get': overrides.scheduleProvenance ?? noProvenance,
    },
  };
}

describe('additional coverage', () => {
  test('a child preview row shows an explicit "Unpinned" label when its revision is undefined', async () => {
    const client = baseClient({
      list: async () => ({
        items: [
          {
            id: 'wf_child_1',
            type: 'validate-shipment',
            status: 'completed',
            version: '1',
            createdAt: 1_000,
            updatedAt: 1_000,
          },
        ],
        total: 1,
        offset: 0,
        limit: 5,
      }),
    });

    const { getByRole } = render(LineagePanelHarness, {
      props: { client, workflow: workflow() },
    });

    await waitFor(() => {
      const link = getByRole('link', { name: /validate-shipment/ });
      expect(link.textContent).toContain('Unpinned');
    });
  });

  test('shows a "+N more" note when the parent has more children than the preview limit', async () => {
    const client = baseClient({
      list: async () => ({
        items: [
          {
            id: 'wf_child_1',
            type: 'validate-shipment',
            status: 'completed',
            version: '1',
            createdAt: 1_000,
            updatedAt: 1_000,
          },
        ],
        total: 3,
        offset: 0,
        limit: 5,
      }),
    });

    const { getByText } = render(LineagePanelHarness, {
      props: { client, workflow: workflow() },
    });

    await waitFor(() => {
      expect(getByText(/\+2 more/)).not.toBeNull();
    });
  });

  test('renders the real schedule-provenance row when the run was schedule-launched (weft#732 item 3)', async () => {
    const client = baseClient({
      scheduleProvenance: async () => ({
        scheduleId: 'nightly-reconcile',
        occurrence: Date.UTC(2026, 6, 9, 2, 0, 0),
      }),
    });

    const { getByText } = render(LineagePanelHarness, {
      props: { client, workflow: workflow() },
    });

    await waitFor(() => {
      expect(getByText('nightly-reconcile')).not.toBeNull();
    });
  });

  test('renders no schedule-provenance row for a non-schedule-launched run', async () => {
    const client = baseClient();

    const { queryByText, getByText } = render(LineagePanelHarness, {
      props: { client, workflow: workflow() },
    });

    await waitFor(() => {
      expect(getByText('No child workflows.')).not.toBeNull();
    });
    expect(queryByText('Launched by schedule')).toBeNull();
  });

  test('renders the continuation chain — previous run (no fabricated status), this run (with revision), no successor — for a start-new replacement (weft#732 item 2, WFT-117)', async () => {
    const client = baseClient();

    const { getByText } = render(LineagePanelHarness, {
      props: {
        client,
        workflow: workflow({
          status: 'running',
          revision: 'order-fulfillment-rev-current',
          restartedFrom: {
            workflowId: 'wf_current',
            workflowExecutionToken: 'prior-run-token',
            replacedAt: 500,
          },
        }),
      },
    });

    await waitFor(() => {
      expect(getByText('This run')).not.toBeNull();
    });
    expect(getByText('Previous run')).not.toBeNull();
    expect(getByText('No successor')).not.toBeNull();
    expect(getByText(/^rev order-fu/)).not.toBeNull();
    expect(
      getByText(/A start-new replacement resolves against whichever revision is active/),
    ).not.toBeNull();
    // The eager-registered/sole-dynamic-source-candidate caveat (Codex
    // review, PR #978) — a start-new replacement can bypass the active
    // pointer entirely, same as any other fresh start.
    expect(
      getByText(/a fresh start can run without consulting the active pointer at all/),
    ).not.toBeNull();
  });

  test('the "This run" chip shows an explicit "Unpinned" badge when this run has no persisted revision', async () => {
    const client = baseClient();

    const { getByText } = render(LineagePanelHarness, {
      props: {
        client,
        workflow: workflow({
          status: 'running',
          restartedFrom: {
            workflowId: 'wf_current',
            workflowExecutionToken: 'prior-run-token',
            replacedAt: 500,
          },
        }),
      },
    });

    await waitFor(() => {
      expect(getByText('This run')).not.toBeNull();
    });
    expect(getByText('Unpinned')).not.toBeNull();
  });

  test('renders the schedule-provenance row without an occurrence suffix when none was recorded', async () => {
    const client = baseClient({
      scheduleProvenance: async () => ({ scheduleId: 'nightly-reconcile' }),
    });

    const { getByText, queryByText } = render(LineagePanelHarness, {
      props: { client, workflow: workflow() },
    });

    await waitFor(() => {
      expect(getByText('nightly-reconcile')).not.toBeNull();
    });
    expect(queryByText(/occurrence/)).toBeNull();
  });

  test('falls back to the workflow id when the previous run carries no execution token', async () => {
    const client = baseClient();

    const { getByText, queryByText } = render(LineagePanelHarness, {
      props: {
        client,
        workflow: workflow({
          restartedFrom: { workflowId: 'wf_current', replacedAt: 500 },
        }),
      },
    });

    await waitFor(() => {
      expect(getByText('Previous run')).not.toBeNull();
    });
    expect(queryByText(/^prior-run-token/)).toBeNull();
  });

  test('shows a pending skeleton for the forked-from row while the source workflow lookup is in flight', async () => {
    const pendingGet: { resolve: ((value: WorkflowState | null) => void) | null } = {
      resolve: null,
    };
    const client = baseClient({
      get: () =>
        new Promise<WorkflowState | null>((resolve) => {
          pendingGet.resolve = resolve;
        }),
    });

    const { container, getByText } = render(LineagePanelHarness, {
      props: {
        client,
        workflow: workflow({ forkedFrom: { workflowId: 'wf_source_pending', step: 4 } }),
      },
    });

    await waitFor(() => {
      expect(getByText('at step 4')).not.toBeNull();
    });
    expect(container.querySelector('.cinder-skeleton')).not.toBeNull();

    pendingGet.resolve?.(workflow({ id: 'wf_source_pending', type: 'reconcile-ledger' }));

    await waitFor(() => {
      expect(getByText('reconcile-ledger')).not.toBeNull();
    });
  });

  test('renders no continuation chain when the run was not started via start-new', async () => {
    const client = baseClient();

    const { queryByText, getByText } = render(LineagePanelHarness, {
      props: { client, workflow: workflow() },
    });

    await waitFor(() => {
      expect(getByText('No child workflows.')).not.toBeNull();
    });
    expect(queryByText('This run')).toBeNull();
    expect(queryByText('Previous run')).toBeNull();
  });
});
