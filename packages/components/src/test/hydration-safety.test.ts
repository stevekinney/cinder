/// <reference lib="dom" />
/**
 * Contract for the build-flag hydration-safety helper (#17).
 *
 * The helper renders a component's SSR output twice — `BROWSER=false` (server)
 * and `BROWSER=true` (client-intent) — and reports whether they agree. The two
 * fixture pairs below pin both halves of its contract:
 *
 *   - a `{#if BROWSER}` gate is build-flag-DEPENDENT → the helper reports it
 *     UNSAFE (the original ShareCard native-share bug class);
 *   - a `hydrated` `$effect` gate is build-flag-INVARIANT → the helper reports
 *     it SAFE (the fix).
 *
 * Each pattern is tested both standalone and with an unconditionally-rendered
 * child component that owns its own `$effect` — the "components with
 * unconditional child-effects" case the task is named for, which the helper
 * handles natively because `Bun.build` bundles the whole import graph.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, setDefaultTimeout, test } from 'bun:test';

import { checkBuildFlagHydrationSafety } from './hydration-safety.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): string => join(fixturesDir, `${name}.svelte`);

// Each check runs two Bun.build + render passes — slower than the 5s default
// under CPU contention. Match the schema-fallback suite's headroom.
setDefaultTimeout(60_000);

describe('checkBuildFlagHydrationSafety', () => {
  test('flags a {#if BROWSER}-gated component as UNSAFE', async () => {
    const result = await checkBuildFlagHydrationSafety(fixture('hydration-probe-browser-flag'));
    expect(result.buildFlagInvariant).toBe(false);
    // The divergence is precisely the client-only affordance: absent server-side,
    // present client-side.
    expect(result.serverHtml).not.toContain('data-testid="client-only"');
    expect(result.clientHtml).toContain('data-testid="client-only"');
  });

  test('reports a `hydrated` $effect-gated component as SAFE', async () => {
    const result = await checkBuildFlagHydrationSafety(fixture('hydration-probe-effect-gate'));
    expect(result.buildFlagInvariant).toBe(true);
    // The affordance is absent under BOTH conditions — `hydrated` is false in SSR
    // regardless of BROWSER, so there is nothing to mismatch.
    expect(result.serverHtml).not.toContain('data-testid="client-only"');
    expect(result.clientHtml).not.toContain('data-testid="client-only"');
  });

  test('flags a BROWSER-gated component as UNSAFE even with an unconditional child-effect', async () => {
    const result = await checkBuildFlagHydrationSafety(
      fixture('hydration-probe-child-browser-flag'),
    );
    expect(result.buildFlagInvariant).toBe(false);
    // The unconditionally-rendered child is present under BOTH conditions — it
    // does not mask the BROWSER-gated divergence.
    expect(result.serverHtml).toContain('data-testid="child"');
    expect(result.clientHtml).toContain('data-testid="child"');
    expect(result.serverHtml).not.toContain('data-testid="client-only"');
    expect(result.clientHtml).toContain('data-testid="client-only"');
  });

  test('reports an $effect-gated component as SAFE even with an unconditional child-effect', async () => {
    const result = await checkBuildFlagHydrationSafety(
      fixture('hydration-probe-child-effect-gate'),
    );
    expect(result.buildFlagInvariant).toBe(true);
    expect(result.serverHtml).toContain('data-testid="child"');
    expect(result.clientHtml).toContain('data-testid="child"');
    // The gated affordance is absent under BOTH conditions — same as the
    // childless safe case; the child does not smuggle it into either render.
    expect(result.serverHtml).not.toContain('data-testid="client-only"');
    expect(result.clientHtml).not.toContain('data-testid="client-only"');
  });
});
