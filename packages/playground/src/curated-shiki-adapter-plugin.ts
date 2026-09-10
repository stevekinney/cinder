/**
 * Build-time substitution of {@link module:curated-shiki-adapter} for
 * `@lostgradient/cinder`'s bundled Shiki adapter, in playground builds only.
 *
 * `<CodeBlock>`'s default-highlighter seam reaches the real adapter through a
 * dynamic `import('../../highlighters/shiki/default.ts')`. That edge is what
 * pulls the full 253-grammar registry into every page bundle's graph, whether
 * or not any block ever highlights — see the sibling module for the cost.
 * Redirecting the specifier is what removes the edge; passing `highlighter`
 * props at every call site does not, because the module stays reachable from
 * `<CodeBlock>`'s own source.
 *
 * Deliberately a resolve-level substitution rather than a change to cinder's
 * published default: the playground compiles 179 bundles and pays the walk
 * each time, a consumer compiles once. Fixing this upstream would narrow what
 * `<CodeBlock>` highlights out of the box for everyone, which is a different
 * decision with a release behind it.
 *
 * @module
 */

import type { BunPlugin } from 'bun';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path of the module substituted in. Exported for the guard test. */
export const CURATED_SHIKI_ADAPTER_PATH = resolve(here, 'curated-shiki-adapter.ts');

/**
 * Matches the bundled adapter by its own filename. `<CodeBlock>` imports it
 * relatively (`../../highlighters/shiki/default.ts`) and the published subpath
 * `@lostgradient/cinder/highlighters/shiki` resolves to the same file, so
 * anchoring on the tail catches both without depending on which one a given
 * importer used.
 */
const BUNDLED_ADAPTER_SPECIFIER = /highlighters[\\/]shiki[\\/]default\.ts$/;

/**
 * Redirect the bundled Shiki adapter to the playground's curated stand-in.
 *
 * Applies to every family that spreads `SHARED_BUILD_OPTIONS`, and to the SSR
 * renderer's server builds, so neither side walks the full registry.
 */
export function curatedShikiAdapterPlugin(): BunPlugin {
  return {
    name: 'playground-curated-shiki-adapter',
    setup(build) {
      build.onResolve({ filter: BUNDLED_ADAPTER_SPECIFIER }, () => ({
        path: CURATED_SHIKI_ADAPTER_PATH,
      }));
    },
  };
}
