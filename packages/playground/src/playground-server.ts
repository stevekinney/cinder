/**
 * Cinder component playground dev server.
 *
 * Runs at http://localhost:5555 by default, or the next available port. Routes:
 *   GET /              → shell HTML with README landing content
 *   GET /c/:name       → 301 redirect to /page/:name (legacy link compatibility)
 *   GET /page/:name    → standalone component documentation or preview-only iframe page
 *   GET /page-bundle/:name.js → page-bundle entry OR a hashed code-split chunk.
 *                              Entry URLs are bare component names (e.g. chat.js);
 *                              chunk URLs are hashed (e.g. core-abc123.js). Both
 *                              artifact types share a flat namespace under /page-bundle/
 *                              so all dynamic-import URLs from either bundle family
 *                              resolve through this single route.
 *   GET /bundle/:name/:scenario.js → compiled example bundle (standalone — useful for tests/debugging)
 *   GET /styles.css    → raw contents of src/styles/index.css (slim base — no per-component CSS)
 *   GET /styles/shell.css → shell chrome styles (base CSS plus shell component CSS)
 *   GET /styles/all.css → full cascade aggregator (all component CSS — used by the
 *                         preview iframe AND by the outer shell, whose README prose
 *                         renders callouts and code blocks that shell.css omits)
 *   GET /package-components/:source/*.css → CSS owned by extracted component packages
 *   GET /example-src/:name/:scenario → raw .example.svelte source
 *   GET /events        → Server-Sent Events stream for live reload
 *   GET /ping          → health check ("pong")
 *   GET /ready         → warmed-bundle readiness check ("ready")
 *
 * This file is the composition root: route dispatch, the bundler, the file
 * watcher, SSE broadcasting, SSR-renderer loading, static-asset serving, and
 * port scanning each live in their own domain module (see the imports
 * below). What stays here is manifest lookup, page rendering, and startup —
 * the parts that tie every domain module together into one running server.
 *
 * A file watcher on `src/` triggers a reload event to all connected SSE clients
 * whenever a file changes. Use `triggerReload()` (from `sse-broadcast.ts`)
 * directly in tests.
 */

import { type FSWatcher } from 'node:fs';
import { join } from 'node:path';

import { initializeHighlighter, renderMarkdown } from '@lostgradient/markdown/rendering';
import { stripExampleHarness } from '../../components/scripts/lib/strip-example-harness.ts';
import {
  findFixture,
  loadFixtureFile,
  resolveFixtureFilePath,
  resolveFixtureHostPath,
} from '../../components/scripts/lib/visual-fixtures/loader.ts';
import { fixtureRenderMode } from '../../components/scripts/lib/visual-fixtures/schema.ts';
import {
  newestSourceMtimeMs,
  type PlaygroundFreshnessFingerprint,
} from '../../testing/scripts/source-fingerprint.ts';
import { analyzeComponent } from './analyze.ts';
import { findArtifactForFamily } from './build-artifacts-shared.ts';
import { validateComponentDocumentationPayload } from './component-documentation-reference.ts';
import type { ComponentDocumentationPayload } from './component-documentation-types.ts';
import {
  ComponentDocumentationError,
  buildComponentDocumentation,
} from './component-documentation.ts';
import {
  documentationComponentStylesheetUrl,
  documentationExampleStylesheetUrls,
} from './component-sources.ts';
import {
  COMPOSE_ONLY_COMPONENTS,
  discoverComponentDefinition,
  discoverComponentDefinitions,
  discoverComponents,
  discoverExamples,
  discoverSidebarComponents,
} from './discover.ts';
import { readExampleMetadata } from './example-metadata.ts';
import { renderFeaturedExample } from './featured-example-server-renderer.ts';
import {
  hasPendingRebuild,
  invalidateCachesForChange,
  startWatcher,
  waitForPendingRebuild,
} from './file-watcher.ts';
import { buildFixtureBundle } from './fixture-bundle.ts';
import { notFound } from './http-responses.ts';
import {
  componentManifestCache,
  manifestCache,
  manifestPromise,
  setManifestCache,
  setManifestPromise,
} from './manifest-cache.ts';
import { buildPageBundle } from './page-bundle.ts';
import { PLAYGROUND_ROOT } from './playground-paths.ts';
import { createHttpServerOnAvailablePort, resolvePreferredPort } from './port-scanner.ts';
import { getRebuildGeneration } from './rebuild-generation.ts';
import {
  DEPICT_THEME_VARIABLES,
  FAVICON_HREF,
  PRE_PAINT_THEME_SCRIPT,
  documentationJsonLd,
  documentationMetadataTags,
  documentationPageMetadata,
  escapeHtml,
  jsonForScriptTag,
  renderShell,
} from './render-shell.ts';
import { repositorySourceHref, rewriteRelativeRenderedMarkdownLinks } from './repository-links.ts';
import { matchRoute, type RouteDefinition } from './route-table.ts';
import { buildBundle } from './scenario-bundle.ts';
import { humanizeComponentName } from './shell-app/humanize.ts';
import { buildShellBundle } from './shell-bundle.ts';
import {
  isSnapshotMode,
  snapshotModeHtmlAttribute,
  snapshotModeStyleTag,
} from './snapshot-mode.ts';
import { handleEventsRoute, sseClients } from './sse-broadcast.ts';
import {
  getPreparedShellServerRenderer,
  loadPageServerRenderer,
  loadShellServerRenderer,
  rendererWarmupAttemptDecision,
  rendererWarmupNeedsCacheInvalidation,
  resetShellRendererWarmupState,
  setPreparedShellServerRenderer,
  shellBuildSucceeded,
  type ShellServerRendererLoadResult,
} from './ssr-renderer.ts';
import {
  handleComponentsStyleRoute,
  handlePackageComponentStyleRoute,
  handlePlaygroundStylesRoute,
  handleStylesRoute,
} from './static-assets.ts';
import { stripInlineSourcemaps } from './strip-inline-sourcemaps.ts';
import type { ComponentManifest } from './types.ts';

export const PORT = resolvePreferredPort();
let startupReady = true;
const REPO_ROOT = join(PLAYGROUND_ROOT, '..', '..'); // repo root
const SOCIAL_IMAGE_FILE = join(PLAYGROUND_ROOT, 'src', 'assets', 'social.png');

/**
 * Startup identity reported by `/ready` so `start-server.ts` can refuse to
 * reuse a server that predates the current source tree — see
 * `source-fingerprint.ts` for the staleness comparison.
 */
const STARTUP_FINGERPRINT: PlaygroundFreshnessFingerprint = {
  startedAtMs: Date.now(),
  newestSourceMtimeMs: newestSourceMtimeMs(REPO_ROOT),
};

