/**
 * Walks `src/components/` and returns the canonical list of component
 * directories the artifact, constraint, schema, variables, examples, and
 * manifest generators all need.
 *
 * Extracted from `generate-component-artifacts.ts` so other generator scripts
 * (e.g. `generate-component-constraints.ts`) can import this without forming
 * a cycle through the artifact orchestrator.
 */

import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type DiscoveredComponent = {
  /** Absolute path to the component directory. */
  directory: string;
  /** Kebab-case component name (the directory basename). */
  name: string;
  /** True for `src/components/experimental/<name>/`. */
  isExperimental: boolean;
};

const COMPONENTS_ROOT = join(import.meta.dir, '..', 'src', 'components');

/**
 * Discover every directory-shaped component under `src/components/`.
 *
 * A directory qualifies when it contains both `<name>.svelte` and
 * `<name>.types.ts`. The presence of the `.types.ts` file is the marker that
 * the per-directory migration is complete; legacy flat or in-progress
 * subdirectories are skipped.
 *
 * Directories named `experimental/` are descended one level, and
 * `icons/` plus underscore-prefixed names (`_internal/`, etc.) are skipped.
 *
 * Returns the list sorted by absolute directory path.
 */
export async function discoverComponentDirectories(): Promise<DiscoveredComponent[]> {
  const results: DiscoveredComponent[] = [];

  for (const entry of await readdir(COMPONENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;

    if (entry.name === 'experimental') {
      const experimentalRoot = join(COMPONENTS_ROOT, 'experimental');
      for (const subEntry of await readdir(experimentalRoot, { withFileTypes: true })) {
        if (!subEntry.isDirectory()) continue;
        if (subEntry.name.startsWith('_')) continue;
        const directory = join(experimentalRoot, subEntry.name);
        if (!existsSync(join(directory, `${subEntry.name}.svelte`))) continue;
        if (!existsSync(join(directory, `${subEntry.name}.types.ts`))) continue;
        results.push({ directory, name: subEntry.name, isExperimental: true });
      }
      continue;
    }

    if (entry.name === 'icons') continue;

    const directory = join(COMPONENTS_ROOT, entry.name);
    if (!existsSync(join(directory, `${entry.name}.svelte`))) continue;
    if (!existsSync(join(directory, `${entry.name}.types.ts`))) continue;
    results.push({ directory, name: entry.name, isExperimental: false });
  }

  return results.toSorted((a, b) => a.directory.localeCompare(b.directory));
}
