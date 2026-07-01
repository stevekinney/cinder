/**
 * Cinder component playground dev server.
 *
 * Runs at http://localhost:5555 by default, or the next available port. Routes:
 *   GET /              → shell HTML with README landing content
 *   GET /c/:name       → shell HTML (sidebar + iframe pointing at /page/:name)
 *   GET /page/:name    → component page HTML (the iframe target — lists examples)
 *   GET /page-bundle/:name.js → page-bundle entry OR a hashed code-split chunk.
 *                              Entry URLs are bare component names (e.g. chat.js);
 *                              chunk URLs are hashed (e.g. core-abc123.js). Both
 *                              artifact types share a flat namespace under /page-bundle/
 *                              so all dynamic-import URLs from either bundle family
 *                              resolve through this single route.
 *   GET /bundle/:name/:scenario.js → compiled example bundle (standalone — useful for tests/debugging)
 *   GET /styles.css    → raw contents of src/styles/index.css (slim base — no per-component CSS)
 *   GET /styles/shell.css → shell chrome styles (base CSS plus shell component CSS)
 *   GET /styles/all.css → full cascade aggregator (all component CSS — used by the preview iframe)
 *   GET /example-src/:name/:scenario → raw .example.svelte source
 *   GET /events        → Server-Sent Events stream for live reload
 *   GET /ping          → health check ("pong")
 *   GET /ready         → warmed-bundle readiness check ("ready")
 *
 * A file watcher on `src/` triggers a reload event to all connected SSE clients
 * whenever a file changes. Use `triggerReload()` directly in tests.
 */

import { randomUUID } from 'node:crypto';
import { rmSync, watch, type FSWatcher } from 'node:fs';
import { dirname, isAbsolute, join, relative as relativePath, sep } from 'node:path';

import { initializeHighlighter, renderMarkdown } from '@cinder/markdown/rendering';
import type { BuildArtifact } from 'bun';
import {
  componentSourcePath,
  findFixture,
  loadFixtureFile,
  resolveFixtureFilePath,
  resolveFixtureHostPath,
} from '../../components/scripts/lib/visual-fixtures/loader.ts';
import {
  fixtureRenderMode,
  type VisualFixture,
} from '../../components/scripts/lib/visual-fixtures/schema.ts';
import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { analyzeAll, resetProject } from './analyze.ts';
import { validateComponentDocumentationPayload } from './component-documentation-reference.ts';
import {
  ComponentDocumentationError,
  buildComponentDocumentation,
} from './component-documentation.ts';
import {
  COMPOSE_ONLY_COMPONENTS,
  discoverComponents,
  discoverExamples,
  discoverSidebarComponents,
  invalidateDiscoveryCache,
} from './discover.ts';
import { readExampleMetadata } from './example-metadata.ts';
import {
  FAVICON_HREF,
  PRE_PAINT_THEME_SCRIPT,
  escapeHtml,
  jsonForScriptTag,
  renderShell,
} from './render-shell.ts';
import { repositorySourceHref, rewriteRelativeRenderedMarkdownLinks } from './repository-links.ts';
import {
  BLOCKED_COLOR_VALUE_PATTERN,
  COLOR_TOKEN_NAMES,
  COLOR_VALUE_VARIABLE_REFERENCE_PATTERN,
  FALLBACK_COLOR_VALUE_PATTERN,
  MAX_COLOR_TOKEN_VALUE_LENGTH,
  SAFE_COLOR_VALUE_VARIABLE_NAME_PATTERN,
} from './shell-app/color-token-registry.ts';
import { humanizeComponentName } from './shell-app/humanize.ts';

import { stripExampleHarness } from '../../components/scripts/lib/strip-example-harness.ts';
import {
  isSnapshotMode,
  snapshotModeHtmlAttribute,
  snapshotModeStyleTag,
} from './snapshot-mode.ts';
import type { ComponentManifest } from './types.ts';

export const PORT = 5555;
const MAX_PORT_SCAN_ATTEMPTS = 100;
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
 * Shell-bundle entries: keyed by logical name → entry artifact path. There's
 * currently exactly one shell bundle (`'shell'`), but the map shape mirrors
 * the page-bundle map for symmetry and lets the cache-state machine in
 * Phase 2 publish atomically per family.
 */
const shellEntryByName = new Map<string, string>();

/**
 * Per-family artifact maps: artifact.path → JS source. Each family owns its
 * own map so the watcher rebuild can preserve one family's previously-published
 * artifacts when another family's rebuild fails. Routes resolve a filename by
 * checking the most-specific family first, then falling through to the others
 * (chunks can be shared between families via dedupe-by-content hash, and the
 * URL itself doesn't carry the family).
 *
 * All artifacts share a flat namespace under `/page-bundle/` and `/shell-bundle/`
 * URLs — there is no `chunks/` subdirectory; the Bun `naming` config emits
 * everything as `[name]-[hash].js` at the same level as entries. Entries can
 * never collide because they use disjoint `page-` / `bundle-` / `shell-`
 * basename prefixes.
 */
const pageArtifactByPath = new Map<string, string>();
const shellArtifactByPath = new Map<string, string>();
const scenarioArtifactByPath = new Map<string, string>();
const fixtureEntryByKey = new Map<string, string>();
const fixtureArtifactByPath = new Map<string, string>();

/**
 * In-flight lazy-build promises, keyed per family so two near-simultaneous
 * requests for the same not-yet-cached artifact (e.g. two browser tabs
 * hitting the same freshly invalidated page right after a save) share one
 * `Bun.build()` call instead of racing two. `pageBuildPromiseByKey` is keyed
 * by component name, `scenarioBuildPromiseByKey` by `<name>/<scenario>`, and
 * `shellBuildPromise` is a single slot (there's only ever one shell bundle).
 */
const pageBuildPromiseByKey = new Map<string, Promise<string | null>>();
const scenarioBuildPromiseByKey = new Map<string, Promise<string | null>>();
let shellBuildPromise: Promise<string | null> | null = null;
const fixtureBuildPromiseByKey = new Map<string, Promise<string | null>>();

/**
 * True when the shell bundle's cached entry may be out of date. Set by
 * `invalidateCachesForChange` for `components`/`shell`-scope changes;
 * cleared by `buildShellBundle` only after a compile that succeeds AND isn't
 * itself racing a newer invalidation.
 *
 * Deliberately NOT the same treatment as `pageEntryByName`/`pageArtifactByPath`
 * (which get cleared outright): the shell is critical infrastructure — losing
 * it blanks the entire playground, not just one component's doc page — so
 * `buildShellBundle` attempts a fresh compile while this is true but falls
 * back to serving the last-good cached shell if that attempt fails, instead
 * of 404ing. This matches the pre-redesign rebuild path's behavior, which
 * only swapped the shell bundle on a successful compile.
 */
let shellStale = false;

/**
 * Family identifier used by `findArtifactForFamily` to constrain which
 * artifacts a given route may serve. Each family corresponds to one of the
 * three artifact maps.
 */
type ArtifactFamily = 'page' | 'shell' | 'scenario' | 'fixture';

/**
 * Prefixes that identify a hashed entry artifact for each bundle family.
 * Bun's `naming` template uses the entrypoint basename for `[name]`, and
 * each family's compile step writes its entry basename with one of these
 * prefixes (see `compilePageBundleArtifacts`, `compileShellBundleArtifacts`,
 * and `buildBundle`). Content-hashed peer chunks (e.g. `core-abc123.js`,
 * `commonmark-def456.js`) do NOT have any of these prefixes — they're
 * emitted by Bun's code-splitter without a family label.
 */
const ENTRY_PREFIXES: Record<ArtifactFamily, string> = {
  page: 'page-',
  shell: 'shell-',
  scenario: 'bundle-',
  fixture: 'fixture-',
};

