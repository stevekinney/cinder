/// <reference lib="dom" />
/**
 * Build-flag hydration-safety test helper.
 *
 * Catches the class of hydration bug where a component's server-rendered markup
 * depends on a *build-time* environment flag — the canonical example being
 * `esm-env`'s `BROWSER`, which is `false` in the server build and `true` in the
 * client build. A `{#if BROWSER}` branch then renders nothing on the server but
 * something on the client's initial hydration pass, so the SSR HTML and the
 * client's hydration target disagree. This is exactly the original ShareCard
 * native-share bug; the fix is to gate client-only affordances on a `hydrated`
 * `$effect` (false during SSR *and* the initial hydration render, flipped true
 * by an effect afterwards) rather than on the build flag.
 *
 * How it works — two-sided invariance under the browser-condition flip:
 *   1. Build + server-render the component with the `browser` export condition
 *      OFF → esm-env resolves `BROWSER=false` → the SSR markup a real server
 *      produces.
 *   2. Build + server-render the SAME component with the `browser` condition ON
 *      → `BROWSER=true` → the markup the client's initial hydration render
 *      WANTS.
 *   3. Compare. If they differ, the component's render depends on the build-flag
 *      split — a hydration mismatch waiting to happen. If they match, it is
 *      build-flag-invariant and hydration-safe in this respect.
 *
 * A `hydrated`-`$effect` gate is build-flag-invariant (the SSR render is the
 * same regardless of `BROWSER`, because `hydrated` starts `false` either way),
 * so it passes. A `{#if BROWSER}` gate is not, so it fails. That contrast is the
 * helper's whole contract.
 *
 * Why static double-render, not a real hydrate: Svelte 5 only emits its
 * `hydration_mismatch` console warning for STRUCTURAL hydration-walk failures
 * (misaligned anchors, a missing expected node), NOT for an `{#if}` condition
 * that merely evaluates differently — it reconciles that silently, in both
 * happy-dom and a real browser. So neither a bun-test `hydrate()` nor a
 * Playwright console capture can observe this bug at runtime. The faithful,
 * deterministic signal is the build-time render divergence itself.
 *
 * Scope: this covers control-flow that branches on the build flag (`{#if}`,
 * `{#each}` over flag-derived data, attribute presence) — the #17 bug class. It
 * is a "build-flag hydration-safety check", not a universal hydration-mismatch
 * detector; it does not exercise bindings, actions, or runtime-only effects.
 *
 * `Bun.build` resolves the full import graph, so a component that unconditionally
 * renders child `.svelte` components is handled natively — no special casing for
 * child effects (unlike `renderThenHydrate`, which only server-compiles the
 * top-level component).
 */
import type { BunPlugin } from 'bun';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Component } from 'svelte';
import { compile } from 'svelte/compiler';

const here = dirname(fileURLToPath(import.meta.url));
/** Scratch directory for the per-render server modules this helper emits. */
const hydrationSafetyTempDir = join(here, '..', '..', 'tmp', 'hydration-safety');

/**
 * Minimal server-target Svelte plugin with `dev: false`. Dev mode is wrong here:
 * its element instrumentation (`push_element`) reads a component context that a
 * bare `render()` on a bundled module never establishes, and the server half
 * never needs a dev warning. Components carrying a `<style>` block are out of
 * scope for this helper (library components keep styles in `src/styles/`); CSS
 * is injected so the rare style-bearing fixture still compiles.
 */
function serverCompilePlugin(): BunPlugin {
  return {
    name: 'hydration-safety-svelte-server',
    setup(builder) {
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const result = compile(source, {
          filename: path,
          generate: 'server',
          css: 'injected',
          dev: false,
        });
        return { contents: result.js.code, loader: 'js' };
      });
    },
  };
}

/**
 * Build `componentPath` for the server with the given export `conditions`, then
 * server-render it and return the HTML body. `browser` in `conditions` makes
 * esm-env resolve `BROWSER=true`; omitting it resolves `BROWSER=false`.
 */
