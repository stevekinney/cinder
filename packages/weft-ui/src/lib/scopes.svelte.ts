/**
 * Principal + scope gating (plan §6, T1.2). Frozen after the Phase 1
 * Foundation gate — see PROJECT-BRIEF "Shared contracts".
 *
 * The 21 scopes below are flat (`workflows:admin` does NOT imply
 * `workflows:read`) and mirror weft's `AUTHORIZATION_SCOPES` — a public
 * export of `@lostgradient/weft` as of 0.18.0. The literal stays
 * duplicated here deliberately: a value import from the server subpath
 * would pull weft's server module graph into the browser bundle, so the
 * console keeps a browser-safe copy and `scopes.svelte.test.ts` pins it
 * byte-identical against the upstream export (the test runs under Bun,
 * where importing the server barrel is fine).
 *
 * ## Principal resolution (weft 0.18.0, `weft.system.principal`)
 *
 * `resolvePrincipal()` calls the principal-introspection operation this
 * module pinned as missing from v0.11.0 through v0.17.0 (plan §14.1 item
 * 4; shipped upstream in 0.18.0). The operation is `access: 'public'` and
 * reports the caller's own resolved principal — method, subject, and the
 * ACTUAL granted scopes — so the old optimistic-grant model (assume all 21
 * scopes, degrade on observed `403`s) is gone: scope gating now starts
 * from the server's authoritative answer.
 *
 * Three outcomes:
 * - **Authenticated** (`method` ≠ `'unauthenticated'`): the granted scopes
 *   verbatim; no banner.
 * - **Anonymous but served** (`method: 'unauthenticated'`): the server has
 *   no `auth` configured — an auth-configured weft rejects uncredentialed
 *   requests at the transport edge before any operation dispatch, public
 *   ones included. Anonymous principals carry zero scopes, so every
 *   scope-gated surface renders disabled-with-reason (truthful: those
 *   operations genuinely reject anonymous callers), while public-access
 *   operations remain usable. `'warn'` vs `'allow'` are still
 *   wire-indistinguishable (both mean "no auth configured"; the option only
 *   gates server BOOT) — the more visible `'warn'` banner is the safe
 *   default.
 * - **`401`**: no principal — the supplied credential was invalid/expired,
 *   or the server requires one (API-key entry must run). The two cases read
 *   identically to callers.
 *
 * `denyScope()`/`isForbidden()` remain as the runtime-degrade path for the
 * residual case of a scope revoked server-side mid-session.
 */
import { getContext, setContext } from 'svelte';

import { HttpClientError, type HttpClient } from '@lostgradient/weft';

export const AUTHORIZATION_SCOPES = [
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
] as const;

export type AuthorizationScope = (typeof AUTHORIZATION_SCOPES)[number];

/** Startup policy mirrored from `UnauthenticatedAccessPolicy` (plan §6). */
export type UnauthenticatedAccessPolicy = 'warn' | 'allow' | 'reject';

export interface Principal {
  /**
   * The scopes the server reported as granted for this credential
   * (`weft.system.principal`). Empty for an anonymous principal. Shrinks
   * further, via `denyScope()`, only if a scope is revoked server-side
   * mid-session and a real `403` is observed.
   */
  scopes: readonly AuthorizationScope[];
  /**
   * Set when the server ran without `auth` configured. `'warn'`/`'allow'`
   * both mean "granted by default" (indistinguishable on the wire — module
   * doc); `null` means this is a normally authenticated principal (an
   * accepted credential), which shows no banner.
   */
  unauthenticatedAccess: UnauthenticatedAccessPolicy | null;
}

/**
 * The auth-mode banner state a principal implies (plan §6, §10). `'none'`
 * means "authenticated normally, nothing to announce."
 */
export type BannerMode =
  'auth-required' | 'unauthenticated-warn' | 'unauthenticated-allow' | 'none';

const PRINCIPAL_CONTEXT_KEY = Symbol('weft-ui-principal');

export interface PrincipalStoreOptions {
  /** Called when a live credential is rejected and the app must reauthenticate. */
  onAuthExpired?: () => void;
}

export class PrincipalStore {
  principal = $state<Principal | null>(null);

  readonly #onAuthExpired: (() => void) | undefined;

  constructor(options: PrincipalStoreOptions = {}) {
    this.#onAuthExpired = options.onAuthExpired;
  }

  hasScope(...required: readonly AuthorizationScope[]): boolean {
    const current = this.principal;
    if (!current) return false;
    return required.every((scope) => current.scopes.includes(scope));
  }

  /** Auth-mode banner state derived from the current principal (plan §6). */
  get bannerMode(): BannerMode {
    const current = this.principal;
    if (!current) return 'auth-required';
    if (current.unauthenticatedAccess === 'warn') return 'unauthenticated-warn';
    if (current.unauthenticatedAccess === 'allow') return 'unauthenticated-allow';
    return 'none';
  }

  /** Sets the resolved principal — a successful boot probe or API-key entry. */
  setPrincipal(principal: Principal): void {
    this.principal = principal;
  }

  /**
   * Clears the principal, returning the store to `bannerMode: 'auth-required'`.
   * Callers decide when this applies (e.g. a `401` on a live credential,
   * observed via `isUnauthorized()`) — this module never clears the
   * principal automatically (module doc: only `403`s degrade automatically).
   * When configured by the app shell, clearing also returns the app to its
   * API-key entry boundary so an expired credential can be replaced.
   */
  clear(): void {
    this.principal = null;
    this.#onAuthExpired?.();
  }

