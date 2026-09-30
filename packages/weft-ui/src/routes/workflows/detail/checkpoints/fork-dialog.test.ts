import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';
import { QueryClient } from '@tanstack/svelte-query';

import { AUTHORIZATION_SCOPES, type Principal } from '../../../../lib/scopes.svelte.ts';
import ForkDialogHarness from './fork-dialog.test-harness.svelte';

function allScopesPrincipal(): Principal {
  return { scopes: AUTHORIZATION_SCOPES, unauthenticatedAccess: null };
}

function deniedPrincipal(): Principal {
  return { scopes: [], unauthenticatedAccess: null };
}

function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function installedRevisionRecord(revision: string, installedAt: number) {
  return {
    manifest: { manifestVersion: 1, name: 'order-processing', workflowVersion: '1.0.0', revision },
    installedAt,
  };
}

function baseClient(
  overrides: {
    fork?: (id: string, options?: unknown) => Promise<{ readonly id: string }>;
    revisionsList?: () => Promise<unknown>;
  } = {},
) {
  return {
    fork: overrides.fork ?? (async () => ({ id: 'wf-forked-1' })),
    operations: {
      'weft.workflows.revisions.list':
        overrides.revisionsList ??
        (async () => [
          installedRevisionRecord('order-processing-rev-a', 1_000),
          installedRevisionRecord('order-processing-rev-b', 2_000),
        ]),
    },
  };
}

