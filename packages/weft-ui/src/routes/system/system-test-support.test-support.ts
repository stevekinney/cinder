/**
 * Test-only support for Track E2 (System) tests: a scripted `globalThis.fetch`
 * plus a minimal `HttpClient`-shaped connection object, so tests can drive
 * `discovery-client.ts` and any component under test against canned
 * responses without a live server. Mirrors the `ScriptedFetch` pattern in
 * `src/lib/live-source/fleet-event-source.test.ts` (T1.4's own convention for
 * this exact need) rather than inventing a different one.
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

function parsedJsonRpcMethod(body: string): string | undefined {
  const parsed: unknown = JSON.parse(body);
  if (parsed === null || typeof parsed !== 'object') return undefined;
  const method = Reflect.get(parsed, 'method');
  return typeof method === 'string' ? method : undefined;
}

interface RouteRule {
  readonly matches: (call: FetchCall) => boolean;
  readonly respond: (call: FetchCall) => Response;
}

/**
 * Scripts `globalThis.fetch`, recording every call. Two complementary
 * dispatch modes:
 *
 *   - `enqueue*` — a strict FIFO queue, for tests where call order is
 *     deterministic (one fetch, then the next).
 *   - `route*` — a standing, order-independent responder keyed by URL
 *     substring or JSON-RPC method name, checked BEFORE the FIFO queue.
 *     Needed whenever a component fires two requests that race (e.g. a
 *     `PollingSource` poll and a `createQuery` both kicking off on mount) —
 *     real request ordering there is a scheduling detail, not something a
 *     test should assert on by queuing responses positionally. Routes are
 *     matched MOST-RECENTLY-REGISTERED-FIRST, so a test can register a
 *     blanket baseline for several URLs and then override just one with a
 *     later, more specific `route*` call.
 */
export class ScriptedFetch {
  readonly calls: FetchCall[] = [];
  readonly #responses: ((call: FetchCall) => Response)[] = [];
  readonly #routes: RouteRule[] = [];
  readonly #restoreFetch: () => void;

