import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import {
  assertSourceManifest,
  buildPublishedManifest,
  type PackageManifest,
} from './pack-for-publish.ts';

const packageRoot = join(import.meta.dir, '..');
const workspaceRoot = join(packageRoot, '..', '..');
const markdownManifest = JSON.parse(
  await Bun.file(join(packageRoot, 'package.json')).text(),
) as PackageManifest;
const cinderManifest = JSON.parse(
  await Bun.file(join(workspaceRoot, 'packages', 'components', 'package.json')).text(),
) as PackageManifest;

// All three `@shikijs/*` packages are shared between markdown and cinder —
// for two different reasons:
//   - `@shikijs/engine-oniguruma` and `@shikijs/types`: cinder's own
//     `src/highlighters/shiki/index.ts` imports them directly (a dynamic
//     `import('@shikijs/engine-oniguruma')` and `@shikijs/types` type
//     imports), independent of markdown entirely.
//   - `@shikijs/langs`: cinder's own source never imports it, but cinder's
//     build VENDORS markdown's compiled `dist/rendering/**` wholesale into
//     its own published dist and re-exposes it under the public
//     `./markdown/rendering*` subpaths (see `scripts/build.ts`'s upstream
//     vendoring pass). That vendored `rendering/highlighter.js` dynamically
//     imports `@shikijs/langs/<name>`, so any consumer who installs
//     `@lostgradient/cinder` alone and reaches `./markdown/rendering*`
//     needs `@shikijs/langs` resolvable from CINDER's own dependency tree,
//     not just markdown's — under pnpm/Yarn PnP or any non-hoisted install
//     layout, a package can only resolve its OWN declared dependencies.
const SHARED_SHIKI_PACKAGES = ['@shikijs/engine-oniguruma', '@shikijs/langs', '@shikijs/types'];
const dependencyFields = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;

describe('@lostgradient/markdown package ownership boundary', () => {
  test('is headless: no Svelte dependency, no peer dependencies', () => {
    for (const field of dependencyFields) {
      expect(markdownManifest[field]?.['svelte']).toBeUndefined();
    }
    expect(markdownManifest.peerDependencies ?? {}).toEqual({});
  });

  test('keeps the published manifest workspace-free and dist-only', () => {
    expect(() => assertSourceManifest(markdownManifest)).not.toThrow();
    const published = buildPublishedManifest(markdownManifest);
    const serialized = JSON.stringify(published);

    expect(published.devDependencies).toBeUndefined();
    expect(published.scripts).toBeUndefined();
    expect(serialized).not.toContain('workspace:');
    expect(serialized).not.toContain('./src/');
  });

  test('every published export condition resolves under dist/, matching the staged publish shape', () => {
    // The SOURCE manifest also carries a `bun` condition pointing at
    // `./src/**` so a workspace `bun test`/`bun run` can resolve this
    // package's self-imports without a build first (see
    // `pack-for-publish.ts#publishedExport`). `buildPublishedManifest` drops
    // that condition, so assert against the published shape, not the raw
    // source `exports` block.
    const published = buildPublishedManifest(markdownManifest);
    for (const [subpath, entry] of Object.entries(published.exports)) {
      if (subpath === './package.json') continue;
      expect(typeof entry).toBe('object');
      const conditions = entry as Record<string, string>;
      expect(Object.keys(conditions)).not.toContain('bun');
      for (const [condition, target] of Object.entries(conditions)) {
        expect(
          target.startsWith('./dist/') || target === './package.json',
          `${subpath}#${condition}`,
        ).toBe(true);
      }
    }
  });

  test('carries every @shikijs/* highlighter engine dep it uses', () => {
    for (const shikiPackage of SHARED_SHIKI_PACKAGES) {
      expect(markdownManifest.dependencies?.[shikiPackage]).toBeDefined();
    }
    // `shiki` itself is not a `@shikijs/*` engine package — it stays a
    // markdown dependency AND a cinder dependency (cinder's own
    // `src/highlighters/shiki` uses it directly for `code-block`).
    expect(markdownManifest.dependencies?.['shiki']).toBeDefined();
  });

  test('cinder declares every shared @shikijs/* dep, including langs (vendored via ./markdown/rendering*)', () => {
    for (const shikiPackage of SHARED_SHIKI_PACKAGES) {
      expect(cinderManifest.dependencies?.[shikiPackage]).toBeDefined();
    }
  });

  test('published markdown manifest declares @types/mdast and @types/unist as real dependencies, not devDependencies', () => {
    // `pipeline/types.d.ts`, `rendering/extract-code-blocks.d.ts`, and other
    // publicly exported `.d.ts` files re-export `mdast`/`unist` types. Those
    // packages must survive `buildPublishedManifest`'s
    // `delete published.devDependencies` — otherwise a consumer typechecking
    // against `@lostgradient/markdown/pipeline` can't resolve them.
    for (const declarationPackage of ['@types/mdast', '@types/unist']) {
      expect(markdownManifest.dependencies?.[declarationPackage]).toBeDefined();
      expect(markdownManifest.devDependencies?.[declarationPackage]).toBeUndefined();
    }
    const published = buildPublishedManifest(markdownManifest);
    expect(published.dependencies?.['@types/mdast']).toBeDefined();
    expect(published.dependencies?.['@types/unist']).toBeDefined();
  });
});
