/**
 * Test-only support module (never imported by production code). Boots a
 * REAL in-process weft server for `LiveSource` integration tests — no mock
 * server, and (as of `@lostgradient/weft@0.12.0`) no app-local composition
 * either: a plain `serve({ engine, port: 0, auth: {...} })`.
 *
 * **Why this is `serve()` now, not `handleRequest()`.** Earlier revisions of
 * this module built a hand-rolled `Bun.serve()` delegating to
 * `@lostgradient/weft`'s `handleRequest()`, with a synthetic
 * per-workflow event feed reimplementing what weft's own (then-unexported)
 * production wiring did — worked around
 * https://github.com/stevekinney/weft/issues/710 (`serve()` threw "Engine
 * internals not initialized" for any root-imported `Engine`) and
 * https://github.com/stevekinney/weft/issues/714 (the per-workflow feed
 * constructor wasn't exported from any public subpath). Both shipped in
 * 0.12.0 (#716, #718) — confirmed empirically (`bun add
 * @lostgradient/weft@0.12.0` + a real `serve({ engine, port: 0 })` call
 * here, no cast, no synthetic feed, WebSocket upgrades included).
 *
 * **`bridgeWorkflowEvents()` is gone, not just renamed.** The old per-workflow
 * bridge existed because the hand-rolled feed could only replay events it had
 * already captured live — a workflow started before the bridge attached lost
 * its early history. `serve()`'s real per-workflow feed
 * (`createEngineEventFeedBackend`) replays directly from the engine's own
 * durable checkpoint log (`engine.replayWorkflowFeed`), so any workflow's
 * full history is always replayable regardless of when a client subscribes —
 * there is nothing left to pre-wire.
 *
 * **Auth is a real, scoped API key — NOT `unauthenticatedAccess`.**
 * `unauthenticatedAccess` only controls whether `serve()` refuses to *start*
 * with no `auth` configured; it has no per-request effect
 * (`assertAuthenticationPosture`,
 * `weft/src/server/serve-internals.ts`). A credential-less request always
 * resolves to `anonymousPrincipal()` (zero scopes,
 * `weft/src/server/handler/auth-context-principal.ts`) regardless of that
 * option — confirmed empirically (live `curl` against a real
 * `serve({ unauthenticatedAccess: 'allow' })` instance 401s
 * `GET /v1/schedules`, which declares `access: { kind: 'authenticated' }`).
 * The old `handleRequest()`-based harness never hit this: it hand-injected a
 * full-scope `principalFromStdioLocal()` `authContext` on every call,
 * bypassing authentication entirely. `serve()` has no equivalent hook, so
 * this module instead configures one real, full-scope static API key
 * (`auth.apiKeys` + `defaultApiKeyScopes: AUTHORIZATION_SCOPES`) and exposes
 * it as `LiveSourceTestServer.token` for every caller to present — the
 * supported way to get elevated access through a real `serve()` instance.
 * Reuses `src/lib/scopes.svelte.ts`'s `AUTHORIZATION_SCOPES` rather than a
 * second hand-copy of weft's (not-yet-publicly-exported) scope vocabulary.
 */
import { Engine, serve } from '@lostgradient/weft';

import { workflows } from '../../../fixtures/workflows.ts';
import { AUTHORIZATION_SCOPES } from '../scopes.svelte.ts';

async function createTestEngine() {
  return Engine.create({ workflows });
}

/** Not a secret — a fixed, well-known key for an ephemeral, localhost-only, per-test `MemoryStorage` server. */
const TEST_API_KEY = 'live-source-test-server-key';

export interface LiveSourceTestServer {
  /** Canonical, unprefixed base URL (e.g. `http://localhost:PORT`) — no `/api` prefix, matching what `HttpClient`/`FleetEventSource` request against directly (`${baseUrl}/v1${path}`). */
  readonly baseUrl: string;
  /** Full-scope bearer token — pass as `new HttpClient({ baseUrl, token })` / `new FleetEventSource({ baseUrl, headers: { Authorization: \`Bearer ${token}\` } })` so `access: 'scoped'`/`'authenticated'` operations succeed. */
  readonly token: string;
  readonly engine: Awaited<ReturnType<typeof createTestEngine>>;
  stop(): Promise<void>;
}

export async function startLiveSourceTestServer(): Promise<LiveSourceTestServer> {
  const engine = await createTestEngine();
  const server = serve({
    engine,
    port: 0,
    auth: { apiKeys: [TEST_API_KEY], defaultApiKeyScopes: AUTHORIZATION_SCOPES },
  });

  return {
    baseUrl: server.url.replace(/\/+$/, ''),
    token: TEST_API_KEY,
    engine,
    stop: () => server.stop(),
  };
}