async function renderWithConditions(
  componentPath: string,
  conditions: readonly string[],
  props: Record<string, unknown>,
): Promise<string> {
  const build = await Bun.build({
    entrypoints: [componentPath],
    target: 'bun',
    conditions: [...conditions],
    // Svelte MUST stay a single shared instance, not bundled. If Bun.build
    // inlined svelte's server internals, the component module would carry its
    // own `ssr_context` module state, separate from the `render()` we import
    // below — `render()` would initialize ITS copy's context while the bundled
    // component reads its own (null) copy, crashing any component that touches a
    // lifecycle/context API (`onDestroy`, `getContext`). esm-env, by contrast,
    // stays bundled so `conditions` still flips BROWSER — that's the discriminator.
    external: ['svelte', 'svelte/*'],
    plugins: [serverCompilePlugin()],
  });
  if (!build.success) {
    const logText = build.logs.map((log) => String(log.message ?? log)).join('\n');
    throw new Error(`hydration-safety: server build failed for ${componentPath}\n${logText}`);
  }
  const artifact = build.outputs[0];
  if (!artifact) throw new Error(`hydration-safety: no server artifact for ${componentPath}`);

  // External svelte alone isn't enough: the test process runs under the
  // `browser` export condition, so a runtime-resolved bare `svelte` import
  // lands on the CLIENT build, whose `onDestroy`/`setContext` throw during a
  // server render. Repoint the bare svelte specifiers at Svelte's server index
  // (and server internals) — the same rewrite renderToServerHtml/hydrate.ts use.
  const sveltePackageUrl = import.meta.resolve('svelte/package.json');
  const serverIndexUrl = new URL('./src/index-server.js', sveltePackageUrl).href;
  const serverInternalUrl = new URL('./src/internal/server/index.js', sveltePackageUrl).href;
  let code = await artifact.text();
  code = code
    .replaceAll(
      /from\s*['"]svelte\/internal\/server['"]/g,
      `from ${JSON.stringify(serverInternalUrl)}`,
    )
    .replaceAll(/from\s*['"]svelte['"]/g, `from ${JSON.stringify(serverIndexUrl)}`);

  const moduleName = `${conditions.includes('browser') ? 'client' : 'server'}-${Bun.hash(
    componentPath,
  ).toString(36)}.mjs`;
  const modulePath = join(hydrationSafetyTempDir, moduleName);
  await Bun.write(modulePath, code);

  const { render } = (await import('svelte/server')) as typeof import('svelte/server');
  const module = (await import(pathToFileURL(modulePath).href)) as { default: unknown };

  // Clear the happy-dom globals the surrounding test suite installs at module
  // scope, so a component that branches on `typeof document`/`navigator` takes
  // the server path during this server-only render (mirrors server-render.ts).
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  globalThis.document = undefined as unknown as Document;
  globalThis.window = undefined as unknown as Window & typeof globalThis;
  // `navigator` is a getter-only global in some runtimes; delete defensively.
  try {
    delete (globalThis as { navigator?: unknown }).navigator;
  } catch {
    // Non-configurable in this runtime — leave it; `hydrated`-gated reads still
    // take the server path because `hydrated` is false during SSR.
  }
  try {
    // The SSR module's default export is a server render function whose shape
    // doesn't match the public `Component` type; `render` accepts it at runtime.
    // Route through `Component<Record<string, unknown>>` (not `never`) so the
    // `props` argument typechecks — mirrors server-render.ts.
    return render(module.default as Component<Record<string, unknown>>, { props }).body;
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    if (originalNavigator !== undefined) {
      try {
        (globalThis as { navigator?: unknown }).navigator = originalNavigator;
      } catch {
        // Restore best-effort.
      }
    }
  }
}

/** Result of a build-flag hydration-safety check. */
export type HydrationSafetyResult = {
  /**
   * `true` when the SSR markup is identical under `BROWSER=false` and
   * `BROWSER=true` — i.e. the render does not depend on the esm-env build-flag
   * split. This is NOT a blanket "hydration-safe" verdict: it says nothing about
   * runtime environment checks (`{#if typeof window !== 'undefined'}`,
   * `typeof navigator`) that aren't already behind a `hydrated` guard — both
   * renders clear those globals identically, so such a divergence is invisible
   * here. Read it as "invariant under the build flag", not "safe in general".
   */
  buildFlagInvariant: boolean;
  /** SSR markup with the `browser` condition OFF (`BROWSER=false`) — real server output. */
  serverHtml: string;
  /** SSR markup with the `browser` condition ON (`BROWSER=true`) — client-intent output. */
  clientHtml: string;
};

/**
 * Render `componentPath` twice — once with `BROWSER=false`, once with
 * `BROWSER=true` — and report whether the two SSR outputs agree. When they
 * differ, the component's render depends on the esm-env build-flag split and
 * will hydration-mismatch; gate the offending markup on a `hydrated` `$effect`
 * instead.
 *
 * Scope — what this catches and what it does NOT: it catches the build-flag
 * (esm-env `BROWSER`-style) divergence — the #11/ShareCard bug class. It does
 * NOT catch a component that gates on a *runtime* environment check
 * (`{#if typeof window !== 'undefined'}`, `typeof navigator`) that is not also
 * behind a `hydrated` guard: both renders clear those globals identically, so
 * such a divergence is invisible here and would be reported `buildFlagInvariant:
 * true` despite mismatching in production. A `buildFlagInvariant: true` result
 * means "render does not depend on the build flag", not "hydration-safe in every
 * respect". ShareCard passes precisely because its `navigator` read sits behind
 * `hydrated &&` — which is the correct fix and what this helper guards against
 * regressing.
 *
 * @param componentPath Absolute path to the component's `.svelte` file.
 * @param props Props forwarded to BOTH server renders (must be identical so the
 *   only varying input is the build flag).
 */
export async function checkBuildFlagHydrationSafety(
  componentPath: string,
  props: Record<string, unknown> = {},
): Promise<HydrationSafetyResult> {
  const serverHtml = await renderWithConditions(componentPath, ['svelte'], props);
  const clientHtml = await renderWithConditions(componentPath, ['browser', 'svelte'], props);
  return { buildFlagInvariant: serverHtml === clientHtml, serverHtml, clientHtml };
}
