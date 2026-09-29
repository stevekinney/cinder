/**
 * Component tests for `<MetricsTab>` (plan §9.7 T7.2). Covers the
 * Dashboard/Raw toggle, stat rendering from a polled snapshot, and the raw
 * Prometheus text view including its fault path.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { createQueryClient } from '../../lib/query.ts';
import MetricsTab from './metrics-tab.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

async function renderMetricsTab() {
  return render(SystemRouteTestHarness, {
    props: { client: realClient(), queryClient: createQueryClient(), component: MetricsTab },
  });
}

describe('MetricsTab', () => {
  test('dashboard view renders stats from the first poll', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.system.metrics', {
      'weft.workflow.active': { type: 'gauge', value: 7 },
      'weft.workflow.completed': { type: 'counter', value: 42 },
      'weft.workflow.failed': { type: 'counter', value: 1 },
    });

    const { findAllByText, findByText } = await renderMetricsTab();

    const activeWorkflowsMatches = await findAllByText('Active workflows');
    expect(activeWorkflowsMatches.length).toBeGreaterThan(0);
    expect(await findByText('7')).not.toBeNull();
    expect(await findByText('42')).not.toBeNull();
  });

  test('switching to Raw fetches and renders the Prometheus text', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.system.metrics', {});
    scripted.routeUrlText('/v1/metrics', 'weft_workflow_active 7\n');

    const { findByRole, findByText } = await renderMetricsTab();

    await fireEvent.click(await findByRole('radio', { name: 'Raw' }));

    expect(await findByText('weft_workflow_active 7')).not.toBeNull();
  });

  test('Raw view shows the fault banner on a failed fetch', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.system.metrics', {});
    scripted.routeUrlStatus('/v1/metrics', 500, 'Internal Server Error');

    const { findByRole, findByText } = await renderMetricsTab();

    await fireEvent.click(await findByRole('radio', { name: 'Raw' }));

    expect(await findByText('Something went wrong')).not.toBeNull();
  });

  test('clicking Download in the Raw view saves the Prometheus text as a Blob', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = mock((_blob: Blob) => 'blob:mock-url');
    const revokeObjectURL = mock((_url: string) => undefined);
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const click = mock(() => undefined);
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = click;

    try {
      scripted = new ScriptedFetch();
      scripted.routeJsonRpcMethod('weft.system.metrics', {});
      scripted.routeUrlText('/v1/metrics', 'weft_workflow_active 7\n');

      const { findByRole, findByText } = await renderMetricsTab();

      await fireEvent.click(await findByRole('radio', { name: 'Raw' }));
      // Wait for the raw text to actually land — the Download button stays
      // `disabled` (`!$rawQuery.data`) until then.
      expect(await findByText('weft_workflow_active 7')).not.toBeNull();
      await fireEvent.click(await findByRole('button', { name: 'Download' }));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const [blob] = createObjectURL.mock.calls[0] ?? [];
      expect(blob?.type.startsWith('text/plain')).toBe(true);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  // The `pollStatus !== 'polling'` branch (bare `ConnectionIndicator` with no
  // `label`) is NOT covered here: `PollingSource.status` (`polling-source.
  // svelte.ts`) starts at `'polling'` and only leaves it after
  // `MAX_CONSECUTIVE_FAILURES` (5) real consecutive failed polls spaced by
  // `METRICS_POLL_INTERVAL_MS` (15s, hardcoded in this component) apart —
  // `polling-source.test.ts` itself only exercises that path with a
  // deliberately short custom interval. Reaching it here would mean either
  // ~60+ real seconds of waiting or fake-timer infrastructure this repo
  // doesn't have; not a meaningful unit test trade either way.
});
