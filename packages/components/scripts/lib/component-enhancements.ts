import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ComponentDiscovery } from './discover-components.ts';

export type ComponentEnhancement = {
  name: string;
  isExperimental: boolean;
  sourcePath: string;
};

/** Return the stable/experimental identity used to match enhancement artifacts. */
export function componentEnhancementKey(
  component: Pick<ComponentDiscovery, 'name' | 'isExperimental'>,
): string {
  return `${component.isExperimental ? 'experimental' : 'stable'}/${component.name}`;
}

/**
 * Discover stable component-owned runtime enhancements.
 *
 * Enhancement exports intentionally follow the same non-experimental policy as
 * `generate-exports.ts`: a component contributes an enhancement when its
 * directory contains `<name>-enhancement.ts`.
 */
export function discoverComponentEnhancements(
  components: ReadonlyArray<Pick<ComponentDiscovery, 'name' | 'isExperimental'>>,
  componentsRoot: string,
): ComponentEnhancement[] {
  return components.flatMap((component) => {
    if (component.isExperimental) return [];
    const sourcePath = join(componentsRoot, component.name, `${component.name}-enhancement.ts`);
    return existsSync(sourcePath)
      ? [{ name: component.name, isExperimental: component.isExperimental, sourcePath }]
      : [];
  });
}

/** Return the browser, declaration, and server outputs for one enhancement. */
export function componentEnhancementOutputPaths(
  distributionDirectory: string,
  name: string,
): { browser: string; types: string; server: string } {
  const directory = join(distributionDirectory, 'components', name);
  return {
    browser: join(directory, `${name}-enhancement.js`),
    types: join(directory, `${name}-enhancement.d.ts`),
    server: join(distributionDirectory, 'server', 'components', name, `${name}-enhancement.js`),
  };
}
