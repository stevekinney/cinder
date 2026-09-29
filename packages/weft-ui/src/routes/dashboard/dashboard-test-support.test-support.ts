/**
 * Test-only support for Dashboard track component tests. Mirrors the
 * `ScriptedFetch`/`realClient` pattern already established in
 * `src/routes/system/system-test-support.test-support.ts` (T1.4's
 * `fleet-event-source.test.ts` is the original convention both follow) —
 * kept as a small local copy rather than a cross-track import, since
 * `.test-support.ts` files still live inside their track's owned path
 * (PROJECT-BRIEF: "own your paths only").
 *
 * Needed because `client.operations['weft.<name>']` always dispatches
 * JSON-RPC-over-HTTP (`httpClientCatalogTransport`, `weft/src/client/
 * http-operations.ts`), and Dashboard card tests want deterministic,
 * per-scenario control over that response (aggregate shapes, error bodies,
 * malformed payloads) that a real engine can't be coaxed into producing on
 * demand. `live-source-test-server.test-support.ts`'s real `serve()`
 * instance does route `/jsonrpc` as of `@lostgradient/weft@0.12.0` (fixed
 * upstream: weft#710), so this module is a deliberate choice for
 * determinism, not a workaround for a missing route. Scripting `fetch`
 * against a REAL `HttpClient` instance exercises the real JSON-RPC
 * request/response encoding either way.
 */
import { HttpClient } from '@lostgradient/weft';

import { installFetchImplementation } from '../../lib/live-source/fetch-test-support.ts';

export interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
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

  /** Standing route: any JSON-RPC request for `method` gets a 403 Forbidden JSON-RPC error envelope. */
  routeJsonRpcMethodForbidden(method: string): void {
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
          error: { code: -32000, message: 'Forbidden', data: { httpStatus: 403 } },
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
