/**
 * Discovery utilities for the cinder component playground.
 *
 * Scans `packages/components/src/components/` for public Svelte components and
 * `packages/playground/src/examples/` for their associated scenario files.
 * All scanning uses `Bun.Glob` with absolute paths derived from `import.meta.dirname`.
 */

import { basename, dirname, join } from 'node:path';

// import.meta.dirname is packages/playground/src/
const PLAYGROUND_ROOT = dirname(import.meta.dirname); // packages/playground/
const COMPONENTS_ROOT = join(PLAYGROUND_ROOT, '..', 'components'); // packages/components/

/**
 * Compose-only leaf components. These public components exist as real
 * directories and are exported flat from `@lostgradient/cinder`, but they have no meaningful
 * standalone usage — they are always rendered inside a parent compound
 * (`Tabs`, `Table`, `Dropdown`, `Accordion`, `Tree`, `Feed`, `GridList`,
 * `StatGroup`, `SideNavigation`). They are excluded from the playground
 * sidebar so a single parent entry covers the family, but they remain in
 * `discoverComponents()` so direct `/c/<leaf>` routing still works.
 */
export const COMPOSE_ONLY_COMPONENTS: ReadonlySet<string> = new Set([
  'accordion-item',
  'tab-list',
  'tab',
  'tab-panel',
  'table-body',
  'table-cell',
  'table-header',
  'table-header-cell',
  'table-row',
  'dropdown-trigger',
  'dropdown-menu',
  'dropdown-item',
  'dropdown-label',
  'dropdown-separator',
  'dropdown-group',
  'context-menu-trigger',
  'tree-item',
  'feed-event',
  'grid-list-item',
  'stat',
  'side-navigation-group',
  'side-navigation-item',
]);

/**
 * Scans a component-source root for the absolute paths of every public
 * component `.svelte` file. Covers both the legacy flat layout
 * (`<root>/<name>.svelte`) and the per-directory migrated layout
 * (`<root>/<name>/<name>.svelte`).
 *
 * Exclusions, applied identically to both layouts:
 *  - underscore-prefixed names (internal-only),
 *  - the `experimental/` and `icons/` directories,
 *  - directories whose `<name>/<name>.svelte` file does not exist.
 *
 * This is the single source of truth shared by {@link discoverComponents}
 * (which derives kebab names) and the playground analyzer's `analyzeAll`
 * (which reads the files). Returned paths are deduplicated but unsorted.
 */
export async function discoverComponentFilePaths(root: string): Promise<string[]> {
  const filePaths = new Set<string>();

  // Flat (legacy) components.
  for await (const file of new Bun.Glob('*.svelte').scan({ cwd: root })) {
    if (file.startsWith('_')) continue;
    filePaths.add(join(root, file));
  }

  // Directory-shaped (migrated) components: `<name>/<name>.svelte`.
  for await (const dir of new Bun.Glob('*/').scan({ cwd: root, onlyFiles: false })) {
    const dirName = dir.replace(/\/$/, '');
    if (dirName.startsWith('_')) continue;
    if (dirName === 'experimental' || dirName === 'icons') continue;
    // Confirm the directory holds a top-level .svelte file matching its name.
    const candidate = join(root, dirName, `${dirName}.svelte`);
    if (await Bun.file(candidate).exists()) filePaths.add(candidate);
  }

  return [...filePaths];
}

/**
 * Memoized result of {@link scanComponents}. `null` means "cold" — the next
 * {@link discoverComponents} call performs the full glob scan and caches the
 * in-flight promise here. Cleared by {@link invalidateDiscoveryCache} on every
 * watcher rebuild so renamed/added/removed components are picked up.
 *
 * The cache stores the *promise*, not the resolved array, so concurrent first
 * callers share a single scan instead of each kicking off their own.
 */
let componentsCache: Promise<string[]> | null = null;

/**
 * Monotonic discovery generation. {@link invalidateDiscoveryCache} bumps it on
 * every watcher rebuild. Each memoized getter captures the generation when it
 * starts a scan and ignores the cache (re-scanning) if the generation has moved
 * on by the time it reads it — so a caller that started awaiting a scan *before*
 * an invalidation never serves the now-stale result back as if it were fresh.
 * Nulling the cache pointers alone could not fix that: a caller already holding
 * the in-flight promise would still resolve to pre-invalidation data.
 */
let discoveryGeneration = 0;

/**
 * Memoized result of {@link computeDiscoverAll}. Derived from the cached
 * component list plus a per-component example scan; invalidated alongside
 * {@link componentsCache}.
 */
let discoverAllCache: Promise<Array<{ name: string; exampleCount: number }>> | null = null;