/**
 * Look up an artifact for a specific bundle family route.
 *
 * Rules:
 * - The requesting family's own map is searched first.
 * - On miss, other family maps are searched ONLY for chunk-style artifacts
 *   (names that don't begin with any family's entry prefix). This allows
 *   shared content-hashed chunks to be served regardless of which build
 *   produced them, while preventing `/shell-bundle/page-button-abc.js`
 *   from being satisfied by a page-bundle entry artifact in the page map.
 *
 * Returns the artifact source, or `undefined` if no family has a permitted
 * match.
 */
function findArtifactForFamily(family: ArtifactFamily, path: string): string | undefined {
  const allMaps: Record<ArtifactFamily, Map<string, string>> = {
    page: pageArtifactByPath,
    shell: shellArtifactByPath,
    scenario: scenarioArtifactByPath,
    fixture: fixtureArtifactByPath,
  };
  const ownHit = allMaps[family].get(path);
  if (ownHit !== undefined) return ownHit;

  // Cross-family fallback is restricted to chunk-style artifacts (no entry
  // prefix). Entries belong to their family and must not be served under
  // another family's route.
  const isEntryName = (Object.values(ENTRY_PREFIXES) as readonly string[]).some((prefix) =>
    path.startsWith(prefix),
  );
  if (isEntryName) return undefined;

  // Search every map *except* the requesting family's own (already checked).
  // Iterate entries so the value is the typed Map directly — no narrowing cast
  // on Object.keys (which is typed `string[]`, not `ArtifactFamily[]`).
  const ownMap = allMaps[family];
  for (const [, map] of Object.entries(allMaps)) {
    if (map === ownMap) continue;
    const hit = map.get(path);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

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

/** Resolved manifest array — cached after first analysis. */
let manifestCache: ComponentManifest[] | null = null;
/** In-flight analyzeAll() promise — prevents duplicate concurrent analyses. */
let manifestPromise: Promise<ComponentManifest[]> | null = null;

/**
 * Invalidation generation. Bumped synchronously by `invalidateCachesForChange`
 * every time the watcher invalidates caches (never by an async rebuild — there
 * is no rebuild). The lazy per-artifact builders (`buildPageBundle`,
 * `buildShellBundle`, `buildFixtureBundle`) capture this value before
 * compiling and skip publishing their entry-name pointer if the generation
 * moved on while they were mid-build, so a build that started just before an
 * edit can't finish just after the cache clear and republish a stale pointer.
 */
let rebuildGeneration = 0;

/** Debounce timer for the watcher. */
let rebuildDebounceTimer: ReturnType<typeof setTimeout> | null = null;
/** Whether any change in the current debounce window touched shell sources. */
let pendingShellChanged = false;
/** Whether any change in the current debounce window touched components-package source. */
let pendingComponentsChanged = false;
/** Example component names (kebab) touched in the current debounce window. */
const pendingExampleNames = new Set<string>();

/**
 * The blast radius of a watched change, computed once per debounce window.
 * Three tiers, widest wins:
 *
 * - `shell`: `shell-app/**` or `render-shell.ts` changed. Clears the shell
 *   bundle plus every page bundle (every page bundle's generated entry mounts
 *   `component-page.svelte`, and the "everything else under playground src"
 *   fallback below also routes through here — see `startWatcher`).
 * - `components`: a file under the components package's `src/` changed.
 *   Clears every page bundle. This is conservative on purpose — components
 *   cross-import each other directly (e.g. `newsletter-section.svelte`
 *   imports `Button`/`Container`/`Input`) and share `utilities/*.ts` helpers
 *   used almost everywhere, so a precise per-file reverse-dependency scope
 *   isn't cheaply computable. Clearing is an O(1) Map operation, not a
 *   rebuild — only the page(s) actually requested next pay a compile cost.
 * - `examples`: only `.example.svelte` files changed. An example file
 *   belongs to exactly one component, so this scope is precise.
 */
type ChangeScope =
  | { kind: 'shell' }
  | { kind: 'components' }
  | { kind: 'examples'; names: ReadonlySet<string> };

/**
 * Schedule a debounced cache invalidation. Coalesces save bursts: multiple
 * calls within the debounce window accumulate into one invalidation that
 * fires after the window elapses with no further calls. Scopes accumulate
 * (OR the booleans, union the example names) so the final invalidation
 * reflects everything touched during the window, not just the last call.
 */
function scheduleRebuild(scope: ChangeScope): void {
  if (scope.kind === 'shell') pendingShellChanged = true;
  else if (scope.kind === 'components') pendingComponentsChanged = true;
  else for (const name of scope.names) pendingExampleNames.add(name);

  if (rebuildDebounceTimer !== null) clearTimeout(rebuildDebounceTimer);
  rebuildDebounceTimer = setTimeout(() => {
    rebuildDebounceTimer = null;
    const shellChanged = pendingShellChanged;
    const componentsChanged = pendingComponentsChanged;
    const exampleNames = new Set(pendingExampleNames);
    pendingShellChanged = false;
    pendingComponentsChanged = false;
    pendingExampleNames.clear();

    if (shellChanged) invalidateCachesForChange({ kind: 'shell' });
    else if (componentsChanged) invalidateCachesForChange({ kind: 'components' });
    else if (exampleNames.size > 0) {
      invalidateCachesForChange({ kind: 'examples', names: exampleNames });
    }
  }, 100);
}

/**
 * Invalidate the cache entries affected by a change, sized to `scope`. This
 * is deliberately NOT a rebuild: the previous implementation eagerly
 * recompiled every sidebar component's page bundle (plus the shell) on every
 * single watched change, which meant one saved file could trigger ~161
 * concurrent `Bun.build()` calls — the actual cause of multi-gigabyte RSS
 * spikes and Bun segfaults during local dev.
 *
 * Clearing a cache Map is O(1); the actual compile is deferred entirely to
 * the existing per-route lazy build-and-cache fallback (`buildPageBundle`,
 * `buildShellBundle`, `buildBundle`) the next time a request actually needs
 * that artifact — the same mechanism already used today when a brand-new
 * component is added after server start, or an eager pre-build failed.
 *
 * Runs fully synchronously (no `await` between steps) so no request can ever
 * observe a half-invalidated cache — this is what makes it safe for route
 * handlers to read the cache maps directly with no additional coordination.
 */
function invalidateCachesForChange(scope: ChangeScope): void {
  // Bump first: a lazy build already in flight captured the OLD generation
  // and will skip publishing its entry-name pointer once it notices the
  // generation moved on (see `buildPageBundle` et al.), so it can't
  // republish a stale pointer after the clears below.
  rebuildGeneration += 1;

  // Component files may have been added, renamed, or removed — re-scan on
  // next request.
  invalidateDiscoveryCache();
  manifestCache = null;
  manifestPromise = null;
  // Dispose the shared ts-morph project so the next analyzeAll() rebuilds
  // from fresh compiler state rather than reusing sources from before this
  // change.
  resetProject();

  // Scenario and fixture builds are lazy (per-example / per-fixture) and were
  // never part of the eager sweep. Clear them unconditionally on every
  // invalidation tier — rebuilding one example or fixture on next request is
  // cheap regardless of what changed.
  bundleEntryByKey.clear();
  scenarioArtifactByPath.clear();
  fixtureEntryByKey.clear();
  fixtureArtifactByPath.clear();
  fixtureBuildPromiseByKey.clear();
  // Also clear the in-flight dedup slot, not just the resolved-artifact
  // caches above. A build already in flight when this invalidation fires
  // keeps running (it'll skip publishing its entry pointer once it notices
  // the generation moved on — see `buildPageBundle` et al.), but if we left
  // its dedup entry in place, a request that arrives AFTER this invalidation
  // (e.g. the browser's reload in response to the SSE event below) would
  // find that stale in-flight promise and join it, serving pre-edit content
  // as if it were fresh. Clearing the slot here — before `triggerReload`
  // fires the event that causes the browser to re-request — guarantees any
  // post-invalidation request starts a genuinely new build instead.
  scenarioBuildPromiseByKey.clear();

  if (scope.kind === 'examples') {
    for (const name of scope.names) {
      const entryPath = pageEntryByName.get(name);
      pageEntryByName.delete(name);
      if (entryPath !== undefined) pageArtifactByPath.delete(entryPath);
      pageBuildPromiseByKey.delete(name);
    }
    triggerReload('reload');
    return;
  }

  // `components` and `shell` have an IDENTICAL clearing footprint — both
  // clear every page bundle (see the `ChangeScope` doc comment for why a
  // narrower page scope isn't safe) AND mark the shell stale. The shell
  // isn't `components`-scope-exempt: `shell-app/sidebar.svelte`,
  // `top-bar.svelte`, and `landing-page.svelte` all import the full
  // component barrel (`../../../components/src/index.ts`), so a
  // components-package change can affect the shell's own compiled output,
  // not just page bundles. The only difference between the two scopes is
  // which SSE event to emit: `shell-reload` forces a live browser reload
  // (needed when shell-app sources themselves changed); `reload` doesn't
  // (a components-only change still leaves the shell CACHE fresh for
  // whenever a real reload next happens, without disrupting the current
  // session on every component edit).
  pageEntryByName.clear();
  pageArtifactByPath.clear();
  pageBuildPromiseByKey.clear();

  // See `shellStale`'s doc comment for why this marks staleness rather than
  // clearing `shellEntryByName`/`shellArtifactByPath` outright. Still clear
  // the in-flight dedup slot for the same reason as `scenarioBuildPromiseByKey`
  // above — a post-invalidation request must not join a pre-edit build.
  shellStale = true;
  shellBuildPromise = null;

  triggerReload(scope.kind === 'shell' ? 'shell-reload' : 'reload');
}

/** Set of active SSE stream controllers. */
const sseClients = new Set<ReadableStreamDefaultController<string>>();

/**
 * Send a named SSE event to every connected client.
 *
 * - `reload` (default) → shell SPA reloads only the iframe, preserving any
 *   in-shell state (sidebar scroll, future top-bar state). Used when
 *   preview-source files change.
 * - `shell-reload` → shell SPA performs a full `location.reload()` because
 *   the shell bundle itself changed. Used when files under `shell-app/` or
 *   `render-shell.ts` change.
 */
export function triggerReload(eventType: 'reload' | 'shell-reload' = 'reload'): void {
  const message = `event: ${eventType}\ndata: {}\n\n`;
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

/**
 * Start watching the components, examples, and playground source trees and
 * route every change through `scheduleRebuild`. The scheduler debounces
 * bursts and the generation-token state machine guarantees publish atomicity.
 */
function startWatcher(): FSWatcher[] {
  const created: FSWatcher[] = [];

  try {
    // Components tree: source or shared-utility changes can affect any page
    // bundle (see the `ChangeScope` doc comment for the verified
    // cross-component-import / shared-utility fan-out), so this always uses
    // the 'components' scope — which ALSO marks the shell stale (shell-app
    // UI imports the full component barrel; see `ChangeScope`'s doc comment).
    const srcPath = join(COMPONENTS_ROOT, 'src');
    created.push(
      watch(srcPath, { recursive: true }, (_event, filename) => {
        if (filename) scheduleRebuild({ kind: 'components' });
      }),
    );

    // Examples directory: an edit to `<name>/<scenario>.example.svelte` can
    // only ever affect that one component's page bundle, so the scope is
    // precisely the touched component name (the first path segment). Other
    // files can also live directly under `examples/` (e.g.
    // `featured-examples.ts`, a shared test-data registry) — those aren't
    // scoped to one component, so they fall back to 'components' scope
    // rather than being silently treated as a bogus per-component name.
    const examplesPath = join(PLAYGROUND_ROOT, 'src', 'examples');
    created.push(
      watch(examplesPath, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const normalizedFilename = filename.replaceAll('\\', '/');
        if (normalizedFilename.endsWith('.test.ts') || normalizedFilename.startsWith('.')) return;
        if (normalizedFilename.endsWith('.example.svelte')) {
          const segments = normalizedFilename.split('/');
          // Recursive `fs.watch` can report a nested edit as a bare basename
          // with no directory segment on some platforms (observed on Linux
          // with certain Bun versions) — in that case we can't tell which
          // component owns it, so fall back to 'components' scope rather
          // than treating the whole filename as a bogus per-component name
          // (which would invalidate nothing real and leave the actual
          // component's stale cache entry untouched).
          if (segments.length < 2) {
            scheduleRebuild({ kind: 'components' });
            return;
          }
          const name = segments[0];
          if (name) scheduleRebuild({ kind: 'examples', names: new Set([name]) });
          return;
        }
        scheduleRebuild({ kind: 'components' });
      }),
    );

    // Playground src tree: component-page.svelte, render-shell.ts, the
    // shell-app/ directory, analyze.ts, etc. Shell-source changes (paths
    // under `shell-app/` or to `render-shell.ts`) use the 'shell' scope so
    // the SSE event is `shell-reload` instead of `reload`. Everything else
    // under playground src (component-page.svelte, and genuine server-logic
    // files like discover.ts/analyze.ts) uses the 'components' scope: for
    // component-page.svelte that's the correct footprint (it's embedded in
    // every page bundle's generated entry, same as a components-package
    // change); for server-logic files it's redundant with `bun --watch`
    // restarting the whole process (see the `dev` script) but harmless,
    // since invalidation is now an O(1) Map-clear rather than a rebuild.
    const playgroundSrcPath = join(PLAYGROUND_ROOT, 'src');
    created.push(
      watch(playgroundSrcPath, { recursive: true }, (_event, filename) => {
        if (
          filename &&
          !filename.startsWith('examples/') &&
          !filename.endsWith('.test.ts') &&
          !filename.startsWith('.')
        ) {
          const normalizedFilename = filename.replaceAll('\\', '/');
          const isShellChange =
            normalizedFilename.startsWith('shell-app/') || normalizedFilename === 'render-shell.ts';
          scheduleRebuild(isShellChange ? { kind: 'shell' } : { kind: 'components' });
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
 * Shared Bun.build options used by every family.
 *
 * Each compile site supplies its own `publicPath` so that dynamic-import URLs
 * emitted by the splitter resolve through the matching route. The shell entry
 * has no dynamic imports today, but parameterizing `publicPath` keeps the
 * route boundary honest the moment a shell descendant ever uses `import()`,
 * rather than relying on `findArtifactForFamily`'s cross-family fallback to
 * paper over chunks that bake in the wrong URL.
 *
 * Putting chunks in a `chunks/` subdir triggers a Bun publicPath quirk where
 * peer-chunk imports get the subdirectory stripped from their URL, so the
 * naming template stays flat.
 */
const SHARED_BUILD_OPTIONS = {
  plugins: [sveltePlugin({ generate: 'client', injectCss: true })],
  target: 'browser',
  format: 'esm',
  // `svelte` falls back to source resolution for the `@lostgradient/cinder`
  // workspace package: its exports map advertises `svelte` and `types`
  // conditions pointing at `./src/components/<name>/index.ts`, with no browser
  // source condition. The page bundles themselves are browser bundles, though,
  // so we avoid the `bun` condition here. Private workspace packages such as
  // `@cinder/markdown` use that condition for Bun/server source entry points,
  // which can break Linux browser bundling for markdown-backed components.
  conditions: ['browser', 'svelte'],
  splitting: true,
  naming: {
    entry: '[name]-[hash].js',
    // Use a distinct prefix for shared chunks so they cannot collide with
    // the entry's `[name]` template. Some Bun builds on Linux emit shared
    // chunks where `[name]` resolves to the entry basename (e.g.
    // `page-code-block`), and when multiple such chunks exist in one build
    // they share the entry's name and race to the same output path. A
    // distinct `chunk-` prefix sidesteps this entirely while keeping chunks
    // in the flat top-level layout (a `chunks/` subdir triggers a separate
    // Bun publicPath quirk where the subdir is stripped from peer-chunk
    // import URLs).
    chunk: 'chunk-[hash].js',
    asset: '[name]-[hash][ext]',
  },
} as const satisfies Omit<Parameters<typeof Bun.build>[0], 'entrypoints' | 'publicPath'>;

/**
 * Per-family `publicPath` baked into each emitted chunk's import URL.
 *
 * The page and scenario families share `/page-bundle/` because scenario chunks
 * have always resolved through that route — there is no separate scenario
 * bundle route. Shell gets its own `/shell-bundle/` so any future dynamic
 * import in the shell tree resolves through the shell route.
 */
const PUBLIC_PATH_BY_FAMILY: Record<ArtifactFamily, string> = {
  page: '/page-bundle/',
  shell: '/shell-bundle/',
  scenario: '/page-bundle/',
  fixture: '/fixture-bundle/',
};

/**
 * Walk `result.outputs` and return the entry path/code plus a map of EVERY
 * artifact produced by this build (entry plus all hashed chunks).
 *
 * This function is pure with respect to the module-level caches — it does NOT
 * write to any shared map. The caller decides whether to publish into the
 * shared cache directly (the lazy-build path) or accumulate into local maps
 * for an atomic publish (the watcher rebuild path).
 *
 * Returns `null` if no entry-point artifact was found (shouldn't happen with
 * a valid Bun.build result, but handled defensively).
 */
async function collectBuildArtifacts(
  outputs: BuildArtifact[],
): Promise<{ entryPath: string; entryCode: string; artifacts: Map<string, string> } | null> {
  const artifacts = new Map<string, string>();
  let entryCode: string | null = null;
  let entryPath: string | null = null;
  for (const output of outputs) {
    const path = artifactRelativePath(output.path);
    const code = await output.text();
    artifacts.set(path, code);
    if (output.kind === 'entry-point') {
      entryCode = code;
      entryPath = path;
    }
  }
  if (entryPath === null || entryCode === null) return null;
  return { entryPath, entryCode, artifacts };
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
    const cached = scenarioArtifactByPath.get(cachedEntryPath);
    if (cached !== undefined) return cached;
  }

  // De-dupe concurrent requests for the same not-yet-cached scenario bundle
  // (e.g. two browser tabs hitting the same freshly invalidated example)
  // into a single Bun.build() call.
  const existing = scenarioBuildPromiseByKey.get(cacheKey);
  if (existing !== undefined) return existing;

  const buildPromise = buildBundleUncached(componentName, scenario, cacheKey);
  scenarioBuildPromiseByKey.set(cacheKey, buildPromise);
  try {
    return await buildPromise;
  } finally {
    // Only remove OUR OWN entry — see buildPageBundle's identical guard for
    // why an unconditional delete would risk clobbering a newer build.
    if (scenarioBuildPromiseByKey.get(cacheKey) === buildPromise) {
      scenarioBuildPromiseByKey.delete(cacheKey);
    }
  }
}

async function buildBundleUncached(
  componentName: string,
  scenario: string,
  cacheKey: string,
): Promise<string | null> {
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

  // Captured before the (potentially slow) compile so we can tell, after it
  // resolves, whether an invalidation raced past us — see the publish guard
  // below.
  const generationAtStart = rebuildGeneration;

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

    const result = await Bun.build({
      entrypoints: [entryTempPath],
      publicPath: PUBLIC_PATH_BY_FAMILY.scenario,
      ...SHARED_BUILD_OPTIONS,
    });

    if (!result.success) {
      console.error(`[playground] Bundle failed for ${componentName}/${scenario}:`, result.logs);
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error(`[playground] Bundle for ${componentName}/${scenario} produced no entry chunk`);
      return null;
    }

    // Chunk filenames are content-hashed, so publishing them is always safe
    // even if a newer invalidation raced past us — the bytes are identical.
    for (const [path, code] of entry.artifacts) scenarioArtifactByPath.set(path, code);
    // Only publish the entry pointer when we're not racing a newer
    // invalidation. Without this guard, a build that straddles an
    // invalidation would resurrect a stale `bundleEntryByKey` entry right
    // after `invalidateCachesForChange` cleared it.
    if (generationAtStart === rebuildGeneration) {
      bundleEntryByKey.set(cacheKey, entry.entryPath);
    }
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
 * Compile the all-in-one page bundle for a single component without
 * mutating any module-level state. Pure with respect to the cache maps —
 * returns the entry path/code + every artifact this build emitted, leaving
 * publication to the caller (lazy-build wrapper or the atomic watcher
 * rebuild).
 *
 * The bundle includes component-page.svelte plus every scenario, all in one
 * Bun.build invocation so they share a single Svelte runtime in the browser.
 * Scenarios register themselves on `window.__CINDER_SCENARIOS__`, and
 * `component-page.svelte` reads that global on mount.
 */
async function compilePageBundleArtifacts(
  componentName: string,
  knownComponents?: ReadonlySet<string>,
): Promise<{ entryPath: string; entryCode: string; artifacts: Map<string, string> } | null> {
  // Validate that this is an actual component before building. A bundle for a
  // bogus name still compiles (empty scenario list + the no-examples fallback)
  // and would 200, hiding typos behind a "No examples found" UI.
  //
  // The watcher rebuild already knows the component list (it discovered them
  // a moment ago), so it passes `knownComponents` to skip the redundant glob
  // scan. The lazy-build path falls through to discoverComponents().
  if (knownComponents !== undefined) {
    if (!knownComponents.has(componentName)) return null;
  } else {
    const components = await discoverComponents();
    if (!components.includes(componentName)) return null;
  }

  const scenarios = await discoverExamples(componentName);
  // Zero scenarios is allowed: the bundle still mounts component-page.svelte,
  // which renders a "No examples found" fallback.

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
import * as BareComponentModule from '@lostgradient/cinder/${componentName}';
${scenarioImports}
const scenarios: Record<string, unknown> = {
${scenarioRegistrations}
};

(window as unknown as Record<string, unknown>)['__CINDER_SCENARIOS__'] = scenarios;
const target = document.getElementById('app');
if (target === null) {
  throw new Error('[cinder playground] #app target not found');
}

// Pass the bare component's module namespace as a prop so the Playground section
// can mount the component directly with synthesized prop values (live preview,
// #405). The page resolves it by \`documentation.component.exportName\`, falling
// back to the default export — the whole namespace is handed over so both
// resolve. Threaded as a prop (not a \`window\` global) so the live preview is
// wired explicitly to the bundle that mounted the page.
mount(ComponentPage, { target, props: { bareComponentModule: BareComponentModule } });
`;

  try {
    await Bun.write(entryTempPath, entrySource);

    const result = await Bun.build({
      entrypoints: [entryTempPath],
      publicPath: PUBLIC_PATH_BY_FAMILY.page,
      ...SHARED_BUILD_OPTIONS,
    });

    if (!result.success) {
      console.error(`[playground] page bundle failed for ${componentName}:`, result.logs);
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error(`[playground] page bundle for ${componentName} produced no entry chunk`);
      return null;
    }

    return entry;
  } finally {
    rmSync(entryTempDir, { recursive: true, force: true });
  }
}

/**
 * Lazy-build wrapper: compile a page bundle and publish into shared caches.
 * Used by the `/page-bundle/:filename.js` route as a fallback when an
 * eagerly-pre-built bundle isn't already in the cache (e.g. a component
 * whose pre-build failed, or a brand-new component added after server start).
 *
 * Concurrency: captures `rebuildGeneration` before the build starts and
 * skips publishing the entry-name pointer if an invalidation landed during
 * the compile (see `invalidateCachesForChange` — a newer invalidation means
 * this result may already be stale). The compiled artifacts are still
 * returned to the caller, so the request that triggered the lazy build is
 * served correctly; only the shared entry-name cache is left alone in the
 * race-loss case. De-dupes concurrent callers for the same component via
 * `pageBuildPromiseByKey` so two near-simultaneous requests share one build.
 */
async function buildPageBundle(
  componentName: string,
  knownComponents?: ReadonlySet<string>,
): Promise<string | null> {
  const cachedEntryPath = pageEntryByName.get(componentName);
  if (cachedEntryPath) {
    const cached = pageArtifactByPath.get(cachedEntryPath);
    if (cached !== undefined) return cached;
  }

  const existing = pageBuildPromiseByKey.get(componentName);
  if (existing !== undefined) return existing;

  const buildPromise = (async () => {
    const generationAtStart = rebuildGeneration;
    const entry = await compilePageBundleArtifacts(componentName, knownComponents);
    if (entry === null) return null;

    // We always publish the artifacts: the entry code we're about to return
    // statically imports content-hashed chunk URLs, and if those chunks
    // aren't in the cache, the browser's chunk requests will 404. Chunk
    // filenames are content-hashed, so writing them is safe even if a newer
    // invalidation already cleared and re-populated the same chunks — the
    // bytes are identical.
    for (const [path, code] of entry.artifacts) pageArtifactByPath.set(path, code);
    // Only update the entry-by-name mapping when we're not racing a newer
    // invalidation. A stale generation skips this so it can't republish a
    // pointer to now-invalidated content.
    if (generationAtStart === rebuildGeneration) {
      pageEntryByName.set(componentName, entry.entryPath);
    }
    return entry.entryCode;
  })();

  pageBuildPromiseByKey.set(componentName, buildPromise);
  try {
    return await buildPromise;
  } finally {
    // Only remove OUR OWN entry. `invalidateCachesForChange` may have
    // already deleted it (to stop a post-invalidation request from joining
    // this now-stale build — see its doc comment), and a newer build may
    // have since claimed the key; an unconditional delete here would
    // clobber that newer build's still-in-flight entry.
    if (pageBuildPromiseByKey.get(componentName) === buildPromise) {
      pageBuildPromiseByKey.delete(componentName);
    }
  }
}

function relativeImportSpecifier(fromDirectory: string, targetPath: string): string {
  const relative = relativePath(fromDirectory, targetPath).replaceAll(sep, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function fixtureEntryKey(
  componentName: string,
  fixtureName: string,
  fixtureContentHash: string,
): string {
  return `fixture-${componentName}-${fixtureName}-${fixtureContentHash}`;
}

function fixtureCacheKey(
  componentName: string,
  fixture: VisualFixture,
  fixtureContentHash: string,
): string {
  return `${componentName}/${fixture.name}/${fixtureRenderMode(fixture)}/${fixtureContentHash}`;
}

async function compileFixtureBundleArtifacts(
  componentName: string,
  fixture: VisualFixture,
  fixtureContentHash: string,
  componentOrHostPath: string,
): Promise<{ entryPath: string; entryCode: string; artifacts: Map<string, string> } | null> {
  const entryBasename = fixtureEntryKey(componentName, fixture.name, fixtureContentHash);
  const entryTempDir = join(PLAYGROUND_ROOT, 'src', `.tmp-${randomUUID()}`);
  const entryTempPath = join(entryTempDir, `${entryBasename}.ts`);
  const propsTempPath = join(entryTempDir, `${entryBasename}-props.ts`);
  const componentImport = relativeImportSpecifier(entryTempDir, componentOrHostPath);
  const fixtureProps = 'props' in fixture && fixture.props !== undefined ? fixture.props : {};

  const entrySource = `import { flushSync, mount } from 'svelte';

import Component from ${JSON.stringify(componentImport)};
import props from './${entryBasename}-props.ts';

const target = document.getElementById('app');
if (target === null) {
  throw new Error('[cinder playground] #app target not found');
}

mount(Component, { target, props });
flushSync();
`;

  try {
    await Bun.write(entryTempPath, entrySource);
    await Bun.write(
      propsTempPath,
      `const props = ${JSON.stringify(fixtureProps)} as const;\nexport default props;\n`,
    );

    const result = await Bun.build({
      entrypoints: [entryTempPath],
      publicPath: PUBLIC_PATH_BY_FAMILY.fixture,
      ...SHARED_BUILD_OPTIONS,
    });

    if (!result.success) {
      console.error(
        `[playground] fixture bundle failed for ${componentName}/${fixture.name}:`,
        result.logs,
      );
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error(
        `[playground] fixture bundle for ${componentName}/${fixture.name} produced no entry chunk`,
      );
      return null;
    }

    return entry;
  } finally {
    rmSync(entryTempDir, { recursive: true, force: true });
  }
}

async function buildFixtureBundle(
  componentName: string,
  fixture: VisualFixture,
  fixtureContentHash: string,
  componentOrHostPath: string,
): Promise<string | null> {
  const entryKey = fixtureEntryKey(componentName, fixture.name, fixtureContentHash);
  const cachedEntryPath = fixtureEntryByKey.get(entryKey);
  if (cachedEntryPath) {
    const cached = fixtureArtifactByPath.get(cachedEntryPath);
    if (cached !== undefined) return cachedEntryPath;
  }

  const cacheKey = fixtureCacheKey(componentName, fixture, fixtureContentHash);
  const existing = fixtureBuildPromiseByKey.get(cacheKey);
  if (existing !== undefined) return existing;

  const buildPromise = (async () => {
    const generationAtStart = rebuildGeneration;
    const entry = await compileFixtureBundleArtifacts(
      componentName,
      fixture,
      fixtureContentHash,
      componentOrHostPath,
    );
    if (entry === null) return null;

    // Always publish the artifacts (matches buildPageBundle's rationale —
    // chunk filenames are content-hashed, so publishing is safe regardless
    // of a racing invalidation) and always return the entry path to the
    // caller that requested this compile: it genuinely succeeded, and the
    // route that serves `/fixture-bundle/:filename.js` resolves by the
    // SPECIFIC hashed path this response embeds, not through
    // `fixtureEntryByKey` — so the fixture page still renders correctly
    // even when the cache pointer below isn't updated.
    for (const [path, code] of entry.artifacts) fixtureArtifactByPath.set(path, code);
    // Only update the "latest" entry-key pointer when we're not racing a
    // newer invalidation, so a FUTURE lookup by `entryKey` doesn't resolve
    // to this now-superseded build.
    if (generationAtStart === rebuildGeneration) {
      fixtureEntryByKey.set(entryKey, entry.entryPath);
    }
    return entry.entryPath;
  })();

  fixtureBuildPromiseByKey.set(cacheKey, buildPromise);
  try {
    return await buildPromise;
  } finally {
    // Only remove OUR OWN entry — see buildPageBundle's identical guard for
    // why an unconditional delete would risk clobbering a newer build.
    if (fixtureBuildPromiseByKey.get(cacheKey) === buildPromise) {
      fixtureBuildPromiseByKey.delete(cacheKey);
    }
  }
}

/**
 * Compile the playground shell SPA bundle without mutating cache state.
 *
 * Compiles `shell-app/shell-entry.ts` (which imports `shell.svelte`) into a
 * single ESM bundle using the same `SHARED_BUILD_OPTIONS` + Svelte plugin
 * configuration as the page-bundle family. The entry uses a `shell-` basename
 * prefix so the entry key is disjoint from `page-*` and `bundle-*`.
 *
 * Returns the entry path/code and every emitted artifact, or `null` on
 * build failure. The caller decides whether to publish into shared caches.
 */
async function compileShellBundleArtifacts(): Promise<{
  entryPath: string;
  entryCode: string;
  artifacts: Map<string, string>;
} | null> {
  const entryBasename = 'shell-shell';
  const entryTempDir = join(PLAYGROUND_ROOT, 'src', `.tmp-${randomUUID()}`);
  const entryTempPath = join(entryTempDir, `${entryBasename}.ts`);
  // Side-effect import: `shell-entry.ts` calls `mount(Shell, ...)` at module
  // top level and exports nothing. `export {} from` is a re-export of named
  // bindings and is eligible for tree-shaking when the source exports no
  // names; a bare side-effect import preserves the module's evaluation.
  const shim = `import '../shell-app/shell-entry.ts';\n`;

  try {
    await Bun.write(entryTempPath, shim);

    const result = await Bun.build({
      entrypoints: [entryTempPath],
      publicPath: PUBLIC_PATH_BY_FAMILY.shell,
      ...SHARED_BUILD_OPTIONS,
    });

    if (!result.success) {
      console.error('[playground] shell bundle failed:', result.logs);
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error('[playground] shell bundle produced no entry chunk');
      return null;
    }

    return entry;
  } finally {
    rmSync(entryTempDir, { recursive: true, force: true });
  }
}

/**
 * Lazy-build wrapper: compile the shell bundle and publish into shared
 * caches. Used by `/shell-bundle/shell.js` as a fallback when the shell
 * bundle isn't already cached, or when `shellStale` is set. Same
 * race-discipline as `buildPageBundle` (see the doc-comment there): skip the
 * entry-name publish if an invalidation landed during the compile. De-dupes
 * concurrent callers via `shellBuildPromise` (a single slot — there's only
 * ever one shell bundle).
 *
 * Unlike `buildPageBundle`, a failed compile does NOT surface as a miss: it
 * falls back to the last-good cached shell (if any) instead — see
 * `shellStale`'s doc comment for why the shell specifically needs this.
 */
async function buildShellBundle(): Promise<string | null> {
  const cachedEntryPath = shellEntryByName.get('shell');
  const cachedCode =
    cachedEntryPath !== undefined ? shellArtifactByPath.get(cachedEntryPath) : undefined;
  if (cachedCode !== undefined && !shellStale) return cachedCode;

  if (shellBuildPromise !== null) return shellBuildPromise;

  const buildPromise: Promise<string | null> = (async () => {
    const generationAtStart = rebuildGeneration;
    // A Svelte syntax error makes the underlying `Bun.build()` call THROW
    // rather than resolve with `{ success: false }` — `.catch()` converts
    // that into the same graceful-failure path as a build that resolves
    // unsuccessfully, so the fallback below actually runs instead of
    // rejecting past this function into an uncaught-exception 500.
    const entry = await compileShellBundleArtifacts().catch((error: unknown) => {
      console.error('[playground] shell rebuild threw:', error);
      return null;
    });
    if (entry === null) {
      console.error(
        '[playground] shell rebuild failed — serving last-good shell (if cached); will retry on next request',
      );
      return cachedCode ?? null;
    }

    // Always publish chunks (see buildPageBundle's comment for the
    // rationale — the entry we're returning has static imports to
    // content-hashed chunks that must be servable).
    for (const [path, code] of entry.artifacts) shellArtifactByPath.set(path, code);
    if (generationAtStart === rebuildGeneration) {
      shellEntryByName.set('shell', entry.entryPath);
      shellStale = false;
    }
    return entry.entryCode;
  })();
  shellBuildPromise = buildPromise;

  try {
    return await buildPromise;
  } finally {
    // Only clear OUR OWN slot — see buildPageBundle's identical guard for
    // why an unconditional null-out would risk clobbering a newer build.
    if (shellBuildPromise === buildPromise) shellBuildPromise = null;
  }
}

/**
 * Return the full manifest array, using the module-level cache. Cleared by
 * `invalidateCachesForChange` (which nulls `manifestCache`/`manifestPromise`
 * and resets the shared ts-morph project) on every invalidation tier.
 */
async function getManifests(): Promise<ComponentManifest[]> {
  if (manifestCache !== null) return manifestCache;
  // Captured before awaiting so we can tell, once the analysis resolves,
  // whether an invalidation raced past us — see the publish guard below.
  const generationAtStart = rebuildGeneration;
  // Reuse the in-flight promise so concurrent callers don't each start analyzeAll().
  manifestPromise ??= analyzeAll(join(COMPONENTS_ROOT, 'src', 'components'));
  const inFlight = manifestPromise;
  try {
    const manifests = await inFlight;
    // Only publish if we're not racing a newer invalidation. Without this
    // guard, an analysis that straddles an invalidation would resurrect
    // stale prop metadata into `manifestCache` right after
    // `invalidateCachesForChange` cleared it.
    if (generationAtStart === rebuildGeneration) {
      manifestCache = manifests;
    }
    return manifests;
  } finally {
    // Only clear OUR OWN in-flight reference — see buildPageBundle's
    // identical guard for why an unconditional null-out would risk
    // clobbering a newer call's in-flight promise.
    if (manifestPromise === inFlight) manifestPromise = null;
  }
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

function renderPreviewMessageBridgeScript(): string {
  const colorTokenNamesJson = jsonForScriptTag(COLOR_TOKEN_NAMES);
  const blockedColorValuePatternSource = jsonForScriptTag(BLOCKED_COLOR_VALUE_PATTERN.source);
  const blockedColorValuePatternFlags = jsonForScriptTag(BLOCKED_COLOR_VALUE_PATTERN.flags);
  const fallbackColorValuePatternSource = jsonForScriptTag(FALLBACK_COLOR_VALUE_PATTERN.source);
  const fallbackColorValuePatternFlags = jsonForScriptTag(FALLBACK_COLOR_VALUE_PATTERN.flags);
  const variableReferencePatternSource = jsonForScriptTag(
    COLOR_VALUE_VARIABLE_REFERENCE_PATTERN.source,
  );
  const variableReferencePatternFlags = jsonForScriptTag(
    COLOR_VALUE_VARIABLE_REFERENCE_PATTERN.flags,
  );
  const safeVariableNamePatternSource = jsonForScriptTag(
    SAFE_COLOR_VALUE_VARIABLE_NAME_PATTERN.source,
  );
  const safeVariableNamePatternFlags = jsonForScriptTag(
    SAFE_COLOR_VALUE_VARIABLE_NAME_PATTERN.flags,
  );

  return `<script>
      // Validated postMessage listener for shell→iframe theme and token commands.
      // The shell SPA is same-origin, but we still validate origin and shape so
      // unknown messages can't push the iframe into a bad state.
      (function () {
        var colorTokenNames = new Set(${colorTokenNamesJson});
        var blockedColorValuePattern = new RegExp(${blockedColorValuePatternSource}, ${blockedColorValuePatternFlags});
        var fallbackColorValuePattern = new RegExp(${fallbackColorValuePatternSource}, ${fallbackColorValuePatternFlags});
        var variableReferencePattern = new RegExp(${variableReferencePatternSource}, ${variableReferencePatternFlags});
        var safeVariableNamePattern = new RegExp(${safeVariableNamePatternSource}, ${safeVariableNamePatternFlags});
        var activeTheme = document.documentElement.dataset.cinderTheme;
        if (!isTheme(activeTheme)) activeTheme = null;

        function isTheme(value) {
          return value === 'light' || value === 'dark';
        }

        function hasOnlySafeColorVariableReferences(value) {
          if (value.toLowerCase().indexOf('var(') === -1) return true;
          variableReferencePattern.lastIndex = 0;
          var references = Array.from(value.matchAll(variableReferencePattern));
          variableReferencePattern.lastIndex = 0;
          if (references.length === 0) return false;
          for (var index = 0; index < references.length; index += 1) {
            var variableName = references[index][1];
            if (typeof variableName !== 'string') return false;
            if (!safeVariableNamePattern.test(variableName.trim())) return false;
          }
          var withoutReferences = value.replace(variableReferencePattern, '');
          variableReferencePattern.lastIndex = 0;
          return withoutReferences.toLowerCase().indexOf('var(') === -1;
        }

        function isSafeColorValue(value) {
          if (typeof value !== 'string') return false;
          var trimmed = value.trim();
          if (trimmed.length === 0 || trimmed.length > ${MAX_COLOR_TOKEN_VALUE_LENGTH}) return false;
          if (blockedColorValuePattern.test(trimmed)) return false;
          if (trimmed.toLowerCase().indexOf('url(') !== -1) return false;
          if (!hasOnlySafeColorVariableReferences(trimmed)) return false;
          if (!fallbackColorValuePattern.test(trimmed.toLowerCase())) return false;
          if (window.CSS && typeof window.CSS.supports === 'function') {
            return window.CSS.supports('color', trimmed);
          }
          return true;
        }

        function applyColorTokenOverrides(overrides) {
          if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return;
          var next = {};
          for (var tokenName in overrides) {
            if (!Object.prototype.hasOwnProperty.call(overrides, tokenName)) continue;
            if (!colorTokenNames.has(tokenName)) return;
            var value = overrides[tokenName];
            if (!isSafeColorValue(value)) return;
            next[tokenName] = value.trim();
          }

          colorTokenNames.forEach(function (tokenName) {
            document.documentElement.style.removeProperty(tokenName);
          });
          for (var safeTokenName in next) {
            if (!Object.prototype.hasOwnProperty.call(next, safeTokenName)) continue;
            document.documentElement.style.setProperty(safeTokenName, next[safeTokenName]);
          }
        }

        window.addEventListener('message', function (event) {
          if (event.origin !== window.location.origin) return;
          var data = event.data;
          if (!data || typeof data !== 'object') return;

          if (data.type === 'cinder:set-theme') {
            // Only light/dark are valid theme overrides; ignore anything else
            // (a stale/foreign message must never push the iframe into an
            // unsupported 'system' state — that value was removed from ThemeChoice).
            if (isTheme(data.value)) {
              document.documentElement.style.colorScheme = data.value;
              document.documentElement.dataset.cinderTheme = data.value;
              activeTheme = data.value;
            }
            return;
          }

          if (data.type === 'cinder:set-color-token-overrides') {
            if (!isTheme(data.theme)) return;
            if (data.theme !== activeTheme) return;
            applyColorTokenOverrides(data.overrides);
          }
        });
      })();
    </script>`;
}

/**
 * Render the standalone component page HTML (the iframe content — no outer shell).
 *
 * When `snapshotMode` is `true` (request had `?snapshot=1`), the rendered
 * `<html>` element gains `data-snapshot-mode=""` and a `<style>` tag is
 * injected that zeroes animation/transition durations and hides carets.
 * Without `?snapshot=1`, the output is byte-identical to the previous behavior.
 */
async function renderComponentPage(componentName: string, snapshotMode: boolean): Promise<string> {
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

  // jsonForScriptTag (not raw JSON.stringify) escapes <, >, &, and the Unicode
  // line/paragraph separators so a `</script>` in an example title/description
  // cannot terminate this inline script early or inject markup.
  const examplesJson = jsonForScriptTag(examples);
  const htmlAttribute = snapshotModeHtmlAttribute(snapshotMode);
  const styleTag = snapshotModeStyleTag(snapshotMode);
  const humanName = escapeHtml(humanizeComponentName(componentName));
  const pageDescription = `Live ${humanName} examples from the cinder Svelte 5 component library.`;

  return `<!DOCTYPE html>
<html lang="en"${htmlAttribute}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${humanName} — cinder playground</title>
    <meta name="description" content="${pageDescription}" />
    <link rel="icon" href="${FAVICON_HREF}" />
    <link rel="stylesheet" href="/styles/all.css" />
    <script>${PRE_PAINT_THEME_SCRIPT}</script>
    <style>
      /* Iframe scaffold: scope the reset narrowly. Unlike the shell, the
         universal selectors here set ONLY box-sizing — not margin/padding —
         so they cannot beat layered component styles. The shell's reset is
         broader and lives in @layer cinder.reset (see render-shell.ts). */
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; min-height: 100%; }
      body {
        background-color: var(--cinder-bg);
        color: var(--cinder-text);
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
    </style>${styleTag ? `\n    ${styleTag}` : ''}
    ${renderPreviewMessageBridgeScript()}
  </head>
  <body>
    <script>window.__CINDER_EXAMPLES__ = ${examplesJson};</script>
    <div id="app"></div>
    <script type="module" src="/page-bundle/${componentName}.js"></script>
  </body>
</html>`;
}

function renderFixturePageHtml(
  componentName: string,
  fixtureName: string,
  snapshotMode: boolean,
  scriptSource: string,
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
    <link rel="stylesheet" href="/styles/all.css" />
    <script>${PRE_PAINT_THEME_SCRIPT}</script>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; min-height: 100%; }
      body {
        background-color: var(--cinder-bg);
        color: var(--cinder-text);
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
    ${renderPreviewMessageBridgeScript()}
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
  const fixturesRoot = join(COMPONENTS_ROOT, 'src', 'components');
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
      : componentSourcePath(componentName);

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
    renderFixturePageHtml(componentName, fixtureName, snapshotMode, scriptSource),
    {
      headers: { 'Content-Type': 'text/html' },
    },
  );
}

/** Verify a path segment is a safe identifier (no path traversal). */
function isSafeSegment(segment: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(segment);
}

/** Build a plain-text 404 response. */
function notFound(message = 'Not Found'): Response {
  return new Response(message, { status: 404, headers: { 'Content-Type': 'text/plain' } });
}

/** Build a plain-text 400 response. */
function badRequest(message: string): Response {
  return new Response(message, { status: 400, headers: { 'Content-Type': 'text/plain' } });
}

export function rewriteRepositoryRelativeReadmeLinks(html: string): string {
  return rewriteRelativeRenderedMarkdownLinks(html, (href) => repositorySourceHref('', href));
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
  return rewriteRepositoryRelativeReadmeLinks(rendered.html);
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

/** Main request handler — exported for testing. */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  // GET /ping
  if (pathname === '/ping') {
    return new Response('pong', { headers: { 'Content-Type': 'text/plain' } });
  }

  // GET /ready
  if (pathname === '/ready') {
    return new Response('ready', { headers: { 'Content-Type': 'text/plain' } });
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

  // GET /components/<path>.css → packages/components/src/components/<path>.css
  // After the per-directory layout migration, each component owns its CSS at
  // `src/components/<name>/<name>.css`. The styles aggregator at
  // `src/styles/components.css` imports those via `@import '../components/<name>/<name>.css'`,
  // which the browser resolves relative to the served URL — landing on
  // `/components/<name>/<name>.css`. Serve them from disk here so the
  // resolved relative paths actually reach the right file.
  if (pathname.startsWith('/components/') && pathname.endsWith('.css')) {
    const COMPONENTS_SRC_ROOT = join(COMPONENTS_ROOT, 'src', 'components');
    const relative = pathname.slice('/components/'.length);
    if (relative.includes('..') || relative.startsWith('/')) return notFound();
    const cssPath = join(COMPONENTS_SRC_ROOT, relative);
    const cssRelativePath = relativePath(COMPONENTS_SRC_ROOT, cssPath);
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
    // Bare, unhashed scenario entry URL — never cache (see NO_STORE_CACHE_CONTROL).
    return new Response(code, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': NO_STORE_CACHE_CONTROL,
      },
    });
  }

  // GET /page-bundle/<filename>.js — covers two cases:
  //   1. The unhashed page-bundle entry URL `/page-bundle/<component>.js`
  //      (the request the iframe makes, where <component> is a safe
  //      segment like `chat`). We look that up via `pageEntryByName` and
  //      serve the actual hashed entry artifact.
  //   2. A hashed chunk URL the entry references, like
  //      `/page-bundle/page-chat-abc123.js` or `/page-bundle/core-def456.js`.
  //      Chunks can live in any family map (shared content-hashed chunks may
  //      have been emitted by the shell or scenario builds first); we use
  //      findArtifact to walk every family.
  //
  // Resolution order: family-map lookup first (cheap, no build), then
  // entry-name lookup with a build fallback. Cache invalidation is fully
  // synchronous (see `invalidateCachesForChange`), so there's no in-flight
  // rebuild window to guard against here.
  const pageBundleMatch = pathname.match(/^\/page-bundle\/([A-Za-z0-9_-]+)\.js$/);
  if (pageBundleMatch) {
    const filename = pageBundleMatch[1]!;
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
  }

  // GET /fixture-bundle/<filename>.js — fixture-page entry and chunks.
  const fixtureBundleMatch = pathname.match(/^\/fixture-bundle\/([A-Za-z0-9_-]+)\.js$/);
  if (fixtureBundleMatch) {
    const filename = fixtureBundleMatch[1]!;
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
  }

  // GET /shell-bundle/<filename>.js — same shape as /page-bundle/*:
  //   1. `/shell-bundle/shell.js` is the unhashed entry URL the scaffold
  //      script tag requests; we resolve it to the hashed entry artifact via
  //      `shellEntryByName`.
  //   2. `/shell-bundle/<hash>.js` URLs are chunks the entry imports; they
  //      live in any family map.
  const shellBundleMatch = pathname.match(/^\/shell-bundle\/([A-Za-z0-9_-]+)\.js$/);
  if (shellBundleMatch) {
    const filename = shellBundleMatch[1]!;
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
    const code = await buildShellBundle();
    if (code === null) return notFound('Shell bundle failed to build');
    // Bare, unhashed shell entry URL (`/shell-bundle/shell.js`) — never cache.
    return new Response(code, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': NO_STORE_CACHE_CONTROL,
      },
    });
  }

  // GET /api/manifest — full manifest array.
  // Add ?standalone=1 for the Playwright sweep input, where compose-only
  // leaves are covered through their parent examples instead of standalone
  // pages that would render "No examples found".
  if (pathname === '/api/manifest') {
    const manifests =
      url.searchParams.get('standalone') === '1'
        ? await getStandaloneManifests()
        : await getManifests();
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

  // GET /api/documentation/:name — component documentation payload
  const apiDocumentationMatch = pathname.match(/^\/api\/documentation\/([^/]+)$/);
  if (apiDocumentationMatch) {
    const componentName = apiDocumentationMatch[1]!;
    if (!isSafeSegment(componentName)) return notFound();
    const manifests = await getManifests();
    const manifest = manifests.find((m) => m.kebabName === componentName);
    if (manifest === undefined) {
      return notFound(`Documentation for "${componentName}" not found`);
    }

    try {
      const documentation = await buildComponentDocumentation(componentName, manifest);
      const validationErrors = validateComponentDocumentationPayload(documentation);
      if (validationErrors.length > 0) {
        throw new Error(
          `Documentation payload for "${componentName}" failed validation:\n` +
            validationErrors.map((validationError) => `  - ${validationError}`).join('\n'),
        );
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

  // GET /page/:name — standalone component page (iframe content, no shell)
  // Supports ?snapshot=1 to activate snapshot mode: data-snapshot-mode on
  // <html>, motion-freeze CSS, and caret-color: transparent.
  const pageMatch = pathname.match(/^\/page\/([^/]+)$/);
  if (pageMatch) {
    const componentName = pageMatch[1]!;
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
    const html = await renderComponentPage(componentName, snapshotModeActive);
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
    return exampleSnippetResponse(source, `${componentName}/${scenario}`);
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

  // GET / → README-backed landing shell
  if (pathname === '/') {
    const sidebarComponents = await discoverSidebarComponents();
    const readmeHtml = await renderLandingReadmeHtml();
    const html = renderShell(null, sidebarComponents, { readmeHtml });
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  return notFound();
}

export type PlaygroundServer = {
  port: number;
  /** Stop the HTTP server and all file watchers. Awaitable. */
  dispose: () => Promise<void>;
};

type BunServer = ReturnType<typeof Bun.serve>;
type PlaygroundFetchHandler = (request: Request) => Response | Promise<Response>;
type PlaygroundHttpServer = {
  server: BunServer;
  port: number;
};

function isAddressInUseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const errorWithCode = error as Error & { code?: unknown };
  return errorWithCode.code === 'EADDRINUSE';
}

export function createHttpServerOnAvailablePort(
  preferredPort: number,
  fetchHandler: PlaygroundFetchHandler,
): PlaygroundHttpServer {
  for (let offset = 0; offset < MAX_PORT_SCAN_ATTEMPTS; offset++) {
    const port = preferredPort + offset;
    try {
      const server = Bun.serve({
        port,
        fetch: fetchHandler,
      });
      return { server, port };
    } catch (error) {
      if (!isAddressInUseError(error)) throw error;
    }
  }

  throw new Error(
    `[playground] no available port found from ${preferredPort} through ${
      preferredPort + MAX_PORT_SCAN_ATTEMPTS - 1
    }`,
  );
}

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
    return null;
  });
  const components = await discoverSidebarComponents();
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

  return { shellSucceeded: shellCode !== null, succeeded, failed };
}

export function createSharedDisposer(disposeWork: () => Promise<void>): () => Promise<void> {
  let disposePromise: Promise<void> | null = null;
  return () => {
    disposePromise ??= disposeWork();
    return disposePromise;
  };
}

/** Start the playground server on the given port. Returns a handle with dispose() to stop everything. */
export async function startServer(port: number = PORT): Promise<PlaygroundServer> {
  // Eager pre-build BEFORE binding the port. Sidebar clicks should serve
  // from cache; we don't want the first user to pay a build cost.
  // Shell-bundle failure is fatal — there's no UI without it.
  const prebuild = await eagerPrebuildAll();
  if (!prebuild.shellSucceeded) {
    throw new Error('[playground] shell bundle failed to build — see logs above');
  }
  const total = prebuild.succeeded + prebuild.failed.length;
  const failedSuffix = prebuild.failed.length > 0 ? ` (failed: ${prebuild.failed.join(', ')})` : '';
  process.stdout.write(
    `[playground] Pre-built ${prebuild.succeeded}/${total} page bundles${failedSuffix}\n`,
  );

  // Pre-warm the component manifest (ts-morph analysis) before binding the
  // port. Without this, the first /api/documentation/:name request pays the
  // cold-analysis cost and can exceed the validate-playground fetch timeout
  // as the component count grows.
  await getManifests().catch((error: unknown) => {
    console.error('[playground] manifest pre-warm failed:', error);
  });

  // Start the HTTP server first — if binding fails for reasons other than an
  // occupied port, no watchers are leaked.
  const playgroundHttpServer = createHttpServerOnAvailablePort(port, handleRequest);
  const { port: actualPort, server } = playgroundHttpServer;

  let watchers: FSWatcher[];
  try {
    watchers = startWatcher();
  } catch (error) {
    // startWatcher() failed — stop the already-listening server before rethrowing.
    await server.stop(true);
    throw error;
  }

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
  return { port: actualPort, dispose };
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
