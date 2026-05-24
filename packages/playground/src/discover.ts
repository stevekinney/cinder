/**
 * Discovery utilities for the cinder component playground.
 *
 * Scans `packages/components/src/components/` for public Svelte components and
 * `packages/playground/src/examples/` for their associated scenario files.
 * All scanning uses `Bun.Glob` with absolute paths derived from `import.meta.dirname`.
 */

import { dirname, join } from 'node:path';

// import.meta.dirname is packages/playground/src/
const PLAYGROUND_ROOT = dirname(import.meta.dirname); // packages/playground/
const COMPONENTS_ROOT = join(PLAYGROUND_ROOT, '..', 'components'); // packages/components/

/**
 * Compose-only leaf components. These public components exist as real
 * directories and are exported flat from `cinder`, but they have no meaningful
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
  'tree-item',
  'feed-event',
  'grid-list-item',
  'stat',
  'side-navigation-group',
  'side-navigation-item',
]);

/**
 * Returns a sorted array of component kebab names. Discovers both the legacy
 * flat layout (`packages/components/src/components/<name>.svelte`) and the
 * per-directory migrated layout (`packages/components/src/components/<name>/<name>.svelte`).
 * Underscore-prefixed names are excluded as internal-only.
 */
export async function discoverComponents(): Promise<string[]> {
  const names = new Set<string>();
  const root = join(COMPONENTS_ROOT, 'src', 'components');

  // Flat (legacy) components.
  for await (const file of new Bun.Glob('*.svelte').scan({ cwd: root })) {
    if (file.startsWith('_')) continue;
    names.add(file.replace(/\.svelte$/, ''));
  }

  // Directory-shaped (migrated) components.
  for await (const dir of new Bun.Glob('*/').scan({ cwd: root, onlyFiles: false })) {
    const dirName = dir.replace(/\/$/, '');
    if (dirName.startsWith('_')) continue;
    if (dirName === 'experimental' || dirName === 'icons') continue;
    // Confirm the directory holds a top-level .svelte file matching its name.
    const expectedFile = `${dirName}/${dirName}.svelte`;
    const hit = await Bun.file(join(root, expectedFile)).exists();
    if (hit) names.add(dirName);
  }

  return [...names].toSorted();
}

/**
 * Returns a sorted array of scenario names (basename without `.example.svelte`)
 * for a given component name.
 */
export async function discoverExamples(componentName: string): Promise<string[]> {
  const glob = new Bun.Glob(`${componentName}/*.example.svelte`);
  const scenarios: string[] = [];

  for await (const file of glob.scan({ cwd: join(PLAYGROUND_ROOT, 'src', 'examples') })) {
    const basename = file.split('/').pop()!;
    const scenario = basename.replace(/\.example\.svelte$/, '');
    scenarios.push(scenario);
  }

  return scenarios.toSorted();
}

/** Returns all components paired with their example count. */
export async function discoverAll(): Promise<Array<{ name: string; exampleCount: number }>> {
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
