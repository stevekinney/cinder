/**
 * Component tests for the Dashboard route's page-level state machine
 * (default/loading/empty/unreachable, plan §9.1, Appendix B). Uses a real
 * `HttpClient` scripted at the `fetch` layer (`./dashboard-test-support.
 * test-support.ts`) rather than the real in-process test server — see that
 * module's doc for why `client.operations[...]` (JSON-RPC) needs this
 * instead.
 */
import { render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import DashboardIndexHarness from './dashboard-index-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './dashboard-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

describe('Dashboard', () => {
  test('shows the unreachable state when the health probe fails', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrlStatus('/v1/health', 503);
    const client = realClient();

    const { getByText } = render(DashboardIndexHarness, { props: { client } });

    await waitFor(() => expect(getByText('Server unreachable')).not.toBeNull());
    expect(getByText('The health probe failed to respond.')).not.toBeNull();
  });

  test('shows the onboarding empty state when the workflow status aggregate totals zero', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrl('/v1/health', { status: 'ok' });
    scripted.routeJsonRpcMethod('weft.workflows.aggregate', {
      total: 0,
      groups: [],
      truncated: false,
    });
    const client = realClient();

    const { getByText } = render(DashboardIndexHarness, { props: { client } });

    await waitFor(() => expect(getByText('No workflow activity yet')).not.toBeNull());
    expect(
      getByText(
        'Register a workflow definition and start a run from your worker to see operational data here.',
      ),
    ).not.toBeNull();
    expect(getByText('Open registry setup')).not.toBeNull();
  });

  test('renders the three bands with real counts once health and aggregate data resolve', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrl('/v1/health', { status: 'ok' });
    scripted.routeJsonRpcMethod('weft.workflows.aggregate', {
      total: 12,
      groups: [
        { key: 'running', count: 9 },
        { key: 'failed', count: 3 },
      ],
      truncated: false,
    });
    scripted.routeJsonRpcMethod('weft.tasks.diagnostics', {
      items: [],
      summary: {
        stuckQueued: 0,
        staleInflight: 0,
        retryStorms: 0,
        allWorkersAtCapacity: 0,
        deadLettered: 0,
        delayed: 0,
        unadoptedTerminal: 0,
      },
      limit: 50,
    });
    scripted.routeUrl('/reviews', { items: [] });
    const client = realClient();

    const { getByText, getAllByText } = render(DashboardIndexHarness, { props: { client } });

    await waitFor(() => expect(getByText('Workflows by status')).not.toBeNull());
    expect(getAllByText('9').length).toBeGreaterThan(0);
    expect(getByText('Failures by category')).not.toBeNull();
    expect(getByText('Recent activity')).not.toBeNull();
  });
});
