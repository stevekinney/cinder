/**
 * Cinder component playground dev server.
 *
 * Runs at http://localhost:5555 by default, or the next available port. Routes:
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
import {
  BLOCKED_COLOR_VALUE_PATTERN,
  COLOR_TOKEN_NAMES,
  COLOR_VALUE_VARIABLE_REFERENCE_PATTERN,
  FALLBACK_COLOR_VALUE_PATTERN,
  MAX_COLOR_TOKEN_VALUE_LENGTH,
  SAFE_COLOR_VALUE_VARIABLE_NAME_PATTERN,
} from './shell-app/color-token-registry.ts';
import { humanizeComponentName } from './shell-app/humanize.ts';

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
const fixtureBuildPromiseByKey = new Map<string, Promise<string | null>>();

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
 * Watcher cache state machine.
 *
 * `rebuildGeneration` increments at the start of every rebuild. A rebuild's
 * publish step only mutates module-level caches if its generation is still
 * the current one — older rebuilds that finish after a newer one started
 * discard their results.
 *
 * `currentRebuild` is `null` when the caches are warm; non-null while a
 * rebuild is in flight. Route handlers `await currentRebuild.promise` before
 * serving so a request that lands mid-rebuild blocks on the newest in-flight
 * publish rather than observing a half-cleared cache.
 */
let rebuildGeneration = 0;
let currentRebuild: { generation: number; promise: Promise<void> } | null = null;

/**
 * Wait for any in-flight rebuild to finish publishing. Route handlers call
 * this before reading from the cache maps to guarantee cache coherence.
 *
 * Cheap when warm (synchronous null check); blocks just on the current
 * rebuild Promise when not warm.
 */
async function awaitWarmCache(): Promise<void> {
  if (currentRebuild !== null) await currentRebuild.promise;
}

/** Debounce timer for the watcher. */
let rebuildDebounceTimer: ReturnType<typeof setTimeout> | null = null;
/** Whether any change in the current debounce window touched shell sources. */
let pendingShellSourceChanged = false;

/**
 * Schedule a debounced rebuild. Coalesces save bursts: multiple calls within
 * the debounce window collapse into one rebuild that fires after the window
 * elapses with no further calls.
 *
 * Per-call `shellSourceChanged` is OR-ed across the window so the publish
 * step knows whether to emit `shell-reload` after a successful shell rebuild.
 */
function scheduleRebuild(shellSourceChanged: boolean): void {
  pendingShellSourceChanged ||= shellSourceChanged;
  if (rebuildDebounceTimer !== null) clearTimeout(rebuildDebounceTimer);
  rebuildDebounceTimer = setTimeout(() => {
    rebuildDebounceTimer = null;
    const shellChanged = pendingShellSourceChanged;
    pendingShellSourceChanged = false;
    startRebuild(shellChanged);
  }, 100);
}

/**
 * Begin a rebuild. Increments the generation, stores `currentRebuild`, and
 * wires a finally hook to clear `currentRebuild` ONLY when this generation
 * remains the active one. Older generations whose promises resolve after
 * a newer rebuild started must not clobber state.
 */
function startRebuild(shellSourceChanged: boolean): void {
  const generation = ++rebuildGeneration;
  // A rebuild means component files may have been added, renamed, or removed,
  // so the cached discovery scans (component list + example counts) are now
  // potentially stale. Drop them in lockstep with the generation bump so the
  // next `/`, `/c/:name`, or `/page/:name` request re-scans the filesystem.
  invalidateDiscoveryCache();
  // The caught chain — NOT the raw rebuild promise — is what route handlers
  // await via `awaitWarmCache`. If we stored the raw promise and it rejected,
  // every blocked route handler would see the rejection re-thrown into its
  // own `await`. Attaching `.catch()` to a forked branch doesn't prevent
  // that — only the chain that owns the catch swallows the error. So we
  // store the chained version where the catch lives.
  const settled = repopulateBundleCaches(generation, shellSourceChanged)
    .catch((error: unknown) => {
      // repopulateBundleCaches() already handles its own errors and logs them;
      // an unexpected throw past those handlers gets logged here.
      console.error('[playground] rebuild promise rejected unexpectedly:', error);
    })
    .finally(() => {
      if (currentRebuild?.generation === generation) currentRebuild = null;
    });
  currentRebuild = { generation, promise: settled };
}

/**
 * Atomic rebuild: compile every bundle into local maps, then publish to the
 * shared module-level maps if (and only if) this rebuild's generation is
 * still the active one. See `startRebuild()` for ownership semantics and the
 * implementation plan for the full state-machine contract.
 *
 * Failure modes:
 * - Per-component page-bundle failure: logged; that component is absent from
 *   the published `pageEntryByName` map; the route's lazy-build fallback
 *   handles user requests for it.
 * - Shell-bundle failure: shell entries/artifacts NOT swapped; the previously
 *   published shell stays fully coherent; no `shell-reload` is emitted.
 * - Fatal error: nothing is published. Old artifacts continue serving.
 *
 * Emits exactly one SSE event per successful publish: `shell-reload` when
 * shell sources changed AND the shell build succeeded; `reload` otherwise.
 */