/**
 * `Cache-Control` value for content-hashed bundle artifacts (hashed entry
 * chunks `<name>-<hash>.js` and shared chunks `chunk-<hash>.js`). The hash is
 * part of the filename, so any source change produces a new URL — the old one
 * can be cached forever. `immutable` tells the browser never to revalidate.
 */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * `Cache-Control` value for the bare, unhashed bundle entry URLs the browser
 * requests directly (`/page-bundle/<component>.js`, `/shell-bundle/shell.js`,
 * and `/bundle/<name>/<scenario>.js`). These point at whatever the latest build
 * produced, so they must never be cached: a watcher rebuild swaps the bytes
 * behind the same URL, and the hot-reload flow depends on the browser refetching.
 */
const NO_STORE_CACHE_CONTROL = 'no-store';
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Return the full manifest array, using the module-level cache in
 * `manifest-cache.ts`. Cleared by `file-watcher.ts`'s
 * `invalidateCachesForChange` (which resets the manifest caches and the
 * shared ts-morph project) on every invalidation tier.
 */
async function getManifests(): Promise<ComponentManifest[]> {
  if (manifestCache !== null) return manifestCache;
  // Captured before awaiting so we can tell, once the analysis resolves,
  // whether an invalidation raced past us — see the publish guard below.
  const generationAtStart = getRebuildGeneration();
  // Reuse the in-flight promise so concurrent callers don't each analyze the
  // same package sources. Discovery has already rejected duplicate route slugs.
  let inFlight = manifestPromise;
  if (inFlight === null) {
    inFlight = discoverComponentDefinitions().then(async (definitions) => {
      const manifests = await Promise.all(
        definitions.map((definition) =>
          analyzeComponent(definition.filePath, { importPath: definition.importPath }),
        ),
      );
      return manifests.toSorted((left, right) => left.kebabName.localeCompare(right.kebabName));
    });
    setManifestPromise(inFlight);
  }
  try {
    const manifests = await inFlight;
    // Only publish if we're not racing a newer invalidation. Without this
    // guard, an analysis that straddles an invalidation would resurrect
    // stale prop metadata into `manifestCache` right after
    // `invalidateCachesForChange` cleared it.
    if (generationAtStart === getRebuildGeneration()) {
      setManifestCache(manifests);
      for (const manifest of manifests) {
        componentManifestCache.set(manifest.kebabName, manifest);
      }
    }
    return manifests;
  } finally {
    // Only clear OUR OWN in-flight reference — see buildPageBundle's
    // identical guard for why an unconditional null-out would risk
    // clobbering a newer call's in-flight promise.
    if (manifestPromise === inFlight) setManifestPromise(null);
  }
}

type GeneratedComponentSchema = {
  properties?: Record<string, { default?: unknown }>;
  metadata?: {
    unsupportedProps?: Array<{ name: string; required?: boolean; reason?: string }>;
  };
};

export async function readGeneratedComponentSchema(
  generatedSchemaFile: Pick<Bun.BunFile, 'exists' | 'json'>,
): Promise<GeneratedComponentSchema | null> {
  try {
    if (!(await generatedSchemaFile.exists())) return null;
    const schema: unknown = await generatedSchemaFile.json();
    return isGeneratedComponentSchema(schema) ? schema : null;
  } catch {
    return null;
  }
}

function isGeneratedComponentSchema(value: unknown): value is GeneratedComponentSchema {
  if (!isRecord(value)) return false;

  if ('properties' in value && value['properties'] !== undefined) {
    const properties = value['properties'];
    if (!isRecord(properties)) return false;
    if (Object.values(properties).some((property) => !isRecord(property))) return false;
  }

  if ('metadata' in value && value['metadata'] !== undefined) {
    const metadata = value['metadata'];
    if (!isRecord(metadata)) return false;
    const unsupportedProps = metadata['unsupportedProps'];
    if (unsupportedProps === undefined) return true;
    if (!Array.isArray(unsupportedProps)) return false;
    return unsupportedProps.every(
      (prop) =>
        isRecord(prop) &&
        typeof prop['name'] === 'string' &&
        (prop['required'] === undefined || typeof prop['required'] === 'boolean') &&
        (prop['reason'] === undefined || typeof prop['reason'] === 'string'),
    );
  }

  return true;
}

export function mergeGeneratedSchemaMetadata(
  analyzedManifest: ComponentManifest,
  schema: GeneratedComponentSchema,
): ComponentManifest {
  return {
    ...analyzedManifest,
    props: analyzedManifest.props.map((prop) => {
      const defaultValue = schema.properties?.[prop.name]?.default;
      return defaultValue === undefined ? prop : { ...prop, defaultValue };
    }),
    ...(schema.metadata?.unsupportedProps?.some(
      (prop) => prop.required === true && prop.reason === 'function-or-snippet',
    )
      ? { isCompound: true }
      : {}),
  };
}

async function getComponentManifest(componentName: string): Promise<ComponentManifest | null> {
  const cached = componentManifestCache.get(componentName);
  if (cached !== undefined) return cached;
  if (manifestCache !== null) {
    return manifestCache.find((manifest) => manifest.kebabName === componentName) ?? null;
  }

  const definition = await discoverComponentDefinition(componentName);
  if (definition === undefined) return null;
  const generatedSchemaPath = join(
    definition.source.componentsRoot,
    componentName,
    `${componentName}.schema.json`,
  );
  const generatedSchemaFile = Bun.file(generatedSchemaPath);
  const generationAtStart = getRebuildGeneration();
  const analyzedManifest = await analyzeComponent(definition.filePath, {
    importPath: definition.importPath,
  });
  let manifest = analyzedManifest;
  const schema = await readGeneratedComponentSchema(generatedSchemaFile);
  if (schema !== null) {
    manifest = mergeGeneratedSchemaMetadata(analyzedManifest, schema);
  }
  if (generationAtStart === getRebuildGeneration()) {
    componentManifestCache.set(componentName, manifest);
  }
  return manifest;
}

/**
 * Return only components that have meaningful standalone screenshot pages.
 * Compose-only leaves still belong in the canonical manifest API because
 * direct pages and static export fetch their prop manifests by name.
 */
async function getStandaloneManifests(): Promise<ComponentManifest[]> {
  const manifests = await getManifests();
  return manifests.filter((entry) => !COMPOSE_ONLY_COMPONENTS.has(entry.kebabName));
}

