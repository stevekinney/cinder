/**
 * SSR-render-and-hydrate test helper.
 *
 * Renders a Svelte 5 component via the server compiler, mounts the resulting
 * markup on the client, and reports any hydration warnings or ID drift back
 * to the caller. Used by every component that:
 *
 * - Generates IDs via `useId` and wires them into ARIA attributes
 * - Has DOM-property-only state (e.g. Checkbox `indeterminate`)
 * - Uses portals or overlay surfaces
 *
 * Why we rebuild inside the helper: the test runtime preloads the Bun Svelte
 * plugin in `generate: 'client'` mode (see `scripts/preload.ts`). Calling
 * `svelte/server`'s `render()` against a client-compiled component crashes
 * because the client runtime expects a live effect tree. So this helper builds
 * the component and its complete local Svelte import graph with
 * `generate: 'server'`, writes the bundled JS to a temp file, dynamic-imports
 * it, and feeds that into `render()`.
 *
 * The helper does NOT itself assert — it returns a structured result so each
 * component test can express the contract it cares about (e.g. "no warnings"
 * vs "warnings expected because open=true was passed").
 *
 * Warnings emitted by Svelte's hydration runtime appear on `console.warn`.
 * We intercept them for the duration of the hydrate.
 */

/// <reference lib="dom" />

import type { BunPlugin } from 'bun';
import { existsSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { hydrate, type Component } from 'svelte';
import { compile, compileModule } from 'svelte/compiler';

import { setupHappyDom } from './happy-dom.ts';

function serverCompilePlugin(): BunPlugin {
  const namespace = 'hydrate-svelte-server';
  const isFileSpecifier = (specifier: string): boolean =>
    isAbsolute(specifier) || specifier.startsWith('.');

  return {
    name: 'hydrate-svelte-server',
    setup(builder) {
      builder.onResolve({ filter: /\.svelte$/ }, ({ path, importer, resolveDir }) => {
        if (!isFileSpecifier(path)) return undefined;
        const baseDirectory = importer ? dirname(importer) : resolveDir;
        const resolvedPath = isAbsolute(path) ? path : resolve(baseDirectory, path);
        return {
          path: existsSync(resolvedPath) ? resolvedPath : `${resolvedPath}.ts`,
          namespace,
        };
      });

      builder.onLoad({ filter: /\.svelte$/, namespace }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const result = compile(source, {
          filename: path,
          generate: 'server',
          css: 'external',
          dev: true,
        });
        return { contents: result.js.code, loader: 'js' };
      });

      builder.onResolve({ filter: /\.svelte\.(js|ts)$/ }, ({ path, importer, resolveDir }) => {
        if (!isFileSpecifier(path)) return undefined;
        const baseDirectory = importer ? dirname(importer) : resolveDir;
        return {
          path: isAbsolute(path) ? path : resolve(baseDirectory, path),
          namespace,
        };
      });

      builder.onLoad({ filter: /\.svelte\.(js|ts)$/, namespace }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const moduleSource = path.endsWith('.ts')
          ? new Bun.Transpiler({ loader: 'ts' }).transformSync(source)
          : source;
        const result = compileModule(moduleSource, {
          filename: path,
          generate: 'server',
          dev: true,
        });
        return { contents: result.js.code, loader: 'js' };
      });
    },
  };
}

/**
 * Every temp SSR module this helper writes is registered here. The per-test
 * `cleanup()` removes its own file and deregisters it; the process-exit handler
 * below is the safety net that synchronously unlinks anything still registered
 * if a test throws or the process is interrupted before `cleanup()` runs.
 */
const pendingTempFiles = new Set<string>();

let exitHandlersRegistered = false;

/** Synchronously remove every still-registered temp file. Safe to call twice. */
function cleanupRegisteredTempFiles(): void {
  for (const path of pendingTempFiles) {
    try {
      unlinkSync(path);
    } catch {
      // Already gone (per-test cleanup beat us to it) — ignore.
    }
    pendingTempFiles.delete(path);
  }
}

