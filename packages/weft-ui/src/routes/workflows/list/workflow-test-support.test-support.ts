/**
 * Test-only support for this track's component tests (list/start/aggregate).
 * Mirrors the `ScriptedFetch`/`realClient` pattern already established in
 * `src/routes/dashboard/dashboard-test-support.test-support.ts` and
 * `src/routes/system/system-test-support.test-support.ts` (T1.4's
 * `fleet-event-source.test.ts` is the original convention all three
 * follow) — kept as a small local copy rather than a cross-track import,
 * since `.test-support.ts` files stay inside their track's owned path
 * (PROJECT-BRIEF: "own your paths only"; the dashboard track's own copy
 * carries the identical note).
 *
 * Scripts `globalThis.fetch` so a REAL `HttpClient` (and therefore real
 * REST/JSON-RPC-over-HTTP request encoding) can be exercised in a
 * component test without booting an actual weft server.
 */
import { HttpClient } from '@lostgradient/weft';

import { installFetchImplementation } from '../../../lib/live-source/fetch-test-support.ts';

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

/** Scripts `globalThis.fetch`. `route*` responders are standing (order-independent, checked first); `enqueue*` is a strict FIFO fallback. */
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

      const route = this.#routes.find((candidate) => candidate.matches(call));
      if (route) return route.respond(call);

      const factory = this.#responses.shift();
      if (!factory) throw new Error(`ScriptedFetch: no more responses queued (called ${url})`);
      return factory(call);
    });
  }

  enqueueJson(body: unknown, init?: ResponseInit): void {
    this.#responses.push(() => Response.json(body, init));
  }

  enqueueStatus(status: number, statusText = ''): void {
    this.#responses.push(() => new Response(null, { status, statusText }));
  }

  /** Standing route: any request whose URL contains `urlSubstring` gets `body` as JSON. */
  routeUrl(urlSubstring: string, body: unknown, init?: ResponseInit): void {
    this.#routes.push({
      matches: (call) => call.url.includes(urlSubstring),
      respond: () => Response.json(body, init),
    });
  }

  /** Standing route variant returning a fixed HTTP status with no body. */
  routeUrlStatus(urlSubstring: string, status: number, statusText = ''): void {
    this.#routes.push({
      matches: (call) => call.url.includes(urlSubstring),
      respond: () => new Response(null, { status, statusText }),
    });
  }

  /**
   * Standing route for an SSE stream (`FleetEventSource` consumers) that
   * STAYS OPEN after delivering `chunks` — never closes on its own. Mirrors
   * `src/routes/system/system-test-support.test-support.ts`'s identical
   * `routeSseStream` (kept as a separate per-track copy — module doc):
   * `FleetEventSource` reconnects unconditionally on ANY stream end (no
   * fleet-level "done" signal), so a finite/closed response would
   * immediately trigger a reconnect loop instead of staying live for the
   * test.
   */
  routeSseStream(urlSubstring: string, chunks: readonly string[] = []): void {
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

  /** Standing route: any JSON-RPC request for `method` gets `result` as a success envelope. */
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

  /** Standing route: any JSON-RPC request for `method` gets a fault envelope with `data.httpStatus: 422` (Unprocessable). */
  routeJsonRpcMethodUnprocessable(method: string, message: string): void {
    this.#routes.push({
      matches: (call) => {
        if (typeof call.init?.body !== 'string') return false;
        try {
          return parsedJsonRpcMethod(call.init.body) === method;
        } catch {
          return false;
        }
      },
      respond: () =>
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32000, message, data: { httpStatus: 422 } },
        }),
    });
  }

  restore(): void {
    this.#restoreFetch();
  }
}

/** A real `HttpClient` instance for component tests — pair with `ScriptedFetch` to script its responses. */
export function realClient(baseUrl = 'http://weft.test/api'): HttpClient {
  return new HttpClient({ baseUrl });
}
