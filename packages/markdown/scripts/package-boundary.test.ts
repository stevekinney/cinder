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

// `@shikijs/engine-oniguruma` and `@shikijs/types` are shared between
// markdown and cinder: cinder's own `src/highlighters/shiki/index.ts`
// imports them directly (a dynamic `import('@shikijs/engine-oniguruma')`
// and `@shikijs/types` type imports), independent of markdown entirely.
//
// `@shikijs/langs` is markdown-only now. Before Phase 5 of
// `docs/decisions/package-boundaries.md`, cinder's build VENDORED
// markdown's compiled `dist/rendering/**` wholesale into its own published
// dist and re-exposed it under `./markdown/rendering*`, so a consumer
// reaching that vendored path needed `@shikijs/langs` resolvable from
// cinder's own dependency tree too. Phase 5 deleted that vendoring — cinder
// no longer exposes any markdown subpath at all — so `@shikijs/langs` is no
// longer cinder's concern; it stays a markdown dependency only (`shiki`
// itself resolves it as its own transitive dependency regardless).
const SHARED_SHIKI_PACKAGES = ['@shikijs/engine-oniguruma', '@shikijs/types'];
const MARKDOWN_ONLY_SHIKI_PACKAGES = ['@shikijs/langs'];
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
    for (const shikiPackage of [...SHARED_SHIKI_PACKAGES, ...MARKDOWN_ONLY_SHIKI_PACKAGES]) {
      expect(markdownManifest.dependencies?.[shikiPackage]).toBeDefined();
    }
    // `shiki` itself is not a `@shikijs/*` engine package — it stays a
    // markdown dependency AND a cinder dependency (cinder's own
    // `src/highlighters/shiki` uses it directly for `code-block`).
    expect(markdownManifest.dependencies?.['shiki']).toBeDefined();
  });

  test('cinder declares every shared @shikijs/* dep it directly imports', () => {
    for (const shikiPackage of SHARED_SHIKI_PACKAGES) {
      expect(cinderManifest.dependencies?.[shikiPackage]).toBeDefined();
    }
  });

  test('cinder no longer carries @shikijs/langs (no longer vendors markdown/rendering)', () => {
    for (const shikiPackage of MARKDOWN_ONLY_SHIKI_PACKAGES) {
      expect(cinderManifest.dependencies?.[shikiPackage]).toBeUndefined();
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