/**
 * Install process-exit / signal handlers exactly once. The `exit` handler must
 * be fully synchronous (Node ignores async work during exit), so it uses
 * `unlinkSync`. SIGINT/SIGTERM clean up, then re-raise the default behaviour so
 * the process still terminates.
 */
function ensureExitHandlersRegistered(): void {
  if (exitHandlersRegistered) return;
  exitHandlersRegistered = true;

  process.on('exit', cleanupRegisteredTempFiles);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    // Install a *named* handler and, on fire, remove only this handler before
    // re-raising — `process.removeAllListeners(signal)` would wipe unrelated
    // signal handlers owned by the test runner or other infrastructure.
    const handler = () => {
      cleanupRegisteredTempFiles();
      process.off(signal, handler);
      // Re-raise so the default disposition runs and exit codes stay correct.
      process.kill(process.pid, signal);
    };
    process.on(signal, handler);
  }
}

/**
 * Test-only accessors for the temp-file registry. Exposed so `hydrate.test.ts`
 * can verify the exit-handler safety net without actually exiting the process.
 */
export const __tempFileRegistryForTests: {
  paths: ReadonlySet<string>;
  runExitCleanup: () => void;
} = {
  paths: pendingTempFiles,
  runExitCleanup: cleanupRegisteredTempFiles,
};

/** Result of a single render-then-hydrate pass. */
export type HydrateResult = {
  /** HTML produced by the SSR render. */
  ssrHtml: string;
  /** Any console.warn output captured during the hydrate. */
  warnings: string[];
  /** The container the component was hydrated into. Inspect for assertions. */
  container: HTMLElement;
  /** Tear down the hydrated instance. Call this in test cleanup. */
  cleanup: () => void;
};

/**
 * Render `clientComponent` on the server (by rebuilding its local Svelte import
 * graph in `generate: 'server'` mode), then hydrate the resulting markup on the client
 * with the already-loaded client compilation.
 *
 * @param clientComponent The client-compiled component (the default import from a `.svelte` file).
 * @param sourcePath The absolute path to the component's `.svelte` file. Required because the
 *   client compilation strips the original source.
 * @param props Props forwarded to both the server render and the client hydrate.
 */