async function repopulateBundleCaches(
  generation: number,
  shellSourceChanged: boolean,
): Promise<void> {
  const localPageEntries = new Map<string, string>();
  const localShellEntries = new Map<string, string>();
  const localPageArtifacts = new Map<string, string>();
  const localShellArtifacts = new Map<string, string>();
  let shellBuildSucceeded = false;
  let fatalRebuildFailed = false;
  const failedPages: string[] = [];

  const rebuildStartedAt = Date.now();
  console.log('[playground] rebuilding…');

  try {
    // Shell bundle.
    try {
      const shell = await compileShellBundleArtifacts();
      if (shell !== null) {
        localShellEntries.set('shell', shell.entryPath);
        for (const [path, code] of shell.artifacts) localShellArtifacts.set(path, code);
        shellBuildSucceeded = true;
      }
    } catch (error) {
      console.error('[playground] shell rebuild failed:', error);
    }

    // Page bundles with per-component failure isolation. Sidebar components
    // are a subset of all components, so we can pass the same set as the
    // validation list — saves N redundant filesystem scans from
    // compilePageBundleArtifacts re-discovering on each call.
    const components = await discoverSidebarComponents();
    const knownComponents = new Set(components);
    const results = await Promise.allSettled(
      components.map((name) => compilePageBundleArtifacts(name, knownComponents)),
    );
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const name = components[i]!;
      if (result.status === 'fulfilled' && result.value !== null) {
        localPageEntries.set(name, result.value.entryPath);
        for (const [path, code] of result.value.artifacts) localPageArtifacts.set(path, code);
      } else {
        failedPages.push(name);
      }
    }
  } catch (error) {
    console.error('[playground] rebuild fatal error:', error);
    fatalRebuildFailed = true;
  }

  // Publish guard: only the newest generation may publish. Stale rebuilds
  // discard their work silently.
  if (generation !== rebuildGeneration) return;
  // Fatal error: do NOT touch caches at all.
  if (fatalRebuildFailed) return;

  // Manifest cache invalidation is part of the publish step — a stale
  // rebuild that lost the generation race must NOT clear it, since a newer
  // rebuild may already have populated a fresh manifest.
  manifestCache = null;
  manifestPromise = null;
  // Dispose the shared ts-morph project so the next analyzeAll() rebuilds from
  // fresh compiler state rather than reusing sources from before this rebuild.
  resetProject();

  // Atomic per-family swap. We .clear() then re-populate the existing Map
  // instances so any reference captured by a route handler stays valid.
  pageEntryByName.clear();
  for (const [k, v] of localPageEntries) pageEntryByName.set(k, v);
  pageArtifactByPath.clear();
  for (const [k, v] of localPageArtifacts) pageArtifactByPath.set(k, v);
  // Scenario builds are lazy (per-example), not part of the watcher rebuild.
  // Clear them so stale per-scenario artifacts don't accumulate; they'll be
  // rebuilt on next view-source toggle.
  bundleEntryByKey.clear();
  scenarioArtifactByPath.clear();
  fixtureEntryByKey.clear();
  fixtureArtifactByPath.clear();
  fixtureBuildPromiseByKey.clear();

  if (shellBuildSucceeded) {
    shellEntryByName.clear();
    for (const [k, v] of localShellEntries) shellEntryByName.set(k, v);
    shellArtifactByPath.clear();
    for (const [k, v] of localShellArtifacts) shellArtifactByPath.set(k, v);
  }
  // If the shell build failed, BOTH shellEntryByName and shellArtifactByPath
  // are untouched — the old, still-coherent shell stays intact.

  if (failedPages.length > 0) {
    console.error(`[playground] rebuild: failed components: ${failedPages.join(', ')}`);
  }
  if (shellSourceChanged && !shellBuildSucceeded) {
    // The user edited a shell-app source but the rebuild produced no new
    // shell bundle. Surface a prominent warning so it's clear from the
    // terminal why the browser didn't pick up their change.
    console.error(
      '[playground] shell source changed but shell rebuild failed — running shell preserved; no shell-reload emitted',
    );
  }

  // Completion log — only the publishing generation reaches this point (stale
  // and fatal rebuilds returned early above), so this never reports timing for
  // a superseded run. N counts the page bundles that landed in the cache, plus
  // the shell bundle when its build succeeded this run.
  const bundleCount = localPageEntries.size + (shellBuildSucceeded ? localShellEntries.size : 0);
  const elapsedSeconds = ((Date.now() - rebuildStartedAt) / 1000).toFixed(2);
  console.log(`[playground] rebuilt ${bundleCount} bundles in ${elapsedSeconds}s`);

  // Emit exactly one event per publish. `shell-reload` only fires when shell
  // sources actually changed AND the new shell bundle is in the cache.
  if (shellSourceChanged && shellBuildSucceeded) triggerReload('shell-reload');
  else triggerReload('reload');
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
    // Components tree: every change invalidates every page bundle (each
    // example imports from the cinder workspace package which re-exports
    // every component), but does NOT touch shell sources.
    const srcPath = join(COMPONENTS_ROOT, 'src');
    created.push(
      watch(srcPath, { recursive: true }, (_event, filename) => {
        if (filename) scheduleRebuild(false);
      }),
    );

    // Examples directory: edits to `.example.svelte` files invalidate the
    // corresponding component's page bundle. We don't try to be precise about
    // which bundles to rebuild — `repopulateBundleCaches` rebuilds all sidebar
    // components in parallel, which is fast and avoids stale-entry hazards.
    const examplesPath = join(PLAYGROUND_ROOT, 'src', 'examples');
    created.push(
      watch(examplesPath, { recursive: true }, (_event, filename) => {
        if (filename) scheduleRebuild(false);
      }),
    );

    // Playground src tree: component-page.svelte, render-shell.ts, the
    // shell-app/ directory, analyze.ts, etc. Shell-source changes (paths
    // under `shell-app/` or to `render-shell.ts`) flip the shellSourceChanged
    // flag so the rebuild's publish step emits `shell-reload` instead of
    // `reload`.
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
          scheduleRebuild(isShellChange);
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

    for (const [path, code] of entry.artifacts) scenarioArtifactByPath.set(path, code);
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
 * skips publishing if the watcher rebuilt during the compile (the watcher's
 * atomic publish is newer and shouldn't be overwritten by our older result).
 * The compiled artifacts are still returned to the caller, so the request
 * that triggered the lazy build is served correctly; only the shared cache
 * is left alone in the race-loss case.
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

  const generationAtStart = rebuildGeneration;
  const entry = await compilePageBundleArtifacts(componentName, knownComponents);
  if (entry === null) return null;

  // We always publish the artifacts: the entry code we're about to return
  // statically imports content-hashed chunk URLs, and if those chunks aren't
  // in the cache, the browser's chunk requests will 404. Chunk filenames are
  // content-hashed, so writing them is safe even if a newer watcher rebuild
  // already wrote the same chunks — the bytes are identical.
  for (const [path, code] of entry.artifacts) pageArtifactByPath.set(path, code);
  // Only update the entry-by-name mapping when we're not racing a newer
  // rebuild. Stale generations skip this so the watcher's atomic publish
  // remains authoritative for the entry-name → hashed-entry mapping.
  if (generationAtStart === rebuildGeneration && currentRebuild === null) {
    pageEntryByName.set(componentName, entry.entryPath);
  }
  return entry.entryCode;
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

    if (generationAtStart === rebuildGeneration && currentRebuild === null) {
      for (const [path, code] of entry.artifacts) fixtureArtifactByPath.set(path, code);
      fixtureEntryByKey.set(entryKey, entry.entryPath);
      return entry.entryPath;
    }
    return null;
  })();

  fixtureBuildPromiseByKey.set(cacheKey, buildPromise);
  try {
    return await buildPromise;
  } finally {
    fixtureBuildPromiseByKey.delete(cacheKey);
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
 * bundle isn't already cached. Same race-discipline as `buildPageBundle`
 * (see the doc-comment there): skip the shared-cache publish if the
 * watcher rebuilt during the compile.
 */
async function buildShellBundle(): Promise<string | null> {
  const cachedEntryPath = shellEntryByName.get('shell');
  if (cachedEntryPath) {
    const cached = shellArtifactByPath.get(cachedEntryPath);
    if (cached !== undefined) return cached;
  }

  const generationAtStart = rebuildGeneration;
  const entry = await compileShellBundleArtifacts();
  if (entry === null) return null;

  // Always publish chunks (see buildPageBundle's comment for the rationale —
  // the entry we're returning has static imports to content-hashed chunks
  // that must be servable).
  for (const [path, code] of entry.artifacts) shellArtifactByPath.set(path, code);
  if (generationAtStart === rebuildGeneration && currentRebuild === null) {
    shellEntryByName.set('shell', entry.entryPath);
  }
  return entry.entryCode;
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
    await awaitWarmCache();
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
    await awaitWarmCache();
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
    await awaitWarmCache();
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
  // entry-name lookup with a build fallback. The state-machine guard above
  // ensured caches are coherent before we got here.
  const pageBundleMatch = pathname.match(/^\/page-bundle\/([A-Za-z0-9_-]+)\.js$/);
  if (pageBundleMatch) {
    // Block on any in-flight watcher rebuild so we never observe a
    // half-cleared cache. Cheap (sync null check) when warm.
    await awaitWarmCache();
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
    await awaitWarmCache();
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
    await awaitWarmCache();
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
    await awaitWarmCache();
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
    await awaitWarmCache();
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
    await awaitWarmCache();
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
  const pagePromise = Promise.allSettled(
    components.map((name) => buildPageBundle(name, knownComponents)),
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

  async function dispose(): Promise<void> {
    for (const watcher of watchers) {
      watcher.close();
    }
    await server.stop(true);
  }

  const portFile = Bun.env['PLAYGROUND_PORT_FILE'];
  if (portFile !== undefined) {
    await Bun.write(portFile, `${actualPort}\n`);
  }
  process.stdout.write(`[playground] Listening at http://localhost:${actualPort}\n`);
  return { port: actualPort, dispose };
}

if (import.meta.main) {
  await startServer();
}
