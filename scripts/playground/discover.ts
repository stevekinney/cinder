/**
 * Discovery utilities for the cinder component playground.
 *
 * Scans `src/components/` for public Svelte components and
 * `scripts/playground/examples/` for their associated scenario files.
 * All scanning uses `Bun.Glob` relative to `process.cwd()` (repo root).
 */

/** Returns a sorted array of component kebab names from `src/components/*.svelte` (top-level only, no `_internal/`). */
export async function discoverComponents(): Promise<string[]> {
  const glob = new Bun.Glob('src/components/*.svelte');
  const names: string[] = [];

  for await (const file of glob.scan({ cwd: process.cwd() })) {
    // file is like "src/components/button.svelte"
    const basename = file.split('/').pop()!;
    const name = basename.replace(/\.svelte$/, '');
    names.push(name);
  }

  return names.toSorted();
}

/**
 * Returns a sorted array of scenario names (basename without `.example.svelte`)
 * for a given component name.
 */
export async function discoverExamples(componentName: string): Promise<string[]> {
  const glob = new Bun.Glob(`scripts/playground/examples/${componentName}/*.example.svelte`);
  const scenarios: string[] = [];

  for await (const file of glob.scan({ cwd: process.cwd() })) {
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
