/**
 * Shared component discovery for the cinder code generation pipeline.
 *
 * Walks `packages/components/src/components/` and returns every component
 * directory that has both a `<name>.svelte` and a `<name>.types.ts` file.
 * Skips underscore-prefixed directories (private/internal), `icons`, and
 * descends one level into `experimental/` for experimental components.
 *
 * Consumed by:
 *   - `generate-exports.ts` (writes `package.json#exports` subpaths)
 *   - `validate-consumers.ts` (derives the public-components allowlist used
 *      to assert tarball contents)
 *
 * Centralizing this here means the two scripts cannot drift: a new component
 * directory automatically participates in both the exports map and the
 * tarball expectations without further code changes.
 */

import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_ROOT = join(scriptDirectory, '..', '..', 'src', 'components');

export type ComponentDiscovery = {
  /** Kebab-case directory name (e.g. `accordion-item`). */
  name: string;
  /** True when the component lives under `src/components/experimental/`. */
  isExperimental: boolean;
};

/**
 * Discover every directory-shaped component under `src/components/`.
 *
 * Results are sorted: non-experimental first, then experimental, each
 * alphabetically.
 */
export async function discoverComponents(): Promise<ComponentDiscovery[]> {
  const result: ComponentDiscovery[] = [];
  for (const entry of await readdir(COMPONENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    if (entry.name === 'icons') continue;

    if (entry.name === 'experimental') {
      const experimentalRoot = join(COMPONENTS_ROOT, 'experimental');
      for (const subEntry of await readdir(experimentalRoot, { withFileTypes: true })) {
        if (!subEntry.isDirectory()) continue;
        if (subEntry.name.startsWith('_')) continue;
        const directory = join(experimentalRoot, subEntry.name);
        if (!existsSync(join(directory, `${subEntry.name}.svelte`))) continue;
        if (!existsSync(join(directory, `${subEntry.name}.types.ts`))) continue;
        result.push({ name: subEntry.name, isExperimental: true });
      }
      continue;
    }

    const directory = join(COMPONENTS_ROOT, entry.name);
    if (!existsSync(join(directory, `${entry.name}.svelte`))) continue;
    if (!existsSync(join(directory, `${entry.name}.types.ts`))) continue;
    result.push({ name: entry.name, isExperimental: false });
  }
  return result.toSorted((a, b) => {
    if (a.isExperimental !== b.isExperimental) return a.isExperimental ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}
