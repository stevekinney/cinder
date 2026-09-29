/**
 * Dashboard health probe (plan §9.1: "full-page server-unreachable
 * treatment on health-probe failure"). Mirrors the shell's own
 * `/v1/health` check (`src/app/engine-status.svelte.ts`'s private
 * `checkHealth`) — that helper isn't exported and the shell's
 * `EngineStatusController` instance isn't reachable from route components
 * (no context/prop path exists; see this track's final report), so the
 * dashboard runs its own probe against the same anonymous liveness route
 * rather than reaching into shell internals.
 */
import type { HttpClient } from '@lostgradient/weft';

/**
 * Resolves `true` when `GET {baseUrl}/v1/health` responds `ok`; throws
 * otherwise (network failure or a non-2xx status). The thrown error is a
 * plain `Error`, not an `HttpClientError` — `/v1/health` is outside the
 * Weft fault wire (plan Appendix A: it is one of the seven root-stable,
 * unauthenticated discovery routes), so there is no fault code to carry.
 * Resolves `true` rather than `void` so TanStack Query's `queryFn` never
 * settles to `undefined` data (mirrors `src/app/engine-status.svelte.ts`'s
 * own `checkHealth` return type for the same reason).
 */
export async function probeHealth(client: Pick<HttpClient, 'baseUrl' | 'headers'>): Promise<true> {
  const response = await fetch(`${client.baseUrl}/v1/health`, { headers: client.headers });
  if (!response.ok) {
    throw new Error(`weft-ui: /v1/health responded ${response.status}`);
  }
  return true;
}
