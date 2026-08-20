/// <reference lib="dom" />

import type { BunPlugin } from 'bun';
import { existsSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Component } from 'svelte';
import { compile, compileModule } from 'svelte/compiler';

import { setupHappyDom } from './happy-dom.ts';

type HydrateResult = {
  ssrHtml: string;
  warnings: string[];
  container: HTMLElement;
  cleanup: () => void;
};

const cinderSourceRoot = resolve(import.meta.dir, '..', '..', '..', '..', 'components', 'src');

export function resolveCinderSourceSubpath(specifier: string): string | undefined {
  const prefix = '@lostgradient/cinder/';
  if (!specifier.startsWith(prefix)) return undefined;

  const subpath = specifier.slice(prefix.length);
  if (!subpath || subpath.includes('/')) return undefined;
  const sourcePath =
    subpath === 'icons'
      ? join(cinderSourceRoot, 'icons', 'index.ts')
      : join(cinderSourceRoot, 'components', subpath, 'index.ts');
  return existsSync(sourcePath) ? sourcePath : undefined;
}

function compilePlugin(generate: 'client' | 'server'): BunPlugin {
  const namespace = `editor-hydrate-${generate}`;
  const isFileSpecifier = (specifier: string): boolean =>
    isAbsolute(specifier) || specifier.startsWith('.');

  return {
    name: namespace,
    setup(builder) {
      builder.onResolve({ filter: /^@lostgradient\/cinder\/.+$/ }, ({ path }) => {
        const sourcePath = resolveCinderSourceSubpath(path);
        return sourcePath ? { path: sourcePath } : undefined;
      });

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
        const result = compile(await Bun.file(path).text(), {
          filename: path,
          generate,
          css: 'external',
          dev: true,
        });
        return { contents: result.js.code, loader: 'js' };
      });

      builder.onResolve({ filter: /\.svelte\.(js|ts)$/ }, ({ path, importer, resolveDir }) => {
        if (!isFileSpecifier(path)) return undefined;
        const baseDirectory = importer ? dirname(importer) : resolveDir;
        return { path: isAbsolute(path) ? path : resolve(baseDirectory, path), namespace };
      });

      builder.onLoad({ filter: /\.svelte\.(js|ts)$/, namespace }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const moduleSource = path.endsWith('.ts')
          ? new Bun.Transpiler({ loader: 'ts' }).transformSync(source)
          : source;
        const result = compileModule(moduleSource, {
          filename: path,
          generate,
          dev: true,
        });
        return { contents: result.js.code, loader: 'js' };
      });
    },
  };
}

async function buildComponentCode(
  sourcePath: string,
  generate: 'client' | 'server',
): Promise<string> {
  const build = await Bun.build({
    entrypoints: [sourcePath],
    target: 'bun',
    conditions: generate === 'client' ? ['browser', 'svelte'] : ['svelte'],
    external: ['svelte', 'svelte/*'],
    plugins: [compilePlugin(generate)],
  });
  if (!build.success) {
    const messages = build.logs.map((log) => String(log.message ?? log)).join('\n');
    throw new Error(`hydrate: ${generate} build failed for ${sourcePath}\n${messages}`);
  }
  const artifact = build.outputs[0];
  if (!artifact) throw new Error(`hydrate: no ${generate} artifact for ${sourcePath}`);
  return artifact.text();
}

