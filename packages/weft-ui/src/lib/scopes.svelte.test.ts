/**
 * Truth-table tests for principal + scope gating (plan §6, §11.1, T1.2).
 * Pure logic, no DOM: exercises `PrincipalStore` directly rather than
 * through `providePrincipalStore()`/`getPrincipalStore()`, which need an
 * active Svelte component context (covered later by the app-shell's own
 * component tests, T1.6).
 */
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';

import { throwingRejectionOf } from '@lostgradient/testing';
import {
  AUTHORIZATION_SCOPES,
  isForbidden,
  isUnauthorized,
  PrincipalStore,
  resolvePrincipal,
  scopeGate,
  scopeReason,
  type AuthorizationScope,
  type Principal,
} from './scopes.svelte.ts';

function grantedPrincipal(scopes: readonly AuthorizationScope[] = AUTHORIZATION_SCOPES): Principal {
  return { scopes, unauthenticatedAccess: null };
}

describe('PrincipalStore.bannerMode', () => {
  test('is "auth-required" with no principal', () => {
    const store = new PrincipalStore();
    expect(store.bannerMode).toBe('auth-required');
  });

  test('is "unauthenticated-warn" for unauthenticatedAccess: warn', () => {
    const store = new PrincipalStore();
    store.setPrincipal({ scopes: AUTHORIZATION_SCOPES, unauthenticatedAccess: 'warn' });
    expect(store.bannerMode).toBe('unauthenticated-warn');
  });

  test('is "unauthenticated-allow" for unauthenticatedAccess: allow', () => {
    const store = new PrincipalStore();
    store.setPrincipal({ scopes: AUTHORIZATION_SCOPES, unauthenticatedAccess: 'allow' });
    expect(store.bannerMode).toBe('unauthenticated-allow');
  });

  test('is "none" for unauthenticatedAccess: reject (never actually observed, but representable)', () => {
    const store = new PrincipalStore();
    store.setPrincipal({ scopes: AUTHORIZATION_SCOPES, unauthenticatedAccess: 'reject' });
    expect(store.bannerMode).toBe('none');
  });

  test('is "none" for a normally authenticated principal', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal());
    expect(store.bannerMode).toBe('none');
  });
});

describe('PrincipalStore.setPrincipal / clear', () => {
  test('clear() returns the store to bannerMode "auth-required"', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal());
    store.clear();
    expect(store.principal).toBeNull();
    expect(store.bannerMode).toBe('auth-required');
  });

  test('setPrincipal() replaces prior denials — a fresh principal starts fully granted', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal());
    store.denyScope('workers:write');
    store.setPrincipal(grantedPrincipal());
    expect(store.hasScope('workers:write')).toBe(true);
  });

  test('clear() notifies the app so an expired credential can be replaced', () => {
    let authExpired = 0;
    const store = new PrincipalStore({ onAuthExpired: () => authExpired++ });
    store.setPrincipal(grantedPrincipal());

    store.clear();

    expect(store.principal).toBeNull();
    expect(authExpired).toBe(1);

    store.setPrincipal(grantedPrincipal(['system:read']));
    expect(store.hasScope('system:read')).toBe(true);
    expect(store.bannerMode).toBe('none');
  });
});

/**
 * Stubs the ONE operation `resolvePrincipal()` calls. `HttpClient.operations`
 * is a plain record keyed by every catalog name, so a structurally complete
 * stub would be ~100 no-op entries for no added coverage — this narrows to
 * the single key under test. The real wire contract (what an auth-configured
 * weft does to a credential-less caller) is pinned by
 * `scopes.svelte.integration.test.ts` against a booted `serve()`.
 */
type PrincipalResponse = Awaited<
  ReturnType<Parameters<typeof resolvePrincipal>[0]['operations']['weft.system.principal']>
>;

function principalClient(
  respond: () => Promise<PrincipalResponse>,
): Parameters<typeof resolvePrincipal>[0] {
  return { operations: { 'weft.system.principal': respond } };
}

describe('PrincipalStore.bootstrap', () => {
  test('applies a successful resolvePrincipal() result', async () => {
    const store = new PrincipalStore();
    await store.bootstrap(
      principalClient(async () => ({
        method: 'api-key',
        subject: 'boot',
        scopes: ['system:read'],
      })),
    );
    expect(store.principal).toEqual({
      scopes: ['system:read'],
      unauthenticatedAccess: null,
    });
  });

  test('applies a rejected (401) resolvePrincipal() result as null', async () => {
    const store = new PrincipalStore();
    await store.bootstrap(
      principalClient(async () => {
        throw new HttpClientError(401, 'No valid credentials provided');
      }),
    );
    expect(store.principal).toBeNull();
  });
});