  /**
   * Revokes one or more scopes from the current principal after the server
   * has denied them with a real `403 Forbidden` (module doc). No-op when
   * there is no principal yet. Idempotent.
   */
  denyScope(...scopes: readonly AuthorizationScope[]): void {
    const current = this.principal;
    if (!current) return;
    this.principal = {
      ...current,
      scopes: current.scopes.filter((scope) => !scopes.includes(scope)),
    };
  }

  /** Runs `resolvePrincipal()` and applies its result (module doc). */
  async bootstrap(client: PrincipalProbeClient): Promise<void> {
    this.principal = await resolvePrincipal(client);
  }
}

export function providePrincipalStore(options?: PrincipalStoreOptions): PrincipalStore {
  const store = new PrincipalStore(options);
  setContext(PRINCIPAL_CONTEXT_KEY, store);
  return store;
}

export function getPrincipalStore(): PrincipalStore {
  const store = getContext<PrincipalStore | undefined>(PRINCIPAL_CONTEXT_KEY);
  if (!store) {
    throw new Error(
      'weft-ui: getPrincipalStore() called with no store in context — providePrincipalStore() must run in an ancestor component.',
    );
  }
  return store;
}

/** `true` for an `HttpClientError` carrying the given HTTP status. */
function isHttpStatus(error: unknown, status: number): boolean {
  return error instanceof HttpClientError && error.status === status;
}

/**
 * `true` when `error` is a `403 Forbidden` from a scope-gated operation.
 * Call sites that know which scope(s) an action required should follow this
 * with `principalStore.denyScope(...)` — the automatic-degrade half of the
 * fallback (module doc).
 */
export function isForbidden(error: unknown): boolean {
  return isHttpStatus(error, 403);
}

/**
 * `true` when `error` is a `401 Unauthorized` — no credential was accepted
 * by the transport-level authenticator. Exposed for call sites that want to
 * react to a live credential expiring (e.g. `principalStore.clear()`); this
 * module itself never reacts to `401` automatically (module doc).
 */
export function isUnauthorized(error: unknown): boolean {
  return isHttpStatus(error, 401);
}

/**
 * The slice of `HttpClient` `resolvePrincipal()` needs. `operations` is a
 * plain record built synchronously from the static catalog, so a caller can
 * satisfy this with a stub in a unit test without a live server — the
 * integration tests in `scopes.svelte.integration.test.ts` cover the real
 * wire behavior.
 */
type PrincipalProbeClient = {
  readonly operations: Pick<HttpClient['operations'], 'weft.system.principal'>;
};

/**
 * Resolves the current principal by asking the server who the caller is —
 * `weft.system.principal` (`GET /v1/principal`, `access: 'public'`, weft
 * 0.18.0). The operation reports the credential's method, subject, and
 * ACTUAL granted scopes, so this module no longer infers any of it.
 *
 * Three outcomes, mapping the operation's `method` onto {@link Principal}:
 *
 * - **`method` is a real credential kind** (`'jwt'`/`'api-key'`/`'mtls'`/
 *   `'stdio-local'`) — the server accepted a credential. Granted scopes
 *   verbatim, `unauthenticatedAccess: null` (no banner).
 * - **`method: 'unauthenticated'`** — the server served an anonymous caller,
 *   which only happens when it has no `auth` configured: an auth-configured
 *   weft rejects credential-less requests at the transport edge before any
 *   operation dispatch, `public` ones included (pinned by
 *   `scopes.svelte.integration.test.ts`). Anonymous principals carry zero
 *   scopes, so scope-gated surfaces render disabled-with-reason — truthful,
 *   since those operations genuinely reject anonymous callers. `'warn'` vs
 *   `'allow'` remain wire-indistinguishable (the option only gates server
 *   BOOT), so the more visible `'warn'` stays the safe default.
 * - **`401`** — no principal. Either the supplied credential was
 *   invalid/expired or the server requires one and the API-key entry surface
 *   must run; both read identically to the caller as "no principal yet."
 *
 * Any other error (network failure, `500`, …) is not one of the auth states
 * this module owns and is rethrown for the caller's own fault handling
 * (plan §10.4).
 */
export async function resolvePrincipal(client: PrincipalProbeClient): Promise<Principal | null> {
  let introspected;
  try {
    introspected = await client.operations['weft.system.principal']({});
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }

  if (introspected.method === 'unauthenticated') {
    return { scopes: [], unauthenticatedAccess: 'warn' };
  }

  return { scopes: [...introspected.scopes], unauthenticatedAccess: null };
}

/** Tooltip text for a missing-scope disable-with-reason (plan §6, §10). */
export function scopeReason(...required: readonly AuthorizationScope[]): string {
  return `Requires ${required.join(', ')}`;
}

/**
 * Disable-with-tooltip convention (plan §6, §10): never hide a
 * capability, disable it and say why. Spread the result onto a button-like
 * component's `disabled`/`title` props.
 */
export interface ScopeGate {
  disabled: boolean;
  title: string | undefined;
}

export function scopeGate(
  store: PrincipalStore,
  required: readonly AuthorizationScope[],
): ScopeGate {
  const granted = store.hasScope(...required);
  return { disabled: !granted, title: granted ? undefined : scopeReason(...required) };
}
