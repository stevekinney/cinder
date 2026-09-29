/**
 * Integration coverage for `resolvePrincipal()` against REAL `serve()`
 * instances (plan §11.3: no mock server) — the three-way boot contract in
 * `scopes.svelte.ts`'s module doc, proven on the wire rather than asserted
 * from a stub.
 *
 * Two server shapes are needed because the distinction the console draws is
 * a property of the SERVER's auth posture, not of the request:
 *
 * - **auth configured** — a valid key resolves to an authenticated principal
 *   carrying exactly the scopes that key was granted, and a credential-less
 *   caller is rejected with `401` **even though `weft.system.principal`
 *   declares `access: 'public'`**. That second assertion is the load-bearing
 *   one: the whole mapping rests on "an auth-configured weft never answers
 *   anonymously," so the console can treat a `method: 'unauthenticated'`
 *   response as proof the server has no `auth` at all. If a future weft ever
 *   let public operations through unauthenticated, this test fails and the
 *   `'warn'` banner would start lying — hence pinning it here rather than
 *   trusting the prose.
 * - **no auth configured** — the anonymous caller is served, reporting
 *   `method: 'unauthenticated'` with zero scopes.
 *
 * `port: 0` gives each server an ephemeral port so these can run alongside
 * the other integration suites without collisions.
 */
import { Engine, HttpClient, serve } from '@lostgradient/weft';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { throwingRejectionOf } from '@lostgradient/testing';
import { workflows } from '../../fixtures/workflows.ts';
import { resolvePrincipal, type AuthorizationScope } from './scopes.svelte.ts';

/** Not a secret — a fixed key for an ephemeral, localhost-only test server. */
const TEST_API_KEY = 'scopes-integration-key';

/**
 * A deliberately PARTIAL grant. A full-scope key would pass even if
 * `resolvePrincipal()` ignored the response and returned the whole
 * vocabulary (the pre-0.18.0 optimistic behavior), so the assertion below
 * would not distinguish the new implementation from the old one.
 */
const GRANTED_SCOPES: readonly AuthorizationScope[] = ['workflows:read', 'system:read'];

async function createTestEngine() {
  return Engine.create({ workflows });
}

let authedEngine: Awaited<ReturnType<typeof createTestEngine>>;
let anonymousEngine: Awaited<ReturnType<typeof createTestEngine>>;
let authedServer: ReturnType<typeof serve>;
let anonymousServer: ReturnType<typeof serve>;
let authedBaseUrl: string;
let anonymousBaseUrl: string;

beforeAll(async () => {
  authedEngine = await createTestEngine();
  authedServer = serve({
    engine: authedEngine,
    port: 0,
    auth: { apiKeys: [TEST_API_KEY], defaultApiKeyScopes: GRANTED_SCOPES },
  });
  authedBaseUrl = authedServer.url.replace(/\/+$/, '');

  anonymousEngine = await createTestEngine();
  anonymousServer = serve({
    engine: anonymousEngine,
    port: 0,
    unauthenticatedAccess: 'allow',
  });
  anonymousBaseUrl = anonymousServer.url.replace(/\/+$/, '');
});

afterAll(async () => {
  await authedServer.stop();
  await anonymousServer.stop();
  await authedEngine.shutdown();
  await anonymousEngine.shutdown();
});

describe('resolvePrincipal against a real auth-configured serve()', () => {
  test('a valid credential resolves to exactly the scopes that key was granted', async () => {
    const client = new HttpClient({ baseUrl: authedBaseUrl, token: TEST_API_KEY });

    const principal = await resolvePrincipal(client);

    expect(principal).not.toBeNull();
    expect(principal?.unauthenticatedAccess).toBeNull();
    // Exactly the granted pair — NOT the full 21-scope vocabulary. This is
    // the assertion the pre-0.18.0 optimistic implementation could not pass.
    expect([...(principal?.scopes ?? [])].toSorted()).toEqual([...GRANTED_SCOPES].toSorted());
  });

  test('a credential-less caller is rejected with 401 even on this public operation', async () => {
    const client = new HttpClient({ baseUrl: authedBaseUrl });

    // Not an anonymous principal — no principal at all, which is what drives
    // the console to its API-key entry surface.
    expect(await resolvePrincipal(client)).toBeNull();
  });

  test('an invalid credential is likewise rejected, indistinguishably from none', async () => {
    const client = new HttpClient({ baseUrl: authedBaseUrl, token: 'not-the-key' });

    expect(await resolvePrincipal(client)).toBeNull();
  });
});

describe('resolvePrincipal against a real serve() with no auth configured', () => {
  test('the anonymous caller is served, with zero scopes and the warn banner', async () => {
    const client = new HttpClient({ baseUrl: anonymousBaseUrl });

    const principal = await resolvePrincipal(client);

    expect(principal).toEqual({ scopes: [], unauthenticatedAccess: 'warn' });
  });

  test('zero scopes is truthful: a scoped operation really does reject this caller', async () => {
    // The console renders scope-gated surfaces disabled-with-reason off the
    // empty scope set above. That is only honest if the operations actually
    // refuse — assert it rather than assuming, so a future weft that grants
    // anonymous callers real scopes surfaces here as a contradiction.
    const client = new HttpClient({ baseUrl: anonymousBaseUrl });

    expect(await throwingRejectionOf(client.operations['weft.system.registry']({}))).toThrow();
  });
});
