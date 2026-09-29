/**
 * Fetches weft's root-stable discovery documents (plan Appendix A: "root-
 * stable: /v1/health, /v1/metrics, /openapi.json, /openrpc.json,
 * /asyncapi.json, /.well-known/{api-catalog,mcp.json}"; T7.3, System →
 * Discovery tab).
 *
 * ## Why this reads `fetch()` directly instead of going through `HttpClient`
 *
 * `HttpClient` (`@lostgradient/weft`) has no method for any of these
 * five documents — verified against its full public surface
 * (`weft/src/client/http-client.ts` v0.11.0): every ergonomic method and
 * `client.operations[...]`/`client.call(...)` model the *functional* API
 * (workflows, schedules, reviews, …), and these routes are explicitly
 * carved out of that: `weft/src/server/route-model.ts`'s module doc says
 * they "remain at the origin root per RFC 9264 / discovery convention" and
 * are excluded from the `/api` external-prefix namespacing every functional
 * route gets. They're public, unauthenticated, self-describing JSON
 * documents — the same ones any HTTP client or `curl` would fetch, not a
 * Weft SDK concern — so a scoped `fetch()` to exactly these well-known paths
 * is the correct answer here, not a gap to route around.
 *
 * `discoveryOrigin()` derives the request origin from the app's already-
 * resolved `HttpClient.baseUrl` (always an absolute URL post-`client.ts`
 * resolution) rather than hardcoding a root-relative path, so this keeps
 * working under the standalone/cross-origin deployment mode (plan §3.4)
 * where the console and the weft server are NOT the same origin — a bare
 * `fetch('/openapi.json')` would silently hit the console's own origin
 * instead.
 */
import type { HttpClient } from '@lostgradient/weft';

export type DiscoveryDocumentKind = 'openapi' | 'openrpc' | 'asyncapi' | 'mcp' | 'metrics';

const DISCOVERY_DOCUMENT_PATH: Readonly<Record<DiscoveryDocumentKind, string>> = {
  openapi: '/openapi.json',
  openrpc: '/openrpc.json',
  asyncapi: '/asyncapi.json',
  mcp: '/.well-known/mcp.json',
  metrics: '/v1/metrics',
};

/** The origin every root-stable discovery document is fetched from — the weft server's own origin, derived from `client.baseUrl`. */
export function discoveryOrigin(client: Pick<HttpClient, 'baseUrl'>): string {
  return new URL(client.baseUrl).origin;
}

/**
 * Thrown for a non-2xx discovery-document response. Kept distinct from
 * `HttpClientError` (these routes never cross the Weft fault wire — no
 * `FaultCode`, no JSON-RPC envelope) so callers don't run `classifyFault` on
 * something it was never designed to classify.
 */
export class DiscoveryFetchError extends Error {
  readonly status: number;
  readonly kind: DiscoveryDocumentKind;

  constructor(kind: DiscoveryDocumentKind, status: number, statusText: string) {
    super(`${DISCOVERY_DOCUMENT_PATH[kind]} responded ${status} ${statusText}`.trim());
    this.name = 'DiscoveryFetchError';
    this.status = status;
    this.kind = kind;
  }
}

/**
 * Fetches and JSON-parses one discovery document. `mcp` legitimately 503s
 * when the server has no `publicOrigin`/`trustedHosts` configured (plan
 * §9.7: "note publicOrigin/trustedHosts 503 behavior with an actionable
 * message") — callers distinguish that case via `error.status === 503` on
 * the thrown `DiscoveryFetchError`, not a special return value, so every
 * document kind shares one fetch/parse code path.
 */
export async function fetchDiscoveryDocument(
  client: Pick<HttpClient, 'baseUrl' | 'headers'>,
  kind: DiscoveryDocumentKind,
): Promise<unknown> {
  const url = `${discoveryOrigin(client)}${DISCOVERY_DOCUMENT_PATH[kind]}`;
  const response = await fetch(url, { headers: client.headers });
  if (!response.ok) throw new DiscoveryFetchError(kind, response.status, response.statusText);
  return response.json();
}

/**
 * Fetches the raw Prometheus text exposition at `GET /v1/metrics` (plan
 * §9.7: "raw Prometheus text ... in CodeBlock + copy/download") — a
 * `text/plain` sibling of the JSON discovery documents above, sharing the
 * same root-stable-origin derivation.
 */
export async function fetchRawMetricsText(
  client: Pick<HttpClient, 'baseUrl' | 'headers'>,
): Promise<string> {
  const url = `${discoveryOrigin(client)}${DISCOVERY_DOCUMENT_PATH.metrics}`;
  const response = await fetch(url, { headers: client.headers });
  if (!response.ok) throw new DiscoveryFetchError('metrics', response.status, response.statusText);
  return response.text();
}
