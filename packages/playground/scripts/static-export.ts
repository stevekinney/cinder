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
 *   - `/page/<name>` documentation HTML, for every component (the ONE
 *     documentation surface; `/c/<name>` is a legacy alias redirected by
 *     `vercel.json` and deliberately not written here)
 *   - `/shell-bundle/shell.js` + every hashed chunk it imports
 *   - `/page-bundle/<name>.js` + every hashed chunk each imports
 *   - `/styles.css`, `/styles/all.css`, and every core or extracted-package CSS
 *     asset the rendered HTML references
 *   - `/api/manifest/<name>` and `/api/documentation/<name>`
 *   - `/example-src/<name>/<scenario>` for every example
 *   - `/ping` (so the deploy smoke-test has a static `pong`)
 *
 * Run by the `vercel-build` script. The output directory is `public/`, which
 * `vercel.json` publishes as the deployment's static root.
 */

import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse,
  relative as relativePath,
  resolve,
  sep,
} from 'node:path';

import {
  discoverComponents,
  discoverExamples,
  discoverSidebarComponents,
} from '../src/discover.ts';
import { handleRequest } from '../src/playground-server.ts';
import { COMPOUND_COMPONENT_FAMILIES } from '../src/shell-app/compound-families.ts';
import { fingerprintStaticAssets } from './static-asset-fingerprints.ts';

const PLAYGROUND_ROOT = join(import.meta.dirname, '..');
const OUTPUT_DIRECTORY = join(PLAYGROUND_ROOT, 'public');
const ORIGIN = 'https://playground.local';

type StaticExportContext = {
  outputDirectory: string;
  rendered: Set<string>;
  origin: string;
};

export type StaticExportOptions = {
  outputDirectory?: string;
  sidebarComponents?: string[];
  allComponents?: string[];
  /** Test-only override. Real exports must supply PLAYGROUND_BASE_URL. */
  baseUrl?: string;
};

export type InitialRoutePayload = {
  transferBytes: number;
  decodedBytes: number;
  urls: readonly string[];
};

type InitialRoutePayloadBudget = {
  route: string;
  transferBytes: number;
  decodedBytes: number;
};

// These are production budgets for the first navigation. A route's deferred
// scenario and Playground imports are intentionally excluded: they are not
// requested until the reader opens an interactive surface.
const INITIAL_ROUTE_PAYLOAD_BUDGETS: readonly InitialRoutePayloadBudget[] = [
  { route: '/', transferBytes: 175_000, decodedBytes: 800_000 },
  { route: '/page/button', transferBytes: 200_000, decodedBytes: 900_000 },
  { route: '/page/chat', transferBytes: 700_000, decodedBytes: 3_250_000 },
];

/**
 * The exported site has no request-time server that can repair a bad canonical
 * origin, so reject anything except a clean HTTPS origin before writing files.
 */
export function requireProductionBaseUrl(value = Bun.env['PLAYGROUND_BASE_URL'] ?? ''): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('[static-export] PLAYGROUND_BASE_URL must be an absolute HTTPS URL');
  }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(
      '[static-export] PLAYGROUND_BASE_URL must be an absolute HTTPS origin without a path, query, or fragment',
    );
  }
  return url.origin;
}

/** Resolve symlinks in an existing ancestor while retaining missing child segments. */
function canonicalizeOutputPath(outputDirectory: string): string {
  let existingAncestor = resolve(outputDirectory);
  const missingSegments: string[] = [];
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) break;
    missingSegments.unshift(basename(existingAncestor));
    existingAncestor = parent;
  }
  return join(realpathSync(existingAncestor), ...missingSegments);
}

