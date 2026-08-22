import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  PUBLIC_PATH_BY_FAMILY,
  SHARED_BUILD_OPTIONS,
  collectBuildArtifacts,
  pageArtifactByPath,
  pageBuildPromiseByKey,
} from './build-artifacts-shared.ts';
import { discoverComponentDefinition, discoverComponents, discoverExamples } from './discover.ts';
import { PLAYGROUND_TEMP_ROOT } from './playground-paths.ts';
import { getRebuildGeneration } from './rebuild-generation.ts';

/**
 * Page-bundle entries: keyed by component name → entry artifact path
 * (e.g. "page-chat.js"). Per-family disjoint key-space prevents collisions
 * with `bundleEntryByKey` since entries get prefix `page-` vs `bundle-`.
 */
export const pageEntryByName = new Map<string, string>();

/**
 * Compile the all-in-one page bundle for a single component without
 * mutating any module-level state. Pure with respect to the cache maps —
 * returns the entry path/code + every artifact this build emitted, leaving
 * publication to the caller (lazy-build wrapper or the atomic watcher
 * rebuild).
 *
 * The bundle includes the documentation page plus dynamic imports for its
 * scenarios and bare component implementation. Documentation hydrates without
 * compiling every example or the selected component into the initial transfer;
 * `component-page.svelte` loads each example only when its preview is attached
 * and the bare component only after the reader opens Playground.
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

  const scenarioLoaders = scenarios
    .map(
      (scenario) =>
        `  ${JSON.stringify(scenario)}: () => import('../../src/examples/${componentName}/${scenario}.example.svelte'),`,
    )
    .join('\n');

  const entrySource = `import { NAV_FILTER_STORAGE_KEY } from '../../src/component-page-theme.ts';
import { persistScrollPosition } from '../../src/shell-app/sidebar-scroll.ts';

const scenarioLoaders: Record<string, () => Promise<unknown>> = {
${scenarioLoaders}
};

(window as unknown as Record<string, unknown>)['__CINDER_SCENARIO_LOADERS__'] = scenarioLoaders;
const target = document.getElementById('app');
if (target === null) {
  throw new Error('[cinder playground] #app target not found');
}
const sidebarNavigation = document.querySelector<HTMLElement>('nav.dx-nav');
if (sidebarNavigation !== null) persistScrollPosition(sidebarNavigation);

// Keep the bare component implementation behind the Playground tab. The page
// resolves the imported namespace by \`documentation.component.exportName\`,
// falling back to the default export. Threading the loader as a prop (rather
// than a \`window\` global) keeps the deferred live preview explicitly wired to
// the bundle that mounted the page.
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
const overviewExampleHtmlRaw = (window as unknown as Record<string, unknown>)['__CINDER_OVERVIEW_EXAMPLE_HTML__'];
const overviewExampleHtml = typeof overviewExampleHtmlRaw === 'string' ? overviewExampleHtmlRaw : null;
let resolveOverviewPreview: (() => void) | undefined;
const overviewPreviewReady = overviewExampleHtml !== null && overviewExampleHtml !== ''
  ? new Promise<void>((resolve) => {
      resolveOverviewPreview = resolve;
    })
  : undefined;

const props = {
  loadBareComponentModule: () => import(${JSON.stringify(componentDefinition.importPath)}),
  previewOnly,
  snapshotMode,
  sidebarComponents,
  overviewExampleHtml,
  onOverviewPreviewSettled: () => resolveOverviewPreview?.(),
};

let pageHydration: Promise<void> | undefined;
let pageHydrated = false;

function hydratePage(): Promise<void> {
  if (pageHydration !== undefined) return pageHydration;

  const hydration = Promise.all([import('svelte'), import('../../src/component-page.svelte')]).then(async ([svelte, { default: ComponentPage }]) => {
    if (shouldHydrate) {
      svelte.hydrate(ComponentPage, { target, props });
      if (overviewPreviewReady !== undefined) await overviewPreviewReady;
      pageHydrated = true;
      return;
    }
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
    svelte.mount(ComponentPage, { target, props });
    pageHydrated = true;
  });
  pageHydration = hydration;
  void hydration.catch(() => {
    if (pageHydration === hydration) pageHydration = undefined;
  });
  return hydration;
}

function hydrateAfter(event: Event, replay: () => void): void {
  event.preventDefault();
  void hydratePage()
    .then(replay)
    .catch((error) => console.error('[cinder playground] failed to hydrate page:', error));
}

function eventElement(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

type ElementLocation = { rootId: string; childIndexes: number[] };

function elementLocation(element: Element): ElementLocation | undefined {
  const childIndexes: number[] = [];
  let current: Element | null = element;
  while (current !== null && current.id === '') {
    const parent = current.parentElement;
    if (parent === null) return undefined;
    childIndexes.unshift(Array.from(parent.children).indexOf(current));
    current = parent;
  }
  return current === null ? undefined : { rootId: current.id, childIndexes };
}

function resolveElementLocation(location: ElementLocation | undefined): Element | null {
  if (location === undefined) return null;
  let current: Element | null = document.getElementById(location.rootId);
  for (const childIndex of location.childIndexes) {
    current = current?.children.item(childIndex) ?? null;
  }
  return current;
}

// The server-rendered documentation remains immediately usable while eager
// hydration loads. If a control interaction wins that race, hydrate first and
// replay it against the now-live component rather than dropping the input.
document.addEventListener(
  'click',
  (event) => {
    if (pageHydrated) return;
    const button = eventElement(event)?.closest('button');
    if (button === null) return;
    if (button.getAttribute('aria-label') === 'Copy import') {
      const source = button.closest('.dx-import')?.querySelector('.dx-import__code')?.textContent;
      if (source !== null && source !== undefined) {
        void navigator.clipboard?.writeText(source).catch(() => undefined);
      }
      hydrateAfter(event, () => undefined);
      return;
    }
    const buttonLocation = elementLocation(button);
    hydrateAfter(event, () => {
      const hydratedButton = resolveElementLocation(buttonLocation);
      if (hydratedButton instanceof HTMLButtonElement) hydratedButton.click();
    });
  },
  { capture: true },
);

document.addEventListener(
  'keydown',
  (event) => {
    if (pageHydrated || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const button = eventElement(event)?.closest('button');
    if (button?.getAttribute('role') !== 'tab') return;
    hydrateAfter(event, () =>
      button.dispatchEvent(
        new KeyboardEvent('keydown', { key: event.key, bubbles: true, cancelable: true }),
      ),
    );
  },
  { capture: true },
);

document.addEventListener(
  'click',
  (event) => {
    if (pageHydrated) return;
    const anchor = eventElement(event)?.closest('a[href^="#"]');
    if (anchor === null) return;
    hydrateAfter(event, () => anchor.click());
  },
  { capture: true },
);

document.addEventListener(
  'input',
  (event) => {
    if (pageHydrated) return;
    const input = eventElement(event);
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
    const value = input.value;
    const inputId = input.id;
    if (inputId === 'sidebar-filter') {
      try {
        sessionStorage.setItem(NAV_FILTER_STORAGE_KEY, value);
      } catch {
        // Private mode or disabled storage: preserve the current input while
        // the component hydrates, even though it cannot survive navigation.
      }
    }
    hydrateAfter(event, () => {
      const hydratedInput = document.getElementById(inputId);
      if (!(hydratedInput instanceof HTMLInputElement || hydratedInput instanceof HTMLTextAreaElement)) return;
      hydratedInput.value = value;
      hydratedInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  },
  { capture: true },
);

// The exported document is complete before this runs. Hydrate immediately so
// its controls and server-rendered example become interactive without using an
// unrelated gesture such as scrolling as a scheduling signal.
void hydratePage().catch((error) =>
  console.error('[cinder playground] failed to hydrate page:', error),
);
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
