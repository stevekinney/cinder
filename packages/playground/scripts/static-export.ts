/**
 * Static pre-render of the cinder playground for Vercel.
 *
 * The playground is a `Bun.serve` dev server that compiles Svelte/TS on the fly
 * with `Bun.build` + `svelte/compiler` + `ts-morph`. That toolchain works at
 * BUILD time (full workspace source + dev deps present) but cannot run inside a
 * deployed serverless function (the module graph doesn't resolve in the bundled
 * Lambda). So instead of shipping the dev server, we drive its `handleRequest`
 * here, at build time, and write every route's response to `public/` as a plain
 * static file. Vercel then serves those static assets — zero cold-start, no dev
 * toolchain in production.
 *
 * What gets rendered (every route `handleRequest` answers, except the live SSE
 * `/events` stream, which has no static form):
 *   - `/` README-backed landing shell HTML
 *   - `/c/<name>` shell HTML, for every sidebar component
 *   - `/page/<name>` iframe HTML, for every component
 *   - `/shell-bundle/shell.js` + every hashed chunk it imports
 *   - `/page-bundle/<name>.js` + every hashed chunk each imports
 *   - `/styles.css`, `/styles/all.css`, and every `/styles/*` + `/components/*`
 *     CSS the rendered HTML references
 *   - `/api/manifest/<name>` and `/api/documentation/<name>`
 *   - `/example-src/<name>/<scenario>` for every example
 *   - `/ping` (so the deploy smoke-test has a static `pong`)
 *
 * Run by the `vercel-build` script. The output directory is `public/`, which
 * `vercel.json` publishes as the deployment's static root.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  discoverComponents,
  discoverExamples,
  discoverSidebarComponents,
} from '../src/discover.ts';
import { handleRequest } from '../src/playground-server.ts';

const PLAYGROUND_ROOT = join(import.meta.dirname, '..');
const OUTPUT_DIRECTORY = join(PLAYGROUND_ROOT, 'public');
const ORIGIN = 'https://playground.local';

type StaticExportContext = {
  outputDirectory: string;
  rendered: Set<string>;
};

export type StaticExportOptions = {
  outputDirectory?: string;
  sidebarComponents?: string[];
  allComponents?: string[];
};

/**
 * Map a request pathname to the static file path under `public/`. A path with
 * extensionless HTML route (e.g. `/c/button`) becomes a directory `index.html`
 * so the static host (with `cleanUrls`) serves it at the clean URL. Every other
 * route is written as a literal file at its path: already-named files
 * (`/page-bundle/button.js`, `/styles/all.css`) verbatim, and extensionless
 * data routes (`/ping`, `/api/manifest/button`, `/example-src/x/y`) as a bare
 * file — NOT an `index.html` dir, which would mislabel JSON/text as HTML.
 */
function outputPathFor(pathname: string, isHtml: boolean, outputDirectory: string): string {
  const clean = pathname.replace(/^\/+/, '');
  if (clean === '') return join(outputDirectory, 'index.html');
  const lastSegment = clean.split('/').pop() ?? '';
  const hasExtension = lastSegment.includes('.');
  // Only extensionless HTML pages get the index.html clean-URL treatment.
  const relative = !hasExtension && isHtml ? `${clean}/index.html` : clean;
  return join(outputDirectory, relative);
}

/**
 * Render one route through `handleRequest` and write the body to `public/`.
 * Returns the response body as text so callers can scrape it for further URLs
 * to render (HTML references its bundles/CSS; JS bundles import their chunks).
 * Non-2xx/3xx responses throw — a broken route must fail the build, not ship a
 * 404 page as if it were content.
 */
async function render(pathname: string, context: StaticExportContext): Promise<string | null> {
  const { outputDirectory, rendered } = context;
  if (rendered.has(pathname)) return null;
  rendered.add(pathname);

  const response = await handleRequest(new Request(`${ORIGIN}${pathname}`));
  // Redirects are materialized as a meta-refresh index.html so the static host
  // has something to serve at that path.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location') ?? '/';
    const html = `<!DOCTYPE html><meta http-equiv="refresh" content="0; url=${location}"><link rel="canonical" href="${location}">`;
    await writeFile(outputPathFor(pathname, true, outputDirectory), html);
    return null;
  }
  if (!response.ok) {
    throw new Error(`[static-export] ${pathname} → HTTP ${response.status} (expected 2xx)`);
  }
  const isHtml = (response.headers.get('Content-Type') ?? '').includes('text/html');
  const body = await response.text();
  await writeFile(outputPathFor(pathname, isHtml, outputDirectory), body);
  return body;
}

/** Write a file, creating parent directories as needed. */
async function writeFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, contents);
}

/**
 * Pull every same-origin asset URL the given HTML references — the `<script
 * src>` bundles and `<link href>` stylesheets — as root-relative paths.
 */
function assetUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();
  const attribute = /\b(?:src|href)="(\/[^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = attribute.exec(html)) !== null) {
    const url = match[1]!;
    // Only crawlable GET routes — skip in-page anchors and the SSE stream.
    if (url === '/events' || url.startsWith('#')) continue;
    urls.add(url);
  }
  return [...urls];
}

/**
 * Pull the hashed-chunk URLs a built JS bundle imports. Bun emits chunks as
 * `<name>-<hash>.js` siblings under the same `/page-bundle/` or `/shell-bundle/`
 * prefix, referenced by `import`/`from` specifiers in the entry body.
 */
function chunkUrlsFromJs(js: string): string[] {
  const urls = new Set<string>();
  const specifier = /(\/(?:page-bundle|shell-bundle)\/[A-Za-z0-9_-]+\.js)/g;
  let match: RegExpExecArray | null;
  while ((match = specifier.exec(js)) !== null) urls.add(match[1]!);
  return [...urls];
}

