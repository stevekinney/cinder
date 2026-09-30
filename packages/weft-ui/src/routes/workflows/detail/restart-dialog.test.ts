import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError, type WorkflowState } from '@lostgradient/weft';
import { QueryClient } from '@tanstack/svelte-query';

import { queryKeys } from '../../../lib/query.ts';
import { AUTHORIZATION_SCOPES, type Principal } from '../../../lib/scopes.svelte.ts';
import RestartDialogHarness from './restart-dialog.test-harness.svelte';

function workflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'reconcile:installation-42',
    type: 'order-processing',
    status: 'completed',
    input: { installationId: 42 },
    versionTuple: { workflowVersion: '1' },
    revision: 'order-processing-rev-old',
    tags: ['nightly'],
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides,
  };
}

function principal(scopes: Principal['scopes'] = AUTHORIZATION_SCOPES): Principal {
  return { scopes, unauthenticatedAccess: null };
}

function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

interface StartOrSignalCall {
  readonly type: string;
  readonly input: unknown;
  readonly signal: { name: string; payload?: unknown; signalId?: string };
  readonly options: unknown;
}

function fakeClient(
  overrides: {
    activeRevision?: () => Promise<unknown>;
    startOrSignal?: () => Promise<{
      readonly id: string;
      readonly outcome?: 'started' | 'signalled';
    }>;
  } = {},
) {
  const calls: StartOrSignalCall[] = [];
  return {
    calls,
    client: {
      startOrSignal: async (
        type: string,
        input: unknown,
        signal: StartOrSignalCall['signal'],
        options: unknown,
      ) => {
        calls.push({ type, input, signal, options });
        return (overrides.startOrSignal ?? (async () => ({ id: 'reconcile:installation-42' })))();
      },
      operations: {
        'weft.workflows.active.get':
          overrides.activeRevision ??
          (async () => ({ revision: 'order-processing-rev-new', generation: 3, activatedAt: 5 })),
      },
    },
  };
}