/**
 * Render the standalone component page HTML (the iframe content — no outer shell).
 *
 * When `snapshotMode` is `true` (request had `?snapshot=1`), the rendered
 * `<html>` element gains `data-snapshot-mode=""` and a `<style>` tag is
 * injected that zeroes animation/transition durations and hides carets.
 * Without `?snapshot=1`, the output is byte-identical to the previous behavior.
 */
async function renderComponentPage(
  componentName: string,
  snapshotMode: boolean,
  previewOnly: boolean,
  baseUrl: string,
): Promise<string> {
  const componentDefinition = await discoverComponentDefinition(componentName);
  const scenarios = await discoverExamples(componentName);
  const componentStylesheetUrl =
    componentDefinition === undefined
      ? null
      : documentationComponentStylesheetUrl(componentDefinition.source, componentName);
  // Every example lives in the shared playground tree, including extracted
  // Chat and Editor pages, so its Cinder imports need opt-in sidecars too.
  // The documented package's own stylesheet remains additive.
  const componentStylesheetUrls = [
    ...(componentDefinition === undefined
      ? []
      : documentationExampleStylesheetUrls(componentDefinition.source, componentName, scenarios)),
    ...(componentStylesheetUrl === null ? [] : [componentStylesheetUrl]),
  ].filter((stylesheetUrl, index, urls) => urls.indexOf(stylesheetUrl) === index);
  const componentStylesheetLinks = componentStylesheetUrls
    .map((stylesheetUrl) => `\n    <link rel="stylesheet" href="${escapeHtml(stylesheetUrl)}" />`)
    .join('');
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

  // jsonForScriptTag (not raw JSON.stringify) escapes <, >, &, and the Unicode
  // line/paragraph separators so a `</script>` in an example title/description
  // cannot terminate this inline script early or inject markup.
  const examplesJson = jsonForScriptTag(examples);
  const documentation = await buildValidatedComponentDocumentation(componentName);
  if (documentation === null) {
    throw new ComponentDocumentationError(
      'unknown-component',
      `Documentation for "${componentName}" not found`,
    );
  }
  const documentationJson = jsonForScriptTag(documentation);
  const htmlAttribute = snapshotModeHtmlAttribute(snapshotMode);
  const styleTag = snapshotModeStyleTag(snapshotMode);
  const metadata = documentationPageMetadata(componentName);
  const metadataTags = documentationMetadataTags(metadata, baseUrl);
  const structuredData = documentationJsonLd(metadata, baseUrl);

  /*
   * Server-render the documentation tree so the page has real content in the
   * HTML — no blank `#app` and no loading state before the bundle executes.
   *
   * TWO query surfaces deliberately opt OUT and keep the historical client-only
   * mount, because each renders a DIFFERENT tree than the canonical page:
   *
   * - `?snapshot=1` — the visual-regression and axe suites wait for `#app > *`
   *   to become visible and assert single-instance counts of `example-mount-*`
   *   on a bare surface (see packages/testing/src/fixtures/component-page.ts).
   *   Rendering the full documentation chrome there would break ~93 suites.
   * - `?preview=1` — the shell's preview frame renders only a single featured
   *   example (`canonical-preview`). The client bundle `mount()`s that surface
   *   rather than hydrating it, and `mount()` does not clear existing children,
   *   so pre-rendering the full documentation tree here would stack a 134 KB
   *   documentation page underneath a small preview inside the iframe.
   *
   * Both surfaces must therefore ship an empty `#app`. Gate on both, or the
   * server's tree and the client's mount disagree.
   *
   * A render failure degrades to the client-only path rather than 500ing — the
   * page still works, it just loses the pre-rendered content.
   */
  /*
   * The sidebar renders inside the documentation page's own tree, so both the
   * server render and the client hydration need the same list. It is omitted
   * for the snapshot and preview surfaces, whose harnesses assert on a bare
   * `#app`.
   */
  const sidebarComponents = snapshotMode || previewOnly ? [] : await discoverSidebarComponents();
  const sidebarJson = jsonForScriptTag(sidebarComponents);
  const overviewExample = examples.find((example) => example.featured === true) ?? examples[0];

  let ssrBody = '';
  let ssrHead = '';
  let overviewExampleHtml: string | null = null;
  if (!snapshotMode && !previewOnly) {
    let overviewExampleHead = '';
    try {
      if (overviewExample !== undefined) {
        const mountId = `overview-mount-${overviewExample.scenario}`;
        const renderedExample = await renderFeaturedExample(
          componentName,
          overviewExample.scenario,
          mountId,
        );
        overviewExampleHtml = renderedExample.body;
        overviewExampleHead = renderedExample.head;
      }
    } catch (error) {
      console.error(`[playground] featured example SSR failed for ${componentName}:`, error);
    }
    try {
      const { renderComponentPageBody } = await loadPageServerRenderer();
      const rendered = renderComponentPageBody({
        componentName,
        documentation,
        examples,
        sidebarComponents,
        overviewExampleHtml,
      });
      ssrBody = rendered.body;
      // Inline sourcemaps in the SSR'd <style> output are ~80% of its bytes and
      // sit on the critical rendering path. See strip-inline-sourcemaps.ts.
      ssrHead = stripInlineSourcemaps(`${rendered.head}${overviewExampleHead}`);
    } catch (error) {
      console.error(`[playground] page SSR failed for ${componentName}:`, error);
    }
  }
  return `<!DOCTYPE html>
<html lang="en"${htmlAttribute}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(metadata.title)}</title>
    ${metadataTags}
    ${structuredData}
    <link rel="icon" href="${FAVICON_HREF}" />
    <link rel="stylesheet" href="/playground-styles/documentation.css" />${componentStylesheetLinks}
    ${ssrHead}
    <script>${PRE_PAINT_THEME_SCRIPT}</script>
    <style>
      /* Iframe scaffold: scope the reset narrowly. Unlike the shell, the
         universal selectors here set ONLY box-sizing — not margin/padding —
         so they cannot beat layered component styles. The shell's reset is
         broader and lives in @layer cinder.reset (see render-shell.ts). */
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; min-height: 100%; }
      body {
        background-color: var(--cinder-surface-canvas);
        color: var(--cinder-text-default);
        font-family: var(--cinder-font-sans);
        font-size: var(--cinder-text-base);
        line-height: var(--cinder-leading-normal);
        /* Scale the preview gutter with the viewport: a comfortable space-6
           (24px) on wide screens collapses to a thin space-1 (4px) on phones so
           example components get almost the full width and look realistic. */
        padding: clamp(var(--cinder-space-1), 2.5vw, var(--cinder-space-6));
      }
      /* Guard the background/color crossfade behind a reduced-motion opt-out so
         users who prefer no motion get an instant theme swap, not a transition. */
      @media (prefers-reduced-motion: no-preference) {
        body {
          transition: background 0.1s, color 0.1s;
        }
      }
      #app { display: contents; }

${DEPICT_THEME_VARIABLES}
    </style>${styleTag ? `\n    ${styleTag}` : ''}
  </head>
  <body>
    <script type="application/json" id="cinder-documentation">${documentationJson}</script>
    <script>window.__CINDER_EXAMPLES__ = ${examplesJson};</script>
    <script>window.__CINDER_SIDEBAR__ = ${sidebarJson};</script>
    <div id="app">${ssrBody}</div>
    <script type="module" src="/page-bundle/${componentName}.js"></script>
  </body>
</html>`;
}