/**
 * Render a JS bundle entry and recursively render every hashed chunk it
 * imports (and any chunks those import) until the graph is exhausted.
 */
async function renderJsBundleGraph(entryPath: string, context: StaticExportContext): Promise<void> {
  const queue = [entryPath];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const js = await render(path, context);
    if (js === null) continue;
    for (const chunk of chunkUrlsFromJs(js)) {
      if (!context.rendered.has(chunk)) queue.push(chunk);
    }
  }
}

/**
 * Resolve a CSS `@import` specifier (relative, e.g. `./tokens.css` or
 * `./components/button.css`) against the importing stylesheet's URL into a
 * root-relative path. Returns null for non-relative/absolute specifiers (none
 * are emitted by the cinder stylesheets, but be defensive).
 */
function resolveCssImport(fromUrl: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return specifier.startsWith('/') ? specifier : null;
  // Strip query/fragment, resolve `./` and `../` against the importer's dir.
  const base = fromUrl.slice(0, fromUrl.lastIndexOf('/') + 1);
  const segments = `${base}${specifier}`.split('/');
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return `/${out.join('/')}`;
}

/**
 * Pull the `@import` target URLs from a stylesheet, resolved to root-relative
 * paths. The cinder aggregators (`/styles/all.css`, `/styles/index.css`) import
 * tokens/foundation/utilities and `components.css`, which in turn imports every
 * per-component `/components/<name>.css` — none of which the HTML references
 * directly, so they must be followed here or they 404 and the site renders
 * unstyled.
 */
function cssImportUrlsFrom(fromUrl: string, css: string): string[] {
  const urls = new Set<string>();
  // @import './x.css';  @import "./x.css" layer(...);  @import url(./x.css);
  const importRule = /@import\s+(?:url\(\s*)?["']?([^"')\s]+\.css)["']?/g;
  let match: RegExpExecArray | null;
  while ((match = importRule.exec(css)) !== null) {
    const resolved = resolveCssImport(fromUrl, match[1]!);
    if (resolved !== null) urls.add(resolved);
  }
  return [...urls];
}

/**
 * Render a CSS entry and recursively render every stylesheet it `@import`s
 * (and their imports) until the graph is exhausted — mirroring the JS chunk
 * graph so the full `@import` cascade is materialized as static files.
 */
async function renderCssGraph(entryPath: string, context: StaticExportContext): Promise<void> {
  const queue = [entryPath];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const css = await render(path, context);
    if (css === null) continue;
    for (const importUrl of cssImportUrlsFrom(path, css)) {
      if (!context.rendered.has(importUrl)) queue.push(importUrl);
    }
  }
}

export async function runStaticExport(options: StaticExportOptions = {}): Promise<Set<string>> {
  const start = Date.now();
  process.stdout.write('[static-export] rendering playground to public/…\n');
  const outputDirectory = options.outputDirectory ?? OUTPUT_DIRECTORY;
  const context: StaticExportContext = {
    outputDirectory,
    rendered: new Set<string>(),
  };

  const sidebarComponents = options.sidebarComponents ?? (await discoverSidebarComponents());
  const allComponents = options.allComponents ?? (await discoverComponents());
  if (sidebarComponents.length === 0) {
    throw new Error('[static-export] no sidebar components discovered — nothing to render');
  }

  // The collected CSS/asset URLs the HTML references, rendered once at the end.
  const assetUrls = new Set<string>();
  const collect = (html: string): void => {
    for (const url of assetUrlsFromHtml(html)) assetUrls.add(url);
  };

  // Root landing page + the shell bundle graph (shared by every shell page).
  const rootHtml = await render('/', context);
  if (rootHtml !== null) collect(rootHtml);
  await renderJsBundleGraph('/shell-bundle/shell.js', context);
  await render('/ping', context);
  // NOTE: the full `/api/manifest` array is intentionally NOT rendered. The UI
  // only ever fetches the per-component `/api/manifest/<name>` route, and
  // writing both would collide on the static host (a file at `api/manifest` and
  // a directory `api/manifest/` cannot coexist).

  // Per-component: shell page, iframe page, page-bundle graph, manifest, sources.
  for (const name of allComponents) {
    const pageHtml = await render(`/page/${name}`, context);
    if (pageHtml !== null) collect(pageHtml);
    await renderJsBundleGraph(`/page-bundle/${name}.js`, context);
    await render(`/api/manifest/${name}`, context);
    await render(`/api/documentation/${name}`, context);
    for (const scenario of await discoverExamples(name)) {
      await render(`/example-src/${name}/${scenario}`, context);
    }
  }
  for (const name of sidebarComponents) {
    const shellHtml = await render(`/c/${name}`, context);
    if (shellHtml !== null) collect(shellHtml);
  }

  // Now render every CSS/asset the pages referenced. A stylesheet is rendered
  // through the CSS graph so its `@import` cascade (tokens → foundation →
  // components.css → every per-component CSS → utilities) is materialized too —
  // those imported files are referenced by no HTML, so without this they 404
  // and the deployed site renders unstyled.
  for (const url of assetUrls) {
    if (context.rendered.has(url)) continue;
    if (url.endsWith('.css')) await renderCssGraph(url, context);
    else await render(url, context);
  }

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  process.stdout.write(
    `[static-export] rendered ${context.rendered.size} files for ${sidebarComponents.length} components in ${seconds}s\n`,
  );
  return context.rendered;
}

// Fire-and-forget: surface any failure as a non-zero exit so the build fails.
if (import.meta.main) {
  void runStaticExport().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
