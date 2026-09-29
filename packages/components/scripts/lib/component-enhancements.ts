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
 * A component contributes an enhancement when its directory contains
 * `<name>-enhancement.ts`.
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

/**
 * Return the browser, declaration, and server outputs for one enhancement.
 *
 * COR-1196. Nothing in corvidae calls this: corvidae never builds a `dist/`, so it has no
 * distribution directory to compute paths into. It is exported here because the published
 * build's `scripts/build.ts` does — `componentEnhancementOutputPaths` is one of three bindings
 * it imports from this module — and `scripts/build.ts` is the target's own, never emitted by
 * corvidae (`package-surface.json`'s `requiredInputs` for `@lostgradient/cinder` names only
 * `scripts/build.ts` and `scripts/pack-for-publish.ts`, and corvidae has neither on disk, so
 * `readDeclaredBuildInputs` skips both and leaves the target's copy of `build.ts` in place).
 * `discoverComponentEnhancements` and `componentEnhancementKey` above are what
 * `generate-manifest.ts` (`validationInputs['@lostgradient/cinder']`) needs from this file, and
 * until this fix corvidae's copy carried only those two — a real emission of a real subset. The
 * target's build imports the third from the same path, so a sync that overwrote this module with
 * corvidae's narrower one broke `bun run build` on a `SyntaxError` naming the missing export.
 * Adopted rather than left for the target to carry a divergent copy, so the module the target's
 * build imports from is the one module corvidae emits — the same convergence weft's README and
 * `examples/` entries in `additionalSourceRoots` already choose over a target-side fork.
 */
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
