import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { PaginatedResult, WorkflowState, WorkflowSummary } from '@lostgradient/weft';

import type { WorkflowCatalogActivePointerLike } from '../../../lib/workflow-revision.ts';
import OverviewTabHarness from './overview-tab.test-harness.svelte';

function workflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'wf_1',
    type: 'order-fulfillment',
    status: 'running',
    input: { orderId: 'ord-1' },
    versionTuple: { workflowVersion: '1' },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function emptyPage(): PaginatedResult<WorkflowSummary> {
  return { items: [], total: 0, offset: 0, limit: 5 };
}

function baseClient() {
  return {
    addTags: async () => {},
    removeTags: async () => {},
    get: async (): Promise<WorkflowState | null> => null,
    list: async (): Promise<PaginatedResult<WorkflowSummary>> => emptyPage(),
    operations: {
      'weft.workflows.scheduleprovenance.get': async () => null,
    },
  };
}

describe('OverviewTab', () => {
  test('running workflow shows the pending-result message, not a result panel', async () => {
    const { getByText, queryByText } = render(OverviewTabHarness, {
      props: { client: baseClient(), workflow: workflow({ status: 'running' }) },
    });

    expect(getByText(/Result pending — workflow still running/)).not.toBeNull();
    expect(queryByText('Result')).toBeNull();
  });

  test('shows a distinct Revision row when the workflow has one', async () => {
    const { getByText } = render(OverviewTabHarness, {
      props: {
        client: baseClient(),
        workflow: workflow({ revision: 'sha256:deadbeef', versionTuple: { workflowVersion: '1' } }),
      },
    });

    expect(getByText('Revision')).not.toBeNull();
    expect(getByText(/^sha256:deadbeef/)).not.toBeNull();
  });

  describe('Revision row active-comparison text (WFT-117)', () => {
    const ACTIVE: WorkflowCatalogActivePointerLike = {
      revision: 'sha256:deadbeef',
      generation: 2,
      activatedAt: 500,
    };

    test('reads "Unpinned (pre-revision record)" for a legacy workflow with no persisted revision — the row is never omitted', async () => {
      const { getByText } = render(OverviewTabHarness, {
        props: { client: baseClient(), workflow: workflow(), activeRevision: ACTIVE },
      });

      expect(getByText('Revision')).not.toBeNull();
      expect(getByText('Unpinned (pre-revision record)')).not.toBeNull();
    });

    test('reads "— active" when workflow.revision matches the active pointer', async () => {
      const { getByText } = render(OverviewTabHarness, {
        props: {
          client: baseClient(),
          workflow: workflow({ revision: ACTIVE.revision }),
          activeRevision: ACTIVE,
        },
      });

      expect(getByText(`${ACTIVE.revision} — active`)).not.toBeNull();
    });

    test('reads "— differs from active" when workflow.revision differs from the active pointer', async () => {
      const { getByText } = render(OverviewTabHarness, {
        props: {
          client: baseClient(),
          workflow: workflow({ revision: 'sha256:stale000' }),
          activeRevision: ACTIVE,
        },
      });

      expect(getByText('sha256:stale000 — differs from active')).not.toBeNull();
    });

    test('reads "— active revision unknown" when activeRevision is null (never activated)', async () => {
      const { getByText } = render(OverviewTabHarness, {
        props: {
          client: baseClient(),
          workflow: workflow({ revision: ACTIVE.revision }),
          activeRevision: null,
        },
      });

      expect(getByText(`${ACTIVE.revision} — active revision unknown`)).not.toBeNull();
    });

    test('reads "— active revision unknown" when activeRevision is omitted (denied/loading)', async () => {
      const { getByText } = render(OverviewTabHarness, {
        props: {
          client: baseClient(),
          workflow: workflow({ revision: ACTIVE.revision }),
        },
      });

      expect(getByText(`${ACTIVE.revision} — active revision unknown`)).not.toBeNull();
    });
  });

  test('completed workflow shows a Result panel', async () => {
    const { getByText } = render(OverviewTabHarness, {
      props: {
        client: baseClient(),
        workflow: workflow({ status: 'completed', result: { ok: true } }),
      },
    });

    expect(getByText('Result')).not.toBeNull();
  });

  test('failed workflow shows the failure-category badge and plain-language explanation', async () => {
    const { getByText } = render(OverviewTabHarness, {
      props: {
        client: baseClient(),
        workflow: workflow({
          status: 'failed',
          failureCategory: 'timeout',
          error: 'the activity took too long',
        }),
      },
    });

    expect(getByText('timeout')).not.toBeNull();
    expect(getByText(/exceeded its configured deadline/)).not.toBeNull();
    expect(getByText('the activity took too long')).not.toBeNull();
  });

  test('cancelled workflow shows a neutral no-result message', async () => {
    const { getByText } = render(OverviewTabHarness, {
      props: { client: baseClient(), workflow: workflow({ status: 'cancelled' }) },
    });

    expect(getByText(/no result value/)).not.toBeNull();
  });

  test('renders existing tags', async () => {
    const { getByText } = render(OverviewTabHarness, {
      props: { client: baseClient(), workflow: workflow({ tags: ['prod', 'tier-1'] }) },
    });

    expect(getByText('prod')).not.toBeNull();
    expect(getByText('tier-1')).not.toBeNull();
  });

  test('adding a tag calls client.addTags with the trimmed value', async () => {
    const added: { tag: string | null } = { tag: null };
    const client = {
      ...baseClient(),
      addTags: async (_id: string, tag: string) => {
        added.tag = tag;
      },
    };

    const { getByLabelText, getByRole } = render(OverviewTabHarness, {
      props: { client, workflow: workflow() },
    });

    const input = getByLabelText('Add tag');
    await fireEvent.input(input, { target: { value: '  urgent  ' } });
    await fireEvent.click(getByRole('button', { name: 'Add tag' }));

    expect(added.tag).toBe('urgent');
  });

  test('timed-out workflow shows a neutral no-result message', async () => {
    const { getByText } = render(OverviewTabHarness, {
      props: { client: baseClient(), workflow: workflow({ status: 'timed-out' }) },
    });

    expect(getByText(/timed out/)).not.toBeNull();
  });

  test('a failed workflow with no failure category shows neither the badge nor the explanation', async () => {
    const { getByText, queryByText } = render(OverviewTabHarness, {
      props: {
        client: baseClient(),
        workflow: workflow({ status: 'failed', error: 'boom' }),
      },
    });

    expect(getByText('Failed')).not.toBeNull();
    expect(getByText('boom')).not.toBeNull();
    expect(queryByText(/could not be classified/)).toBeNull();
  });

  test('a failed workflow with an error stack renders a collapsible trigger for it', async () => {
    // Cinder's `Collapsible` toggles via a `transition:` directive whose
    // lifecycle event dispatch happy-dom can't construct cross-realm — no
    // test in this repo drives a transitioning Cinder trigger via
    // `fireEvent.click` (see `advanced-options.test.ts`'s identical note).
    // This only asserts the trigger itself renders (the `errorStack.length >
    // 0` branch), not the post-expand content.
    const { getByRole } = render(OverviewTabHarness, {
      props: {
        client: baseClient(),
        workflow: workflow({
          status: 'failed',
          error: 'boom',
          errorStack: 'Error: boom\n    at doThing (file.ts:1:1)',
        }),
      },
    });

    expect(getByRole('button', { name: 'Show full stack trace' })).not.toBeNull();
  });

  test('removing a tag calls client.removeTags', async () => {
    const removed: { tag: string | null } = { tag: null };
    const client = {
      ...baseClient(),
      removeTags: async (_id: string, tag: string) => {
        removed.tag = tag;
      },
    };

    const { getByRole } = render(OverviewTabHarness, {
      props: { client, workflow: workflow({ tags: ['prod'] }) },
    });

    await fireEvent.click(getByRole('button', { name: 'Remove tag prod' }));

    expect(removed.tag).toBe('prod');
  });

  test('pressing Enter in the Add tag input submits it, and a blank tag is a no-op', async () => {
    const added: string[] = [];
    const client = {
      ...baseClient(),
      addTags: async (_id: string, tag: string) => {
        added.push(tag);
      },
    };

    const { getByLabelText } = render(OverviewTabHarness, {
      props: { client, workflow: workflow() },
    });

    const input = getByLabelText('Add tag');
    await fireEvent.input(input, { target: { value: '   ' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(added).toEqual([]);

    await fireEvent.input(input, { target: { value: 'urgent' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(added).toEqual(['urgent']);
  });

  test('the Definition list includes a Deadline row when the workflow has an execution deadline', async () => {
    const { getByText } = render(OverviewTabHarness, {
      props: {
        client: baseClient(),
        workflow: workflow({ executionDeadline: Date.UTC(2026, 0, 1) }),
      },
    });

    expect(getByText('Deadline')).not.toBeNull();
  });

  test('the version summary includes agent and tool-version counts when present', async () => {
    const { getByText } = render(OverviewTabHarness, {
      props: {
        client: baseClient(),
        workflow: workflow({
          versionTuple: {
            workflowVersion: '2',
            agentVersion: 'gpt-5',
            toolVersions: ['search@1', 'browse@2'],
          },
        }),
      },
    });

    expect(getByText(/agent gpt-5/)).not.toBeNull();
    expect(getByText(/tools 2/)).not.toBeNull();
  });
});
