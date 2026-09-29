/**
 * Component test for the Workers dashboard card, against a real `HttpClient`
 * with a stubbed `fetch` responding to the exact `/jsonrpc` envelope
 * `httpClientCatalogTransport` sends (`weft/src/client/http-operations.ts`:
 * `{ jsonrpc: '2.0', method, params, id: method }` → `{ jsonrpc: '2.0', id,
 * result }`).
 *
 * Not a real-server integration test, though it could be one now:
 * `client.operations[...]` — the only way to call
 * `weft.workers.list`/`weft.tasks.diagnostics` (neither has an `HttpClient`
 * ergonomic method) — is JSON-RPC-over-HTTP-only, which
 * `startLiveSourceTestServer()`'s harness does serve as of
 * `@lostgradient/weft@0.12.0` (a real `serve()`, fixing the #710 gap this
 * comment used to describe). A stubbed transport stays the better choice
 * for THIS card specifically — it exercises deterministic aggregate shapes
 * and error bodies a real registry can't be coaxed into producing on
 * demand — but a real-server variant is now a viable follow-up, unlike
 * before.
 */
import { HttpClient, HttpClientError } from '@lostgradient/weft';
import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { installFetchImplementation } from '../../../lib/live-source/fetch-test-support.ts';
import WorkersCardTestHarness from './workers-card-test-harness.test-harness.svelte';

let restoreFetch = (): void => {};

afterEach(() => {
  restoreFetch();
});

interface JsonRpcHandlers {
  readonly [operationName: string]: unknown;
}

/** Stubs `fetch` to answer any `/jsonrpc` POST with a canned per-method result, mirroring `httpClientCatalogTransport`'s exact request/response envelope. */
function stubJsonRpc(handlers: JsonRpcHandlers): void {
  restoreFetch = installFetchImplementation(async (input, init) => {
    const request = new Request(input, init);
    const parsed: unknown = JSON.parse(await request.text());
    if (parsed === null || typeof parsed !== 'object')
      throw new Error('Malformed JSON-RPC request');
    const method = Reflect.get(parsed, 'method');
    const id = Reflect.get(parsed, 'id');
    if (typeof method !== 'string') throw new Error('JSON-RPC request has no method');
    if (!(method in handlers)) {
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', id, error: { message: 'unhandled', data: {} } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: handlers[method] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

const EMPTY_DIAGNOSTICS = {
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
};

describe('Workers dashboard card', () => {
  test('renders capacity/unhealthy stats once the queries resolve', async () => {
    stubJsonRpc({
      'weft.workers.list': {
        items: [
          {
            id: 'wkr_1',
            queue: 'default',
            activities: [],
            concurrency: 4,
            inFlight: 2,
            availableCapacity: 2,
            connectedAt: 0,
            lastHeartbeatAt: 0,
            startedAt: 0,
            heartbeatAgeMs: 1_000,
            capabilities: {},
            health: 'active',
          },
          {
            id: 'wkr_2',
            queue: 'default',
            activities: [],
            concurrency: 4,
            inFlight: 0,
            availableCapacity: 4,
            connectedAt: 0,
            lastHeartbeatAt: 0,
            startedAt: 0,
            heartbeatAgeMs: 1_000,
            capabilities: {},
            health: 'drained',
          },
        ],
        deployments: [],
        routingPolicy: 'least-loaded',
      },
      'weft.tasks.diagnostics': {
        ...EMPTY_DIAGNOSTICS,
        items: [
          { kind: 'stuck-queued', state: 'queued', retryCount: 0, requeueCount: 0, evidence: [] },
        ],
        summary: { ...EMPTY_DIAGNOSTICS.summary, stuckQueued: 1 },
      },
    });

    const client = new HttpClient({ baseUrl: 'https://weft.example.com' });
    const { getByText, findByText } = render(WorkersCardTestHarness, { props: { client } });

    expect(await findByText('2 / 8')).not.toBeNull();
    expect(getByText('1')).not.toBeNull(); // Unhealthy = 1 drained worker
    expect(getByText('Stuck queued')).not.toBeNull();
  });

  test('shows the locked state when the principal lacks system:read', async () => {
    stubJsonRpc({});
    const client = new HttpClient({ baseUrl: 'https://weft.example.com' });
    const { getByText } = render(WorkersCardTestHarness, { props: { client, scopes: [] } });

    expect(getByText('Locked')).not.toBeNull();
    expect(getByText('Requires system:read')).not.toBeNull();
  });

  test('shows the classified fault message on a query error', async () => {
    restoreFetch = installFetchImplementation(async () => {
      throw new HttpClientError(403, 'scope denied', { faultCode: 'Forbidden' });
    });

    const client = new HttpClient({ baseUrl: 'https://weft.example.com' });
    const { findByText } = render(WorkersCardTestHarness, { props: { client } });

    expect(await findByText('scope denied')).not.toBeNull();
  });
});
