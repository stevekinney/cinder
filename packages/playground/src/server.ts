/**
 * Cinder component playground dev server.
 *
 * Runs at http://localhost:4173. Routes:
 *   GET /              → 302 redirect to /c/<first-component>
 *   GET /c/:name       → shell HTML (sidebar + iframe pointing at /page/:name)
 *   GET /page/:name    → component page HTML (the iframe target — lists examples)
 *   GET /bundle/:name/:scenario.js → compiled example bundle (cached)
 *   GET /styles.css    → raw contents of src/styles/index.css
 *   GET /example-src/:name/:scenario → raw .example.svelte source
 *   GET /events        → Server-Sent Events stream for live reload
 *   GET /ping          → health check ("pong")
 *
 * A file watcher on `src/` triggers a reload event to all connected SSE clients
 * whenever a file changes. Use `triggerReload()` directly in tests.
 */

import { randomUUID } from 'node:crypto';
import { unlinkSync, watch, type FSWatcher } from 'node:fs';
import { dirname, join } from 'node:path';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { analyzeAll } from './analyze.ts';
import { discoverComponents, discoverExamples } from './discover.ts';
import { renderShell } from './render-shell.ts';
import type { ComponentManifest } from './types.ts';
import { generateWrapper } from './wrapper-generator.ts';

export const PORT = 4173;
// import.meta.dirname is packages/playground/src/
const PLAYGROUND_ROOT = dirname(import.meta.dirname); // packages/playground/
const COMPONENTS_ROOT = join(PLAYGROUND_ROOT, '..', 'components'); // packages/components/

/** Compiled bundle cache: "componentName/scenario" → JS source string. */
const bundleCache = new Map<string, string>();

/** Resolved manifest array — cached after first analysis. */
let manifestCache: ComponentManifest[] | null = null;
/** In-flight analyzeAll() promise — prevents duplicate concurrent analyses. */
let manifestPromise: Promise<ComponentManifest[]> | null = null;

/** Set of active SSE stream controllers. */
const sseClients = new Set<ReadableStreamDefaultController<string>>();

/** Send a `reload` event to every connected SSE client. */
export function triggerReload(): void {
  const message = 'event: reload\ndata: {}\n\n';
  const dead: ReadableStreamDefaultController<string>[] = [];
  for (const controller of sseClients) {
    try {
      controller.enqueue(message);
    } catch {
      // Client already closed — collect for removal after iteration.
      dead.push(controller);
    }
  }
  for (const controller of dead) {
    sseClients.delete(controller);
  }
}

/** Start watching `src/` and `src/examples/` for live reload. */
function startWatcher(): FSWatcher[] {
  const created: FSWatcher[] = [];

  try {
    const srcPath = join(COMPONENTS_ROOT, 'src');
    created.push(
      watch(srcPath, { recursive: true }, (_event, filename) => {
        if (filename) {
          // Clear both caches on any src/ change. Each example imports from
          // the cinder workspace package which re-exports every component, so
          // editing any component invalidates all cached example bundles. Also
          // clear the component-page bundle since it imports from svelte which
          // may pull in updated code.
          bundleCache.clear();
          componentPageBundleCache = null;
          manifestCache = null;
          manifestPromise = null;
          triggerReload();
        }
      }),
    );

    // Watch the examples directory so edits to .example.svelte files invalidate
    // the cached bundle and trigger a browser reload.
    const examplesPath = join(PLAYGROUND_ROOT, 'src', 'examples');
    created.push(
      watch(examplesPath, { recursive: true }, (_event, filename) => {
        if (filename) {
          const match = filename.match(/^([^/]+)\/([^/]+)\.example\.svelte$/);
          if (match) {
            bundleCache.delete(`${match[1]}/${match[2]}`);
          }
          triggerReload();
        }
      }),
    );
  } catch (error) {
    // Close any watchers already created before rethrowing.
    for (const watcher of created) {
      watcher.close();
    }
    throw error;
  }

  return created;
}

