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

import { rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { hydrate, type Component } from 'svelte';
import { compile } from 'svelte/compiler';

import { setupHappyDom } from './happy-dom.ts';

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
  await writeFile(file, compiled.js.code, 'utf-8');

  // The SSR module's default export is a server-only render function whose
  // shape (`($$renderer, $$props) => void`) doesn't match the public
  // `Component<Props>` type. `svelte/server.render` accepts both shapes at
  // runtime; we route through `unknown` because the public types are too
  // narrow to express the dual-target reality.
  const ssrModule = (await import(file)) as { default: unknown };

  const { render } = (await import('svelte/server')) as typeof import('svelte/server');
  const { body: ssrHtml } = render(ssrModule.default as Component<Props>, { props });

  const container = document.createElement('div');
  container.innerHTML = ssrHtml;
  document.body.appendChild(container);

  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };

  let instance: Record<string, unknown> | undefined;
  try {
    instance = hydrate(clientComponent, {
      target: container,
      props,
    }) as Record<string, unknown>;
  } finally {
    console.warn = originalWarn;
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
      // Remove the temp SSR file we created next to the source. Best-effort —
      // failures don't break the test, just leave a stray file.
      void rm(file, { force: true }).catch(() => {});
    },
  };
}
