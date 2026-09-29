/**
 * Truth-table tests for principal + scope gating (plan §6, §11.1, T1.2).
 * Pure logic, no DOM: exercises `PrincipalStore` directly rather than
 * through `providePrincipalStore()`/`getPrincipalStore()`, which need an
 * active Svelte component context (covered later by the app-shell's own
 * component tests, T1.6).
 */
import { describe, expect, test } from 'bun:test';

import {
  HttpClient,
  AUTHORIZATION_SCOPES as UPSTREAM_AUTHORIZATION_SCOPES,
} from '@lostgradient/weft';

import {
  AUTHORIZATION_SCOPES,
  PrincipalStore,
  type AuthorizationScope,
  type Principal,
} from './scopes.svelte.ts';

function grantedPrincipal(scopes: readonly AuthorizationScope[] = AUTHORIZATION_SCOPES): Principal {
  return { scopes, unauthenticatedAccess: null };
}

describe('AUTHORIZATION_SCOPES', () => {
  test('is byte-identical to weft’s own exported vocabulary, in order', () => {
    // The real drift detector, available since weft 0.18.0 made
    // `AUTHORIZATION_SCOPES` a public export. The console still keeps its own
    // copy because `src/lib/scopes.svelte.ts` is bundled for the browser and a
    // value import from the server barrel would pull weft's server module
    // graph in with it — but the copy is no longer unverifiable. This test
    // runs under Bun, where importing the server entry point is free, so a
    // weft release that adds, removes, or reorders a scope fails here instead
    // of silently desynchronizing the console's gating vocabulary.
    expect(AUTHORIZATION_SCOPES).toEqual([...UPSTREAM_AUTHORIZATION_SCOPES]);
  });

  test('is the flat 21-scope vocabulary, verbatim, in order', () => {
    // Kept alongside the upstream comparison rather than replaced by it: this
    // spells the vocabulary out, so a review of a weft bump sees exactly which
    // scopes changed rather than just "both sides moved together."
    expect(AUTHORIZATION_SCOPES).toEqual([
      'workflows:read',
      'workflows:write',
      'workflows:admin',
      'schedules:read',
      'schedules:write',
      'signals:write',
      'updates:write',
      'queries:read',
      'reviews:read',
      'reviews:write',
      'attributes:read',
      'attributes:write',
      'tags:write',
      'streams:read',
      'events:read',
      'storage:read',
      'storage:write',
      'storage:admin',
      'workers:write',
      'system:read',
      'system:admin',
    ]);
  });

  test('has no duplicate entries', () => {
    expect(new Set(AUTHORIZATION_SCOPES).size).toBe(AUTHORIZATION_SCOPES.length);
  });
});
describe('the principal-introspection operation (T1.2 pin, adopted in weft 0.18.0)', () => {
  // Constructing an HttpClient does no network I/O (`operations` is a plain
  // object built synchronously from the static catalog name list) — safe to
  // assert against without a live server.
  const client = new HttpClient({ baseUrl: 'http://localhost:0' });

  // This pin ran inverted from weft 0.11.0 through 0.17.0, asserting the
  // operation did NOT exist and that the console's probe-and-infer fallback
  // was therefore load-bearing (plan §14.1 item 4). weft 0.18.0 shipped it;
  // the assertion flips rather than being deleted, so a dependency
  // downgrade that removes the operation fails here instead of silently
  // reverting `resolvePrincipal()` to guessing.
  test('plan §6 names `weft.system.principal` as the expected op; it exists', () => {
    expect('weft.system.principal' in client.operations).toBe(true);
  });
});
describe('PrincipalStore.hasScope', () => {
  test('is false for every scope with no principal', () => {
    const store = new PrincipalStore();
    for (const scope of AUTHORIZATION_SCOPES) {
      expect(store.hasScope(scope)).toBe(false);
    }
  });

  test('is true for every scope of a fully granted principal', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal());
    for (const scope of AUTHORIZATION_SCOPES) {
      expect(store.hasScope(scope)).toBe(true);
    }
  });

  test('scopes are flat — workflows:admin does not imply workflows:read or workflows:write', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal(['workflows:admin']));
    expect(store.hasScope('workflows:admin')).toBe(true);
    expect(store.hasScope('workflows:read')).toBe(false);
    expect(store.hasScope('workflows:write')).toBe(false);
  });

  test('variadic calls are AND — every required scope must be granted', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal(['workflows:read', 'workflows:write']));
    expect(store.hasScope('workflows:read', 'workflows:write')).toBe(true);
    expect(store.hasScope('workflows:read', 'workflows:admin')).toBe(false);
  });

  test('a call with no required scopes is vacuously true for any principal', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal([]));
    expect(store.hasScope()).toBe(true);
  });
});
describe('PrincipalStore.denyScope', () => {
  test('revokes a single scope from the current principal', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal());
    store.denyScope('workers:write');
    expect(store.hasScope('workers:write')).toBe(false);
    expect(store.hasScope('workflows:read')).toBe(true);
  });

  test('revokes multiple scopes in one call', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal());
    store.denyScope('storage:admin', 'system:admin');
    expect(store.hasScope('storage:admin')).toBe(false);
    expect(store.hasScope('system:admin')).toBe(false);
    expect(store.hasScope('storage:read')).toBe(true);
  });

  test('is a no-op with no principal', () => {
    const store = new PrincipalStore();
    expect(() => store.denyScope('workflows:admin')).not.toThrow();
    expect(store.principal).toBeNull();
  });

  test('is idempotent — denying an already-denied scope does not error or duplicate', () => {
    const store = new PrincipalStore();
    store.setPrincipal(grantedPrincipal());
    store.denyScope('workers:write');
    store.denyScope('workers:write');
    expect(store.principal?.scopes.filter((scope) => scope === 'workers:write')).toEqual([]);
  });
});
