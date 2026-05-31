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
 * Why we recompile inside the helper: the test runtime preloads the Bun Svelte
 * plugin in `generate: 'client'` mode (see `scripts/preload.ts`). Calling
 * `svelte/server`'s `render()` against a client-compiled component crashes
 * because the client runtime expects a live effect tree. So this helper reads
 * the `.svelte` source directly, compiles it with `generate: 'server'`, writes
 * the JS to a temp file, dynamic-imports it, and feeds that into `render()`.
 *
 * The helper does NOT itself assert — it returns a structured result so each
 * component test can express the contract it cares about (e.g. "no warnings"
 * vs "warnings expected because open=true was passed").
 *
 * Warnings emitted by Svelte's hydration runtime appear on `console.warn`.
 * We intercept them for the duration of the hydrate.
 */

/// <reference lib="dom" />

import { unlinkSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { hydrate, type Component } from 'svelte';
import { compile } from 'svelte/compiler';

import { setupHappyDom } from './happy-dom.ts';

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
 * Render `clientComponent` on the server (by recompiling its source file in
 * `generate: 'server'` mode), then hydrate the resulting markup on the client
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

  const source = await Bun.file(sourcePath).text();
  const compiled = compile(source, {
    filename: sourcePath,
    generate: 'server',
    css: 'external',
    dev: false,
  });
  // Resolve svelte's location from the hydrate helper's own directory so it
  // works regardless of process.cwd() (which varies when tests run from the
  // package root vs the monorepo root).
  const sveltePackageJson = new URL(import.meta.resolve('svelte/package.json')).pathname;
  const serverSvelteEntry = pathToFileURL(
    join(dirname(sveltePackageJson), 'src/index-server.js'),
  ).href;
  const serverCode = compiled.js.code.replaceAll(
    "from 'svelte';",
    `from ${JSON.stringify(serverSvelteEntry)};`,
  );

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
  const ssrFileName = `.cinder-ssr-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`;
  const file = join(sourceDir, ssrFileName);
  ensureExitHandlersRegistered();
  pendingTempFiles.add(file);

  // Everything from the temp-file write through the hydrate is wrapped so that
  // any failure BEFORE we return a `cleanup()` to the caller still removes and
  // deregisters the temp file. Without this, a throw in import/render/hydrate
  // would orphan the file until process exit — the exact leak this helper exists
  // to prevent.
  let ssrHtml = '';
  let container: HTMLElement;
  const warnings: string[] = [];
  let instance: Record<string, unknown> | undefined;
  try {
    await writeFile(file, serverCode, 'utf-8');

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
    // Pre-return failure: remove the temp file and deregister it so it doesn't
    // linger in the registry, then rethrow for the test to observe.
    pendingTempFiles.delete(file);
    void rm(file, { force: true }).catch(() => {});
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
      // Remove the temp SSR file we created next to the source and deregister
      // it from the exit-handler safety net. Best-effort — failures don't break
      // the test, just leave a stray file the exit handler will sweep later.
      pendingTempFiles.delete(file);
      void rm(file, { force: true }).catch(() => {});
    },
  };
}