/** Compile an example bundle and cache the result. */
async function buildBundle(componentName: string, scenario: string): Promise<string | null> {
  const cacheKey = `${componentName}/${scenario}`;
  if (bundleCache.has(cacheKey)) {
    return bundleCache.get(cacheKey)!;
  }

  const examplePath = join(
    PLAYGROUND_ROOT,
    'src',
    'examples',
    componentName,
    `${scenario}.example.svelte`,
  );
  const file = Bun.file(examplePath);
  const exists = await file.exists();
  if (!exists) return null;

  const result = await Bun.build({
    entrypoints: [examplePath],
    plugins: [sveltePlugin({ generate: 'client' })],
    target: 'browser',
    format: 'esm',
  });

  if (!result.success) {
    console.error(`[playground] Bundle failed for ${componentName}/${scenario}:`, result.logs);
    return null;
  }

  const output = result.outputs[0];
  if (!output) return null;

  const code = await output.text();
  bundleCache.set(cacheKey, code);
  return code;
}

/** Extract title/description from an example file's module script via regex. */
async function readExampleMetadata(
  filePath: string,
): Promise<{ title: string; description?: string }> {
  const source = await Bun.file(filePath).text();
  const titleMatch = source.match(/export\s+const\s+title\s*=\s*['"]([^'"]+)['"]/);
  const descriptionMatch = source.match(/export\s+const\s+description\s*=\s*['"]([^'"]+)['"]/);
  const meta: { title: string; description?: string } = {
    title: titleMatch?.[1] ?? 'Untitled',
  };
  if (descriptionMatch?.[1] !== undefined) {
    meta.description = descriptionMatch[1];
  }
  return meta;
}

/** Cache for the component-page client bundle. */
let componentPageBundleCache: string | null = null;

/** Compile the component-page.svelte into a client bundle (cached). */
async function buildComponentPageBundle(): Promise<string | null> {
  if (componentPageBundleCache !== null) return componentPageBundleCache;

  const entrypoint = join(PLAYGROUND_ROOT, 'src', 'component-page.svelte');
  const result = await Bun.build({
    entrypoints: [entrypoint],
    plugins: [sveltePlugin({ generate: 'client' })],
    target: 'browser',
    format: 'esm',
  });

  if (!result.success) {
    console.error('[playground] component-page bundle failed:', result.logs);
    return null;
  }

  const output = result.outputs[0];
  if (!output) return null;

  const code = await output.text();
  componentPageBundleCache = code;
  return code;
}

/**
 * Return the full manifest array, using the module-level cache.
 * Cleared whenever bundleCache.clear() is called (i.e., on any src/ change).
 */
async function getManifests(): Promise<ComponentManifest[]> {
  if (manifestCache !== null) return manifestCache;
  // Reuse the in-flight promise so concurrent callers don't each start analyzeAll().
  manifestPromise ??= analyzeAll(join(COMPONENTS_ROOT, 'src', 'components'));
  try {
    manifestCache = await manifestPromise;
    return manifestCache;
  } finally {
    manifestPromise = null;
  }
}

/**
 * Compile a controls wrapper bundle for the given component and cache the result
 * under the key `${componentName}/controls`.
 */
async function buildControlsBundle(componentName: string): Promise<string | null> {
  const cacheKey = `${componentName}/controls`;
  if (bundleCache.has(cacheKey)) {
    return bundleCache.get(cacheKey)!;
  }

  const manifests = await getManifests();
  const manifest = manifests.find((m) => m.kebabName === componentName);
  if (manifest === undefined) return null;

  // Use manifest.file (absolute source path) as importPath so Bun.build can
  // resolve it from the temp wrapper file without needing the cinder package installed.
  const wrapperSource = generateWrapper({
    ...manifest,
    name: manifest.kebabName,
    importPath: manifest.file,
  });

  // Write the temp wrapper inside the repo so Bun's module resolver can find
  // 'svelte' and other local deps (tmpdir is outside the module graph).
  const tempPath = join(
    PLAYGROUND_ROOT,
    'src',
    `.controls-${componentName}-${randomUUID()}.svelte`,
  );
  await Bun.write(tempPath, wrapperSource);

  try {
    const result = await Bun.build({
      entrypoints: [tempPath],
      plugins: [sveltePlugin({ generate: 'client' })],
      target: 'browser',
      format: 'esm',
    });

    if (!result.success) {
      console.error(`[playground] controls bundle failed for ${componentName}:`, result.logs);
      return null;
    }

    const output = result.outputs[0];
    if (!output) return null;

    const code = await output.text();
    bundleCache.set(cacheKey, code);
    return code;
  } finally {
    // Best-effort synchronous cleanup of the temp file.
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore — file may already be gone or never written.
    }
  }
}