/** Refuse roots and repository source paths before clearing static output. */
export function assertSafeOutputDirectory(outputDirectory: string): string {
  const resolved = canonicalizeOutputPath(outputDirectory);
  if (resolved === parse(resolved).root) {
    throw new Error('[static-export] refusing to clear a filesystem root');
  }
  const repositoryRoot = canonicalizeOutputPath(join(PLAYGROUND_ROOT, '..', '..'));
  const generatedOutputRoot = canonicalizeOutputPath(OUTPUT_DIRECTORY);
  const isSameOrNestedPath = (parent: string, child: string): boolean => {
    const pathRelativeToParent = relativePath(parent, child);
    return (
      pathRelativeToParent === '' ||
      (!pathRelativeToParent.startsWith(`..${sep}`) &&
        pathRelativeToParent !== '..' &&
        !isAbsolute(pathRelativeToParent))
    );
  };
  const isRepositoryAncestor = isSameOrNestedPath(resolved, repositoryRoot);
  const isUnapprovedRepositoryPath =
    isSameOrNestedPath(repositoryRoot, resolved) &&
    resolved !== generatedOutputRoot &&
    !isSameOrNestedPath(generatedOutputRoot, resolved);
  if (isRepositoryAncestor || isUnapprovedRepositoryPath) {
    throw new Error('[static-export] refusing to clear a protected repository path');
  }
  return resolved;
}

function sitemapXml(baseUrl: string, routes: readonly string[]): string {
  const urls = routes.map((route) => `${baseUrl}${route}`);
  if (new Set(urls).size !== urls.length) {
    throw new Error('[static-export] sitemap route inventory contains duplicate URLs');
  }
  if (urls.some((url) => !url.startsWith('https://') || new URL(url).search !== '')) {
    throw new Error('[static-export] sitemap must contain clean absolute HTTPS URLs only');
  }
  const entries = urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function assertSitemapMatchesRoutes(
  xml: string,
  baseUrl: string,
  routes: readonly string[],
): void {
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    throw new Error('[static-export] sitemap must be UTF-8 XML');
  }
  const actual = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
  const expected = routes.map((route) => `${baseUrl}${route}`);
  if (actual.length !== expected.length || new Set(actual).size !== actual.length) {
    throw new Error('[static-export] sitemap route count is missing or duplicated');
  }
  for (const url of expected) {
    if (!actual.includes(url)) throw new Error(`[static-export] sitemap is missing ${url}`);
  }
}

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
 * Returns textual response bodies so callers can scrape HTML references and
 * JS/CSS imports. Binary assets are copied byte-for-byte and return null.
 * Non-2xx/3xx responses throw — a broken route must fail the build, not ship a
 * 404 page as if it were content.
 */
async function render(pathname: string, context: StaticExportContext): Promise<string | null> {
  const { outputDirectory, rendered } = context;
  if (rendered.has(pathname)) return null;
  rendered.add(pathname);

  const response = await handleRequest(new Request(`${context.origin}${pathname}`));
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
  const contentType = response.headers.get('Content-Type') ?? '';
  const isHtml = contentType.includes('text/html');
  const isText =
    contentType.startsWith('text/') ||
    contentType.includes('javascript') ||
    contentType.includes('json') ||
    contentType.includes('xml');
  const outputPath = outputPathFor(pathname, isHtml, outputDirectory);
  if (!isText) {
    await mkdir(dirname(outputPath), { recursive: true });
    await Bun.write(outputPath, await response.arrayBuffer());
    return null;
  }
  const body = await response.text();
  await writeFile(outputPath, body);
  return body;
}

/** Write a file, creating parent directories as needed. */
async function writeFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, contents);
}

/**
 * Elements whose `href`/`src` names a subresource the browser must fetch for the
 * page to render correctly, and which therefore has to exist as a static file.
 *
 * `<a>` is deliberately absent. An anchor is navigation, not a subresource, and
 * since the documentation pages became server-rendered their markup contains
 * example content with illustrative links — `SideNavigation.Item
 * href="/projects/atlas"` in `examples/side-navigation/basic.example.svelte`, for
 * instance. Those routes do not exist, and because `render()` throws on any
 * non-2xx response, crawling them failed the whole export with
 * `/projects/atlas → HTTP 404`.
 *
 * Every real route is enumerated explicitly by `runStaticExport` (`/page/<name>`
 * for all components and family children, the API and example-source routes), so scraping anchors added no coverage — only the risk of treating
 * demo content as a build requirement.
 */
const ASSET_ELEMENTS = ['link', 'script', 'img', 'iframe', 'source'] as const;

/**
 * Source for a regex matching an asset-bearing start tag, capturing its
 * root-relative `href`/`src`. Attribute order varies (`<link rel="stylesheet"
 * href="…">` vs `<link href="…" rel="…">`), so the URL is captured from anywhere
 * inside the tag.
 *
 * Held as a string and compiled per call: a shared `/g` regex carries `lastIndex`
 * between invocations, so a second call would silently resume mid-document.
 */
