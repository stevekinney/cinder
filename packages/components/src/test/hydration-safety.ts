/// <reference lib="dom" />
/**
 * Build-flag hydration-safety test helper.
 *
 * Catches the class of hydration bug where a component's server-rendered markup
 * depends on a *build-time* flag — canonically `esm-env`'s `BROWSER` (`false` in
 * the server build, `true` in the client build). A `{#if BROWSER}` branch then
 * renders nothing on the server but something on the client's initial hydration
 * render, so the two disagree. This was the original ShareCard native-share bug;
 * the fix gates client-only affordances on a `hydrated` `$effect` (false during
 * SSR *and* the initial hydration render) instead of the build flag.
 *
 * Mechanism — two-sided invariance under the browser-condition flip: build +
 * server-render the component twice, with the `browser` export condition off
 * (`BROWSER=false`, real server markup) and on (`BROWSER=true`, the declarative
 * markup the client's initial render wants), and compare. Differ → the render
 * depends on the build flag. Match → it is build-flag-invariant.
 *
 * Why a static double-render rather than a real hydrate: Svelte 5 does not
 * reliably emit a `hydration_mismatch` warning for an `{#if}` condition that
 * merely evaluates differently — that warning is tied to hydration-walk
 * structure failures, while a build-flag branch divergence is reconciled
 * silently (confirmed in both happy-dom and a real Chromium dev hydrate). So
 * runtime warning capture cannot observe this bug; the build-time render
 * divergence is the deterministic signal. (See the PR for the full evidence.)
 *
 * Scope: build-flag control flow (`{#if BROWSER}`, `{#each}` over flag-derived
 * data, flag-derived attribute presence). This is a proxy for the client
 * compilation's initial declarative markup shape, NOT a full hydration pass — it
 * does not validate bindings, actions, event attachment, lifecycle ordering, or
 * DOM mutation during hydration. See {@link HydrationSafetyResult.buildFlagInvariant}.
 *
 * `Bun.build` resolves the full import graph, so a component that unconditionally
 * renders child `.svelte` components is handled natively — the "unconditional
 * child-effects" case `renderThenHydrate` cannot (it server-compiles only the
 * top-level component).
 */
import type { BunPlugin } from 'bun';
import { unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Component } from 'svelte';
import { compile } from 'svelte/compiler';

const here = dirname(fileURLToPath(import.meta.url));
/** Scratch directory for the per-render server modules this helper emits. */
const hydrationSafetyTempDir = join(here, '..', '..', 'tmp', 'hydration-safety');

/**
 * Minimal server-target Svelte plugin with `dev: false`. Dev mode is wrong here:
 * its element instrumentation (`push_element`) reads a component context that a
 * bare `render()` on a bundled module never establishes. This is acceptable
 * because the helper only compares production SSR HTML under two build
 * conditions — it is not a warning-capture or development-hydration validator,
 * and `{#if BROWSER}` markup divergence shows up in production output regardless.
 * Components carrying a `<style>` block are out of scope (library components keep
 * styles in `src/styles/`); CSS is injected so the rare style-bearing fixture
 * still compiles.
 */