/** Render the standalone component page HTML (the iframe content — no outer shell). */
async function renderComponentPage(componentName: string): Promise<string> {
  const scenarios = await discoverExamples(componentName);
  const examples = await Promise.all(
    scenarios.map(async (scenario) => {
      const filePath = join(
        PLAYGROUND_ROOT,
        'src',
        'examples',
        componentName,
        `${scenario}.example.svelte`,
      );
      const meta = await readExampleMetadata(filePath);
      return { scenario, ...meta };
    }),
  );

  const examplesJson = JSON.stringify(examples);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${componentName} — cinder playground</title>
    <link rel="stylesheet" href="/styles.css" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; min-height: 100%; }
      body {
        background-color: var(--cinder-bg);
        color: var(--cinder-text);
        font-family: var(--cinder-font-sans);
        font-size: var(--cinder-text-base);
        line-height: var(--cinder-leading-normal);
        padding: var(--cinder-space-6);
      }
      #app { display: contents; }
    </style>
  </head>
  <body>
    <script>window.__CINDER_EXAMPLES__ = ${examplesJson};</script>
    <div id="app"></div>
    <script type="module" src="/component-page.js"></script>
  </body>
</html>`;
}

/** Verify a path segment is a safe identifier (no path traversal). */
function isSafeSegment(segment: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(segment);
}

/** Build a plain-text 404 response. */
function notFound(message = 'Not Found'): Response {
  return new Response(message, { status: 404, headers: { 'Content-Type': 'text/plain' } });
}

/** Main request handler — exported for testing. */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  // GET /ping
  if (pathname === '/ping') {
    return new Response('pong', { headers: { 'Content-Type': 'text/plain' } });
  }

  // GET /events
  if (pathname === '/events') {
    let controller: ReadableStreamDefaultController<string> | undefined;
    const stream = new ReadableStream<string>({
      start(c) {
        controller = c;
        sseClients.add(c);
        // Send an initial comment to establish the connection.
        c.enqueue(': connected\n\n');
      },
      cancel() {
        if (controller) sseClients.delete(controller);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // GET /styles.css
  if (pathname === '/styles.css') {
    const cssPath = join(COMPONENTS_ROOT, 'src', 'styles', 'index.css');
    const cssFile = Bun.file(cssPath);
    if (!(await cssFile.exists())) return notFound('styles.css not found');
    const css = await cssFile.text();
    return new Response(css, { headers: { 'Content-Type': 'text/css' } });
  }

  // GET /bundle/:name/controls.js — compiled wrapper bundle (must precede the generic route)
  const controlsBundleMatch = pathname.match(/^\/bundle\/([^/]+)\/controls\.js$/);
  if (controlsBundleMatch) {
    const componentName = controlsBundleMatch[1]!;
    if (!isSafeSegment(componentName)) return notFound();
    const code = await buildControlsBundle(componentName);
    if (code === null)
      return notFound(`Controls bundle for "${componentName}" not found or failed to build`);
    return new Response(code, { headers: { 'Content-Type': 'application/javascript' } });
  }

  // GET /bundle/:name/:scenario.js (scenario must not be "controls" — handled above)
  const bundleMatch = pathname.match(/^\/bundle\/([^/]+)\/([^/]+)\.js$/);
  if (bundleMatch) {
    const componentName = bundleMatch[1]!;
    const scenario = bundleMatch[2]!;
    if (!isSafeSegment(componentName) || !isSafeSegment(scenario)) return notFound();
    const code = await buildBundle(componentName, scenario);
    if (code === null)
      return notFound(`Example "${componentName}/${scenario}" not found or failed to build`);
    return new Response(code, { headers: { 'Content-Type': 'application/javascript' } });
  }

  // GET /component-page.js — the component-page.svelte compiled for the browser
  if (pathname === '/component-page.js') {
    const code = await buildComponentPageBundle();
    if (code === null) return notFound('component-page bundle failed to build');
    return new Response(code, { headers: { 'Content-Type': 'application/javascript' } });
  }

  // GET /api/manifest — full manifest array
  if (pathname === '/api/manifest') {
    const manifests = await getManifests();
    return new Response(JSON.stringify(manifests), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/manifest/:name — single component manifest
  const apiManifestMatch = pathname.match(/^\/api\/manifest\/([^/]+)$/);
  if (apiManifestMatch) {
    const componentName = apiManifestMatch[1]!;
    if (!isSafeSegment(componentName)) return notFound();
    const manifests = await getManifests();
    const manifest = manifests.find((m) => m.kebabName === componentName);
    if (manifest === undefined) return notFound(`Manifest for "${componentName}" not found`);
    return new Response(JSON.stringify(manifest), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /page/:name — standalone component page (iframe content, no shell)
  const pageMatch = pathname.match(/^\/page\/([^/]+)$/);
  if (pageMatch) {
    const componentName = pageMatch[1]!;
    if (!isSafeSegment(componentName)) return notFound();
    const allComponents = await discoverComponents();
    if (!allComponents.includes(componentName))
      return notFound(`Component "${componentName}" not found`);
    const html = await renderComponentPage(componentName);
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  // GET /example-src/:name/:scenario
  const exampleSrcMatch = pathname.match(/^\/example-src\/([^/]+)\/([^/]+)$/);
  if (exampleSrcMatch) {
    const componentName = exampleSrcMatch[1]!;
    const scenario = exampleSrcMatch[2]!;
    if (!isSafeSegment(componentName) || !isSafeSegment(scenario)) return notFound();
    const examplePath = join(
      PLAYGROUND_ROOT,
      'src',
      'examples',
      componentName,
      `${scenario}.example.svelte`,
    );
    const exampleFile = Bun.file(examplePath);
    if (!(await exampleFile.exists()))
      return notFound(`Example "${componentName}/${scenario}" not found`);
    const source = await exampleFile.text();
    return new Response(source, { headers: { 'Content-Type': 'text/plain' } });
  }

  // GET /c/:name
  const componentMatch = pathname.match(/^\/c\/([^/]+)$/);
  if (componentMatch) {
    const componentName = componentMatch[1]!;
    if (!isSafeSegment(componentName)) return notFound();
    const allComponents = await discoverComponents();
    if (!allComponents.includes(componentName))
      return notFound(`Component "${componentName}" not found`);
    const html = renderShell(componentName, allComponents);
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  // GET / → redirect to first component
  if (pathname === '/') {
    const allComponents = await discoverComponents();
    if (allComponents.length === 0) {
      const html = renderShell(null, []);
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }
    const first = allComponents[0];
    return new Response(null, {
      status: 302,
      headers: { Location: `/c/${first}` },
    });
  }

  return notFound();
}

export type PlaygroundServer = {
  port: number;
  /** Stop the HTTP server and all file watchers. Awaitable. */
  dispose: () => Promise<void>;
};

/** Start the playground server on the given port. Returns a handle with dispose() to stop everything. */
export async function startServer(port: number = PORT): Promise<PlaygroundServer> {
  // Start the HTTP server first — if Bun.serve throws (e.g. EADDRINUSE),
  // no watchers are leaked.
  const server = Bun.serve({
    port,
    fetch: handleRequest,
  });

  let watchers: FSWatcher[];
  try {
    watchers = startWatcher();
  } catch (error) {
    // startWatcher() failed — stop the already-listening server before rethrowing.
    await server.stop(true);
    throw error;
  }

  async function dispose(): Promise<void> {
    for (const watcher of watchers) {
      watcher.close();
    }
    await server.stop(true);
  }

  const actualPort = server.port ?? port;
  process.stdout.write(`[playground] Listening at http://localhost:${actualPort}\n`);
  return { port: actualPort, dispose };
}

if (import.meta.main) {
  await startServer();
}