describe('ForkDialog', () => {
  test('default state shows "Retains rev X" for a run with a persisted source revision', async () => {
    const { getByText } = render(ForkDialogHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    expect(getByText(/^Retains/)).not.toBeNull();
  });

  test("qualifies the default retention promise as a snapshot, not a guarantee (Codex review, PR #978, round 5) — sourceRevision is threaded from the detail page's own fetch, which can be stale by the time the operator submits", async () => {
    const { getByText } = render(ForkDialogHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    expect(getByText(/as last loaded here/)).not.toBeNull();
  });

  test('refetches the source run on open and reflects a revision that changed since the page loaded, keeping the snapshot disclosure (COR-15)', async () => {
    const requestedIds: string[] = [];
    const client = {
      ...baseClient(),
      get: async (id: string) => {
        requestedIds.push(id);
        return { revision: 'order-processing-rev-replacement' };
      },
    };

    const { getByText, queryByText } = render(ForkDialogHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => {
      expect(getByText('rev order-pr…ment')).not.toBeNull();
    });
    expect(queryByText('rev order-pr…rent')).toBeNull();
    expect(requestedIds).toEqual(['wf-1']);
    // The refetch is added ON TOP of the snapshot disclosure, not instead of it.
    expect(getByText(/as last loaded here/)).not.toBeNull();
  });

  test('falls back to the page-load revision when the open-time refetch finds the run purged or fails (COR-15)', async () => {
    for (const outcome of ['purged', 'fails'] as const) {
      let calls = 0;
      const queryClient = newQueryClient();
      const { getByText, unmount } = render(ForkDialogHarness, {
        props: {
          client: {
            ...baseClient(),
            get: async () => {
              calls += 1;
              if (outcome === 'fails') throw new Error('network down');
              return null;
            },
          },
          workflowId: 'wf-1',
          initialStep: 3,
          workflowType: 'order-processing',
          sourceRevision: 'order-processing-rev-current',
          principal: allScopesPrincipal(),
          queryClient,
        },
      });
      // The refetch settles (no fetch left in flight) before asserting the fallback held.
      await waitFor(() => expect(calls).toBe(1));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(getByText('rev order-pr…rent')).not.toBeNull();
      unmount();
    }
  });

  test('an unpinned page-load source picks up a revision persisted since (COR-15)', async () => {
    const client = { ...baseClient(), get: async () => ({ revision: 'order-processing-rev-new' }) };

    const { getByText } = render(ForkDialogHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: undefined,
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await waitFor(() => {
      expect(getByText(/^Retains/)).not.toBeNull();
    });
  });

  test('default state shows the unpinned-legacy variant when sourceRevision is undefined', async () => {
    const { getByText } = render(ForkDialogHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: undefined,
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    expect(getByText(/^Unpinned source/)).not.toBeNull();
  });

  test('the unpinned-legacy variant does NOT promise the catalog-active revision (Codex review, PR #978, round 3) — eager registration and sole dynamic-source candidates can both bypass the active pointer', async () => {
    const { getByText, queryByText } = render(ForkDialogHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: undefined,
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    expect(
      getByText(/eager-registered type instead runs whatever this process currently has/),
    ).not.toBeNull();
    expect(
      queryByText(/resolves normally against\s*whichever revision is currently active/),
    ).toBeNull();
  });

  test('the picker disclosure lists installed revisions when workflows:read is granted', async () => {
    const { getByRole, getByText } = render(ForkDialogHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Fork a different revision' }));

    // Full revision ids, not a truncated form — two installed revisions
    // could otherwise share the same displayed prefix/suffix and be
    // indistinguishable before selection (Codex review, PR #978).
    await waitFor(() => {
      expect(getByText(/order-processing-rev-a/)).not.toBeNull();
      expect(getByText(/order-processing-rev-b/)).not.toBeNull();
    });
  });

  test('the picker degrades to a free-text input with an explanatory note when workflows:read is denied', async () => {
    const { getByRole, getByText } = render(ForkDialogHarness, {
      props: {
        client: baseClient(),
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: deniedPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Fork a different revision' }));

    await waitFor(() => {
      expect(getByRole('textbox', { name: 'Revision id' })).not.toBeNull();
      expect(getByText(/don't have permission to list installed revisions/)).not.toBeNull();
    });
  });

  test('the picker also degrades to the free-text fallback when the listing itself comes back 403, even though the principal store still says workflows:read is granted (Codex review, PR #978, round 3)', async () => {
    // Simulates a scope revoked server-side after principal bootstrap:
    // client-side `readGate.disabled` stays false, but the actual request
    // is rejected. `weft.workflows.fork` itself is public, so this must not
    // be a dead end — the same free-text degrade as an already-known denial.
    const client = baseClient({
      revisionsList: async () => {
        throw new HttpClientError(403, 'workflows:read required', { faultCode: 'Forbidden' });
      },
    });

    const { getByRole, getByText, queryByText } = render(ForkDialogHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Fork a different revision' }));

    await waitFor(() => {
      expect(getByRole('textbox', { name: 'Revision id' })).not.toBeNull();
      expect(getByText(/don't have permission to list installed revisions/)).not.toBeNull();
    });
    expect(queryByText('Could not load the list of installed revisions.')).toBeNull();
  });

  test('a non-Forbidden query failure still shows the generic "could not load" error, not the free-text fallback', async () => {
    const client = baseClient({
      revisionsList: async () => {
        throw new HttpClientError(500, 'internal engine failure', { faultCode: 'EngineFailure' });
      },
    });

    const { getByRole, getByText, queryByRole } = render(ForkDialogHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: allScopesPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Fork a different revision' }));

    await waitFor(() => {
      expect(getByText('Could not load the list of installed revisions.')).not.toBeNull();
    });
    expect(queryByRole('textbox', { name: 'Revision id' })).toBeNull();
  });

  test('submitting with an explicit revision passes {fromStep, revision} to client.fork', async () => {
    const forkCalls: unknown[] = [];
    const client = baseClient({
      fork: async (_id, options) => {
        forkCalls.push(options);
        return { id: 'wf-forked-1' };
      },
    });

    const { getByRole } = render(ForkDialogHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: deniedPrincipal(),
        queryClient: newQueryClient(),
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Fork a different revision' }));
    const input = getByRole('textbox', { name: 'Revision id' });
    await fireEvent.input(input, { target: { value: 'order-processing-rev-explicit' } });
    await fireEvent.click(getByRole('button', { name: 'Create fork' }));

    await waitFor(() => {
      expect(forkCalls).toEqual([{ fromStep: 3, revision: 'order-processing-rev-explicit' }]);
    });
  });
});
