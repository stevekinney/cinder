/**
 * Cinder component playground dev server.
 *
 * Runs at http://localhost:4173. Routes:
 *   GET /              → 302 redirect to /c/<first-component>
 *   GET /c/:name       → shell HTML (sidebar + iframe pointing at /page/:name)
 *   GET /page/:name    → component page HTML (the iframe target — lists examples)
 *   GET /page-bundle/:name.js → page-bundle entry OR a hashed code-split chunk.
 *                              Entry URLs are bare component names (e.g. chat.js);
 *                              chunk URLs are hashed (e.g. core-abc123.js). Both
 *                              artifact types share a flat namespace under /page-bundle/
 *                              so all dynamic-import URLs from either bundle family
 *                              resolve through this single route.
 *   GET /bundle/:name/:scenario.js → compiled example bundle (standalone — useful for tests/debugging)
 *   GET /styles.css    → raw contents of src/styles/index.css
 *   GET /example-src/:name/:scenario → raw .example.svelte source
 *   GET /events        → Server-Sent Events stream for live reload
 *   GET /ping          → health check ("pong")
 *
 * A file watcher on `src/` triggers a reload event to all connected SSE clients
 * whenever a file changes. Use `triggerReload()` directly in tests.
 */

import { randomUUID } from 'node:crypto';
import { rmSync, watch, type FSWatcher } from 'node:fs';
import { dirname, isAbsolute, join, relative as relativePath } from 'node:path';

import type { BuildArtifact } from 'bun';
import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { analyzeAll } from './analyze.ts';
import { discoverComponents, discoverExamples, discoverSidebarComponents } from './discover.ts';
import { renderShell } from './render-shell.ts';

import type { ComponentManifest } from './types.ts';

export const PORT = 4173;
// import.meta.dirname is packages/playground/src/
const PLAYGROUND_ROOT = dirname(import.meta.dirname); // packages/playground/
const COMPONENTS_ROOT = join(PLAYGROUND_ROOT, '..', 'components'); // packages/components/

/**
 * Page-bundle entries: keyed by component name → entry artifact path
 * (e.g. "page-chat.js"). Per-family disjoint key-space prevents collisions
 * with `bundleEntryByKey` since entries get prefix `page-` vs `bundle-`.
 */
const pageEntryByName = new Map<string, string>();

/**
 * Per-scenario bundle entries: keyed by "<name>/<scenario>" → entry
 * artifact path (e.g. "bundle-chat-basic.js").
 */
const bundleEntryByKey = new Map<string, string>();

/**
 * Shared artifact contents: artifact.path → JS source. Holds entries from
 * BOTH bundle families plus all hashed async chunks (e.g. `core-abc123.js`).
 * All artifacts share a flat namespace under `/page-bundle/` — there is no
 * `chunks/` subdirectory; the Bun `naming` config emits everything as
 * `[name]-[hash].js` at the same level as entries.
 *
 * Chunks are content-hashed, so when two builds emit the same chunk path
 * the bytes are identical — no overwrite hazard. Entries can never collide
 * because they use disjoint `page-` / `bundle-` prefixes.
 */
const artifactByPath = new Map<string, string>();

/** Resolved manifest array — cached after first analysis. */
let manifestCache: ComponentManifest[] | null = null;
/** In-flight analyzeAll() promise — prevents duplicate concurrent analyses. */
let manifestPromise: Promise<ComponentManifest[]> | null = null;

/**
 * Atomically clear every build-derived cache. The three artifact maps and
 * the manifest cache are cleared in one synchronous call so a request can
 * never observe a partially-cleared state.
 */
