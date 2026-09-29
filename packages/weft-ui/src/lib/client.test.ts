/**
 * `HttpClient` provisioning tests (plan §4, T1.1). Pure logic, no DOM:
 * `createClient()`'s same-origin fallback takes its origin as an injectable
 * parameter rather than reading the ambient `window.location` directly (bare
 * `bun test`/happy-dom, with no navigation, resolves `window.location.origin`
 * to the opaque-origin string `"null"`, not a usable URL). Exercises
 * `createClient()`/`setApiKey()` directly rather than through
 * `provideClient()`/`getClient()`, which need an active Svelte component
 * context; those two are exercised through the `*.test-harness.svelte`
 * components below — a bare call from this file only reaches Svelte's own
 * "no active component" lifecycle error, never the context plumbing itself.
 *
 * `HttpClient.headers` keys are lower-cased (`Headers`/Fetch-spec
 * normalization) — assertions below read `headers['authorization']`, not
 * `headers['Authorization']`.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { HttpClient } from '@lostgradient/weft';

import { createClient, getClient, provideClient, setApiKey } from './client.ts';
import type { WeftUiRuntimeConfig } from './config.ts';

describe('createClient — baseUrl resolution', () => {
  test('an empty baseUrl (same-origin, plan §3.3) resolves to the injected origin', () => {
    const client = createClient({ baseUrl: '' }, 'https://weft-ui.example.com');
    expect(client.baseUrl).toBe('https://weft-ui.example.com');
  });

  test('an explicit baseUrl is passed through unchanged', () => {
    const client = createClient({ baseUrl: 'https://weft.example.com' });
    expect(client.baseUrl).toBe('https://weft.example.com');
  });

  test('a Service Worker path-prefix baseUrl (plan §3.3) resolves against the injected origin', () => {
    const client = createClient({ baseUrl: '/weft' }, 'https://weft-ui.example.com');
    expect(client.baseUrl).toBe('https://weft-ui.example.com/weft');
  });
});

describe('createClient — eventTransport', () => {
  test('constructs successfully with eventTransport omitted (defaults to "auto")', () => {
    // `HttpClient` keeps its resolved `eventTransport` in a private field —
    // this asserts the observable contract (construction succeeds) rather
    // than reaching for the private value.
    expect(() => createClient({ baseUrl: 'https://weft.example.com' })).not.toThrow();
  });

  test('does not throw for any documented eventTransport value', () => {
    for (const eventTransport of ['auto', 'websocket', 'sse'] as const) {
      expect(() =>
        createClient({ baseUrl: 'https://weft.example.com', eventTransport }),
      ).not.toThrow();
    }
  });
});

describe('createClient — token', () => {
  test('with no token, no Authorization header is set', () => {
    const client = createClient({ baseUrl: 'https://weft.example.com' });
    expect(client.headers['authorization']).toBeUndefined();
  });

  test('a config token becomes a Bearer Authorization header', () => {
    const client = createClient({ baseUrl: 'https://weft.example.com', token: 'secret-token' });
    expect(client.headers['authorization']).toBe('Bearer secret-token');
  });
});

describe('createClient — headers', () => {
  test('config headers are sent on every request', () => {
    const client = createClient({
      baseUrl: 'https://weft.example.com',
      headers: { 'X-Custom-Header': 'value' },
    });
    expect(client.headers['x-custom-header']).toBe('value');
  });

  test('an explicit headers.Authorization wins over a config token (HttpClient precedence)', () => {
    const client = createClient({
      baseUrl: 'https://weft.example.com',
      token: 'from-token',
      headers: { Authorization: 'Bearer from-headers' },
    });
    expect(client.headers['authorization']).toBe('Bearer from-headers');
  });
});

describe('setApiKey', () => {
  const config: WeftUiRuntimeConfig = { baseUrl: 'https://weft.example.com' };

  test('replaces both configured credential headers while preserving routing headers', () => {
    const configured = {
      ...config,
      headers: {
        'X-API-Key': 'expired-key',
        AUTHORIZATION: 'Bearer expired-token',
        'X-Engine-Instance': 'engine-a',
      },
    };
    const client = setApiKey(configured, 'replacement-key');
    expect(client.headers['authorization']).toBe('Bearer replacement-key');
    expect(client.headers['x-api-key']).toBeUndefined();
    expect(client.headers['x-engine-instance']).toBe('engine-a');
    expect(configured.headers['X-API-Key']).toBe('expired-key');
  });

  test('rebuilds the client with the entered key as a Bearer Authorization header', () => {
    const client = setApiKey(config, 'operator-entered-key');
    expect(client.headers['authorization']).toBe('Bearer operator-entered-key');
  });

  test('entered key replaces a stale configured Authorization header', () => {
    const client = setApiKey(
      { ...config, headers: { Authorization: 'Bearer expired-configured-key', 'X-Trace': 'keep' } },
      'operator-entered-key',
    );
    expect(client.headers['authorization']).toBe('Bearer operator-entered-key');
    expect(client.headers['x-trace']).toBe('keep');
  });

  test('preserves the base config baseUrl', () => {
    const client = setApiKey(config, 'operator-entered-key');
    expect(client.baseUrl).toBe(config.baseUrl);
  });

  test('does not mutate the config object passed in', () => {
    const original = { ...config };
    setApiKey(config, 'operator-entered-key');
    expect(config).toEqual(original);
  });

  test('a fresh call with a different key produces an independent client', () => {
    const first = setApiKey(config, 'first-key');
    const second = setApiKey(config, 'second-key');
    expect(first.headers['authorization']).toBe('Bearer first-key');
    expect(second.headers['authorization']).toBe('Bearer second-key');
  });
});

describe('getClient — outside any provideClient() ancestor', () => {
  test('throws a clear error rather than returning undefined', () => {
    // Svelte's getContext() itself requires an active component-initialization
    // lifecycle; calling it here (no component, no provideClient() ancestor)
    // throws Svelte's own lifecycle error before getClient()'s own check runs
    // — still proves getClient() is not silently swallowing the missing case.
    expect(() => getClient()).toThrow();
  });

  test("inside a real component with no provideClient() ancestor, getClient()'s own guard fires", async () => {
    // Unlike the bare call above, `get-client-harness.test-harness.svelte`
    // renders as a real component, so `getContext()` succeeds (returns
    // `undefined` — no ancestor called `provideClient()`) and control reaches
    // `getClient()`'s own `if (!client) throw …` guard.
    const harnessModule = await import('./get-client-harness.test-harness.svelte');
    const GetClientHarness = harnessModule.default;
    expect(() => render(GetClientHarness)).toThrow(
      /getClient\(\) called with no client in context/,
    );
  });
});

describe('provideClient — outside any component', () => {
  test("throws Svelte's own lifecycle error rather than silently no-op-ing", () => {
    const client = createClient({ baseUrl: 'https://weft.example.com' });
    expect(() => provideClient(client)).toThrow();
  });
});

describe('provideClient + getClient — round trip through a real component tree', () => {
  test('a child of the provideClient() ancestor gets the exact same client instance back', async () => {
    // Mirrors how `src/app/shell/shell.svelte` actually wires these two
    // functions: `ProvideClientHarness` calls `provideClient()` during its
    // own setup, then renders `GetClientHarness` (reused from the "no
    // ancestor" tests above) as a child that calls `getClient()`.
    const harnessModule = await import('./provide-client-harness.test-harness.svelte');
    const ProvideClientHarness = harnessModule.default;
    const client = createClient({ baseUrl: 'https://weft.example.com' });

    let received: HttpClient | undefined;
    render(ProvideClientHarness, {
      props: { client, onClient: (c: HttpClient) => (received = c) },
    });

    expect(received).toBe(client);
  });
});
