import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join, relative as relativePath, sep } from 'node:path';

import {
  PUBLIC_PATH_BY_FAMILY,
  SHARED_BUILD_OPTIONS,
  collectBuildArtifacts,
  pageArtifactByPath,
  pageBuildPromiseByKey,
} from './build-artifacts-shared.ts';
import { discoverComponentDefinition, discoverComponents, discoverExamples } from './discover.ts';
import { getRebuildGeneration } from './file-watcher.ts';
import { PLAYGROUND_TEMP_ROOT } from './playground-paths.ts';

/**
 * Page-bundle entries: keyed by component name → entry artifact path
 * (e.g. "page-chat.js"). Per-family disjoint key-space prevents collisions
 * with `bundleEntryByKey` since entries get prefix `page-` vs `bundle-`.
 */
export const pageEntryByName = new Map<string, string>();

export function relativeImportSpecifier(fromDirectory: string, targetPath: string): string {
  const relative = relativePath(fromDirectory, targetPath).replaceAll(sep, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
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
export async function compilePageBundleArtifacts(
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

  const componentDefinition = await discoverComponentDefinition(componentName);
  if (componentDefinition === undefined) return null;

  const scenarios = await discoverExamples(componentName);
  // Zero scenarios is allowed: the bundle still mounts component-page.svelte,
  // which renders a "No examples found" fallback.

  const entryBasename = `page-${componentName}`;
  const entryTempDir = join(PLAYGROUND_TEMP_ROOT, randomUUID());
  const entryTempPath = join(entryTempDir, `${entryBasename}.ts`);

  const scenarioImports = scenarios
    .map(
      (scenario, index) =>
        `import Scenario_${index} from '../../src/examples/${componentName}/${scenario}.example.svelte';`,
    )
    .join('\n');
  const scenarioRegistrations = scenarios
    .map((scenario, index) => `  ${JSON.stringify(scenario)}: Scenario_${index},`)
    .join('\n');

  const entrySource = `import { hydrate, mount } from 'svelte';

import ComponentPage from '../../src/component-page.svelte';
import * as BareComponentModule from ${JSON.stringify(componentDefinition.importPath)};
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
const previewOnly = new URLSearchParams(window.location.search).get('preview') === '1';

// The server pre-renders the documentation tree into #app for the canonical
// route, so take over that markup with hydrate() instead of mount() — mount()
// would discard the server output and re-create every node, throwing away the
// pre-rendered paint and double-mounting the examples.
//
// The props MUST match what page-server-entry.ts passed, or the client's first
// render disagrees with the server's and hydration mismatches. snapshotMode is
// therefore read from the URL exactly as the server read it, and the same
// documentation/examples data islands feed both sides.
const snapshotMode = new URLSearchParams(window.location.search).get('snapshot') === '1';
const hasServerRenderedContent = target.firstElementChild !== null;
const shouldHydrate = hasServerRenderedContent && !snapshotMode && !previewOnly;

// Read the sidebar list the server embedded, so the client's first render
// matches the server's exactly.
// Validate rather than assert: this global is page-supplied, and a tampered or
// malformed value would otherwise reach \`humanizeId\` and crash the page.
const sidebarRaw = (window as unknown as Record<string, unknown>)['__CINDER_SIDEBAR__'];
const sidebarComponents = Array.isArray(sidebarRaw)
  ? sidebarRaw.filter((entry): entry is string => typeof entry === 'string')
  : [];

const props = {
  bareComponentModule: BareComponentModule,
  previewOnly,
  snapshotMode,
  sidebarComponents,
};

if (shouldHydrate) {
  hydrate(ComponentPage, { target, props });
} else {
  // mount() APPENDS; it does not clear the target. So whenever we are mounting a
  // tree that differs from whatever the document already contains, we must own
  // the container explicitly.
  //
  // This is load-bearing on the STATIC export, not just in development. The
  // exporter strips query strings when crawling, so \`/page/<name>?preview=1\`
  // resolves to the one exported \`/page/<name>/index.html\` — the full
  // documentation page. The server-side preview gate cannot help there, because
  // a static host runs no server. Without this clear, the shell's preview iframe
  // renders the entire documentation page with a small preview stacked on top.
  //
  // Clearing is safe in every mount case: snapshot and preview surfaces are
  // served with an empty \`#app\` anyway, so there is nothing to discard.
  target.replaceChildren();
  mount(ComponentPage, { target, props });
}
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
 * Concurrency: captures the rebuild generation before the build starts and
 * skips publishing the entry-name pointer if an invalidation landed during
 * the compile (see `invalidateCachesForChange` — a newer invalidation means
 * this result may already be stale). The compiled artifacts are still
 * returned to the caller, so the request that triggered the lazy build is
 * served correctly; only the shared entry-name cache is left alone in the
 * race-loss case. De-dupes concurrent callers for the same component via
 * `pageBuildPromiseByKey` so two near-simultaneous requests share one build.
 */
export async function buildPageBundle(
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
    const generationAtStart = getRebuildGeneration();
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
    if (generationAtStart === getRebuildGeneration()) {
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
