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

// `@shikijs/langs` is markdown-only: only `src/rendering/highlighter.ts` lazily
// imports per-language grammars. `@shikijs/engine-oniguruma` and
// `@shikijs/types` are shared: cinder's own `src/highlighters/shiki/index.ts`
// also imports them directly (a dynamic `import('@shikijs/engine-oniguruma')`
// and `@shikijs/types` type imports), so they must stay declared on BOTH
// packages — dropping them from cinder would leave that adapter's transitive
// dependency unresolved under any install layout that doesn't hoist markdown's
// deps beside cinder (pnpm, Yarn PnP).
const MARKDOWN_ONLY_SHIKI_PACKAGES = ['@shikijs/langs'];
const SHARED_SHIKI_PACKAGES = ['@shikijs/engine-oniguruma', '@shikijs/types'];
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
    for (const shikiPackage of [...MARKDOWN_ONLY_SHIKI_PACKAGES, ...SHARED_SHIKI_PACKAGES]) {
      expect(markdownManifest.dependencies?.[shikiPackage]).toBeDefined();
    }
    // `shiki` itself is not a `@shikijs/*` engine package — it stays a
    // markdown dependency AND a cinder dependency (cinder's own
    // `src/highlighters/shiki` uses it directly for `code-block`).
    expect(markdownManifest.dependencies?.['shiki']).toBeDefined();
  });

  test('cinder declares no dependency on the markdown-only @shikijs/* packages', () => {
    for (const shikiPackage of MARKDOWN_ONLY_SHIKI_PACKAGES) {
      for (const field of dependencyFields) {
        expect(cinderManifest[field]?.[shikiPackage]).toBeUndefined();
      }
    }
  });

  test('cinder keeps the shared @shikijs/* deps its own highlighter adapter imports directly', () => {
    for (const shikiPackage of SHARED_SHIKI_PACKAGES) {
      expect(cinderManifest.dependencies?.[shikiPackage]).toBeDefined();
    }
  });
});