async function buildValidatedComponentDocumentation(
  componentName: string,
): Promise<ComponentDocumentationPayload | null> {
  const manifest = await getComponentManifest(componentName);
  if (manifest === null) return null;

  const componentDefinition = await discoverComponentDefinition(componentName);
  if (componentDefinition === undefined) return null;

  const documentation = await buildComponentDocumentation(
    componentName,
    manifest,
    undefined,
    componentDefinition.source,
  );
  const validationErrors = validateComponentDocumentationPayload(documentation);
  if (validationErrors.length > 0) {
    throw new Error(
      `Documentation payload for "${componentName}" failed validation:\n` +
        validationErrors.map((validationError) => `  - ${validationError}`).join('\n'),
    );
  }
  return documentation;
}

function renderFixturePageHtml(
  componentName: string,
  fixtureName: string,
  snapshotMode: boolean,
  scriptSource: string,
  componentStylesheetUrl: string | null,
): string {
  const htmlAttribute = snapshotModeHtmlAttribute(snapshotMode);
  const styleTag = snapshotModeStyleTag(snapshotMode);
  const humanName = escapeHtml(humanizeComponentName(componentName));

  return `<!DOCTYPE html>
<html lang="en"${htmlAttribute}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${humanName} / ${escapeHtml(fixtureName)} — cinder playground</title>
    <link rel="icon" href="${FAVICON_HREF}" />
    <link rel="stylesheet" href="/styles/all.css" />${
      componentStylesheetUrl === null
        ? ''
        : `\n    <link rel="stylesheet" href="${escapeHtml(componentStylesheetUrl)}" />`
    }
    <script>${PRE_PAINT_THEME_SCRIPT}</script>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; min-height: 100%; }
      body {
        background-color: var(--cinder-surface-canvas);
        color: var(--cinder-text-default);
        font-family: var(--cinder-font-sans);
        font-size: var(--cinder-text-base);
        line-height: var(--cinder-leading-normal);
        /* Scale the preview gutter with the viewport: a comfortable space-6
           (24px) on wide screens collapses to a thin space-1 (4px) on phones so
           example components get almost the full width and look realistic. */
        padding: clamp(var(--cinder-space-1), 2.5vw, var(--cinder-space-6));
      }
      @media (prefers-reduced-motion: no-preference) {
        body {
          transition: background 0.1s, color 0.1s;
        }
      }
      #app { display: contents; }
    </style>${styleTag ? `\n    ${styleTag}` : ''}
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${scriptSource}"></script>
  </body>
</html>`;
}

