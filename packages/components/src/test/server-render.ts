/**
 * Server-render test helper.
 *
 * Compiles a Svelte 5 component in `generate: 'server'` mode and returns the
 * HTML the server would emit — without hydrating it on the client. Component
 * tests use this to assert their SSR contract: that markup gated behind a
 * client-only `hydrated` flag (drawer, sheet, toast-region) or behind a
 * client-only load/error state (image) does NOT appear in the server output,
 * so there is no hydration mismatch and no client-only markup leaks into SSR.
 *
 * Why we recompile inside the helper: the test runtime preloads the Bun Svelte
 * plugin in `generate: 'client'` mode (see `scripts/preload.ts`). The client
 * compilation cannot be fed to `svelte/server`'s `render()` — it expects a live
 * effect tree. So this helper reads the `.svelte` source directly, compiles it
 * with `generate: 'server'`, writes the JS to a temp file next to the source,
 * dynamic-imports it, and feeds that into `render()`.
 *
 * Why we rewrite the bare `svelte` import: the test process runs under the
 * `browser` export condition, which resolves `svelte` to its client build.
 * Lifecycle helpers from the client build (`onDestroy`, etc.) throw when invoked
 * during a server render. We rewrite the compiled module's `from 'svelte'`
 * imports to point at Svelte's server index so those helpers resolve to their
 * server-safe variants.
 */

/// <reference lib="dom" />

import type { BunPlugin } from 'bun';
import { unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Component } from 'svelte';
import { compile, compileModule } from 'svelte/compiler';

function serverCompilePlugin(): BunPlugin {
  const namespace = 'server-render-svelte-server';
  const isFileSpecifier = (specifier: string): boolean =>
    isAbsolute(specifier) || specifier.startsWith('.');

  return {
    name: 'server-render-svelte-server',
    setup(builder) {
      builder.onResolve({ filter: /\.svelte$/ }, ({ path, importer, resolveDir }) => {
        if (!isFileSpecifier(path)) return undefined;
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
          css: 'external',
          dev: false,
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
          dev: false,
        });
        return { contents: result.js.code, loader: 'js' };
      });
    },
  };
}

/**
 * Render `sourcePath`'s component on the server and return the emitted HTML.
 *
 * @param sourcePath Absolute path to the component's `.svelte` file.
 * @param props Props forwarded to the server render.
 * @returns The server-emitted HTML body.
 */
export async function renderToServerHtml<Props extends Record<string, unknown>>(
  sourcePath: string,
  props: Props = {} as Props,
): Promise<string> {
  const build = await Bun.build({
    entrypoints: [sourcePath],
    target: 'bun',
    conditions: ['svelte'],
    external: ['svelte', 'svelte/*'],
    plugins: [serverCompilePlugin()],
  });
  if (!build.success) {
    const logText = build.logs.map((log) => String(log.message ?? log)).join('\n');
    throw new Error(`server-render: server build failed for ${sourcePath}\n${logText}`);
  }
  const artifact = build.outputs[0];
  if (!artifact) throw new Error(`server-render: no server artifact for ${sourcePath}`);

  // Resolve Svelte's server index and repoint the compiled module's bare
  // `svelte` imports at it. The temp module is imported in a `browser`-condition
  // process, which would otherwise resolve `svelte` to its client build and make
  // server-side lifecycle calls (`onDestroy`, `setContext`) throw.
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

  const sourceDir = dirname(sourcePath);
  const ssrFileName = `.cinder-ssr-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const file = join(sourceDir, `${ssrFileName}.mjs`);
  const serverRuntimeShimPath = join(sourceDir, `${ssrFileName}.svelte-server.mjs`);
  const serverRuntimeShimUrl = pathToFileURL(serverRuntimeShimPath).href;

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

  // Write the compiled SSR module **in the same directory** as the source so its
  // relative imports (e.g. `../../utilities/class-names.ts`) resolve identically,
  // and `svelte/internal/server` still resolves through the package's node_modules
  // tree. A `.mjs` extension keeps Bun's `.svelte.js` preload plugin from trying
  // to recompile our already-compiled output.
  await Bun.write(file, code);

  try {
    // The SSR module's default export is a server-only render function whose
    // shape doesn't match the public `Component<Props>` type. `render` accepts
    // it at runtime; we route through `unknown` because the public types are too
    // narrow to express the dual-target reality.
    const ssrModule = (await import(pathToFileURL(file).href)) as { default: unknown };
    const { render } = (await import('svelte/server')) as typeof import('svelte/server');

    // Clear happy-dom's `document`/`window` globals around the server render.
    // The surrounding tests install them via `setupHappyDom()` at module scope,
    // so without this a component that branches on `typeof document` would take
    // the browser path during this supposedly server-only render — making the
    // SSR contract assert markup that real SSR would never emit. Restore them in
    // `finally` so the rest of the test sees its DOM again. Mirrors `hydrate.ts`.
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    globalThis.document = undefined as unknown as Document;
    globalThis.window = undefined as unknown as Window & typeof globalThis;
    try {
      const { body } = render(ssrModule.default as Component<Props>, { props });
      return body;
    } finally {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    }
  } finally {
    // Best-effort cleanup of the temp module. A stray file never breaks a test.
    try {
      unlinkSync(file);
    } catch {
      // Already gone; ignore.
    }
    try {
      unlinkSync(serverRuntimeShimPath);
    } catch {
      // Already gone; ignore.
    }
  }
}
