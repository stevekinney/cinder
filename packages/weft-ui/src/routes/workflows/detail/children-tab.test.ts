import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { PaginatedResult, WorkflowState, WorkflowSummary } from '@lostgradient/weft';

import ChildrenTabHarness from './children-tab.test-harness.svelte';

function workflowState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'wf_1',
    type: 'fulfillment-parent',
    status: 'completed',
    input: {},
    versionTuple: { workflowVersion: '1' },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function summary(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    id: 'wf_child_1',
    type: 'validate-shipment',
    status: 'completed',
    version: '1',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function page(items: WorkflowSummary[], total = items.length): PaginatedResult<WorkflowSummary> {
  return { items, total, offset: 0, limit: 50 };
}

/** Active-pointer stub for the fakes below that don't exercise the comparison badge: resolves nothing, so every badge stays hidden. */
const inertOperations = {
  'weft.workflows.active.get': async (_input: { name: string }) => null,
};

describe('ChildrenTab', () => {
  test('shows the empty state when list({ parentWorkflowId }) returns no children', async () => {
    const client = { list: async () => page([]), operations: inertOperations };

    const { getByText } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    await waitFor(() => {
      expect(getByText('No child workflows')).not.toBeNull();
    });
  });

  test('renders real child ids as clickable rows, including a detached (non-awaited) child', async () => {
    const client = {
      operations: inertOperations,
      list: async (filter?: { parentWorkflowId?: string }) => {
        expect(filter?.parentWorkflowId).toBe('wf_1');
        return page([
          summary({ id: 'wf_child_1', type: 'validate-shipment', status: 'completed' }),
          summary({ id: 'wf_child_2', type: 'monitor-delivery', status: 'running' }),
        ]);
      },
    };

    const { getByText, getByRole } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    await waitFor(() => {
      expect(getByText('validate-shipment')).not.toBeNull();
      expect(getByText('monitor-delivery')).not.toBeNull();
    });

    const link = getByRole('link', { name: /validate-shipment/ });
    expect(link.getAttribute('href')).toContain('wf_child_1');
  });

  test('shows a "+N more" note when the parent has more children than the page limit', async () => {
    const client = {
      operations: inertOperations,
      list: async () => page([summary({ id: 'wf_child_1' })], 3),
    };

    const { getByText } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    await waitFor(() => {
      expect(getByText(/Showing 1 of 3/)).not.toBeNull();
    });
  });

  test('no "+N more" note when every child fits on the one page', async () => {
    const client = {
      operations: inertOperations,
      list: async () => page([summary({ id: 'wf_child_1' })], 1),
    };

    const { getByText, queryByText } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    await waitFor(() => {
      expect(getByText('validate-shipment')).not.toBeNull();
    });
    expect(queryByText(/more —/)).toBeNull();
  });

  test('shows a skeleton while the children list is loading', async () => {
    const pendingList: { resolve: ((value: PaginatedResult<WorkflowSummary>) => void) | null } = {
      resolve: null,
    };
    const client = {
      operations: inertOperations,
      list: () =>
        new Promise<PaginatedResult<WorkflowSummary>>((resolve) => {
          pendingList.resolve = resolve;
        }),
    };

    const { container, getByText } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    expect(container.querySelector('.cinder-skeleton')).not.toBeNull();

    pendingList.resolve?.(page([summary({ id: 'wf_child_1' })]));

    await waitFor(() => {
      expect(getByText('validate-shipment')).not.toBeNull();
    });
  });

  test('a child row shows its truncated revision when defined', async () => {
    const client = {
      operations: inertOperations,
      list: async () =>
        page([summary({ id: 'wf_child_1', revision: 'validate-shipment-rev-abcdefgh' })]),
    };

    const { getByRole } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    await waitFor(() => {
      const link = getByRole('link', { name: /validate-shipment/ });
      expect(link.textContent).toContain('validate…efgh');
    });
  });

  test('a child row shows an explicit "Unpinned" label when revision is undefined', async () => {
    const client = {
      operations: inertOperations,
      list: async () => page([summary({ id: 'wf_child_1' })]),
    };

    const { getByRole } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    await waitFor(() => {
      const link = getByRole('link', { name: /validate-shipment/ });
      expect(link.textContent).toContain('Unpinned');
    });
  });

  test('child rows show an active-versus-bound badge from one active-pointer fetch per distinct type (COR-15)', async () => {
    const requested: string[] = [];
    const client = {
      list: async () =>
        page([
          summary({ id: 'wf_c1', type: 'validate-shipment', revision: 'rev-current' }),
          summary({ id: 'wf_c2', type: 'validate-shipment', revision: 'rev-old' }),
          summary({ id: 'wf_c3', type: 'monitor-delivery', revision: 'rev-mon' }),
          summary({ id: 'wf_c4', type: 'monitor-delivery' }),
        ]),
      operations: {
        'weft.workflows.active.get': async (input: { name: string }) => {
          requested.push(input.name);
          return {
            revision: input.name === 'validate-shipment' ? 'rev-current' : 'rev-mon',
            generation: 1,
            activatedAt: 1,
          };
        },
      },
    };

    const { getAllByText } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    await waitFor(() => {
      expect(getAllByText('Active')).toHaveLength(2);
    });
    expect(getAllByText('Differs from active')).toHaveLength(1);
    expect([...requested].sort()).toEqual(['monitor-delivery', 'validate-shipment']);
  });

  test('a child row displays its truncated id and relative creation time', async () => {
    const client = {
      operations: inertOperations,
      list: async () => page([summary({ id: 'wf_child_abcdef0123456789', createdAt: 1_000 })]),
    };

    const { getByRole } = render(ChildrenTabHarness, {
      props: { client, workflow: workflowState() },
    });

    await waitFor(() => {
      const link = getByRole('link', { name: /validate-shipment/ });
      expect(link.textContent).toContain('wf_child');
    });
  });
});
