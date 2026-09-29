import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';
import { QueryClient } from '@tanstack/svelte-query';

import { queryKeys } from '../../../../lib/query.ts';
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

describe('additional coverage', () => {
  test('a WorkflowRevisionUnavailableError-coded rejection on a DEFAULT (source-mode) fork points at the picker, not back at the source revision (Codex review, PR #978)', async () => {
    // The default fork (no explicit opt-in) IS "use the source revision" —
    // when that's exactly what just failed, telling the operator to "use
    // the source revision instead" would be telling them to retry the
    // thing that just failed. Guidance must route them to the picker.
    const client = baseClient({
      fork: async () => {
        throw new HttpClientError(409, 'revision not registered', {
          faultCode: 'Conflict',
          weftCode: 'WorkflowRevisionUnavailableError',
        });
      },
    });

    const { getByRole, getByText, queryByText } = render(ForkDialogHarness, {
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

    await fireEvent.click(getByRole('button', { name: 'Create fork' }));

    await waitFor(() => {
      expect(getByText('Revision unavailable')).not.toBeNull();
      // Matches the conflict paragraph's own sentence, not the disclosure
      // button's identical-looking label — `getByText` would otherwise
      // throw on finding both.
      expect(getByText(/pick one that is currently installed/)).not.toBeNull();
    });
    expect(queryByText(/use the source revision instead/)).toBeNull();
  });

  test('conflict guidance stays bound to the SUBMITTED selection, not a live edit made after the failure (Codex review, PR #978, round 3)', async () => {
    // A source-mode fork fails first (guidance: route to the picker). The
    // operator then opens the picker and types an explicit revision WITHOUT
    // resubmitting — the still-displayed error's guidance must not silently
    // flip to "use the source revision instead" just because the live
    // `selection` changed; it reflects `$forkMutation.variables`, frozen at
    // the failed `mutate()` call, not the current picker contents.
    const client = baseClient({
      fork: async () => {
        throw new HttpClientError(409, 'revision not registered', {
          faultCode: 'Conflict',
          weftCode: 'WorkflowRevisionUnavailableError',
        });
      },
    });

    const { getByRole, getByText, queryByText } = render(ForkDialogHarness, {
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

    await fireEvent.click(getByRole('button', { name: 'Create fork' }));
    await waitFor(() => {
      expect(getByText(/pick one that is currently installed/)).not.toBeNull();
    });

    await fireEvent.click(getByRole('button', { name: 'Fork a different revision' }));
    const input = getByRole('textbox', { name: 'Revision id' });
    await fireEvent.input(input, { target: { value: 'order-processing-rev-explicit' } });

    // Still showing the FIRST (source-mode) failure's guidance — the
    // in-progress picker edit hasn't been submitted.
    expect(getByText(/pick one that is currently installed/)).not.toBeNull();
    expect(queryByText(/use the source revision instead/)).toBeNull();
  });

  test('a WorkflowRevisionUnavailableError-coded rejection on an EXPLICIT-revision fork keeps the "use the source revision instead" fallback', async () => {
    const client = baseClient({
      fork: async () => {
        throw new HttpClientError(409, 'revision not registered', {
          faultCode: 'Conflict',
          weftCode: 'WorkflowRevisionUnavailableError',
        });
      },
    });

    const { getByRole, getByText } = render(ForkDialogHarness, {
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
    await fireEvent.input(input, { target: { value: 'order-processing-rev-missing' } });
    await fireEvent.click(getByRole('button', { name: 'Create fork' }));

    await waitFor(() => {
      expect(getByText('Revision unavailable')).not.toBeNull();
      expect(
        getByText(/Pick a different revision, or use the source revision instead/),
      ).not.toBeNull();
    });
  });

  test('any other error keeps the existing generic-error paragraph', async () => {
    const client = baseClient({
      fork: async () => {
        throw new HttpClientError(500, 'internal engine failure', { faultCode: 'EngineFailure' });
      },
    });

    const { getByRole, getByText, queryByText } = render(ForkDialogHarness, {
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

    await fireEvent.click(getByRole('button', { name: 'Create fork' }));

    await waitFor(() => {
      expect(getByText('internal engine failure')).not.toBeNull();
    });
    expect(queryByText('Revision unavailable')).toBeNull();
  });

  test("a mid-session degrade clears the now-hidden Select's stale value — typing a new revision into the Input that replaces it submits the NEW value, not the old Select choice (Codex review, PR #978)", async () => {
    // First call succeeds (Select renders, operator picks revision A);
    // every call after that is a 403 (simulates `workflows:read` revoked
    // server-side mid-session, `revisionsForbidden` flips true, and the
    // dialog swaps the Select for the free-text Input without the operator
    // closing/reopening the disclosure).
    let calls = 0;
    const forkCalls: unknown[] = [];
    const client = baseClient({
      fork: async (_id, options) => {
        forkCalls.push(options);
        return { id: 'wf-forked-1' };
      },
      revisionsList: async () => {
        calls += 1;
        if (calls === 1) {
          return [
            installedRevisionRecord('order-processing-rev-a', 1_000),
            installedRevisionRecord('order-processing-rev-b', 2_000),
          ];
        }
        throw new HttpClientError(403, 'workflows:read required', { faultCode: 'Forbidden' });
      },
    });
    const queryClient = newQueryClient();

    const { getByRole, findByRole } = render(ForkDialogHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: allScopesPrincipal(),
        queryClient,
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Fork a different revision' }));
    const select = await findByRole('combobox', { name: 'Revision' });
    await fireEvent.change(select, { target: { value: 'order-processing-rev-a' } });

    // Force the listing query to refetch and this time come back 403 —
    // the dialog degrades to the free-text Input mid-session.
    await queryClient.refetchQueries({ queryKey: queryKeys.catalog.revisions('order-processing') });
    const input = await findByRole('textbox', { name: 'Revision id' });
    await fireEvent.input(input, { target: { value: 'order-processing-rev-b' } });
    await fireEvent.click(getByRole('button', { name: 'Create fork' }));

    await waitFor(() => {
      expect(forkCalls).toEqual([{ fromStep: 3, revision: 'order-processing-rev-b' }]);
    });
  });

  test('a non-403 refetch failure replaces the cached Select with the "Could not load" error, not stale entries (Codex review, PR #978, round 6)', async () => {
    // First call succeeds (the picker renders installed revisions);
    // every call after that fails with a non-Forbidden error (network
    // blip, EngineFailure, or a revision genuinely uninstalled between
    // fetches). TanStack Query keeps the previous successful `data`
    // alongside `isError: true` across the failed refetch — without
    // ignoring cached data on error, the Select would keep presenting
    // those (possibly stale) revisions as selectable.
    let calls = 0;
    const client = baseClient({
      revisionsList: async () => {
        calls += 1;
        if (calls === 1) {
          return [installedRevisionRecord('order-processing-rev-a', 1_000)];
        }
        throw new HttpClientError(500, 'internal engine failure', { faultCode: 'EngineFailure' });
      },
    });
    const queryClient = newQueryClient();

    const { getByRole, getByText, findByRole } = render(ForkDialogHarness, {
      props: {
        client,
        workflowId: 'wf-1',
        initialStep: 3,
        workflowType: 'order-processing',
        sourceRevision: 'order-processing-rev-current',
        principal: allScopesPrincipal(),
        queryClient,
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Fork a different revision' }));
    await findByRole('combobox', { name: 'Revision' });

    await queryClient.refetchQueries({ queryKey: queryKeys.catalog.revisions('order-processing') });

    await waitFor(() => {
      expect(getByText('Could not load the list of installed revisions.')).not.toBeNull();
    });
  });
});
