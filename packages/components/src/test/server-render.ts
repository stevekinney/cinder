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

import { rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Component } from 'svelte';
import { compile } from 'svelte/compiler';

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
  const source = await Bun.file(sourcePath).text();
  const compiled = compile(source, {
    filename: sourcePath,
    generate: 'server',
    css: 'external',
    dev: false,
  });

  // Resolve Svelte's server index and repoint the compiled module's bare
  // `svelte` imports at it. The temp module is imported in a `browser`-condition
  // process, which would otherwise resolve `svelte` to its client build and make
  // server-side lifecycle calls (`onDestroy`, `setContext`) throw.
  const sveltePackageUrl = import.meta.resolve('svelte/package.json');
  const serverIndexUrl = new URL('./src/index-server.js', sveltePackageUrl).href;
  const code = compiled.js.code.replaceAll(
    /from ['"]svelte['"]/g,
    `from ${JSON.stringify(serverIndexUrl)}`,
  );

  // Write the compiled SSR module **in the same directory** as the source so its
  // relative imports (e.g. `../../utilities/class-names.ts`) resolve identically,
  // and `svelte/internal/server` still resolves through the package's node_modules
  // tree. A `.mjs` extension keeps Bun's `.svelte.js` preload plugin from trying
  // to recompile our already-compiled output.
  const sourceDir = dirname(sourcePath);
  const ssrFileName = `.cinder-ssr-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`;
  const file = join(sourceDir, ssrFileName);
  await writeFile(file, code, 'utf-8');

  try {
    // The SSR module's default export is a server-only render function whose
    // shape doesn't match the public `Component<Props>` type. `render` accepts
    // it at runtime; we route through `unknown` because the public types are too
    // narrow to express the dual-target reality.
    const ssrModule = (await import(file)) as { default: unknown };
    const { render } = (await import('svelte/server')) as typeof import('svelte/server');
    const { body } = render(ssrModule.default as Component<Props>, { props });
    return body;
  } finally {
    // Best-effort cleanup of the temp module. A stray file never breaks a test.
    void rm(file, { force: true }).catch(() => {});
  }
}