async function renderFixturePageResponse(
  componentName: string,
  fixtureName: string,
  snapshotMode: boolean,
  expectedFixtureContentHash: string,
): Promise<Response> {
  const componentDefinition = await discoverComponentDefinition(componentName);
  if (componentDefinition === undefined) {
    return notFound(`Component "${componentName}" not found`);
  }
  const fixturesRoot = componentDefinition.source.componentsRoot;
  const fixtureFilePath = resolveFixtureFilePath(componentName, fixturesRoot);
  let fixtureFile;
  try {
    fixtureFile = await loadFixtureFile(fixtureFilePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Invalid fixture file for "${componentName}":\n${message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (fixtureFile === null) return notFound(`Fixture file for "${componentName}" not found`);
  if (expectedFixtureContentHash !== fixtureFile.contentHash) {
    return new Response(
      `Fixture manifest drift for "${componentName}": expected ${expectedFixtureContentHash}, found ${fixtureFile.contentHash}`,
      { status: 409, headers: { 'Content-Type': 'text/plain' } },
    );
  }

  const fixture = findFixture(fixtureFile, fixtureName);
  if (fixture === undefined) {
    return notFound(`Fixture "${fixtureName}" not found for "${componentName}"`);
  }

  const componentOrHostPath =
    fixtureRenderMode(fixture) === 'host'
      ? resolveFixtureHostPath(fixtureFile, fixture)
      : componentDefinition.filePath;

  const fixtureEntryPath = await buildFixtureBundle(
    componentName,
    fixture,
    fixtureFile.contentHash,
    componentOrHostPath,
  );
  if (fixtureEntryPath === null) {
    return new Response(`Fixture "${componentName}/${fixtureName}" failed to build`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const scriptSource = `/fixture-bundle/${fixtureEntryPath}`;
  return new Response(
    renderFixturePageHtml(
      componentName,
      fixtureName,
      snapshotMode,
      scriptSource,
      componentDefinition.source.componentStylesheetUrl(componentName),
    ),
    {
      headers: { 'Content-Type': 'text/html' },
    },
  );
}

/** Verify a path segment is a safe identifier (no path traversal). */
function isSafeSegment(segment: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(segment);
}

/** Build a plain-text 400 response. */
function badRequest(message: string): Response {
  return new Response(message, { status: 400, headers: { 'Content-Type': 'text/plain' } });
}

export function rewriteRepositoryRelativeReadmeLinks(html: string): string {
  return rewriteRelativeRenderedMarkdownLinks(html, (href) => repositorySourceHref('', href));
}

/**
 * The landing hero owns the document's sole top-level heading. The root README
 * starts with the same title, so leaving its rendered H1 in the prose would
 * expose duplicate H1s before and after hydration. Remove that leading source
 * title structurally rather than concealing it with CSS.
 */
export function omitLandingReadmeTitle(html: string): string {
  return html.replace(/^\s*<h1\b[^>]*>.*?<\/h1>\s*/is, '');
}

async function renderLandingReadmeHtml(): Promise<string> {
  await initializeHighlighter();
  const markdown = await Bun.file(join(PLAYGROUND_ROOT, '..', '..', 'README.md')).text();
  const rendered = renderMarkdown(markdown);
  if (rendered.hadUnsafeContent) {
    throw new Error(
      'Root README rendering stripped unsafe content. Update README.md to remove raw HTML, unsafe URLs, or other sanitizer-blocked content.',
    );
  }
  return omitLandingReadmeTitle(rewriteRepositoryRelativeReadmeLinks(rendered.html));
}

/**
 * Build the `/example-src/:name/:scenario` response: strip the doc-page
 * mount-isolation harness so the reader copies clean consumer usage, not the
 * `mountIdPrefix` / `$props.id()` internals.
 *
 * The strip fails closed — it throws on an unrecognized binding shape rather
 * than serve half-stripped, uncopyable code — so a throw becomes a clear 500
 * (with the failing `scenarioKey`) instead of bubbling out as an opaque
 * connection error. Exported for testing both the 200 and 500 paths without a
 * live socket or a filesystem poison fixture.
 */
export function exampleSnippetResponse(source: string, scenarioKey: string): Response {
  let snippet: string;
  try {
    snippet = stripExampleHarness(source, scenarioKey);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`stripExampleHarness failed for "${scenarioKey}": ${detail}`);
    return new Response(`Failed to prepare example snippet for "${scenarioKey}": ${detail}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new Response(snippet, { headers: { 'Content-Type': 'text/plain' } });
}

async function handleApiManifestRoute(url: URL): Promise<Response> {
  const manifests =
    url.searchParams.get('standalone') === '1'
      ? await getStandaloneManifests()
      : await getManifests();
  return new Response(JSON.stringify(manifests), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleApiManifestNameRoute(componentName: string): Promise<Response> {
  if (!isSafeSegment(componentName)) return notFound();
  const manifests = await getManifests();
  const manifest = manifests.find((m) => m.kebabName === componentName);
  if (manifest === undefined) return notFound(`Manifest for "${componentName}" not found`);
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleApiDocumentationRoute(componentName: string): Promise<Response> {
  if (!isSafeSegment(componentName)) return notFound();

  try {
    const documentation = await buildValidatedComponentDocumentation(componentName);
    if (documentation === null) {
      return notFound(`Documentation for "${componentName}" not found`);
    }
    return new Response(JSON.stringify(documentation), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof ComponentDocumentationError && error.code === 'unknown-component') {
      return notFound(`Documentation for "${componentName}" not found`);
    }
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Documentation route failed for "${componentName}":\n${message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * GET /page/:name — standalone component page (iframe content, no shell).
 * Supports ?snapshot=1 to activate snapshot mode: data-snapshot-mode on
 * <html>, motion-freeze CSS, and caret-color: transparent.
 */
async function handlePageRoute(url: URL, componentName: string): Promise<Response> {
  if (!isSafeSegment(componentName)) return notFound();
  const allComponents = await discoverComponents();
  if (!allComponents.includes(componentName))
    return notFound(`Component "${componentName}" not found`);
  const snapshotModeActive = isSnapshotMode(url.searchParams);
  const fixtureName = url.searchParams.get('fixture');
  if (fixtureName !== null) {
    if (!isSafeSegment(fixtureName)) return notFound();
    const fixtureContentHash = url.searchParams.get('fixtureContentHash');
    if (fixtureContentHash === null) {
      return badRequest('fixtureContentHash is required for fixture routes');
    }
    if (!SHA256_HEX_PATTERN.test(fixtureContentHash)) {
      return badRequest('fixtureContentHash must be a 64-character lowercase sha256 hash');
    }
    return await renderFixturePageResponse(
      componentName,
      fixtureName,
      snapshotModeActive,
      fixtureContentHash,
    );
  }
  // `?preview=1` is the shell preview frame's single-example surface. It must
  // stay client-only for the same reason as snapshot mode — see the comment in
  // renderComponentPage.
  const previewOnlyActive = url.searchParams.get('preview') === '1';
  const html = await renderComponentPage(
    componentName,
    snapshotModeActive,
    previewOnlyActive,
    Bun.env['PLAYGROUND_BASE_URL'] ?? url.origin,
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleExampleSrcRoute(componentName: string, scenario: string): Promise<Response> {
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
  return exampleSnippetResponse(source, `${componentName}/${scenario}`);
}

/*
 * GET /c/:name → 301 /page/:name
 *
 * `/c/<name>` used to render a SECOND, condensed documentation page: a hero, a
 * 360px iframe preview, an abbreviated readme, and a link labelled "Open
 * interactive documentation" that pointed at `/page/<name>` — the page it was
 * duplicating. There is now exactly one documentation page per component and
 * it lives at `/page/<name>`, with the sidebar rendered inside it.
 *
 * The redirect (rather than deleting the route) keeps existing links,
 * bookmarks, and any `related`/`avoidWhen` references working.
 */
async function handleComponentRedirectRoute(url: URL, componentName: string): Promise<Response> {
  if (!isSafeSegment(componentName)) return notFound();
  const allComponents = await discoverComponents();
  if (!allComponents.includes(componentName))
    return notFound(`Component "${componentName}" not found`);

  return Response.redirect(`/page/${encodeURIComponent(componentName)}${url.search}`, 301);
}

async function handleLandingRoute(url: URL): Promise<Response> {
  const [sidebarComponents, readmeHtml] = await Promise.all([
    discoverSidebarComponents(),
    renderLandingReadmeHtml(),
  ]);
  let renderShellBody = getPreparedShellServerRenderer();
  if (renderShellBody === null) {
    const loadedShellRenderer = await loadShellServerRenderer();
    renderShellBody = loadedShellRenderer.renderer;
  }
  const renderedShell = renderShellBody({
    components: sidebarComponents,
    readmeHtml,
  });
  const html = renderShell(null, sidebarComponents, {
    baseUrl: Bun.env['PLAYGROUND_BASE_URL'] ?? url.origin,
    readmeHtml,
    shellBody: renderedShell.body,
    shellHead: renderedShell.head,
    initialSearch: url.search,
  });
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleSocialImageRoute(): Promise<Response> {
  const image = Bun.file(SOCIAL_IMAGE_FILE);
  if (!(await image.exists())) return notFound('social image not found');
  return new Response(image, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': IMMUTABLE_CACHE_CONTROL,
    },
  });
}

/**
 * Every route the playground server serves, in dispatch order. `matchRoute`
 * (from `route-table.ts`) tries patterns top to bottom, so a more specific
 * exact-match entry (row 4, `/styles.css`) must be listed before a broader
 * wildcard it would otherwise also match (row 5, `/styles/*`).
 */
export const ROUTES: RouteDefinition[] = [
  {
    method: 'GET',
    pattern: /^\/social\.png$/,
    handler: () => handleSocialImageRoute(),
  },
  {
    method: 'GET',
    pattern: /^\/ping$/,
    handler: () => new Response('pong', { headers: { 'Content-Type': 'text/plain' } }),
  },
  {
    method: 'GET',
    pattern: /^\/ready$/,
    handler: () =>
      new Response(startupReady ? 'ready' : 'warming', {
        status: startupReady ? 200 : 503,
        headers: {
          'Content-Type': 'text/plain',
          'X-Cinder-Playground-Fingerprint': JSON.stringify(STARTUP_FINGERPRINT),
        },
      }),
  },
  {
    method: 'GET',
    pattern: /^\/events$/,
    handler: () => handleEventsRoute(),
  },
  {
    method: 'GET',
    pattern: /^\/styles\.css$/,
    handler: () => handleStylesRoute('index.css'),
  },
  {
    method: 'GET',
    pattern: /^\/styles\/(.+)$/,
    handler: ({ match }) => handleStylesRoute(match[1]!),
  },
  {
    method: 'GET',
    pattern: /^\/playground-styles\/(documentation|landing)\.css$/,
    handler: ({ match }) => handlePlaygroundStylesRoute(match[1]! as 'documentation' | 'landing'),
  },
  {
    method: 'GET',
    pattern: /^\/components\/(.+)\.css$/,
    handler: ({ match }) => handleComponentsStyleRoute(`${match[1]!}.css`),
  },
  {
    method: 'GET',
    pattern: /^\/package-components\/([a-z0-9][a-z0-9-]*)\/(.+\.css)$/,
    handler: ({ match }) => handlePackageComponentStyleRoute(match[1]!, match[2]!),
  },
  {
    method: 'GET',
    pattern: /^\/bundle\/([^/]+)\/([^/]+)\.js$/,
    handler: async ({ match }) => {
      const componentName = match[1]!;
      const scenario = match[2]!;
      if (!isSafeSegment(componentName) || !isSafeSegment(scenario)) return notFound();
      const code = await buildBundle(componentName, scenario);
      if (code === null) {
        return notFound(`Example "${componentName}/${scenario}" not found or failed to build`);
      }
      // Bare, unhashed scenario entry URL — never cache (see NO_STORE_CACHE_CONTROL).
      return new Response(code, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': NO_STORE_CACHE_CONTROL,
        },
      });
    },
  },
  {
    method: 'GET',
    pattern: /^\/page-bundle\/([A-Za-z0-9_-]+)\.js$/,
    // Resolution order: family-map lookup first (cheap, no build), then
    // entry-name lookup with a build fallback. Cache invalidation is fully
    // synchronous (see `invalidateCachesForChange`), so there's no in-flight
    // rebuild window to guard against here.
    handler: async ({ match }) => {
      const filename = match[1]!;
      const directHit = findArtifactForFamily('page', `${filename}.js`);
      if (directHit !== undefined) {
        // A direct cache hit is always a content-hashed artifact (a hashed entry
        // `page-<name>-<hash>.js` or a shared `chunk-<hash>.js`) — cache forever.
        return new Response(directHit, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': IMMUTABLE_CACHE_CONTROL,
          },
        });
      }
      if (!isSafeSegment(filename)) return notFound();
      const code = await buildPageBundle(filename);
      if (code === null)
        return notFound(`Page bundle for "${filename}" not found or failed to build`);
      // Bare, unhashed page entry URL (`/page-bundle/<component>.js`) — never cache.
      return new Response(code, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': NO_STORE_CACHE_CONTROL,
        },
      });
    },
  },
  {
    method: 'GET',
    pattern: /^\/fixture-bundle\/([A-Za-z0-9_-]+)\.js$/,
    handler: ({ match }) => {
      const filename = match[1]!;
      const directHit = findArtifactForFamily('fixture', `${filename}.js`);
      if (directHit !== undefined) {
        return new Response(directHit, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': IMMUTABLE_CACHE_CONTROL,
          },
        });
      }

      if (!isSafeSegment(filename)) return notFound();
      return notFound(`Fixture bundle "${filename}" not found`);
    },
  },
  {
    method: 'GET',
    pattern: /^\/shell-bundle\/([A-Za-z0-9_-]+)\.js$/,
    handler: async ({ match }) => {
      const filename = match[1]!;
      const directHit = findArtifactForFamily('shell', `${filename}.js`);
      if (directHit !== undefined) {
        // Direct hit = content-hashed artifact (hashed entry `shell-<hash>.js` or
        // a shared `chunk-<hash>.js`) — cache forever.
        return new Response(directHit, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': IMMUTABLE_CACHE_CONTROL,
          },
        });
      }
      // Canonical entry URL is `/shell-bundle/shell.js`. Other filenames must
      // be hashed chunks served from the cache above; we never lazily build
      // anything other than the entry on this route.
      if (filename !== 'shell') return notFound();
      const shellResult = await buildShellBundle();
      if (shellResult.code === null) return notFound('Shell bundle failed to build');
      // Bare, unhashed shell entry URL (`/shell-bundle/shell.js`) — never cache.
      return new Response(shellResult.code, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': NO_STORE_CACHE_CONTROL,
        },
      });
    },
  },
  // GET /api/manifest — full manifest array.
  // Add ?standalone=1 for the Playwright sweep input, where compose-only
  // leaves are covered through their parent examples instead of standalone
  // pages that would render "No examples found".
  {
    method: 'GET',
    pattern: /^\/api\/manifest$/,
    handler: ({ url }) => handleApiManifestRoute(url),
  },
  {
    method: 'GET',
    pattern: /^\/api\/manifest\/([^/]+)$/,
    handler: ({ match }) => handleApiManifestNameRoute(match[1]!),
  },
  {
    method: 'GET',
    pattern: /^\/api\/documentation\/([^/]+)$/,
    handler: ({ match }) => handleApiDocumentationRoute(match[1]!),
  },
  {
    method: 'GET',
    pattern: /^\/page\/([^/]+)$/,
    handler: ({ url, match }) => handlePageRoute(url, match[1]!),
  },
  {
    method: 'GET',
    pattern: /^\/example-src\/([^/]+)\/([^/]+)$/,
    handler: ({ match }) => handleExampleSrcRoute(match[1]!, match[2]!),
  },
  {
    method: 'GET',
    pattern: /^\/c\/([^/]+)$/,
    handler: ({ url, match }) => handleComponentRedirectRoute(url, match[1]!),
  },
  {
    method: 'GET',
    pattern: /^\/$/,
    handler: ({ url }) => handleLandingRoute(url),
  },
];