const ASSET_REFERENCE_SOURCE = `<(?:${ASSET_ELEMENTS.join('|')})\\b[^>]*?\\b(?:href|src)="(/[^"]*)"`;

/**
 * Pull every same-origin subresource URL the given HTML references — `<script
 * src>` bundles, `<link href>` stylesheets, and `<img>`/`<iframe>`/`<source>`
 * media — as root-relative paths. Navigation links are ignored; see
 * {@link ASSET_ELEMENTS}.
 */
export function assetUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();
  const assetReference = new RegExp(ASSET_REFERENCE_SOURCE, 'gi');
  let match: RegExpExecArray | null;
  while ((match = assetReference.exec(html)) !== null) {
    const url = match[1]!;
    // Only crawlable GET routes — skip the SSE stream, which has no static form.
    if (url === '/events') continue;
    // Queries configure browser behavior but do not identify a second static
    // file. Materialize `/page/button?preview=1` at the already-exported
    // `/page/button` path instead of creating a literal `?preview=1` directory.
    urls.add(new URL(url, ORIGIN).pathname);
  }
  return [...urls];
}

/** Static ESM imports are requested during initial evaluation; `import(...)` is not. */
function staticJavaScriptImportUrls(javascript: string): string[] {
  const urls = new Set<string>();
  const imports = /(?:^|\n)\s*import\s*(?:[\s\S]*?\s+from\s+)?["'](\/assets\/[^"']+\.js)["'];?/g;
  let match: RegExpExecArray | null;
  while ((match = imports.exec(javascript)) !== null) urls.add(match[1]!);
  return [...urls];
}

function stylesheetAssetUrls(stylesheet: string): string[] {
  const urls = new Set<string>();
  const imports = /@import\s+(?:url\(\s*)?["']?(\/assets\/[^"'\s)]+)["']?/g;
  const references = /url\(\s*["']?(\/assets\/[^"'\s)]+)["']?\s*\)/g;
  for (const expression of [imports, references]) {
    let match: RegExpExecArray | null;
    while ((match = expression.exec(stylesheet)) !== null) urls.add(match[1]!);
  }
  return [...urls];
}

function exportedHtmlPath(route: string, outputDirectory: string): string {
  return outputPathFor(route, true, outputDirectory);
}

/**
 * Sum the files a production browser requests to render a route before any
 * reader-triggered dynamic import. Every asset is gzipped independently, which
 * matches HTTP content encoding rather than pretending one archive compresses
 * across request boundaries.
 */
export async function initialRoutePayload(
  route: string,
  outputDirectory: string,
): Promise<InitialRoutePayload> {
  const queue = [{ url: route, filePath: exportedHtmlPath(route, outputDirectory), kind: 'html' }];
  const visited = new Set<string>();
  let transferBytes = 0;
  let decodedBytes = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.url)) continue;
    visited.add(current.url);

    const contents = new Uint8Array(await readFile(current.filePath));
    transferBytes += Bun.gzipSync(contents).byteLength;
    decodedBytes += contents.byteLength;

    const text = new TextDecoder().decode(contents);
    const dependencies =
      current.kind === 'html'
        ? assetUrlsFromHtml(text)
        : current.kind === 'javascript'
          ? staticJavaScriptImportUrls(text)
          : stylesheetAssetUrls(text);
    for (const url of dependencies) {
      if (!url.startsWith('/assets/')) continue;
      const extension = url.split('?')[0]!.split('.').pop()?.toLowerCase();
      queue.push({
        url,
        filePath: join(outputDirectory, url.slice(1)),
        kind: extension === 'js' || extension === 'mjs' ? 'javascript' : 'stylesheet',
      });
    }
  }

  return { transferBytes, decodedBytes, urls: [...visited].toSorted() };
}