function serverCompilePlugin(): BunPlugin {
  const namespace = 'hydration-safety-svelte-server';

  return {
    name: 'hydration-safety-svelte-server',
    setup(builder) {
      builder.onResolve({ filter: /\.svelte$/ }, ({ path, importer, resolveDir }) => {
        const baseDirectory = importer ? dirname(importer) : resolveDir;
        return {
          path: isAbsolute(path) ? path : resolve(baseDirectory, path),
          namespace,
        };
      });

      builder.onLoad({ filter: /\.svelte$/, namespace }, async ({ path }) => {
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
  const previousHydrationSafetyServerBuild = process.env['CINDER_HYDRATION_SAFETY_SERVER_BUILD'];
  process.env['CINDER_HYDRATION_SAFETY_SERVER_BUILD'] = '1';
  let build: Bun.BuildOutput;
  try {
    build = await Bun.build({
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
  } finally {
    if (previousHydrationSafetyServerBuild === undefined) {
      delete process.env['CINDER_HYDRATION_SAFETY_SERVER_BUILD'];
    } else {
      process.env['CINDER_HYDRATION_SAFETY_SERVER_BUILD'] = previousHydrationSafetyServerBuild;
    }
  }
  if (!build.success) {
    const logText = build.logs.map((log) => String(log.message ?? log)).join('\n');
    throw new Error(`hydration-safety: server build failed for ${componentPath}\n${logText}`);
  }
  const artifact = build.outputs[0];
  if (!artifact) throw new Error(`hydration-safety: no server artifact for ${componentPath}`);

  // External svelte alone isn't enough: the test process runs under the `browser`
  // export condition and the root test preload mocks bare `svelte`, so a
  // runtime-resolved `svelte`/`svelte/internal/server` import can land on the
  // CLIENT build, whose `onDestroy`/`setContext` throw during a server render.
  // Repoint `svelte/internal/server` directly and route bare `svelte` through a
  // per-render server shim. Other `svelte/*` subpaths
  // (`svelte/reactivity`, `svelte/store`, …) stay runtime-resolved: they are
  // isomorphic across the browser/server condition for SSR (verified with a
  // `SvelteMap` child), so they don't fork the rendered markup.
  const moduleNameBase = `${conditions.includes('browser') ? 'client' : 'server'}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const modulePath = join(hydrationSafetyTempDir, `${moduleNameBase}.mjs`);
  const serverRuntimeShimPath = join(hydrationSafetyTempDir, `${moduleNameBase}.svelte-server.mjs`);
  const serverRuntimeShimUrl = pathToFileURL(serverRuntimeShimPath).href;

  const sveltePackageUrl = import.meta.resolve('svelte/package.json');
  const serverAbortSignalUrl = new URL('./src/internal/server/abort-signal.js', sveltePackageUrl)
    .href;
  const serverContextUrl = new URL('./src/internal/server/context.js', sveltePackageUrl).href;
  const serverErrorsUrl = new URL('./src/internal/server/errors.js', sveltePackageUrl).href;
  const serverHydratableUrl = new URL('./src/internal/server/hydratable.js', sveltePackageUrl).href;
  const serverInternalUrl = new URL('./src/internal/server/index.js', sveltePackageUrl).href;
  const serverSnippetUrl = new URL('./src/internal/server/blocks/snippet.js', sveltePackageUrl)
    .href;
  const sharedUtilitiesUrl = new URL('./src/internal/shared/utils.js', sveltePackageUrl).href;
  await Bun.write(
    serverRuntimeShimPath,
    [
      `import { ssr_context } from ${JSON.stringify(serverContextUrl)};`,
      `import { noop } from ${JSON.stringify(sharedUtilitiesUrl)};`,
      `import * as e from ${JSON.stringify(serverErrorsUrl)};`,
      `export { noop as beforeUpdate, noop as afterUpdate, noop as onMount, noop as flushSync, run as untrack } from ${JSON.stringify(sharedUtilitiesUrl)};`,
      `export { createContext, getAllContexts, getContext, hasContext, setContext } from ${JSON.stringify(serverContextUrl)};`,
      `export { getAbortSignal } from ${JSON.stringify(serverAbortSignalUrl)};`,
      `export { hydratable } from ${JSON.stringify(serverHydratableUrl)};`,
      `export { createRawSnippet } from ${JSON.stringify(serverSnippetUrl)};`,
      'export function createEventDispatcher() { return noop; }',
      'export function onDestroy(fn) { ssr_context.r.on_destroy(fn); }',
      'export async function tick() {}',
      'export async function settled() {}',
      "export function mount() { e.lifecycle_function_unavailable('mount'); }",
      "export function hydrate() { e.lifecycle_function_unavailable('hydrate'); }",
      "export function unmount() { e.lifecycle_function_unavailable('unmount'); }",
      "export function fork() { e.lifecycle_function_unavailable('fork'); }",
      '',
    ].join('\n'),
  );
  let code = await artifact.text();
  code = code
    .replaceAll(
      /from\s*['"]svelte\/internal\/server['"]/g,
      `from ${JSON.stringify(serverInternalUrl)}`,
    )
    .replaceAll(/from\s*['"]svelte['"]/g, `from ${JSON.stringify(serverRuntimeShimUrl)}`);

  // Unique per-call filenames + finally cleanup so parallel checks on the SAME
  // component path never race the same module file (mirrors hydrate.ts).
  await Bun.write(modulePath, code);

  const { render } = (await import('svelte/server')) as typeof import('svelte/server');

  // Clear the happy-dom globals the surrounding test suite installs at module
  // scope, so a component that branches on `typeof document`/`typeof window`
  // takes the server path during this server-only render (mirrors
  // server-render.ts, which clears exactly these two).
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = undefined as unknown as Document;
  globalThis.window = undefined as unknown as Window & typeof globalThis;
  try {
    const module = (await import(pathToFileURL(modulePath).href)) as { default: unknown };
    // The SSR module's default export is a server render function whose shape
    // doesn't match the public `Component` type; `render` accepts it at runtime.
    // Route through `Component<Record<string, unknown>>` (not `never`) so the
    // `props` argument typechecks — mirrors server-render.ts.
    return render(module.default as Component<Record<string, unknown>>, { props }).body;
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    try {
      unlinkSync(modulePath);
    } catch {
      // Best-effort — a stray temp module never breaks a test.
    }
    try {
      unlinkSync(serverRuntimeShimPath);
    } catch {
      // Best-effort — a stray temp module never breaks a test.
    }
  }
}

/** Result of a build-flag hydration-safety check. */
export type HydrationSafetyResult = {
  /**
   * `true` when the SSR markup is identical under `BROWSER=false` and
   * `BROWSER=true` — i.e. the render does not depend on the esm-env build-flag
   * split. This is NOT a blanket "hydration-safe" verdict. Both renders clear
   * `document` and `window` (so a `{#if typeof window !== 'undefined'}` branch
   * takes the server path in each), but `navigator` is intentionally left
   * ambient. So a runtime capability check — `navigator.share`, `navigator.clipboard`
   * — is outside this helper's guarantee unless it sits behind a `hydrated`
   * guard: whether it renders depends on what the surrounding test environment
   * exposes, not on the build-flag split. Read a `true` result as "invariant
   * under the build flag", not "safe in general". (ShareCard is invariant
   * precisely because its `navigator.share` read is behind `hydrated &&`.)
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
 * See {@link HydrationSafetyResult.buildFlagInvariant} for what a `true` result
 * does and does not guarantee.
 *
 * @param componentPath Absolute path to the component's `.svelte` file.
 * @param props Props forwarded to BOTH server renders (must be identical so the
 *   only varying input is the build flag).
 */
export async function checkBuildFlagHydrationSafety(
  componentPath: string,
  props: Record<string, unknown> = {},
): Promise<HydrationSafetyResult> {
  await assertDiscriminatorWorks();
  const serverHtml = await renderWithConditions(componentPath, ['svelte'], props);
  const clientHtml = await renderWithConditions(componentPath, ['browser', 'svelte'], props);
  return { buildFlagInvariant: serverHtml === clientHtml, serverHtml, clientHtml };
}

/**
 * Memoized fail-closed self-check: the whole helper rests on `Bun.build`'s
 * `conditions` flipping esm-env's `BROWSER` between the two renders. If that ever
 * stops working (an esm-env export-map change, a resolution-cache quirk), every
 * `{#if BROWSER}` component would render identically both ways and be silently
 * reported `buildFlagInvariant: true` — a false negative on the exact bug class
 * this exists to catch. So before the first real check, render a sentinel that
 * is KNOWN to diverge on `BROWSER` and assert it actually does. Memoized to one
 * build pair per process so it doesn't double the cost of every call.
 */
let discriminatorVerified: Promise<void> | null = null;
function assertDiscriminatorWorks(): Promise<void> {
  discriminatorVerified ??= (async () => {
    const sentinel = join(here, 'fixtures', 'hydration-probe-browser-flag.svelte');
    const off = await renderWithConditions(sentinel, ['svelte'], {});
    const on = await renderWithConditions(sentinel, ['browser', 'svelte'], {});
    if (off === on) {
      throw new Error(
        'hydration-safety: the BROWSER build-flag discriminator is not working — the ' +
          '`{#if BROWSER}` sentinel rendered identically under both build conditions. ' +
          'Every check would be a false negative. Investigate esm-env resolution / Bun.build ' +
          'conditions before trusting any `buildFlagInvariant` result.',
      );
    }
  })();
  return discriminatorVerified;
}