/** Main request handler — exported for testing. */
export async function handleRequest(request: Request): Promise<Response> {
  const matched = matchRoute(ROUTES, request);
  if (matched === null) return notFound();
  return matched.route.handler(matched.context);
}

export type PlaygroundServer = {
  port: number;
  /** Stop the HTTP server and all file watchers. Awaitable. */
  dispose: () => Promise<void>;
};

/**
 * Maximum concurrent `Bun.build()` calls during the eager pre-build sweep
 * (initial startup, or a `bun --watch` restart triggered by editing a
 * server-logic file — see `startWatcher`'s doc comment). Unbounded
 * concurrency across ~161 sidebar components is the same failure shape as
 * the watcher's old eager rebuild-everything bug (multi-gigabyte RSS spikes,
 * Bun segfaults) — this bounds the one remaining place that can still
 * happen, without slowing down the common case (a save that only needs a
 * cheap cache invalidation, handled entirely by `invalidateCachesForChange`).
 */
const EAGER_PREBUILD_CONCURRENCY = 6;

export function eagerPrebuildComponents(
  components: readonly string[],
  rawComponentScope: string | undefined = process.env['CINDER_TEST_COMPONENTS'],
  knownComponents: readonly string[] = components,
): string[] {
  const requested = [
    ...new Set(
      (rawComponentScope ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  if (requested.length === 0) return [...components];

  const knownComponentSet = new Set(knownComponents);
  const unknownComponents = requested.filter((component) => !knownComponentSet.has(component));
  if (unknownComponents.length > 0) {
    throw new Error(
      `CINDER_TEST_COMPONENTS references unknown playground component slugs: ${unknownComponents.join(', ')}`,
    );
  }
  return components.filter((component) => requested.includes(component));
}

/**
 * Run `task` once per item with at most `limit` concurrent calls in flight.
 * Returns one `PromiseSettledResult` per item, in input order — same shape
 * as `Promise.allSettled`, but without ever holding more than `limit`
 * `Bun.build()` calls live at once.
 */
async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = Array.from({ length: items.length });
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await task(items[index]!) };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Pre-build every sidebar component's page bundle + the shell bundle.
 *
 * Per-component page failures are logged but do NOT abort startup — the
 * playground's lazy-build fallback in `/page-bundle/:filename.js` handles
 * those at request time (surfacing the build error to the user when they
 * click that entry). Shell-bundle failure IS fatal because there's no UI
 * without it; the caller decides whether to exit.
 *
 * Returns counts so the caller can log a single line and pass the shell
 * failure signal upward.
 */
async function eagerPrebuildAll(): Promise<{
  shellSucceeded: boolean;
  succeeded: number;
  failed: string[];
}> {
  const shellPromise = buildShellBundle().catch((error) => {
    console.error('[playground] shell bundle threw during pre-build:', error);
    return { code: null, usedFallback: true };
  });
  const sidebarComponents = await discoverSidebarComponents();
  const components = eagerPrebuildComponents(
    sidebarComponents,
    undefined,
    await discoverComponents(),
  );
  // Sidebar components are a subset of all components, so each is a valid
  // bundle target. Passing the set avoids N redundant glob scans during the
  // eager pre-build.
  const knownComponents = new Set(components);
  const pagePromise = mapWithConcurrencyLimit(components, EAGER_PREBUILD_CONCURRENCY, (name) =>
    buildPageBundle(name, knownComponents),
  );

  const [shellCode, pageResults] = await Promise.all([shellPromise, pagePromise]);

  let succeeded = 0;
  const failed: string[] = [];
  for (let i = 0; i < pageResults.length; i++) {
    const result = pageResults[i]!;
    if (result.status === 'fulfilled' && result.value !== null) {
      succeeded++;
    } else {
      failed.push(components[i]!);
    }
  }

  return {
    shellSucceeded: shellBuildSucceeded(shellCode.code, shellCode.usedFallback),
    succeeded,
    failed,
  };
}

async function eagerPrebuildAndWarmManifests(): ReturnType<typeof eagerPrebuildAll> {
  const prebuild = await eagerPrebuildAll();
  await getManifests().catch((error: unknown) => {
    console.error('[playground] manifest pre-warm failed:', error);
  });
  return prebuild;
}

/** Run the independent browser-bundle and server-renderer startup work in parallel. */
export async function runConcurrentStartupWarmup<Prebuild, Renderer>(
  prebuild: () => Promise<Prebuild>,
  prepareRenderer: () => Promise<Renderer>,
): Promise<{ prebuild: Prebuild; renderer: Renderer }> {
  const [prebuildResult, rendererResult] = await Promise.all([prebuild(), prepareRenderer()]);
  return { prebuild: prebuildResult, renderer: rendererResult };
}

export function createSharedDisposer(disposeWork: () => Promise<void>): () => Promise<void> {
  let disposePromise: Promise<void> | null = null;
  return () => {
    disposePromise ??= disposeWork();
    return disposePromise;
  };
}

export function isWarmupStable(
  generationAtStart: number,
  generationAtEnd: number,
  sourceMtimeAtStart: number | null,
  sourceMtimeAtEnd: number | null,
  hasPendingRebuildFlag = false,
): boolean {
  return (
    warmupInstabilityReasons(
      generationAtStart,
      generationAtEnd,
      sourceMtimeAtStart,
      sourceMtimeAtEnd,
      hasPendingRebuildFlag,
    ).length === 0
  );
}

/** Explain why a warmup pass must be retried, for diagnostics in slow CI. */
export function warmupInstabilityReasons(
  generationAtStart: number,
  generationAtEnd: number,
  sourceMtimeAtStart: number | null,
  sourceMtimeAtEnd: number | null,
  hasPendingRebuildFlag = false,
): string[] {
  const reasons: string[] = [];
  if (generationAtStart !== generationAtEnd) {
    reasons.push(`rebuild generation changed (${generationAtStart} -> ${generationAtEnd})`);
  }
  if (sourceMtimeAtStart !== sourceMtimeAtEnd) {
    reasons.push(`newest source mtime changed (${sourceMtimeAtStart} -> ${sourceMtimeAtEnd})`);
  }
  if (hasPendingRebuildFlag) reasons.push('rebuild debounce is pending');
  return reasons;
}

/** Run warmup work after pending invalidation settles and validate its generation boundary. */
export async function runGenerationCheckedWarmup<T>(
  work: () => Promise<T>,
): Promise<{ value: T; instabilityReasons: string[] }> {
  const generationAtStart = await waitForPendingRebuild();
  const sourceMtimeAtStart = newestSourceMtimeMs(REPO_ROOT);
  const value = await work();
  const sourceMtimeAtEnd = newestSourceMtimeMs(REPO_ROOT);
  return {
    value,
    instabilityReasons: warmupInstabilityReasons(
      generationAtStart,
      getRebuildGeneration(),
      sourceMtimeAtStart,
      sourceMtimeAtEnd,
      hasPendingRebuild(),
    ),
  };
}

/** Start the playground server on the given port. Returns a handle with dispose() to stop everything. */
export async function startServer(port: number = PORT): Promise<PlaygroundServer> {
  startupReady = false;
  const playgroundHttpServer = createHttpServerOnAvailablePort(port, handleRequest);
  const { port: actualPort, server } = playgroundHttpServer;

  let watchers: FSWatcher[] = [];

  const dispose = createSharedDisposer(async () => {
    for (const watcher of watchers) {
      watcher.close();
    }
    for (const controller of sseClients) {
      try {
        controller.close();
      } catch {
        // Ignore already-closed streams.
      }
    }
    sseClients.clear();
    await server.stop(true);
  });

  const portFile = Bun.env['PLAYGROUND_PORT_FILE'];
  if (portFile !== undefined) {
    await Bun.write(portFile, `${actualPort}\n`);
  }
  process.stdout.write(`[playground] Listening at http://localhost:${actualPort}\n`);

  let prebuild;
  let stable = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    // Register before the eager build so deletions and edits during warmup
    // advance the generation even when the removed file is no longer present
    // in the end-of-build mtime scan.
    if (watchers.length === 0) {
      try {
        watchers = startWatcher();
      } catch (error) {
        await dispose();
        throw error;
      }
    }
    const prebuildAttempt = await runGenerationCheckedWarmup(() =>
      runConcurrentStartupWarmup(eagerPrebuildAndWarmManifests, loadShellServerRenderer),
    );
    prebuild = prebuildAttempt.value.prebuild;
    const { instabilityReasons } = prebuildAttempt;
    if (instabilityReasons.length === 0) {
      stable = true;
      break;
    }
    console.warn(
      `[playground] warmup pre-build invalidated on attempt ${attempt + 1}/5: ${instabilityReasons.join('; ')}`,
    );
    invalidateCachesForChange({ kind: 'components' });
  }
  if (!stable || !prebuild) {
    await dispose();
    throw new Error('[playground] eager prebuild invalidated repeatedly; refusing readiness');
  }
  if (!prebuild.shellSucceeded) {
    await dispose();
    throw new Error('[playground] shell bundle failed to build — see logs above');
  }
  const total = prebuild.succeeded + prebuild.failed.length;
  const failedSuffix = prebuild.failed.length > 0 ? ` (failed: ${prebuild.failed.join(', ')})` : '';
  process.stdout.write(
    `[playground] Pre-built ${prebuild.succeeded}/${total} page bundles${failedSuffix}\n`,
  );
  // Prepare the SSR shell renderer before advertising readiness. Requests must
  // never pay the cold Svelte server compilation cost on the first navigation.
  let rendererPrepared = false;
  let bundlesNeedPrebuild = false;
  for (let attempt = 0; attempt < 5 && !rendererPrepared; attempt += 1) {
    if (bundlesNeedPrebuild) {
      const prebuildAttempt = await runGenerationCheckedWarmup(eagerPrebuildAndWarmManifests);
      prebuild = prebuildAttempt.value;
      if (!prebuild.shellSucceeded) {
        await dispose();
        throw new Error(
          '[playground] shell bundle failed to build during renderer retry — see logs above',
        );
      }
      if (prebuildAttempt.instabilityReasons.length > 0) {
        console.warn(
          `[playground] renderer retry pre-build invalidated on attempt ${attempt + 1}/5: ${prebuildAttempt.instabilityReasons.join('; ')}`,
        );
        invalidateCachesForChange({ kind: 'components' });
        continue;
      }
      bundlesNeedPrebuild = false;
    }

    const generationAtStart = getRebuildGeneration();
    const sourceMtimeAtStart = newestSourceMtimeMs(REPO_ROOT);
    let rendererResult: ShellServerRendererLoadResult;
    try {
      rendererResult = await loadShellServerRenderer();
      setPreparedShellServerRenderer(rendererResult.renderer);
    } catch (error) {
      await dispose();
      throw new Error('[playground] shell server renderer failed to prepare', { cause: error });
    }
    const sourceMtimeAtEnd = newestSourceMtimeMs(REPO_ROOT);
    const generationChanged = generationAtStart !== getRebuildGeneration();
    const sourceChanged = sourceMtimeAtStart !== sourceMtimeAtEnd;
    const pendingRebuild = hasPendingRebuild();
    const instabilityReasons = warmupInstabilityReasons(
      generationAtStart,
      getRebuildGeneration(),
      sourceMtimeAtStart,
      sourceMtimeAtEnd,
      pendingRebuild,
    );
    const decision = rendererWarmupAttemptDecision(
      rendererResult.usedFallback,
      generationChanged,
      sourceChanged,
      pendingRebuild,
    );
    if (decision.accepted) {
      rendererPrepared = true;
    } else {
      if (rendererResult.usedFallback) {
        instabilityReasons.unshift('renderer fallback was used');
      }
      console.warn(
        `[playground] shell renderer warmup invalidated on attempt ${attempt + 1}/5: ${instabilityReasons.join('; ')}`,
      );
      resetShellRendererWarmupState();
      if (decision.needsPrebuild) {
        // Any source change can make the eager browser bundles stale. Restore
        // the bundle guarantee before advertising readiness. The next attempt
        // validates the generation around that prebuild before loading another
        // renderer, so an edit during the build cannot leave a partially cold
        // cache behind a stable renderer result.
        await waitForPendingRebuild();
        if (
          rendererWarmupNeedsCacheInvalidation(
            generationAtStart !== getRebuildGeneration(),
            sourceChanged,
            false,
          )
        ) {
          invalidateCachesForChange({ kind: 'components' });
        }
        bundlesNeedPrebuild = true;
      }
    }
  }
  if (!rendererPrepared) {
    await dispose();
    throw new Error('[playground] shell renderer invalidated repeatedly; refusing readiness');
  }
  startupReady = true;
  return {
    port: actualPort,
    dispose: async () => {
      startupReady = false;
      await dispose();
    },
  };
}

if (import.meta.main) {
  const server = await startServer();
  let shutdownPromise: Promise<void> | null = null;

  async function shutdown(code: number): Promise<never> {
    try {
      shutdownPromise ??= server.dispose();
      await shutdownPromise;
    } catch (error) {
      console.error('[playground] shutdown cleanup failed:', error);
    }
    process.exit(code);
  }

  process.on('SIGINT', () => {
    void shutdown(130);
  });
  process.on('SIGTERM', () => {
    void shutdown(143);
  });
}