describe('resolvePrincipal', () => {
  test('an authenticated principal reports its granted scopes verbatim, no banner', async () => {
    const principal = await resolvePrincipal(
      principalClient(async () => ({
        method: 'api-key',
        subject: 'console',
        scopes: ['workflows:read', 'system:read'],
      })),
    );
    expect(principal).toEqual({
      scopes: ['workflows:read', 'system:read'],
      unauthenticatedAccess: null,
    });
  });

  test('the reported scope set is copied, not aliased to the response array', async () => {
    // `Principal.scopes` outlives the response object; `denyScope()` rebuilds
    // it by filtering, so a shared reference would be a latent aliasing bug
    // rather than an observable one today. Pin the copy.
    const response: PrincipalResponse = {
      method: 'api-key',
      subject: 'console',
      scopes: ['workflows:read'],
    };
    const principal = await resolvePrincipal(principalClient(async () => response));
    expect(principal?.scopes).not.toBe(response.scopes);
    expect(principal?.scopes).toEqual(['workflows:read']);
  });

  test('an anonymous principal reports zero scopes and the unauthenticated-warn banner', async () => {
    // Reaching this state at all means the server has no `auth` configured:
    // an auth-configured weft 401s a credential-less caller at the transport
    // edge (pinned in the integration test), so it never answers anonymously.
    const principal = await resolvePrincipal(
      principalClient(async () => ({ method: 'unauthenticated', subject: null, scopes: [] })),
    );
    expect(principal).toEqual({ scopes: [], unauthenticatedAccess: 'warn' });
  });

  test('a 401 (no/invalid credential) → null', async () => {
    const principal = await resolvePrincipal(
      principalClient(async () => {
        throw new HttpClientError(401, 'No valid credentials provided');
      }),
    );
    expect(principal).toBeNull();
  });

  test('a non-401 HttpClientError (e.g. 500) is rethrown, not swallowed', async () => {
    expect(
      await throwingRejectionOf(
        resolvePrincipal(
          principalClient(async () => {
            throw new HttpClientError(500, 'Internal server error');
          }),
        ),
      ),
    ).toThrow('Internal server error');
  });

  test('a non-HttpClientError failure (e.g. a network error) is rethrown, not swallowed', async () => {
    expect(
      await throwingRejectionOf(
        resolvePrincipal(
          principalClient(async () => {
            throw new TypeError('fetch failed');
          }),
        ),
      ),
    ).toThrow('fetch failed');
  });
});

describe('isForbidden / isUnauthorized', () => {
  test('isForbidden is true only for a 403 HttpClientError', () => {
    expect(isForbidden(new HttpClientError(403, 'nope'))).toBe(true);
    expect(isForbidden(new HttpClientError(401, 'nope'))).toBe(false);
    expect(isForbidden(new HttpClientError(500, 'nope'))).toBe(false);
    expect(isForbidden(new Error('nope'))).toBe(false);
    expect(isForbidden(new TypeError('fetch failed'))).toBe(false);
    expect(isForbidden(undefined)).toBe(false);
  });

  test('isUnauthorized is true only for a 401 HttpClientError', () => {
    expect(isUnauthorized(new HttpClientError(401, 'nope'))).toBe(true);
    expect(isUnauthorized(new HttpClientError(403, 'nope'))).toBe(false);
    expect(isUnauthorized(new Error('nope'))).toBe(false);
    expect(isUnauthorized('not an error')).toBe(false);
  });
});

describe('scopeReason', () => {
  test('formats a single scope', () => {
    expect(scopeReason('workflows:admin')).toBe('Requires workflows:admin');
  });

  test('formats multiple scopes, comma-joined', () => {
    expect(scopeReason('workflows:admin', 'streams:read')).toBe(
      'Requires workflows:admin, streams:read',
    );
  });

  test('formats zero scopes deterministically', () => {
    expect(scopeReason()).toBe('Requires ');
  });
});

describe('scopeGate', () => {
  test('is enabled (no title) when every required scope is granted', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal(['workflows:read', 'workflows:write']));
    expect(scopeGate(store, ['workflows:read', 'workflows:write'])).toEqual({
      disabled: false,
      title: undefined,
    });
  });

  test('is disabled with a "Requires …" title when a required scope is missing', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal(['workflows:read']));
    expect(scopeGate(store, ['workflows:read', 'workflows:admin'])).toEqual({
      disabled: true,
      title: 'Requires workflows:read, workflows:admin',
    });
  });

  test('is disabled with no principal', () => {
    const store = new PrincipalStore();
    expect(scopeGate(store, ['workflows:read'])).toEqual({
      disabled: true,
      title: 'Requires workflows:read',
    });
  });
});
