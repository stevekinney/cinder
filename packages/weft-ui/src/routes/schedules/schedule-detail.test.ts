import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for `<ScheduleDetail>` against a REAL in-process weft
 * server (`live-source-test-server.test-support.ts`).
 */
import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClient } from '@lostgradient/weft';

import { startLiveSourceTestServer } from '../../lib/live-source/live-source-test-server.test-support.ts';
import ScheduleDetailHarness from './schedule-detail-test-harness.test-harness.svelte';

/**
 * Polls a server-side condition until it holds, BEFORE the page under test
 * mounts, so the page's own initial fetch already contains the data the
 * assertion needs. Without this, the queued-runs/history tests race the
 * engine's real scheduler (fire → run → persist) against the DOM `waitFor`
 * window — a race the un-instrumented suite wins easily but the ~7×-slower
 * `--coverage` run can lose (observed: the queued-runs assertion timing
 * out at 5s only under coverage instrumentation). Waiting on the SERVER
 * state rather than bumping the DOM timeout keeps the assertion about
 * rendering, not about scheduler latency.
 */
async function waitForServerState(check: () => Promise<boolean>, label: string): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server never reached state: ${label}`);
}

describe('ScheduleDetail', () => {
  test('renders the not-found state for an unknown id', async () => {
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(ScheduleDetailHarness, {
        props: { client, id: 'does-not-exist' },
      });

      await waitFor(() => expect(getByText('Schedule not found')).not.toBeNull());
    } finally {
      await server.stop();
    }
  });

  test('renders the specification, next fires, and overlap consequence for an active schedule', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
      overlapPolicy: 'queue',
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(ScheduleDetailHarness, {
        props: { client, id: 'nightly-rollup' },
      });

      await waitFor(() => expect(getByText('0 2 * * *')).not.toBeNull());
      expect(getByText('inventory-sync-sweep · Every day at 02:00')).not.toBeNull();
      expect(getByText('Overlap policy: Queue')).not.toBeNull();
      expect(getByText(/Queue can grow unbounded during outages/)).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('a schedule with no current or queued runs shows the empty runs note', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(ScheduleDetailHarness, {
        props: { client, id: 'nightly-rollup' },
      });

      await waitFor(() => expect(getByText('No active or queued runs.')).not.toBeNull());
      await waitFor(() =>
        expect(getByText("No runs yet — this schedule hasn't fired.")).not.toBeNull(),
      );
    } finally {
      await server.stop();
    }
  });

  test('queued runs (weft 0.13+ ScheduleQueuedRun[]) render as links with a queued-at timestamp', async () => {
    const server = await startLiveSourceTestServer();
    // `long-sleeper` parks on a 24h `ctx.sleep()`, so its run stays "running"
    // for the lifetime of this test — the first occurrence occupies
    // `currentWorkflowId` and every occurrence after it queues behind it
    // under `overlapPolicy: 'queue'` rather than completing and freeing the
    // slot. `every: '50ms'` (far below the engine's 1s scheduler poll
    // interval) guarantees a tick is always due at each poll without
    // relying on a fixed wall-clock sleep before the assertion below —
    // `waitFor` polls the rendered DOM until a queued run actually appears.
    await server.engine.schedule({
      workflow: 'long-sleeper',
      id: 'queue-probe',
      every: '50ms',
      input: { label: 'queue-probe-run' },
      overlapPolicy: 'queue',
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    await waitForServerState(async () => {
      const schedule = await client.getSchedule('queue-probe');
      return (schedule?.queuedRuns?.length ?? 0) > 0;
    }, 'queue-probe has a queued run');

    try {
      const { getByText } = render(ScheduleDetailHarness, {
        props: { client, id: 'queue-probe' },
      });

      // Unique to a queued-run row (`schedule-detail.svelte`'s `{#each
      // schedule.queuedRuns as queued}` branch) — the current-run row (if
      // any) never renders "queued …" text, so this can only pass once a
      // real `ScheduleQueuedRun` entry has round-tripped through the API.
      const queuedAtText = await waitFor(() => getByText(/^queued /), { timeout: 5000 });
      expect(queuedAtText).not.toBeNull();
      const queuedLink = queuedAtText.closest('li')?.querySelector('a');
      expect(queuedLink?.getAttribute('href')).toMatch(/^\/workflows\//);
    } finally {
      await server.stop();
    }
  }, 10000);

  test('a current run renders a "running" Badge on the current-run link', async () => {
    const server = await startLiveSourceTestServer();
    // `long-sleeper` parks on a 24h `ctx.sleep()`, so the first occurrence
    // stays "running" indefinitely and durably occupies
    // `schedule.currentWorkflowId` — no `overlapPolicy: 'queue'` needed here
    // since this test only cares about the current-run branch
    // (`schedule-detail.svelte`'s `{#if schedule.currentWorkflowId}` block),
    // not the queued-runs branch. Waiting on the server-side
    // `currentWorkflowId` before mounting (rather than polling the DOM after
    // mount) keeps this deterministic instead of racing the engine's
    // scheduler the way an un-instrumented run and a `--coverage` run can
    // resolve differently.
    await server.engine.schedule({
      workflow: 'long-sleeper',
      id: 'current-run-probe',
      every: '50ms',
      input: { label: 'current-run-probe-run' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    await waitForServerState(async () => {
      const schedule = await client.getSchedule('current-run-probe');
      return schedule?.currentWorkflowId !== undefined;
    }, 'current-run-probe has a current run');

    try {
      const { getByText } = render(ScheduleDetailHarness, {
        props: { client, id: 'current-run-probe' },
      });

      const runningBadge = await waitFor(() => getByText('running'), { timeout: 5000 });
      expect(runningBadge).not.toBeNull();
      const currentRunLink = runningBadge.closest('a');
      expect(currentRunLink?.getAttribute('href')).toMatch(/^\/workflows\//);
    } finally {
      await server.stop();
    }
  }, 10000);

  test('recent runs (weft.workflows.list scheduleId filter, weft 0.13+) shows persisted history, not just live fires', async () => {
    const server = await startLiveSourceTestServer();
    // `inventory-sync-sweep` completes near-instantly (one activity call),
    // so within a couple of the engine's 1s scheduler polls it has both
    // fired and completed — real, persisted history reachable via
    // `fetchScheduleRunHistory`'s `scheduleId` filter, independent of
    // whether this page ever observes the live `schedule:fired` event.
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'history-probe',
      every: '50ms',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    await waitForServerState(async () => {
      const history = await client.list({ scheduleId: 'history-probe', limit: 20 });
      return history.items.some((run) => run.status === 'completed');
    }, 'history-probe has a completed run');

    try {
      const { getByText } = render(ScheduleDetailHarness, {
        props: { client, id: 'history-probe' },
      });

      const completedBadge = await waitFor(() => getByText('Completed'), { timeout: 5000 });
      expect(completedBadge).not.toBeNull();
      const runLink = completedBadge.closest('li')?.querySelector('a');
      expect(runLink?.getAttribute('href')).toMatch(/^\/workflows\//);
    } finally {
      await server.stop();
    }
  }, 10000);

  test('a paused schedule shows "Not scheduled" instead of a next-fires list', async () => {
    const server = await startLiveSourceTestServer();
    const handle = await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'weekly-digest',
      cron: '0 9 * * 1',
      input: { warehouseId: 'wh-main' },
    });
    await handle.pause();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(ScheduleDetailHarness, {
        props: { client, id: 'weekly-digest' },
      });

      await waitFor(() => expect(getByText('Not scheduled — schedule is paused.')).not.toBeNull());
    } finally {
      await server.stop();
    }
  });

  test('pause/resume toggles based on the current status, gated on schedules:write', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole } = render(ScheduleDetailHarness, {
        props: { client, id: 'nightly-rollup' },
      });

      const pauseButton = await waitFor(() => getByRole('button', { name: /Pause/ }));
      await fireEvent.click(pauseButton);

      await waitFor(() => expect(getByRole('button', { name: /Resume/ })).not.toBeNull());
    } finally {
      await server.stop();
    }
  });

  test('pause/cancel actions are disabled when schedules:write is missing', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole } = render(ScheduleDetailHarness, {
        props: { client, id: 'nightly-rollup', scopes: ['schedules:read'] },
      });

      await waitFor(() => {
        expect(
          requireElement(getByRole('button', { name: /Pause/ }), HTMLButtonElement).disabled,
        ).toBe(true);
      });
      expect(
        requireElement(getByRole('button', { name: /Cancel/ }), HTMLButtonElement).disabled,
      ).toBe(true);
    } finally {
      await server.stop();
    }
  });

  test('cancelling requires confirming the Tier-2 dialog', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole, getByText } = render(ScheduleDetailHarness, {
        props: { client, id: 'nightly-rollup' },
      });

      await waitFor(() => expect(getByRole('button', { name: /Cancel/ })).not.toBeNull());
      await fireEvent.click(getByRole('button', { name: /Cancel/ }));

      const dialog = await waitFor(() => getByRole('dialog'));
      await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel schedule' }));

      await waitFor(() => expect(getByText('Cancelled')).not.toBeNull());
    } finally {
      await server.stop();
    }
  });

  test('a fault (unreachable server) renders the fault banner with a retry action', async () => {
    const client = new HttpClient({ baseUrl: 'http://127.0.0.1:1' });

    const { getByRole } = render(ScheduleDetailHarness, {
      props: { client, id: 'nightly-rollup' },
    });

    await waitFor(() => expect(getByRole('button', { name: 'Retry' })).not.toBeNull(), {
      timeout: 3000,
    });
  });
});