/**
 * Drop every memoized discovery result so the next call re-scans the
 * filesystem. Called by the playground server whenever the file watcher kicks
 * off a rebuild (i.e. when `rebuildGeneration` increments), guaranteeing the
 * sidebar and component routes reflect on-disk renames, additions, and
 * deletions without a server restart.
 */
export function invalidateDiscoveryCache(): void {
  discoveryGeneration += 1;
  componentsCache = null;
  discoverAllCache = null;
}

/**
 * Perform the actual scan for public component kebab names. Pure and uncached —
 * {@link discoverComponents} owns the memoization. Delegates the filesystem
 * walk to {@link discoverComponentFilePaths} (the single source of truth shared
 * with the analyzer), then derives sorted, deduplicated kebab names. Kept
 * separate so the cache layer and the scan logic stay independently testable.
 */
async function scanComponents(): Promise<string[]> {
  const root = join(COMPONENTS_ROOT, 'src', 'components');
  const filePaths = await discoverComponentFilePaths(root);
  const names = filePaths.map((filePath) => basename(filePath, '.svelte'));
  return [...new Set(names)].toSorted();
}

/**
 * Returns a sorted array of component kebab names. Discovers both the legacy
 * flat layout (`packages/components/src/components/<name>.svelte`) and the
 * per-directory migrated layout (`packages/components/src/components/<name>/<name>.svelte`).
 * Underscore-prefixed names are excluded as internal-only.
 *
 * The result is memoized at module scope: this function runs on every `/`,
 * `/c/:name`, and `/page/:name` request, so the full `Bun.Glob` scan only
 * happens once per watcher generation. Call {@link invalidateDiscoveryCache}
 * to force a re-scan after a rebuild. The cache stores the in-flight promise,
 * so the resolved array is identical between calls and preserves exact sorting.
 */
export async function discoverComponents(): Promise<string[]> {
  // Re-scan until a scan completes without an invalidation racing it. A single
  // post-await generation check is not enough: a second invalidation *during*
  // the retry scan would otherwise be missed, returning stale data again. The
  // loop converges as soon as no rebuild lands while a scan is in flight, which
  // it always does because rebuilds are debounced and finite.
  for (;;) {
    const generationAtStart = discoveryGeneration;
    componentsCache ??= scanComponents();
    const result = await componentsCache;
    if (generationAtStart === discoveryGeneration) return result;
  }
}

/**
 * Returns a sorted array of scenario names (basename without `.example.svelte`)
 * for a given component name.
 */
export async function discoverExamples(componentName: string): Promise<string[]> {
  const glob = new Bun.Glob(`${componentName}/*.example.svelte`);
  const scenarios: string[] = [];

  for await (const file of glob.scan({ cwd: join(PLAYGROUND_ROOT, 'src', 'examples') })) {
    const fileName = file.split('/').pop()!;
    const scenario = fileName.replace(/\.example\.svelte$/, '');
    scenarios.push(scenario);
  }

  return scenarios.toSorted();
}

/**
 * Pair every component with its example count. Pure and uncached —
 * {@link discoverAll} owns the memoization. Relies on {@link discoverComponents}
 * (itself cached) for the component list, then scans each component's example
 * directory once.
 */
async function computeDiscoverAll(): Promise<Array<{ name: string; exampleCount: number }>> {
  const components = await discoverComponents();

  const results = await Promise.all(
    components.map(async (name) => {
      const examples = await discoverExamples(name);
      return { name, exampleCount: examples.length };
    }),
  );

  return results;
}

/**
 * Returns all components paired with their example count. Memoized under the
 * same invalidation as {@link discoverComponents}, since `/` and `/c/:name`
 * drive {@link discoverSidebarComponents} (which calls this) on every request.
 * Call {@link invalidateDiscoveryCache} to force a re-scan after a rebuild.
 */
export async function discoverAll(): Promise<Array<{ name: string; exampleCount: number }>> {
  // Loop until a compute completes without an invalidation racing it — the same
  // convergence guard as discoverComponents(), so a second rebuild during the
  // retry can't leave stale example counts cached.
  for (;;) {
    const generationAtStart = discoveryGeneration;
    discoverAllCache ??= computeDiscoverAll();
    const result = await discoverAllCache;
    if (generationAtStart === discoveryGeneration) return result;
  }
}

/**
 * Components that should appear in the playground sidebar — those with at least
 * one `.example.svelte` file, minus any compose-only leaf listed in
 * `COMPOSE_ONLY_COMPONENTS`. Compose-only subcomponents are demonstrated on
 * their parent's page (for example, `Tabs.List` is shown in the `tabs` entry),
 * so they would only add noise to the sidebar.
 */
export async function discoverSidebarComponents(): Promise<string[]> {
  const all = await discoverAll();
  return all
    .filter(({ exampleCount }) => exampleCount > 0)
    .map(({ name }) => name)
    .filter((name) => !COMPOSE_ONLY_COMPONENTS.has(name));
}
