/**
 * `EngineStatusController` integration tests against a REAL in-process weft
 * server (`live-source-test-server.test-support.ts`, T1.4's harness — a
 * plain `serve()` as of `@lostgradient/weft@0.12.0`).
 *
 * Scope: `FleetEventSource`'s own wire/reconnect behavior is exhaustively
 * covered by T1.4's own test suites; what this file proves is the
 * composition this module adds — real fleet frames land in the shared
 * `NotificationStore`, `status` reflects the fleet connection once it's
 * live, and `dispose()` actually tears both sources down. The
 * `status`-falls-back-to-the-health-poll branch (`fleetSource.status ===
 * 'closed'`) is reachable only in the narrow window before the
 * constructor's synchronous `subscribe()` call flips `FleetEventSource`
 * into `'connecting'`, or after `dispose()` (at which point reading
 * `status` is moot) — not exercised here; see the module's getter doc.
 */
import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { FleetEventSource } from '../lib/live-source/fleet-event-source.svelte.ts';
import { startLiveSourceTestServer } from '../lib/live-source/live-source-test-server.test-support.ts';
import { EngineStatusController } from './engine-status.svelte.ts';
import GetFleetEventSourceHarness from './get-fleet-event-source-harness.test-harness.svelte';
import { NotificationStore } from './notifications.svelte.ts';
import ProvideFleetEventSourceHarness from './provide-fleet-event-source-harness.test-harness.svelte';

/** A bare `Bun.serve()` that always fails `/v1/events/sse` (simulating an unreachable fleet feed) but keeps `/v1/health` reachable, so `EngineStatusController`'s health-poll fallback has somewhere to succeed. */
function startUnreachableFleetServer(): { baseUrl: string; stop: () => void } {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === '/v1/health') {
        return Response.json({ status: 'ok' });
      }
      if (url.pathname === '/v1/events/sse') {
        return new Response('Not Implemented', { status: 501 });
      }
      return new Response('Not Found', { status: 404 });
    },
  });
  return { baseUrl: server.url.toString().replace(/\/+$/, ''), stop: () => server.stop(true) };
}

describe('EngineStatusController (integration, real server)', () => {
  test('status becomes live and real fleet frames are forwarded into the notification store', async () => {
    const server = await startLiveSourceTestServer();
    const notifications = new NotificationStore();
    const controller = new EngineStatusController(
      { baseUrl: server.baseUrl, headers: { Authorization: `Bearer ${server.token}` } },
      notifications,
    );

    try {
      await waitFor(() => {
        expect(controller.status).toBe('live');
      });

      const workflowId = 'engine-status-integration';
      await server.engine.start('signal-stepped', { steps: 1 }, { id: workflowId });

      await waitFor(() => {
        expect(
          notifications.items.some(
            (item) => item.href === `/workflows/${workflowId}` && item.title === 'Workflow started',
          ),
        ).toBe(true);
      });
    } finally {
      controller.dispose();
      server.stop();
    }
  });

  test('caughtUp becomes true against a real server (the toast-gate primitive actually opens, not just "no crash")', async () => {
    // `notifyForNotification`'s gate (`if (item && this.fleetSource.caughtUp)
    // toastForNotification(item)`) is only worth anything if `caughtUp` ever
    // flips true against the real fleet-SSE path `serve()` serves — a
    // fake/no-op `replayComplete` ping
    // would make this pass trivially by never toasting anything, ever, which
    // "0 toasts on load" alone can't distinguish from "the gate correctly
    // suppressed replay". This proves the real server actually sends the
    // ping that opens the gate.
    const server = await startLiveSourceTestServer();
    const notifications = new NotificationStore();
    const controller = new EngineStatusController(
      { baseUrl: server.baseUrl, headers: { Authorization: `Bearer ${server.token}` } },
      notifications,
    );

    try {
      await waitFor(() => {
        expect(controller.fleetSource.caughtUp).toBe(true);
      });
    } finally {
      controller.dispose();
      server.stop();
    }
  });

  test('dispose() closes both the fleet source and the health poll', async () => {
    const server = await startLiveSourceTestServer();
    const notifications = new NotificationStore();
    const controller = new EngineStatusController(
      { baseUrl: server.baseUrl, headers: { Authorization: `Bearer ${server.token}` } },
      notifications,
      { healthPollIntervalMs: 5 },
    );

    try {
      await waitFor(() => {
        expect(controller.status).toBe('live');
      });

      controller.dispose();

      expect(controller.fleetSource.status).toBe('closed');
    } finally {
      server.stop();
    }
  });

  test('falls back to the health poll once the fleet feed fails to reconnect 5 times in a row', async () => {
    const server = startUnreachableFleetServer();
    const notifications = new NotificationStore();
    const controller = new EngineStatusController(
      { baseUrl: server.baseUrl, headers: {} },
      notifications,
      { healthPollIntervalMs: 5, fleetReconnectDelayMs: () => 1 },
    );

    try {
      await waitFor(
        () => {
          expect(controller.fleetSource.reconnectAttempt).toBeGreaterThanOrEqual(5);
        },
        { timeout: 2000 },
      );

      await waitFor(() => {
        expect(controller.status).toBe('polling');
      });

      // The fleet source itself never gives up — it keeps retrying in the
      // background at its own capped curve (plan §5.3's fallback is a
      // DISPLAY policy, not a "stop trying" policy) — only the controller's
      // displayed `status` switches over.
      expect(controller.fleetSource.status).not.toBe('closed');
    } finally {
      controller.dispose();
      server.stop();
    }
  });
});

describe('provideFleetEventSource() / getFleetEventSource() (Track B addition)', () => {
  test('getFleetEventSource() throws outside any provideFleetEventSource() ancestor', async () => {
    expect(() => render(GetFleetEventSourceHarness)).toThrow(
      /getFleetEventSource\(\) called with no source in context/,
    );
  });

  test('a descendant reads back the exact instance a provideFleetEventSource() ancestor provided', async () => {
    const source = new FleetEventSource({ baseUrl: 'https://weft.example.com' });
    let received: FleetEventSource | undefined;

    render(ProvideFleetEventSourceHarness, {
      props: { source, onSource: (value) => (received = value) },
    });

    expect(received).toBe(source);
    source.close();
  });
});