/** Render a Svelte component with the server compiler, then hydrate its client build. */
export async function renderThenHydrate<Props extends Record<string, unknown>>(
  sourcePath: string,
  props: Props,
): Promise<HydrateResult> {
  setupHappyDom();

  const sveltePackageUrl = import.meta.resolve('svelte/package.json');
  const runtimeUrls = {
    abortSignal: new URL('./src/internal/server/abort-signal.js', sveltePackageUrl).href,
    context: new URL('./src/internal/server/context.js', sveltePackageUrl).href,
    errors: new URL('./src/internal/server/errors.js', sveltePackageUrl).href,
    hydratable: new URL('./src/internal/server/hydratable.js', sveltePackageUrl).href,
    internal: new URL('./src/internal/server/index.js', sveltePackageUrl).href,
    snippet: new URL('./src/internal/server/blocks/snippet.js', sveltePackageUrl).href,
    utilities: new URL('./src/internal/shared/utils.js', sveltePackageUrl).href,
  };
  const sourceDirectory = dirname(sourcePath);
  const filePrefix = `.editor-ssr-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const modulePath = join(sourceDirectory, `${filePrefix}.mjs`);
  const clientModulePath = join(sourceDirectory, `${filePrefix}.client.mjs`);
  const shimPath = join(sourceDirectory, `${filePrefix}.svelte-server.mjs`);
  const removeTemporaryFiles = () => {
    for (const filePath of [modulePath, clientModulePath, shimPath]) {
      try {
        unlinkSync(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  };

  let container: HTMLElement | undefined;
  try {
    await Bun.write(
      shimPath,
      [
        `import { ssr_context } from ${JSON.stringify(runtimeUrls.context)};`,
        `import { noop } from ${JSON.stringify(runtimeUrls.utilities)};`,
        `import * as errors from ${JSON.stringify(runtimeUrls.errors)};`,
        `export { noop as beforeUpdate, noop as afterUpdate, noop as onMount, noop as flushSync, run as untrack } from ${JSON.stringify(runtimeUrls.utilities)};`,
        `export { createContext, getAllContexts, getContext, hasContext, setContext } from ${JSON.stringify(runtimeUrls.context)};`,
        `export { getAbortSignal } from ${JSON.stringify(runtimeUrls.abortSignal)};`,
        `export { hydratable } from ${JSON.stringify(runtimeUrls.hydratable)};`,
        `export { createRawSnippet } from ${JSON.stringify(runtimeUrls.snippet)};`,
        'export function createEventDispatcher() { return noop; }',
        'export function onDestroy(fn) { ssr_context.r.on_destroy(fn); }',
        'export async function tick() {}',
        'export async function settled() {}',
        "export function mount() { errors.lifecycle_function_unavailable('mount'); }",
        "export function hydrate() { errors.lifecycle_function_unavailable('hydrate'); }",
        "export function unmount() { errors.lifecycle_function_unavailable('unmount'); }",
      ].join('\n'),
    );
    const compiledServerCode = await buildComponentCode(sourcePath, 'server');
    const serverCode = compiledServerCode
      .replaceAll(
        /from\s*['"]svelte\/internal\/server['"]/g,
        `from ${JSON.stringify(runtimeUrls.internal)}`,
      )
      .replaceAll(/from\s*['"]svelte['"]/g, `from ${JSON.stringify(pathToFileURL(shimPath).href)}`);
    await Bun.write(modulePath, serverCode);
    const clientRuntimeUrl = new URL('./src/index-client.js', sveltePackageUrl).href;
    const compiledClientCode = await buildComponentCode(sourcePath, 'client');
    const clientCode = compiledClientCode.replaceAll(
      /from\s*['"]svelte['"]/g,
      `from ${JSON.stringify(clientRuntimeUrl)}`,
    );
    await Bun.write(clientModulePath, clientCode);

    const serverModule = (await import(pathToFileURL(modulePath).href)) as { default: unknown };
    const clientModule = (await import(pathToFileURL(clientModulePath).href)) as {
      default: Component<Props>;
    };
    const { render } = await import('svelte/server');
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    globalThis.document = undefined as unknown as Document;
    globalThis.window = undefined as unknown as Window & typeof globalThis;
    let ssrHtml: string;
    try {
      ssrHtml = render(serverModule.default as Component<Props>, { props }).body;
    } finally {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    }

    container = document.createElement('div');
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map((argument) => String(argument)).join(' '));
    };
    let hydratedExports: Record<string, unknown> | undefined;
    let clientRuntime: typeof import('svelte') | undefined;
    try {
      clientRuntime = (await import(clientRuntimeUrl)) as typeof import('svelte');
      hydratedExports = clientRuntime.hydrate<Props, Record<string, unknown>>(
        clientModule.default,
        {
          target: container,
          props,
        },
      );
    } finally {
      console.warn = originalWarn;
    }

    return {
      ssrHtml,
      warnings,
      container,
      cleanup: () => {
        if (hydratedExports && clientRuntime) {
          void clientRuntime.unmount(hydratedExports, { outro: false });
        }
        container?.remove();
        removeTemporaryFiles();
      },
    };
  } catch (error) {
    container?.remove();
    removeTemporaryFiles();
    throw error;
  }
}
