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
 *   - `/` (the redirect to the first component, emitted as an index.html meta-refresh)
 *   - `/c/<name>` shell HTML, for every sidebar component
 *   - `/page/<name>` iframe HTML, for every component
 *   - `/shell-bundle/shell.js` + every hashed chunk it imports
 *   - `/page-bundle/<name>.js` + every hashed chunk each imports
 *   - `/styles.css`, `/styles/all.css`, and every `/styles/*` + `/components/*`
 *     CSS the rendered HTML references
 *   - `/api/manifest` and `/api/manifest/<name>`
 *   - `/example-src/<name>/<scenario>` for every example
 *   - `/ping` (so the deploy smoke-test has a static `pong`)
 *
 * Run by the `vercel-build` script. The output directory is `public/`, which
 * `vercel.json` publishes as the deployment's static root.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { handleRequest } from '../src/playground-server.ts';
import {
  discoverComponents,
  discoverExamples,
  discoverSidebarComponents,
} from '../src/discover.ts';

const PLAYGROUND_ROOT = join(import.meta.dirname, '..');
const OUTPUT_DIRECTORY = join(PLAYGROUND_ROOT, 'public');
const ORIGIN = 'https://playground.local';

/** Every path written, so we never render the same route twice. */
const rendered = new Set<string>();

/**
 * Map a request pathname to the static file path under `public/`. A path with
 * extensionless HTML route (e.g. `/c/button`) becomes a directory `index.html`
 * so the static host (with `cleanUrls`) serves it at the clean URL. Every other
 * route is written as a literal file at its path: already-named files
 * (`/page-bundle/button.js`, `/styles/all.css`) verbatim, and extensionless
 * data routes (`/ping`, `/api/manifest/button`, `/example-src/x/y`) as a bare
 * file — NOT an `index.html` dir, which would mislabel JSON/text as HTML.
 */
function outputPathFor(pathname: string, isHtml: boolean): string {
  const clean = pathname.replace(/^\/+/, '');
  if (clean === '') return join(OUTPUT_DIRECTORY, 'index.html');
  const lastSegment = clean.split('/').pop() ?? '';
  const hasExtension = lastSegment.includes('.');
  // Only extensionless HTML pages get the index.html clean-URL treatment.
  const relative = !hasExtension && isHtml ? `${clean}/index.html` : clean;
  return join(OUTPUT_DIRECTORY, relative);
}

/**
 * Render one route through `handleRequest` and write the body to `public/`.
 * Returns the response body as text so callers can scrape it for further URLs
 * to render (HTML references its bundles/CSS; JS bundles import their chunks).
 * Non-2xx/3xx responses throw — a broken route must fail the build, not ship a
 * 404 page as if it were content.
 */
async function render(pathname: string): Promise<string | null> {
  if (rendered.has(pathname)) return null;
  rendered.add(pathname);

  const response = await handleRequest(new Request(`${ORIGIN}${pathname}`));
  // A redirect (the `/` → `/c/<first>` case) is materialized as a meta-refresh
  // index.html so the static host has something to serve at `/`.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location') ?? '/';
    const html = `<!DOCTYPE html><meta http-equiv="refresh" content="0; url=${location}"><link rel="canonical" href="${location}">`;
    await writeFile(outputPathFor(pathname, true), html);
    return null;
  }
  if (!response.ok) {
    throw new Error(`[static-export] ${pathname} → HTTP ${response.status} (expected 2xx)`);
  }
  const isHtml = (response.headers.get('Content-Type') ?? '').includes('text/html');
  const body = await response.text();
  await writeFile(outputPathFor(pathname, isHtml), body);
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
async function renderJsBundleGraph(entryPath: string): Promise<void> {
  const queue = [entryPath];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const js = await render(path);
    if (js === null) continue;
    for (const chunk of chunkUrlsFromJs(js)) {
      if (!rendered.has(chunk)) queue.push(chunk);
    }
  }
}

async function main(): Promise<void> {
  const start = Date.now();
  process.stdout.write('[static-export] rendering playground to public/…\n');

  const sidebarComponents = await discoverSidebarComponents();
  const allComponents = await discoverComponents();
  if (sidebarComponents.length === 0) {
    throw new Error('[static-export] no sidebar components discovered — nothing to render');
  }

  // The collected CSS/asset URLs the HTML references, rendered once at the end.
  const assetUrls = new Set<string>();
  const collect = (html: string): void => {
    for (const url of assetUrlsFromHtml(html)) assetUrls.add(url);
  };

  // Root redirect + the shell bundle graph (shared by every shell page).
  await render('/');
  await renderJsBundleGraph('/shell-bundle/shell.js');
  await render('/ping');
  // NOTE: the full `/api/manifest` array is intentionally NOT rendered. The UI
  // only ever fetches the per-component `/api/manifest/<name>` route, and
  // writing both would collide on the static host (a file at `api/manifest` and
  // a directory `api/manifest/` cannot coexist).

  // Per-component: shell page, iframe page, page-bundle graph, manifest, sources.
  for (const name of allComponents) {
    const pageHtml = await render(`/page/${name}`);
    if (pageHtml !== null) collect(pageHtml);
    await renderJsBundleGraph(`/page-bundle/${name}.js`);
    await render(`/api/manifest/${name}`);
    for (const scenario of await discoverExamples(name)) {
      await render(`/example-src/${name}/${scenario}`);
    }
  }
  for (const name of sidebarComponents) {
    const shellHtml = await render(`/c/${name}`);
    if (shellHtml !== null) collect(shellHtml);
  }

  // Now render every CSS/asset the pages referenced (styles + per-component CSS).
  for (const url of assetUrls) {
    if (!rendered.has(url)) await render(url);
  }

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  process.stdout.write(
    `[static-export] rendered ${rendered.size} files for ${sidebarComponents.length} components in ${seconds}s\n`,
  );
}

// Fire-and-forget: surface any failure as a non-zero exit so the build fails.
void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
