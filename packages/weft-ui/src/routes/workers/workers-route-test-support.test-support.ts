/**
 * Test-only support for the Workers route root (`index.svelte`): a scripted
 * `globalThis.fetch` plus a real `HttpClient` pointed at it, so a component
 * test can drive `index.svelte` against canned JSON-RPC responses without a
 * live server. Mirrors the `ScriptedFetch`/`realClient` pattern already
 * established independently per-track (`src/lib/live-source/fleet-event-source.test.ts`,
 * `src/routes/system/system-test-support.test-support.ts`,
 * `src/routes/dashboard/dashboard-test-support.test-support.ts`,
 * `src/routes/workflows/list/workflow-test-support.test-support.ts`) rather
 * than importing another track's copy across the owned-paths boundary.
 */
import { HttpClient } from '@lostgradient/weft';

import { installFetchImplementation } from '../../lib/live-source/fetch-test-support.ts';

export interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

export function parseJsonObject(body: string): Record<string, unknown> | undefined {
  const parsed: unknown = JSON.parse(body);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? Object.fromEntries(Object.entries(parsed))
    : undefined;
}

export function taskLedgerDetailFixture() {
  return {
    state: 'queued',
    operationId: 'op_ledger_route',
    workflowId: 'wf_route',
    workflowExecutionToken: 'token_route',
    workflowType: 'orders',
    activityName: 'chargeCard',
    queue: 'payments',
    priority: 7,
    headerKeys: ['traceparent'],
    visibilityTimeoutMilliseconds: 30_000,
    retryPolicy: { maxAttempts: 3 },
    createdAt: 1_700_000_000_000,
    availableAt: 1_700_000_030_000,
    attempt: 2,
    retryCount: 1,
    requeueCount: 1,
  } as const;
}

interface RouteRule {
  readonly matches: (call: FetchCall) => boolean;
  readonly respond: (call: FetchCall) => Response | Promise<Response>;
}

function parsedJsonRpcMethod(call: FetchCall): string | undefined {
  if (typeof call.init?.body !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(call.init.body);
    if (parsed === null || typeof parsed !== 'object') return undefined;
    const method = Reflect.get(parsed, 'method');
    return typeof method === 'string' ? method : undefined;
  } catch {
    return undefined;
  }
}

export class ScriptedFetch {
  readonly calls: FetchCall[] = [];
  readonly #routes: RouteRule[] = [];
  readonly #restoreFetch: () => void;

  constructor() {
    this.#restoreFetch = installFetchImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const call: FetchCall = { url, init };
      this.calls.push(call);

      const route = this.#routes.findLast((candidate) => candidate.matches(call));
      if (route) return route.respond(call);

      throw new Error(`ScriptedFetch: no route registered for ${url}`);
    });
  }

  /** Standing route: any JSON-RPC request for `method` gets `result` as a success envelope. */
  routeJsonRpcMethod(method: string, result: unknown): void {
    this.#routes.push({
      matches: (call) => parsedJsonRpcMethod(call) === method,
      respond: () => Response.json({ jsonrpc: '2.0', id: 1, result }),
    });
  }

  /**
   * Standing route: any JSON-RPC request for `method` gets a JSON-RPC error
   * envelope back, in the exact shape `httpClientCatalogTransport` (`weft/src/client/http-operations.ts`)
   * decodes into an `HttpClientError` — `error.data.httpStatus`/`.weftCode`
   * carry the coarse status/fault code (the JSON-RPC transport always
   * responds HTTP 200, even for operation faults; the true status lives in
   * the envelope, not `response.status`).
   */
  routeJsonRpcMethodError(
    method: string,
    httpStatus: number,
    message: string,
    weftCode?: string,
  ): void {
    this.#routes.push({
      matches: (call) => parsedJsonRpcMethod(call) === method,
      respond: () =>
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32000,
            message,
            data: { httpStatus, ...(weftCode !== undefined ? { weftCode } : {}) },
          },
        }),
    });
  }

  /**
   * Standing route for a plain (non-JSON-RPC) REST call.
   */
  routeRest(match: (url: URL, method: string) => boolean, respond: () => Response): void {
    this.#routes.push({
      matches: (call) => match(new URL(call.url), call.init?.method ?? 'GET'),
      respond,
    });
  }

  /**
   * Standing route whose response stays pending until `resolve` is called —
   * for asserting a loading state that must survive an `await` (e.g.
   * `findByRole`/`fireEvent.click`) before the query settles. A plain
   * `routeJsonRpcMethod` resolves synchronously, so any awaited microtask
   * between mount and the assertion risks TanStack Query processing the
   * response first and flipping `loading` to `false` out from under the
   * test (flagged in WFC-10 PR #14 review).
   */
  deferJsonRpcMethod(method: string): { resolve: (result: unknown) => void } {
    let releaseResponse: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let pendingResult: unknown;
    this.#routes.push({
      matches: (call) => parsedJsonRpcMethod(call) === method,
      respond: async () => {
        await gate;
        return Response.json({ jsonrpc: '2.0', id: 1, result: pendingResult });
      },
    });
    return {
      resolve: (result: unknown) => {
        pendingResult = result;
        releaseResponse?.();
      },
    };
  }

  restore(): void {
    this.#restoreFetch();
  }
}

/** A real `HttpClient` instance for component tests that call `client.operations[...]` — pair with `ScriptedFetch` to script its responses. */
export function realClient(baseUrl = 'http://weft.test/api'): HttpClient {
  return new HttpClient({ baseUrl });
}