describe('RestartDialog', () => {
  test('shows the revision a restart will select (the active one) and the fresh-start hedge before the operator confirms', async () => {
    const { client } = fakeClient();
    const { findByText, getByText } = render(RestartDialogHarness, {
      props: {
        client,
        workflow: workflow(),
        principal: principal(),
        queryClient: newQueryClient(),
      },
    });

    expect(await findByText(/Selects/)).not.toBeNull();
    expect(getByText('rev order-pr…-new')).not.toBeNull();
    expect(getByText(/can run without consulting the active pointer/)).not.toBeNull();
    // The prior run is named as the thing being replaced.
    expect(getByText(/reconcile:installation-42/)).not.toBeNull();
  });

  test('says the active revision is unknown when the lookup is denied or never activated, without blocking the restart', async () => {
    const { client } = fakeClient({
      activeRevision: async () => {
        throw new HttpClientError(404, 'not found', { faultCode: 'NotFound' });
      },
    });
    const { findByText, getByRole } = render(RestartDialogHarness, {
      props: {
        client,
        workflow: workflow(),
        principal: principal(),
        queryClient: newQueryClient(),
      },
    });

    expect(await findByText(/active revision could not be resolved/i)).not.toBeNull();
    expect(getByRole('button', { name: 'Restart workflow' })).not.toBeNull();
  });

  test('does not fetch the active revision without workflows:read', async () => {
    let fetched = 0;
    const { client } = fakeClient({
      activeRevision: async () => {
        fetched += 1;
        return { revision: 'x', generation: 1, activatedAt: 1 };
      },
    });
    const { findByText } = render(RestartDialogHarness, {
      props: {
        client,
        workflow: workflow(),
        principal: principal(['workflows:write']),
        queryClient: newQueryClient(),
      },
    });

    expect(await findByText(/active revision could not be resolved/i)).not.toBeNull();
    expect(fetched).toBe(0);
  });

  test('confirm is disabled until a signal name is entered and the payload is valid JSON', async () => {
    const { client } = fakeClient();
    const { getByRole, getByLabelText } = render(RestartDialogHarness, {
      props: {
        client,
        workflow: workflow(),
        principal: principal(),
        queryClient: newQueryClient(),
      },
    });

    const confirm = getByRole('button', { name: 'Restart workflow' });
    expect(confirm.hasAttribute('disabled')).toBe(true);

    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'resync' } });
    expect(confirm.hasAttribute('disabled')).toBe(false);

    await fireEvent.input(getByLabelText('Signal payload (JSON)'), { target: { value: '{oops' } });
    expect(confirm.hasAttribute('disabled')).toBe(true);
  });

  test("confirming calls startOrSignal with onTerminalConflict: start-new, the run's id/type/input/tags, and a stable signal id", async () => {
    const { client, calls } = fakeClient();
    let restarted = 0;
    const queryClient = newQueryClient();
    const { getByRole, getByLabelText } = render(RestartDialogHarness, {
      props: {
        client,
        workflow: workflow(),
        principal: principal(),
        queryClient,
        onRestarted: () => (restarted += 1),
      },
    });

    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'resync' } });
    await fireEvent.input(getByLabelText('Signal payload (JSON)'), {
      target: { value: '{"reason":"manual"}' },
    });
    await fireEvent.click(getByRole('button', { name: 'Restart workflow' }));

    await waitFor(() => expect(restarted).toBe(1));
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.type).toBe('order-processing');
    expect(call?.input).toEqual({ installationId: 42 });
    expect(call?.signal.name).toBe('resync');
    expect(call?.signal.payload).toEqual({ reason: 'manual' });
    expect(typeof call?.signal.signalId).toBe('string');
    expect(call?.signal.signalId?.length).toBeGreaterThan(0);
    expect(call?.options).toEqual({
      id: 'reconcile:installation-42',
      onTerminalConflict: 'start-new',
      tags: ['nightly'],
    });
  });

  test('invalidates the detail, list, and every per-run cache after a successful restart', async () => {
    const { client } = fakeClient();
    const queryClient = newQueryClient();
    const id = 'reconcile:installation-42';
    const listKey = ['workflows', 'list', { status: 'completed' }] as const;
    const timelineKey = ['workflows', 'timeline', id] as const;
    const checkpointsKey = ['workflows', 'checkpoints', id] as const;
    const otherRunKey = ['workflows', 'timeline', 'some-other-run'] as const;
    queryClient.setQueryData(queryKeys.workflows.detail(id), 'stale');
    for (const key of [listKey, timelineKey, checkpointsKey, otherRunKey]) {
      queryClient.setQueryData(key, 'stale');
    }
    const { getByRole, getByLabelText } = render(RestartDialogHarness, {
      props: { client, workflow: workflow(), principal: principal(), queryClient },
    });

    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'resync' } });
    await fireEvent.click(getByRole('button', { name: 'Restart workflow' }));

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.workflows.detail(id))?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(timelineKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(checkpointsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherRunKey)?.isInvalidated).toBe(false);
  });

  test("a 'signalled' outcome (the id belongs to a live run) is not reported as a restart: the dialog stays open with a notice (COR-15)", async () => {
    const { client } = fakeClient({
      startOrSignal: async () => ({ id: 'reconcile:installation-42', outcome: 'signalled' }),
    });
    let restarted = 0;
    let closed = 0;
    const queryClient = newQueryClient();
    queryClient.setQueryData(queryKeys.workflows.detail('reconcile:installation-42'), 'stale');
    const { getByRole, getByLabelText, findByText } = render(RestartDialogHarness, {
      props: {
        client,
        workflow: workflow(),
        principal: principal(),
        queryClient,
        onRestarted: () => (restarted += 1),
        onClose: () => (closed += 1),
      },
    });

    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'resync' } });
    await fireEvent.click(getByRole('button', { name: 'Restart workflow' }));

    expect(await findByText(/was not restarted/)).not.toBeNull();
    expect(restarted).toBe(0);
    expect(closed).toBe(0);
    expect(getByRole('button', { name: 'Restart workflow' }).hasAttribute('disabled')).toBe(true);
    // The signal did land, so the caches still refresh.
    expect(
      queryClient.getQueryState(queryKeys.workflows.detail('reconcile:installation-42'))
        ?.isInvalidated,
    ).toBe(true);
  });

  test("a 'started' outcome reports the restart and closes", async () => {
    const { client } = fakeClient({
      startOrSignal: async () => ({ id: 'reconcile:installation-42', outcome: 'started' }),
    });
    let restarted = 0;
    let closed = 0;
    const { getByRole, getByLabelText } = render(RestartDialogHarness, {
      props: {
        client,
        workflow: workflow(),
        principal: principal(),
        queryClient: newQueryClient(),
        onRestarted: () => (restarted += 1),
        onClose: () => (closed += 1),
      },
    });
    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'resync' } });
    await fireEvent.click(getByRole('button', { name: 'Restart workflow' }));
    await waitFor(() => expect(restarted).toBe(1));
    expect(closed).toBe(1);
  });

  test('a rejected restart renders the fault and stays open', async () => {
    const { client } = fakeClient({
      startOrSignal: async () => {
        throw new HttpClientError(409, 'workflow already exists and is not terminal', {
          faultCode: 'Conflict',
        });
      },
    });
    let restarted = 0;
    let closed = 0;
    const { getByRole, getByLabelText, findByText } = render(RestartDialogHarness, {
      props: {
        client,
        workflow: workflow(),
        principal: principal(),
        queryClient: newQueryClient(),
        onRestarted: () => (restarted += 1),
        onClose: () => (closed += 1),
      },
    });

    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'resync' } });
    await fireEvent.click(getByRole('button', { name: 'Restart workflow' }));

    expect(await findByText(/already exists/)).not.toBeNull();
    expect(restarted).toBe(0);
    expect(closed).toBe(0);
  });
});