function clearCaches(): void {
  pageEntryByName.clear();
  bundleEntryByKey.clear();
  artifactByPath.clear();
  manifestCache = null;
  manifestPromise = null;
}

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
          // Clear all caches on any src/ change. Each example imports from
          // the cinder workspace package which re-exports every component, so
          // editing any component invalidates every cached bundle. Chunks are
          // content-hashed but their *contents* may have changed even if the
          // hash didn't (different hash inputs that collide aren't a real
          // hazard, but stale chunk source is) — clear them too.
          clearCaches();
          triggerReload();
        }
      }),
    );

    // Watch the examples directory so edits to .example.svelte files invalidate
    // the cached bundle and trigger a browser reload. Examples are compiled
    // into per-component page bundles AND per-scenario bundles, so we clear
    // both family entries plus every chunk (chunks are shared across builds).
    const examplesPath = join(PLAYGROUND_ROOT, 'src', 'examples');
    created.push(
      watch(examplesPath, { recursive: true }, (_event, filename) => {
        if (filename) {
          // Clear all caches. The partial approach (deleting only the changed
          // component's entries while wiping all artifacts) left stale entry
          // references in the lookup maps that pointed at deleted artifacts,
          // causing spurious rebuilds on next request. A full clearCaches()
          // is simpler and correct — rebuilds are cheap relative to the cost
          // of serving stale content.
          if (filename.match(/^([^/]+)\/([^/]+)\.example\.svelte$/)) {
            clearCaches();
          }
          triggerReload();
        }
      }),
    );

    // Watch the playground src tree (component-page.svelte, render-shell.ts,
    // analyze.ts, etc.) — these are baked into every page bundle, so any edit
    // must invalidate every cached bundle.
    const playgroundSrcPath = join(PLAYGROUND_ROOT, 'src');
    created.push(
      watch(playgroundSrcPath, { recursive: true }, (_event, filename) => {
        if (
          filename &&
          !filename.startsWith('examples/') &&
          !filename.endsWith('.test.ts') &&
          !filename.startsWith('.')
        ) {
          clearCaches();
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

/**
 * Shared Bun.build options for both bundle families.
 *
 * All artifacts use a flat namespace under `/page-bundle/` so that
 * dynamic-import URLs emitted by either family resolve through one route.
 * Putting chunks in a `chunks/` subdir triggers a Bun publicPath quirk
 * where peer-chunk imports get the subdirectory stripped from their URL.
 */
const SHARED_BUILD_OPTIONS = {
  plugins: [sveltePlugin({ generate: 'client', injectCss: true })],
  target: 'browser',
  format: 'esm',
  conditions: ['bun'],
  splitting: true,
  publicPath: '/page-bundle/',
  naming: {
    entry: '[name]-[hash].js',
    chunk: '[name]-[hash].js',
    asset: '[name]-[hash][ext]',
  },
};

/**
 * Walk `result.outputs`, store every artifact in `artifactByPath`, and
 * return the `kind === 'entry-point'` artifact's path and source.
 *
 * Returns `null` if no entry-point artifact was found (shouldn't happen
 * with a valid Bun.build result, but handled defensively).
 */
async function collectBuildArtifacts(
  outputs: BuildArtifact[],
): Promise<{ entryPath: string; entryCode: string } | null> {
  let entryCode: string | null = null;
  let entryPath: string | null = null;
  for (const output of outputs) {
    const path = artifactRelativePath(output.path);
    const code = await output.text();
    artifactByPath.set(path, code);
    if (output.kind === 'entry-point') {
      entryCode = code;
      entryPath = path;
    }
  }
  if (entryPath === null || entryCode === null) return null;
  return { entryPath, entryCode };
}

/**
 * Compile a per-scenario example bundle with code splitting enabled.
 *
 * Stores the entry artifact path in `bundleEntryByKey` and every artifact's
 * source in `artifactByPath`. Returns the entry's compiled JS, or null if
 * the example file doesn't exist or the build fails.
 *
 * The entry is named `bundle-<componentName>-<scenario>.js` via a temp
 * entry file basename (Bun's `naming` template uses the entrypoint's
 * basename for `[name]`). This keeps it in a disjoint key-space from
 * page-bundle entries (`page-<name>.js`).
 */
async function buildBundle(componentName: string, scenario: string): Promise<string | null> {
  const cacheKey = `${componentName}/${scenario}`;
  const cachedEntryPath = bundleEntryByKey.get(cacheKey);
  if (cachedEntryPath) {
    const cached = artifactByPath.get(cachedEntryPath);
    if (cached !== undefined) return cached;
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

  // Bun's `naming` template uses the entrypoint basename for `[name]`. To
  // emit the entry as `bundle-<name>-<scenario>.js` (disjoint from the
  // page-bundle family's `page-<name>.js`) we write a tiny re-export shim
  // at exactly that basename. The shim lives under a UUID-tagged
  // subdirectory under `src/` so concurrent builds don't clobber each
  // other on disk; the basename itself stays stable so Bun's `[name]`
  // resolves predictably.
  const entryBasename = `bundle-${componentName}-${scenario}`;
  const entryTempDir = join(PLAYGROUND_ROOT, 'src', `.tmp-${randomUUID()}`);
  const entryTempPath = join(entryTempDir, `${entryBasename}.ts`);
  const shim = `export { default } from '../examples/${componentName}/${scenario}.example.svelte';\n`;

  try {
    // Bun.write auto-creates parent directories. We keep the write inside
    // the try so a write failure still hits the finally cleanup (rmSync
    // is idempotent for a missing dir).
    await Bun.write(entryTempPath, shim);

    const result = await Bun.build({ entrypoints: [entryTempPath], ...SHARED_BUILD_OPTIONS });

    if (!result.success) {
      console.error(`[playground] Bundle failed for ${componentName}/${scenario}:`, result.logs);
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error(`[playground] Bundle for ${componentName}/${scenario} produced no entry chunk`);
      return null;
    }

    bundleEntryByKey.set(cacheKey, entry.entryPath);
    return entry.entryCode;
  } finally {
    // Recursive remove handles intermediate files Bun might emit and is
    // idempotent if the dir was never created.
    rmSync(entryTempDir, { recursive: true, force: true });
  }
}

/**
 * Normalize an artifact path returned by Bun.build to the relative form we
 * use as a cache key.
 *
 * When `outdir` is omitted, Bun returns paths as either basenames
 * (`page-chat.js`) or with the `chunk` template prefix
 * (`chunks/foo-ab12.js`). Older or different Bun versions may prefix with
 * `./` (or `.\\` on Windows). We:
 *
 *   1. Strip a leading `./` or `.\\` so cache keys don't carry a redundant
 *      relative-path prefix.
 *   2. Normalize backslashes to forward slashes — Bun on Windows can emit
 *      `dir\\file.js`, but URL paths and our regex routes use `/`.
 */
function artifactRelativePath(path: string): string {
  return path.replace(/^\.[\\/]/, '').replaceAll('\\', '/');
}

/**
 * Extract title/description from an example file's module script via regex.
 *
 * Supports single-quoted, double-quoted, and template-literal (backtick) strings.
 * The matched body is run through `unescapeStringLiteral` so escape sequences
 * like `\n`, `\'`, and `\\` render correctly. Template literals with
 * `${...}` interpolations are intentionally not supported — example metadata
 * is a static label, not a computed expression.
 */
async function readExampleMetadata(
  filePath: string,
): Promise<{ title: string; description?: string }> {
  const source = await Bun.file(filePath).text();
  // Capture group 1 = the surrounding quote (one of `'`, `"`, ``\``);
  // group 2 = the body. The body matches anything that's not the matching
  // quote or a backslash-escape — backreferenced \1 enforces same-quote close.
  const stringPattern = /(['"`])((?:[^\\]|\\.)*?)\1/.source;
  const titleMatch = source.match(new RegExp(`export\\s+const\\s+title\\s*=\\s*${stringPattern}`));
  const descriptionMatch = source.match(
    new RegExp(`export\\s+const\\s+description\\s*=\\s*${stringPattern}`),
  );
  const meta: { title: string; description?: string } = {
    title: titleMatch ? unescapeStringLiteral(titleMatch[2] ?? '') : 'Untitled',
  };
  if (descriptionMatch?.[2] !== undefined) {
    meta.description = unescapeStringLiteral(descriptionMatch[2]);
  }
  return meta;
}

/** Resolve common JavaScript string escape sequences in a captured literal body. */
function unescapeStringLiteral(raw: string): string {
  return raw.replace(/\\(.)/g, (_match, char: string) => {
    switch (char) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case '\\':
        return '\\';
      case "'":
        return "'";
      case '"':
        return '"';
      case '`':
        return '`';
      default:
        return char;
    }
  });
}

/**
 * Build the all-in-one page bundle for a single component: component-page.svelte
 * plus every scenario, all in one `Bun.build` invocation so they share a
 * single Svelte runtime instance in the browser.
 *
 * Scenarios register themselves on `window.__CINDER_SCENARIOS__`, and
 * `component-page.svelte` reads that global on mount.
 */
async function buildPageBundle(componentName: string): Promise<string | null> {
  const cachedEntryPath = pageEntryByName.get(componentName);
  if (cachedEntryPath) {
    const cached = artifactByPath.get(cachedEntryPath);
    if (cached !== undefined) return cached;
  }

  // Validate that this is an actual component before building. A bundle for a
  // bogus name still compiles (empty scenario list + the no-examples fallback)
  // and would 200, hiding typos behind a "No examples found" UI. The
  // componentName must correspond to a real `.svelte` under components/src/.
  const components = await discoverComponents();
  if (!components.includes(componentName)) return null;

  const scenarios = await discoverExamples(componentName);
  // Zero scenarios is allowed: the bundle still mounts component-page.svelte,
  // which renders a "No examples found" fallback. Returning null here would
  // 404 the bundle URL and the iframe would silently fail to load.

  // Bun's `naming` template uses the entrypoint basename for `[name]`. We
  // give the temp file the basename `page-<componentName>` so the emitted
  // entry artifact is `page-<componentName>.js` — disjoint from the
  // `bundle-*` family that buildBundle produces. The temp directory has
  // a UUID for concurrent-build isolation.
  const entryBasename = `page-${componentName}`;
  const entryTempDir = join(PLAYGROUND_ROOT, 'src', `.tmp-${randomUUID()}`);
  const entryTempPath = join(entryTempDir, `${entryBasename}.ts`);

  const scenarioImports = scenarios
    .map(
      (scenario, index) =>
        `import Scenario_${index} from '../examples/${componentName}/${scenario}.example.svelte';`,
    )
    .join('\n');
  const scenarioRegistrations = scenarios
    .map((scenario, index) => `  ${JSON.stringify(scenario)}: Scenario_${index},`)
    .join('\n');

  const entrySource = `import { mount } from 'svelte';

import ComponentPage from '../component-page.svelte';
${scenarioImports}
const scenarios: Record<string, unknown> = {
${scenarioRegistrations}
};

(window as unknown as Record<string, unknown>)['__CINDER_SCENARIOS__'] = scenarios;
const target = document.getElementById('app');
if (target === null) {
  throw new Error('[cinder playground] #app target not found');
}

mount(ComponentPage, { target });
`;

  try {
    // Bun.write auto-creates parent directories. We keep the write inside
    // the try so a write failure still hits the finally cleanup (rmSync
    // is idempotent for a missing dir).
    await Bun.write(entryTempPath, entrySource);

    const result = await Bun.build({ entrypoints: [entryTempPath], ...SHARED_BUILD_OPTIONS });

    if (!result.success) {
      console.error(`[playground] page bundle failed for ${componentName}:`, result.logs);
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error(`[playground] page bundle for ${componentName} produced no entry chunk`);
      return null;
    }

    pageEntryByName.set(componentName, entry.entryPath);
    return entry.entryCode;
  } finally {
    // Recursive remove handles intermediate files Bun might emit and is
    // idempotent if the dir was never created.
    rmSync(entryTempDir, { recursive: true, force: true });
  }
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
    <link rel="stylesheet" href="/styles/index.css" />
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
    <script type="module" src="/page-bundle/${componentName}.js"></script>
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

  // GET /styles.css → packages/components/src/styles/index.css
  // GET /styles/<path>.css → packages/components/src/styles/<path>.css
  // The component-library's index.css uses `@import './tokens.css'` etc. which
  // the browser resolves relative to the served URL — so we need to serve the
  // full styles/ tree, not just the entry file.
  if (pathname === '/styles.css' || pathname.startsWith('/styles/')) {
    const STYLES_ROOT = join(COMPONENTS_ROOT, 'src', 'styles');
    const relative = pathname === '/styles.css' ? 'index.css' : pathname.slice('/styles/'.length);
    // Require an actual .css filename. Without this, `GET /styles/` resolves
    // to the styles directory itself, and Bun.file(dir).text() throws a 500.
    if (relative === '' || !relative.endsWith('.css')) return notFound();
    // Reject path-traversal attempts.
    if (relative.includes('..') || relative.startsWith('/')) return notFound();
    const cssPath = join(STYLES_ROOT, relative);
    // Guard against traversal that survives the includes('..') pre-filter via
    // canonicalization quirks. `relative()` keeps this check platform-safe:
    // POSIX paths use `/`, Windows paths use `\`, and adjacent-prefix bypasses
    // still resolve outside the styles root.
    const cssRelativePath = relativePath(STYLES_ROOT, cssPath);
    if (cssRelativePath.startsWith('..') || isAbsolute(cssRelativePath)) return notFound();
    const cssFile = Bun.file(cssPath);
    if (!(await cssFile.exists())) return notFound(`${relative} not found`);
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

  // GET /page-bundle/<filename>.js — covers two cases that share a flat
  // artifact namespace:
  //   1. The unhashed page-bundle entry URL `/page-bundle/<component>.js`
  //      (the request the iframe makes, where <component> is a safe
  //      segment like `chat`). We look that up via `pageEntryByName` and
  //      serve the actual hashed entry artifact.
  //   2. A hashed chunk URL the entry references, like
  //      `/page-bundle/page-chat-abc123.js` or `/page-bundle/core-def456.js`.
  //      These appear directly in `artifactByPath` and don't need a build.
  //
  // Resolution order: artifactByPath first (cheap lookup, no build), then
  // entry-name lookup with a build fallback.
  const pageBundleMatch = pathname.match(/^\/page-bundle\/([A-Za-z0-9_-]+)\.js$/);
  if (pageBundleMatch) {
    const filename = pageBundleMatch[1]!;
    const directHit = artifactByPath.get(`${filename}.js`);
    if (directHit !== undefined) {
      return new Response(directHit, {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }
    if (!isSafeSegment(filename)) return notFound();
    const code = await buildPageBundle(filename);
    if (code === null)
      return notFound(`Page bundle for "${filename}" not found or failed to build`);
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
    const sidebarComponents = await discoverSidebarComponents();
    const html = renderShell(componentName, sidebarComponents);
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  // GET / → redirect to first component
  if (pathname === '/') {
    const sidebarComponents = await discoverSidebarComponents();
    if (sidebarComponents.length === 0) {
      const html = renderShell(null, []);
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }
    const first = sidebarComponents[0];
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