  constructor() {
    this.#restoreFetch = installFetchImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const call: FetchCall = { url, init };
      this.calls.push(call);

      const route = this.#routes.findLast((candidate) => candidate.matches(call));
      if (route) return route.respond(call);

      const factory = this.#responses.shift();
      if (!factory) throw new Error(`ScriptedFetch: no more responses queued (called ${url})`);
      return factory(call);
    });
  }

  enqueueJson(body: unknown, init?: ResponseInit): void {
    this.#responses.push(() => Response.json(body, init));
  }

  enqueueText(body: string, init?: ResponseInit): void {
    this.#responses.push(() => new Response(body, init));
  }

  enqueueStatus(status: number, statusText = ''): void {
    this.#responses.push(() => new Response(null, { status, statusText }));
  }

  /** Queues a JSON-RPC 2.0 SUCCESS envelope — the shape `HttpClient.operations[...]`/`.call(...)` expects back from `POST {baseUrl}/jsonrpc` (`httpClientCatalogTransport`, `weft/src/client/http-operations.ts`). */
  enqueueJsonRpcResult(result: unknown): void {
    this.enqueueJson({ jsonrpc: '2.0', id: 1, result });
  }

  /** Standing route: any request whose URL contains `urlSubstring` gets `body` as JSON, regardless of call order. */
  routeUrl(urlSubstring: string, body: unknown, init?: ResponseInit): void {
    this.#routes.push({
      matches: (call) => call.url.includes(urlSubstring),
      respond: () => Response.json(body, init),
    });
  }

  /** Standing route matched on EXACT URL equality — for when a substring match would be ambiguous (e.g. `/mcp` is also a substring of `/.well-known/mcp.json`). */
  routeExactUrl(url: string, body: unknown, init?: ResponseInit): void {
    this.#routes.push({
      matches: (call) => call.url === url,
      respond: () => Response.json(body, init),
    });
  }

  /** Standing route variant of `routeUrl` for a plain-text response (e.g. `/v1/metrics`'s Prometheus exposition), which isn't JSON-encoded. */
  routeUrlText(urlSubstring: string, body: string, init?: ResponseInit): void {
    this.#routes.push({
      matches: (call) => call.url.includes(urlSubstring),
      respond: () => new Response(body, init),
    });
  }

  /**
   * Standing route for an SSE stream (`FleetEventSource`/`WorkflowTailSource`
   * consumers) that STAYS OPEN after delivering `chunks` — never closes on
   * its own. Mirrors `fleet-event-source.test.ts`'s `openSseResponse`
   * (T1.4's own convention): `FleetEventSource` reconnects unconditionally
   * on ANY stream end (there's no fleet-level "done" signal), so a response
   * built from a plain string/finite stream immediately triggers a
   * reconnect loop the instant it's drained — an explicit, never-closing
   * `ReadableStream` is required, not a shortcut.
   */
  routeSseStream(urlSubstring: string, chunks: readonly string[]): void {
    this.#routes.push({
      matches: (call) => call.url.includes(urlSubstring),
      respond: () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          },
        });
        return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
      },
    });
  }

  /** Standing route variant of `routeUrl` returning a fixed HTTP status with no body — for testing a fault path on a specific URL without disturbing other routed/queued responses. */
  routeUrlStatus(urlSubstring: string, status: number, statusText = ''): void {
    this.#routes.push({
      matches: (call) => call.url.includes(urlSubstring),
      respond: () => new Response(null, { status, statusText }),
    });
  }

  /** Standing route: any JSON-RPC request for `method` gets `result` as a success envelope, regardless of call order — the JSON-RPC-equivalent of `routeUrl`, since every JSON-RPC call shares one URL and only the request BODY distinguishes the operation. */
  routeJsonRpcMethod(method: string, result: unknown): void {
    this.#routes.push({
      matches: (call) => {
        if (typeof call.init?.body !== 'string') return false;
        try {
          return parsedJsonRpcMethod(call.init.body) === method;
        } catch {
          return false;
        }
      },
      respond: () => Response.json({ jsonrpc: '2.0', id: 1, result }),
    });
  }

  /**
   * Standing route: any JSON-RPC request for `method` resolves only once
   * `result` does, as a success envelope. The one way to hold a request
   * genuinely in flight while a test drives the UI around it — `routeJsonRpcMethod`
   * resolves as fast as the microtask queue allows, which leaves no window to
   * observe mid-flight behavior (the same timing limitation
   * `workflow-revisions-view.ts`'s `isBackgroundRefreshing` doc describes for
   * background-fetch indicators).
   */
  routeJsonRpcDeferred(method: string, result: Promise<unknown>): void {
    this.#routes.push({
      matches: (call) => {
        if (typeof call.init?.body !== 'string') return false;
        try {
          return parsedJsonRpcMethod(call.init.body) === method;
        } catch {
          return false;
        }
      },
      // `RouteRule.respond` is synchronous, so the awaiting happens inside the
      // `Response` body rather than before it: a streamed body the fetch
      // caller cannot finish reading until `result` settles, which is exactly
      // "the request has not come back yet" from the client's point of view.
      respond: () =>
        new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              const resolved = await result;
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({ jsonrpc: '2.0', id: 1, result: resolved }),
                ),
              );
              controller.close();
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    });
  }

  /**
   * Standing route: any JSON-RPC request for `method` gets a JSON-RPC ERROR
   * envelope back, regardless of call order — the error-response sibling of
   * `routeJsonRpcMethod`. Shape mirrors what `httpClientCatalogTransport`
   * (`@lostgradient/weft`, `http-operations.ts`) actually parses:
   * `error.data.httpStatus` drives `HttpClientError.status`, `error.data.weftCode`
   * (a coarse `FaultCode`, e.g. `'Conflict'`) drives `.faultCode`, and the full
   * `error.data` object is forwarded verbatim as `.data` — so a caller wanting a
   * `WorkflowCatalogActivationResult` refusal's `compatibilityReasons`/
   * `currentGeneration` on `HttpClientError.data` passes them here as `data`.
   */
  routeJsonRpcError(
    method: string,
    error: { code: number; message: string; data?: Record<string, unknown> },
  ): void {
    this.#routes.push({
      matches: (call) => {
        if (typeof call.init?.body !== 'string') return false;
        try {
          return parsedJsonRpcMethod(call.init.body) === method;
        } catch {
          return false;
        }
      },
      respond: () => Response.json({ jsonrpc: '2.0', id: 1, error }),
    });
  }

  restore(): void {
    this.#restoreFetch();
  }
}

/** The minimal slice of `HttpClient` every `discovery-client.ts`/component consumer needs. */
export function fakeClient(
  baseUrl = 'http://weft.test/api',
): Pick<HttpClient, 'baseUrl' | 'headers'> {
  return { baseUrl, headers: {} };
}

/** A real `HttpClient` instance for component tests that call ergonomic methods or `client.operations[...]` — pair with `ScriptedFetch` to script its responses. */
export function realClient(baseUrl = 'http://weft.test/api'): HttpClient {
  return new HttpClient({ baseUrl });
}
