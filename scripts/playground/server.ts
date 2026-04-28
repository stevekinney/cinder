/**
 * Cinder component playground dev server.
 *
 * Runs at http://localhost:4173. Routes:
 *   GET /              → 302 redirect to /c/<first-component>
 *   GET /c/:name       → full shell HTML for the named component
 *   GET /bundle/:name/:scenario.js → compiled example bundle (cached)
 *   GET /styles.css    → raw contents of src/styles/index.css
 *   GET /example-src/:name/:scenario → raw .example.svelte source
 *   GET /events        → Server-Sent Events stream for live reload
 *   GET /ping          → health check ("pong")
 *
 * A file watcher on `src/` triggers a reload event to all connected SSE clients
 * whenever a file changes. Use `triggerReload()` directly in tests.
 */

import { watch } from 'node:fs';
import { join } from 'node:path';

import { sveltePlugin } from '../svelte-plugin.ts';
import { discoverComponents } from './discover.ts';
import { renderShell } from './render-shell.ts';

export const PORT = 4173;
const ROOT = process.cwd();

/** Compiled bundle cache: "componentName/scenario" → JS source string. */
const bundleCache = new Map<string, string>();

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

/** Start watching `src/` and `scripts/playground/examples/` for live reload. */
function startWatcher(): void {
  const srcPath = join(ROOT, 'src');
  watch(srcPath, { recursive: true }, (_event, filename) => {
    if (filename) {
      // Invalidate example bundle cache for any changed component.
      const match = filename.match(/^components\/([^/]+)\.svelte$/);
      if (match) {
        const componentName = match[1]!;
        for (const key of bundleCache.keys()) {
          if (key.startsWith(`${componentName}/`)) {
            bundleCache.delete(key);
          }
        }
      }
      triggerReload();
    }
  });

  // Watch the examples directory so edits to .example.svelte files invalidate
  // the cached bundle and trigger a browser reload.
  const examplesPath = join(ROOT, 'scripts', 'playground', 'examples');
  watch(examplesPath, { recursive: true }, (_event, filename) => {
    if (filename) {
      const match = filename.match(/^([^/]+)\/([^/]+)\.example\.svelte$/);
      if (match) {
        bundleCache.delete(`${match[1]}/${match[2]}`);
      }
      triggerReload();
    }
  });
}

/** Compile an example bundle and cache the result. */
async function buildBundle(componentName: string, scenario: string): Promise<string | null> {
  const cacheKey = `${componentName}/${scenario}`;
  if (bundleCache.has(cacheKey)) {
    return bundleCache.get(cacheKey)!;
  }

  const examplePath = join(
    ROOT,
    'scripts',
    'playground',
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
    const cssPath = join(ROOT, 'src', 'styles', 'index.css');
    const cssFile = Bun.file(cssPath);
    if (!(await cssFile.exists())) return notFound('styles.css not found');
    const css = await cssFile.text();
    return new Response(css, { headers: { 'Content-Type': 'text/css' } });
  }

  // GET /bundle/:name/:scenario.js
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

  // GET /example-src/:name/:scenario
  const exampleSrcMatch = pathname.match(/^\/example-src\/([^/]+)\/([^/]+)$/);
  if (exampleSrcMatch) {
    const componentName = exampleSrcMatch[1]!;
    const scenario = exampleSrcMatch[2]!;
    if (!isSafeSegment(componentName) || !isSafeSegment(scenario)) return notFound();
    const examplePath = join(
      ROOT,
      'scripts',
      'playground',
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

/** Start the playground server on the given port and return the Bun.Server instance. */
export function startServer(port: number = PORT): ReturnType<typeof Bun.serve> {
  startWatcher();

  const server = Bun.serve({
    port,
    fetch: handleRequest,
  });

  process.stdout.write(`[playground] Listening at http://localhost:${server.port}\n`);
  return server;
}

if (import.meta.main) {
  startServer();
}