async function assertInitialRoutePayloadBudgets(
  outputDirectory: string,
  exportedRoutes: readonly string[],
): Promise<void> {
  for (const budget of INITIAL_ROUTE_PAYLOAD_BUDGETS) {
    if (!exportedRoutes.includes(budget.route)) continue;
    const payload = await initialRoutePayload(budget.route, outputDirectory);
    if (payload.transferBytes > budget.transferBytes || payload.decodedBytes > budget.decodedBytes) {
      throw new Error(
        `[static-export] ${budget.route} initial payload exceeds budget: ` +
          `${payload.transferBytes}/${budget.transferBytes} transfer bytes, ` +
          `${payload.decodedBytes}/${budget.decodedBytes} decoded bytes. ` +
          `Assets: ${payload.urls.join(', ')}`,
      );
    }
  }
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
  const outputDirectory = assertSafeOutputDirectory(options.outputDirectory ?? OUTPUT_DIRECTORY);
  // Unit tests invoke the function directly and do not have a deployment
  // origin. The executable build path below always calls requireProductionBaseUrl.
  const baseUrl = options.baseUrl ?? Bun.env['PLAYGROUND_BASE_URL'] ?? 'https://playground.local';
  const context: StaticExportContext = {
    outputDirectory,
    rendered: new Set<string>(),
    origin: baseUrl,
  };

  // `public/` is generated deployment output. Start clean so an earlier export
  // cannot leave stale routes or stale immutable assets reachable by a new deploy.
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const sidebarComponents = options.sidebarComponents ?? (await discoverSidebarComponents());
  const allComponents = options.allComponents ?? (await discoverComponents());
  const sidebarRoutes = [
    ...new Set([
      ...sidebarComponents,
      ...sidebarComponents.flatMap((name) => COMPOUND_COMPONENT_FAMILIES[name] ?? []),
    ]),
  ];
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
  if (rootHtml !== null) {
    assertExactlyOneH1('landing page', rootHtml);
    assertDocumentationMetadata('landing page', rootHtml, baseUrl, '/');
    collect(rootHtml);
  }
  await renderJsBundleGraph('/shell-bundle/shell.js', context);
  await render('/ping', context);
  // NOTE: the full `/api/manifest` array is intentionally NOT rendered. The UI
  // only ever fetches the per-component `/api/manifest/<name>` route, and
  // writing both would collide on the static host (a file at `api/manifest` and
  // a directory `api/manifest/` cannot coexist).

  /*
   * Every component that needs a documentation page. `/page/<name>` is now the
   * ONE documentation surface, so it must cover both the full component list and
   * any navigable compound-family children — those used to be materialized only
   * by the `/c/<name>` loop, which is gone.
   */
  const documentationRoutes = [...new Set([...allComponents, ...sidebarRoutes])];
  const canonicalRoutes = ['/', ...documentationRoutes.map((name) => `/page/${name}`)];

  // Per-component: documentation page, page-bundle graph, manifest, sources.
  const documentationPages: { name: string; html: string }[] = [];
  for (const name of documentationRoutes) {
    const pageHtml = await render(`/page/${name}`, context);
    if (pageHtml !== null) {
      collect(pageHtml);
      documentationPages.push({ name, html: pageHtml });
      assertDocumentationMetadata(name, pageHtml, baseUrl, `/page/${name}`);
    }
    await renderJsBundleGraph(`/page-bundle/${name}.js`, context);
    await render(`/api/manifest/${name}`, context);
    await render(`/api/documentation/${name}`, context);
    for (const scenario of await discoverExamples(name)) {
      await render(`/example-src/${name}/${scenario}`, context);
    }
  }
  /*
   * `/c/<name>` is intentionally NOT exported. It is a legacy alias that 301s to
   * `/page/<name>`, declared in `vercel.json` so the host answers with a real
   * 301 rather than a meta-refresh stub. Writing files here would also put a
   * second documentation surface back into `public/`.
   */

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

  // Metadata points at this image but it is not an HTML subresource, so the
  // asset crawler cannot discover it. Materialize it explicitly and fail the
  // build if a shared social card ever disappears.
  await render('/social.png', context);

  const sitemap = sitemapXml(baseUrl, canonicalRoutes);
  assertSitemapMatchesRoutes(sitemap, baseUrl, canonicalRoutes);
  await writeFile(join(outputDirectory, 'sitemap.xml'), sitemap);
  await writeFile(
    join(outputDirectory, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`,
  );
  context.rendered.add('/sitemap.xml');
  context.rendered.add('/robots.txt');

  const { fingerprintedUrlBySourceUrl } = await fingerprintStaticAssets(outputDirectory);
  for (const [sourceUrl, fingerprintedUrl] of fingerprintedUrlBySourceUrl) {
    context.rendered.delete(sourceUrl);
    context.rendered.add(fingerprintedUrl);
  }

  assertDocumentationPagesArePreRendered(documentationPages);
  await assertInitialRoutePayloadBudgets(outputDirectory, canonicalRoutes);

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  process.stdout.write(
    `[static-export] rendered ${context.rendered.size} files for ${sidebarComponents.length} components in ${seconds}s\n`,
  );
  return context.rendered;
}

/**
 * Markers every server-rendered documentation page must carry.
 *
 * `data-component-page` is the page root's own attribute, and a `<h1>` proves the
 * hero rendered rather than an empty frame.
 */
const PRE_RENDER_MARKERS = ['data-component-page', '<h1'] as const;

/** An `#app` with no children is the exact shape of the regression guarded here. */
const EMPTY_MOUNT_ROOT = '<div id="app"></div>';

export function assertExactlyOneH1(name: string, html: string): void {
  const count = html.match(/<h1\b/gi)?.length ?? 0;
  if (count !== 1) throw new Error(`${name}: expected exactly one h1, found ${count}`);
}

/** Verify every static document retains one complete route-specific SEO contract. */
export function assertDocumentationMetadata(
  name: string,
  html: string,
  baseUrl: string,
  canonicalPath: string,
): void {
  const canonical = `${baseUrl}${canonicalPath}`;
  const required = [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${baseUrl}/social.png" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="',
    '<meta name="twitter:description" content="',
    '<script type="application/ld+json">',
  ];
  const missing = required.filter((value) => !html.includes(value));
  if (missing.length > 0) {
    throw new Error(`[static-export] ${name}: missing metadata ${missing.join(', ')}`);
  }
  const canonicalCount = html.split('<link rel="canonical"').length - 1;
  if (canonicalCount !== 1) {
    throw new Error(`[static-export] ${name}: expected one canonical URL, found ${canonicalCount}`);
  }
  const jsonLdMatches = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ];
  if (jsonLdMatches.length !== 1) {
    throw new Error(
      `[static-export] ${name}: expected one JSON-LD block, found ${jsonLdMatches.length}`,
    );
  }
  try {
    const parsed: unknown = JSON.parse(jsonLdMatches[0]![1]!);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`[static-export] ${name}: invalid JSON-LD: ${detail}`, { cause: error });
  }
}

/**
 * Fail the build when a documentation page exported without server-rendered
 * content.
 *
 * This is the guardrail for the original defect: `/page/<name>` shipped an empty
 * `<div id="app">` plus a bundle, so the deployed site rendered nothing until
 * JavaScript executed. That shipped silently because nothing asserted the
 * exported bytes actually contained the documentation — the export only checked
 * for a 2xx response.
 *
 * Throwing here is deliberate: `vercel-build` runs this script, so a page that
 * loses its pre-rendering fails the deploy instead of reaching production blank.
 *
 * @throws When any page lacks a pre-render marker or still has an empty `#app`.
 */
export function assertDocumentationPagesArePreRendered(
  pages: readonly { name: string; html: string }[],
): void {
  const failures: string[] = [];

  for (const { name, html } of pages) {
    if (html.includes(EMPTY_MOUNT_ROOT)) {
      failures.push(`${name}: #app is empty — the page was not server-rendered`);
      continue;
    }
    const missing = PRE_RENDER_MARKERS.filter((marker) => !html.includes(marker));
    if (missing.length > 0) {
      failures.push(`${name}: missing ${missing.join(', ')}`);
      continue;
    }
    try {
      assertExactlyOneH1(name, html);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `${name}: invalid h1 count`);
    }
  }

  if (failures.length === 0) return;

  throw new Error(
    `[static-export] ${failures.length} of ${pages.length} documentation pages are not ` +
      `server-rendered. A blank page must never deploy.\n` +
      failures.map((failure) => `  - ${failure}`).join('\n'),
  );
}

// Fire-and-forget: surface any failure as a non-zero exit so the build fails.
if (import.meta.main) {
  const baseUrl = requireProductionBaseUrl();
  void runStaticExport({ baseUrl }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
