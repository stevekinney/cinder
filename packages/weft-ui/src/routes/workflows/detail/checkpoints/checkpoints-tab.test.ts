import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { CheckpointSummary, WorkflowReplay } from '@lostgradient/weft';
import { HttpClientError } from '@lostgradient/weft';
import { QueryClient } from '@tanstack/svelte-query';

import { AUTHORIZATION_SCOPES, type Principal } from '../../../../lib/scopes.svelte.ts';
import CheckpointsTabHarness from './checkpoints-tab.test-harness.svelte';

function allScopesPrincipal(): Principal {
  return { scopes: AUTHORIZATION_SCOPES, unauthenticatedAccess: null };
}

function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function baseClient(
  checkpoints: CheckpointSummary[] = [
    { step: 3, timestamp: 3_000, sizeBytes: 512 },
    { step: 2, timestamp: 2_000, sizeBytes: 256 },
  ],
) {
  return {
    operations: {
      'weft.workflows.checkpoints.list': async (): Promise<CheckpointSummary[]> => checkpoints,
      'weft.workflows.checkpoints.get': async () => ({
        step: 0,
        locals: {},
        searchAttributes: {},
        version: '1',
        createdAt: 0,
      }),
      'weft.workflows.revisions.list': async () => [],
    },
    replayTo: async (): Promise<WorkflowReplay | null> => null,
    fork: async () => ({ id: 'wf-forked-1' }),
    getTimeline: async () => [],
  };
}

describe('CheckpointsTab', () => {
  test('renders the checkpoint list', async () => {
    const { getByText } = render(CheckpointsTabHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => {
      expect(getByText('step 3')).not.toBeNull();
      expect(getByText('step 2')).not.toBeNull();
    });
  });

  test('shows an empty state when no checkpoints are retained', async () => {
    const { getByText } = render(CheckpointsTabHarness, {
      props: {
        client: baseClient([]),
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => {
      expect(getByText('No checkpoint history retained')).not.toBeNull();
    });
  });

  test('selecting a checkpoint shows the Replay panel by default, and Fork after clicking the Fork tab', async () => {
    const { getByText, getByRole } = render(CheckpointsTabHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => expect(getByText('step 3')).not.toBeNull());
    await fireEvent.click(getByText('step 3'));

    await waitFor(() => {
      expect(getByText('This is a replay. No actions available.')).not.toBeNull();
    });

    await fireEvent.click(getByRole('button', { name: 'Fork' }));

    await waitFor(() => {
      expect(getByText('Target step')).not.toBeNull();
    });
  });

  test('forking a checkpoint shows the success link and reveals the divergence view', async () => {
    const { getByText, getByRole } = render(CheckpointsTabHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => expect(getByText('step 3')).not.toBeNull());
    await fireEvent.click(getByText('step 3'));
    await fireEvent.click(getByRole('button', { name: 'Fork' }));
    await waitFor(() => expect(getByText('Target step')).not.toBeNull());
    await fireEvent.click(getByRole('button', { name: 'Create fork' }));

    await waitFor(() => {
      expect(getByText('wf-forked-1')).not.toBeNull();
    });
    await waitFor(() => {
      expect(getByText('Divergence from the forked run')).not.toBeNull();
    });
  });

  test('the default fork path sends only {fromStep} — no revision — to client.fork (WFT-117)', async () => {
    const forkCalls: unknown[] = [];
    const client = {
      ...baseClient(),
      fork: async (_id: string, options?: unknown) => {
        forkCalls.push(options);
        return { id: 'wf-forked-1' };
      },
    };

    const { getByText, getByRole } = render(CheckpointsTabHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-a',
      },
    });

    await waitFor(() => expect(getByText('step 3')).not.toBeNull());
    await fireEvent.click(getByText('step 3'));
    await fireEvent.click(getByRole('button', { name: 'Fork' }));
    await waitFor(() => expect(getByText('Target step')).not.toBeNull());
    await fireEvent.click(getByRole('button', { name: 'Create fork' }));

    await waitFor(() => {
      expect(forkCalls).toEqual([{ fromStep: 3 }]);
    });
  });

  test("the Fork panel threads workflowType/sourceRevision into ForkDialog's retention line", async () => {
    const { getByText, getByRole } = render(CheckpointsTabHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-a',
      },
    });

    await waitFor(() => expect(getByText('step 3')).not.toBeNull());
    await fireEvent.click(getByText('step 3'));
    await fireEvent.click(getByRole('button', { name: 'Fork' }));

    await waitFor(() => {
      expect(getByText(/^Retains/)).not.toBeNull();
    });
  });

  test('ReplayView renders replay.revision when present', async () => {
    const client = {
      ...baseClient(),
      replayTo: async () => ({
        checkpoint: { step: 3, locals: {}, searchAttributes: {}, version: '1', createdAt: 0 },
        accumulatedResults: [],
        events: [],
        revision: 'order-processing-rev-a',
      }),
    };

    const { getByText } = render(CheckpointsTabHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => expect(getByText('step 3')).not.toBeNull());
    await fireEvent.click(getByText('step 3'));

    await waitFor(() => {
      // The definition text now also carries the WFT-159 eager-registration
      // hedge (Codex review, PR #978, round 3) — same caveat as the header,
      // Overview row, and fork surfaces, so replay output can't be
      // attributed to the wrong executable artifact after a redeploy.
      expect(
        getByText(/^order-processing-rev-a\. For an eager-registered workflow type/),
      ).not.toBeNull();
    });
  });

  test('ReplayView renders the explicit "not attributable" explanation when replay.revision is absent', async () => {
    const client = {
      ...baseClient(),
      replayTo: async () => ({
        checkpoint: { step: 3, locals: {}, searchAttributes: {}, version: '1', createdAt: 0 },
        accumulatedResults: [],
        events: [],
      }),
    };

    const { getByText } = render(CheckpointsTabHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => expect(getByText('step 3')).not.toBeNull());
    await fireEvent.click(getByText('step 3'));

    await waitFor(() => {
      expect(getByText(/Not attributable/)).not.toBeNull();
      // The explanation covers every reason `resolveReplayRevision()`
      // omits a revision, not only the purged/legacy cases (Codex review,
      // PR #978, round 6) — a pre-token-correlation record and an
      // id-reuse mismatch are real, distinct causes too.
      expect(getByText(/execution-token correlation/)).not.toBeNull();
      expect(getByText(/reused by a different run/)).not.toBeNull();
    });
  });

  test('a query fault (e.g. a 404 from the checkpoints operation) shows the real fault treatment, not a fabricated "no checkpoints" empty state', async () => {
    const client = baseClient();
    const failingClient = {
      ...client,
      operations: {
        ...client.operations,
        'weft.workflows.checkpoints.list': async () => {
          throw new HttpClientError(404, 'Not found: POST /jsonrpc');
        },
      },
    };

    const { getByText, queryByText } = render(CheckpointsTabHarness, {
      props: {
        client: failingClient,
        workflowId: 'wf-1',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => {
      expect(getByText('Not found: POST /jsonrpc')).not.toBeNull();
    });
    expect(queryByText('No checkpoint history retained')).toBeNull();
  });

  test('a principal missing workflows:read sees the disabled replay gate, not a fabricated view', async () => {
    const { getByText } = render(CheckpointsTabHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        principal: { scopes: [], unauthenticatedAccess: null },
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => expect(getByText('step 3')).not.toBeNull());
    await fireEvent.click(getByText('step 3'));

    await waitFor(() => {
      expect(getByText('Replay unavailable')).not.toBeNull();
    });
  });
});
