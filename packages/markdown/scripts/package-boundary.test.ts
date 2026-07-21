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

const MOVED_SHIKI_PACKAGES = ['@shikijs/engine-oniguruma', '@shikijs/langs', '@shikijs/types'];
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

  test('every export condition resolves under dist/, matching the staged publish shape', () => {
    for (const [subpath, entry] of Object.entries(markdownManifest.exports)) {
      if (subpath === './package.json') continue;
      expect(typeof entry).toBe('object');
      const conditions = entry as Record<string, string>;
      for (const [condition, target] of Object.entries(conditions)) {
        expect(
          target.startsWith('./dist/') || target === './package.json',
          `${subpath}#${condition}`,
        ).toBe(true);
      }
    }
  });

  test('carries the @shikijs/* highlighter engine deps moved off cinder', () => {
    for (const shikiPackage of MOVED_SHIKI_PACKAGES) {
      expect(markdownManifest.dependencies?.[shikiPackage]).toBeDefined();
    }
    // `shiki` itself is not a `@shikijs/*` engine package — it stays a
    // markdown dependency AND a cinder dependency (cinder's own
    // `src/highlighters/shiki` uses it directly for `code-block`).
    expect(markdownManifest.dependencies?.['shiki']).toBeDefined();
  });

  test('cinder declares no dependency on the moved @shikijs/* packages', () => {
    for (const shikiPackage of MOVED_SHIKI_PACKAGES) {
      for (const field of dependencyFields) {
        expect(cinderManifest[field]?.[shikiPackage]).toBeUndefined();
      }
    }
  });
});
