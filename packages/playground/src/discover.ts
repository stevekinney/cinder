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

/** Returns a sorted array of component kebab names from `packages/components/src/components/*.svelte` (top-level only, no `_internal/`). */
export async function discoverComponents(): Promise<string[]> {
  const glob = new Bun.Glob('*.svelte');
  const names: string[] = [];

  for await (const file of glob.scan({ cwd: join(COMPONENTS_ROOT, 'src', 'components') })) {
    // file is like "button.svelte"
    const name = file.replace(/\.svelte$/, '');
    names.push(name);
  }

  return names.toSorted();
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