export async function renderThenHydrate<Props extends Record<string, unknown>>(
  clientComponent: Component<Props>,
  sourcePath: string,
  props: Props,
): Promise<HydrateResult> {
  setupHappyDom();

  const build = await Bun.build({
    entrypoints: [sourcePath],
    target: 'bun',
    conditions: ['svelte'],
    external: ['svelte', 'svelte/*'],
    plugins: [serverCompilePlugin()],
  });
  if (!build.success) {
    const logText = build.logs.map((log) => String(log.message ?? log)).join('\n');
    throw new Error(`hydrate: server build failed for ${sourcePath}\n${logText}`);
  }
  const artifact = build.outputs[0];
  if (!artifact) throw new Error(`hydrate: no server artifact for ${sourcePath}`);

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

  // Write the compiled SSR module to a tmp file. We can't use a Blob URL or
  // a `data:` URL because the SSR module imports `svelte/internal/server`,
  // and dynamic-import resolution requires a real path the resolver
  // recognizes (Bun's internal resolver relative to a real file).
  // Write the compiled SSR module **in the same directory** as the original
  // `.svelte` source so its relative imports (e.g. `../utilities/class-names.ts`)
  // resolve identically. A subdirectory would shift the relative import depth;
  // a path under the OS tmpdir would also fail to resolve `svelte/internal/server`
  // because it lives outside any node_modules tree.
  // Use a `.mjs` extension so Bun's `.svelte.js` preload plugin filter doesn't
  // try to recompile our already-compiled SSR output.
  const sourceDir = dirname(sourcePath);
  const ssrFileName = `.cinder-ssr-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const file = join(sourceDir, `${ssrFileName}.mjs`);
  const serverRuntimeShimPath = join(sourceDir, `${ssrFileName}.svelte-server.mjs`);
  const serverRuntimeShimUrl = pathToFileURL(serverRuntimeShimPath).href;
  ensureExitHandlersRegistered();
  pendingTempFiles.add(file);
  pendingTempFiles.add(serverRuntimeShimPath);

  // Everything from the temp-file write through the hydrate is wrapped so that
  // any failure BEFORE we return a `cleanup()` to the caller still removes and
  // deregisters the temp file. Without this, a throw in import/render/hydrate
  // would orphan the file until process exit — the exact leak this helper exists
  // to prevent.
  let ssrHtml = '';
  let container: HTMLElement | undefined;
  const warnings: string[] = [];
  let instance: Record<string, unknown> | undefined;
  try {
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
    let serverCode = await artifact.text();
    serverCode = serverCode
      .replaceAll(
        /from\s*['"]svelte\/internal\/server['"]/g,
        `from ${JSON.stringify(serverInternalUrl)}`,
      )
      .replaceAll(/from\s*['"]svelte['"]/g, `from ${JSON.stringify(serverRuntimeShimUrl)}`);
    await Bun.write(file, serverCode);

    // The SSR module's default export is a server-only render function whose
    // shape (`($$renderer, $$props) => void`) doesn't match the public
    // `Component<Props>` type. `svelte/server.render` accepts both shapes at
    // runtime; we route through `unknown` because the public types are too
    // narrow to express the dual-target reality.
    const ssrModule = (await import(file)) as { default: unknown };

    const { render } = (await import('svelte/server')) as typeof import('svelte/server');
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    globalThis.document = undefined as unknown as Document;
    globalThis.window = undefined as unknown as Window & typeof globalThis;
    try {
      ssrHtml = render(ssrModule.default as Component<Props>, { props }).body;
    } finally {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    }

    container = document.createElement('div');
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);

    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };

    try {
      instance = hydrate(clientComponent, {
        target: container,
        props,
      }) as Record<string, unknown>;
    } finally {
      console.warn = originalWarn;
    }
  } catch (error) {
    // Pre-return failure. Remove the SSR container if it made it into the DOM,
    // or it would orphan markup that contaminates later tests. Then unlink the
    // temp file SYNCHRONOUSLY and only deregister it AFTER removal — an async
    // rm() + immediate deregister would lose the file if the process exited
    // before the rm settled (the exit handler skips deregistered paths). Finally
    // rethrow for the test to observe.
    container?.remove();
    for (const tempFile of [file, serverRuntimeShimPath]) {
      try {
        unlinkSync(tempFile);
      } catch {
        // Already gone — ignore.
      }
      pendingTempFiles.delete(tempFile);
    }
    throw error;
  }

  return {
    ssrHtml,
    warnings,
    container,
    cleanup: () => {
      // Svelte 5's hydrate returns the component's exports plus a Symbol-keyed
      // unmount handle on some versions. Try common shapes; if no unmount fn
      // is found, removing the container suffices for happy-dom-based tests.
      if (instance) {
        for (const value of Object.values(instance)) {
          if (typeof value === 'function' && value.length === 0) {
            try {
              (value as () => void)();
            } catch {
              // Not the unmount fn; ignore.
            }
          }
        }
      }
      container.remove();
      // Remove the temp SSR file we created next to the source, then deregister
      // it from the exit-handler safety net. Unlink SYNCHRONOUSLY and deregister
      // only AFTER removal: an async rm() + immediate deregister would lose the
      // file if rm() failed or the process exited before it settled (the exit
      // handler skips already-deregistered paths). Best-effort — a unlink failure
      // doesn't break the test; the path stays registered for the exit sweep.
      for (const tempFile of [file, serverRuntimeShimPath]) {
        try {
          unlinkSync(tempFile);
          pendingTempFiles.delete(tempFile);
        } catch {
          // Leave it registered so the exit-handler safety net still sweeps it.
        }
      }
    },
  };
}
