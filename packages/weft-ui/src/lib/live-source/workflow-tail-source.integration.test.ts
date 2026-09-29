/**
 * Integration tests for `WorkflowTailSource` against a REAL in-process weft
 * server (`live-source-test-server.test-support.ts`, a plain `serve()`) — no
 * mock server.
 *
 * Uses the `signal-stepped` fixture (`fixtures/workflows.ts`) specifically
 * so this suite can drive checkpoint commits deterministically —
 * `engine.signal(id, 'advance')` — rather than racing real wall-clock
 * timing against a fast-completing workflow.
 *
 * **Scope.** `client.tail()`'s own reconnect/catch-up mechanics are weft's
 * to test (and are — `weft/src/client/event-stream.test.ts`); this source's
 * OWN added value — the outer capped-exponential reconnect layer, positional
 * dedup across reconnects, the pre-attach buffer, terminal-event detection —
 * is exhaustively covered against a scripted fake tail in
 * `workflow-tail-source.test.ts` (deterministic, no server, no real
 * timers). What genuinely needs a real server is proving the WIRE
 * INTEGRATION holds: a real `HttpClient`, real SSE framing, real engine
 * execution driving real committed events, catch-up-then-live delivery
 * through `WorkflowTailSource` end to end. A literal mid-stream network
 * drop has no test-side hook here (Bun's `fetch`/`ReadableStream` gives no
 * way to sever an in-flight SSE response without either killing the whole
 * server or reaching into the operation's own internal `AbortController`,
 * which weft's server does not expose) — "reconnect resume without
 * dup/skip" is proven instead by opening a second, independent tail after
 * more events have committed and confirming its OWN catch-up (the same
 * mechanism a reconnect's fresh `client.tail()` call relies on) delivers
 * everything exactly once, in order.
 */
import type { WorkflowEvent } from '@lostgradient/weft';
import { HttpClient } from '@lostgradient/weft';
import { waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import {
  startLiveSourceTestServer,
  type LiveSourceTestServer,
} from './live-source-test-server.test-support.ts';
import { WorkflowTailSource } from './workflow-tail-source.svelte.ts';

/**
 * `client.tail()` defaults to `eventTransport: 'auto'` (WebSocket first, real
 * `serve()` supports both) — this suite forces SSE deliberately so the SSE
 * transport keeps dedicated coverage rather than being shadowed by the
 * default WS path every run.
 */
function sseClient(server: LiveSourceTestServer): HttpClient {
  return new HttpClient({ baseUrl: server.baseUrl, token: server.token, eventTransport: 'sse' });
}

async function startSignalStepped(
  server: LiveSourceTestServer,
  workflowId: string,
  steps: number,
): Promise<void> {
  await server.engine.start('signal-stepped', { steps }, { id: workflowId });
}

describe('WorkflowTailSource (integration, real server)', () => {
  test('whenConnected resolves after catch-up, then delivers live frames driven by real engine activity', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const workflowId = 'wts-integration-catchup-live';
      await startSignalStepped(server, workflowId, 3);

      // Commit one step before subscribing so catch-up has a deterministic
      // persisted frame. Waiting for wall-clock time does not prove that the
      // workflow has reached its signal boundary or committed anything.
      await server.engine.signal(workflowId, 'advance');

      const client = sseClient(server);
      const source = new WorkflowTailSource(client, workflowId);
      const received: WorkflowEvent[] = [];
      source.subscribe((frame) => received.push(frame));

      await source.whenConnected();
      expect(source.status).toBe('live');
      await waitFor(() => {
        expect(received.length).toBeGreaterThan(0);
      });
      const catchUpCount = received.length;

      // Drive a genuinely LIVE checkpoint through real engine execution.
      await server.engine.signal(workflowId, 'advance');

      await waitFor(() => {
        expect(received.length).toBeGreaterThan(catchUpCount);
      });

      source.close();
    } finally {
      await server.stop();
    }
  });

  test('a second, independent tail catches up to everything committed so far exactly once, in order (the mechanism reconnect relies on)', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const workflowId = 'wts-integration-second-tail';
      await startSignalStepped(server, workflowId, 3);
      await server.engine.signal(workflowId, 'advance');
      await server.engine.signal(workflowId, 'advance');

      const firstClient = sseClient(server);
      const firstSource = new WorkflowTailSource(firstClient, workflowId);
      const firstReceived: WorkflowEvent[] = [];
      firstSource.subscribe((frame) => firstReceived.push(frame));
      await firstSource.whenConnected();
      await waitFor(() => {
        expect(firstReceived.length).toBeGreaterThanOrEqual(2);
      });
      firstSource.close();

      // A fresh tail (what a reconnect opens) independently catches up to
      // the SAME committed history — no duplicates, no gaps, same order.
      const secondClient = sseClient(server);
      const secondSource = new WorkflowTailSource(secondClient, workflowId);
      const secondReceived: WorkflowEvent[] = [];
      secondSource.subscribe((frame) => secondReceived.push(frame));
      await secondSource.whenConnected();
      await waitFor(() => {
        expect(secondReceived.length).toBeGreaterThanOrEqual(firstReceived.length);
      });

      expect(secondReceived.slice(0, firstReceived.length)).toEqual(firstReceived);
      // No duplicate (type, data) pairs within the second tail's own delivery.
      const seen = new Set(
        secondReceived.map((frame) => `${frame.type}:${JSON.stringify(frame.data)}`),
      );
      expect(seen.size).toBe(secondReceived.length);

      secondSource.close();
    } finally {
      await server.stop();
    }
  });

  test('close() stops delivery — no further frames arrive after close', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const workflowId = 'wts-integration-close';
      await startSignalStepped(server, workflowId, 2);
      await server.engine.signal(workflowId, 'advance');

      const client = sseClient(server);
      const source = new WorkflowTailSource(client, workflowId);
      const received: WorkflowEvent[] = [];
      source.subscribe((frame) => received.push(frame));
      await source.whenConnected();

      // `whenConnected()` resolving (the `replayComplete` ping) does not by
      // itself guarantee every catch-up frame ahead of that ping has
      // finished its own delivery microtask — let catch-up fully settle
      // before taking the "at close" baseline, or this test would be
      // asserting on an inherent delivery race rather than close()'s
      // actual behavior.
      await waitFor(() => {
        expect(received.length).toBeGreaterThan(0);
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      source.close();
      expect(source.status).toBe('closed');
      const countAtClose = received.length;

      await server.engine.signal(workflowId, 'advance');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(received.length).toBe(countAtClose);
    } finally {
      await server.stop();
    }
  });
});
