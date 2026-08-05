import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { PUBLISHED_SOURCE_FILES_GLOBS } from './pack-for-publish.ts';

/**
 * Every relative import reachable from a packed source file must itself be
 * packed. The `files` globs in package.json decide what ships in the npm
 * tarball; an import whose target is excluded resolves fine in the repo but
 * crashes in a consumer install. This is invisible to unit tests, typecheck,
 * and per-PR Playwright — only the tarball-based consumer fixtures (main-green
 * hydration smoke, release validate:consumer) exercise the packed layout,
 * which is how the 2026-08-04 regression (src/_internal Svelte components
 * missing from `files`) reached main. This test moves that failure class into
 * per-PR CI.
 */

const packageRoot = resolve(import.meta.dir, '..');
const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
  files: string[];
};

const globSets: Array<{ label: string; globs: readonly string[] }> = [
  { label: 'package.json files', globs: packageJson.files },
  { label: 'pack-for-publish PUBLISHED_SOURCE_FILES_GLOBS', globs: PUBLISHED_SOURCE_FILES_GLOBS },
];

const includeGlobs = packageJson.files.filter((entry) => !entry.startsWith('!'));
const excludeGlobs = packageJson.files
  .filter((entry) => entry.startsWith('!'))
  .map((entry) => entry.slice(1));

const includeMatchers = includeGlobs.map((pattern) => new Bun.Glob(pattern));
const excludeMatchers = excludeGlobs.map((pattern) => new Bun.Glob(pattern));

function isPacked(relativePath: string): boolean {
  if (!includeMatchers.some((glob) => glob.match(relativePath))) return false;

  return !excludeMatchers.some((glob) => glob.match(relativePath));
}

function walk(directory: string, collected: string[]): string[] {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      walk(full, collected);
      continue;
    }
    collected.push(full);
  }

  return collected;
}

const importSpecifierPattern = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g;

function resolveRelativeImport(importer: string, specifier: string): string | null {
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.svelte`,
    `${base}.svelte.ts`,
    join(base, 'index.ts'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
}

describe('packed import closure', () => {
  const sourceRoot = join(packageRoot, 'src');
  const allFiles = walk(sourceRoot, []);
  const packedSources = allFiles.filter((file) => {
    if (!/\.(ts|svelte)$/.test(file)) return false;

    return isPacked(relative(packageRoot, file));
  });

  test('collects a non-trivial packed source set', () => {
    expect(packedSources.length).toBeGreaterThan(100);
  });

  test('every relative import from a packed source resolves to a packed file', () => {
    const violations: string[] = [];

    for (const file of packedSources) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(importSpecifierPattern)) {
        const specifier = match[1];
        if (!specifier || specifier.endsWith('.css')) continue;

        const target = resolveRelativeImport(file, specifier);
        if (target === null) continue;

        const targetRelative = relative(packageRoot, target);
        if (!targetRelative.startsWith('src')) continue;
        if (isPacked(targetRelative)) continue;

        violations.push(
          `${relative(packageRoot, file)} imports '${specifier}' -> ${targetRelative}, which the package.json files globs do not pack`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  test('css imports from packed sources are packed too', () => {
    const violations: string[] = [];

    for (const file of packedSources) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(importSpecifierPattern)) {
        const specifier = match[1];
        if (!specifier || !specifier.endsWith('.css')) continue;

        const target = resolve(dirname(file), specifier);
        if (!existsSync(target)) continue;

        const targetRelative = relative(packageRoot, target);
        if (isPacked(targetRelative)) continue;

        violations.push(
          `${relative(packageRoot, file)} imports '${specifier}' -> ${targetRelative}, which the package.json files globs do not pack`,
        );
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('published tarball import closure', () => {
  const sourceRoot = join(packageRoot, 'src');
  for (const { label, globs } of globSets) {
    const include = globs.filter((g) => !g.startsWith('!')).map((g) => new Bun.Glob(g));
    const exclude = globs.filter((g) => g.startsWith('!')).map((g) => new Bun.Glob(g.slice(1)));
    const packed = (relativePath: string) =>
      include.some((g) => g.match(relativePath)) && !exclude.some((g) => g.match(relativePath));

    test(`${label}: every relative import from a packed source resolves to a packed file`, () => {
      const violations: string[] = [];
      const sources = walk(sourceRoot, []).filter((file) => {
        if (!/\.(ts|svelte)$/.test(file)) return false;

        return packed(relative(packageRoot, file));
      });
      for (const file of sources) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(importSpecifierPattern)) {
          const specifier = match[1];
          if (!specifier) continue;

          const target = specifier.endsWith('.css')
            ? existsSync(resolve(dirname(file), specifier))
              ? resolve(dirname(file), specifier)
              : null
            : resolveRelativeImport(file, specifier);
          if (target === null) continue;

          const targetRelative = relative(packageRoot, target);
          if (!targetRelative.startsWith('src')) continue;
          if (packed(targetRelative)) continue;

          violations.push(
            `${relative(packageRoot, file)} imports '${specifier}' -> ${targetRelative}`,
          );
        }
      }
      expect(violations).toEqual([]);
    });
  }
});
