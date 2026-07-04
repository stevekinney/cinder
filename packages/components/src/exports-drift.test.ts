/**
 * Validates that package.json#exports stays in sync with the component file system.
 *
 * Two flavors are checked:
 *   1. Migrated components (per-directory) — discovered via `<name>/<name>.svelte`
 *      AND `<name>/<name>.types.ts`. Each contributes `./<name>`, `./<name>/schema`,
 *      and `./<name>/variables` subpaths.
 *   2. Flat (legacy, pre-migration) components — still single `.svelte` files. Each
 *      contributes a single `./<name>` subpath.
 *
 * If this test fails, run `bun run exports:generate` to update package.json.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';

import {
  assertNoForbiddenExportKeys,
  computeDeprecatedExperimentalAliases,
  computeExports,
  computeUpstreamReexports,
  FORBIDDEN_EXPORT_KEY_PATTERN,
  type ExportEntry,
} from '../scripts/generate-exports.ts';
import { deriveUpstreamReexports } from '../scripts/lib/derive-upstream-reexports.ts';
import { discoverComponents } from '../scripts/lib/discover-components.ts';

const ROOT = join(import.meta.dir, '..');
const COMPONENTS_ROOT = join(ROOT, 'src', 'components');
const SUBPATH_ONLY_COMPONENTS = new Set(['markdown-editor', 'review-editor']);

describe('exports drift', () => {
  test('package.json#exports matches src/components/*.svelte', async () => {
    const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
    const existing = packageJson.exports as Record<string, ExportEntry>;

    // 1. Directory-shaped (migrated) components.
    const migrated = await discoverComponents();
    const directoryExports = computeExports(migrated);

    // 2. Flat (legacy) components — every `*.svelte` at top level + experimental that
    //    is NOT also a migrated directory.
    const migratedNames = new Set(
      migrated.map((c) => (c.isExperimental ? `./experimental/${c.name}` : `./${c.name}`)),
    );

    const flatExpected: Record<string, ExportEntry> = {};
    for await (const file of new Glob('src/components/*.svelte').scan(ROOT)) {
      const name = file
        .split('/')
        .pop()!
        .replace(/\.svelte$/, '');
      if (name.startsWith('_')) continue;
      const key = `./${name}`;
      if (migratedNames.has(key)) continue;
      flatExpected[key] = {
        types: `./dist/components/${name}.svelte.d.ts`,
        svelte: `./src/components/${name}.svelte`,
      };
    }
    for await (const file of new Glob('src/components/experimental/*.svelte').scan(ROOT)) {
      const name = file
        .split('/')
        .pop()!
        .replace(/\.svelte$/, '');
      if (name.startsWith('_')) continue;
      const key = `./experimental/${name}`;
      if (migratedNames.has(key)) continue;
      flatExpected[key] = {
        types: `./dist/components/experimental/${name}.svelte.d.ts`,
        svelte: `./src/components/experimental/${name}.svelte`,
      };
    }

    // 3. Upstream re-exports: every public sub-path of the four @cinder/*
    //    workspace packages flows through cinder/<pkg>/* (PR 1).
    const upstreamReexports = await deriveUpstreamReexports();
    const upstreamExports = computeUpstreamReexports(upstreamReexports);

    // 4. Deprecated `./experimental/<name>` aliases for components promoted
    //    out of the experimental tree.
    const deprecatedAliasExports = computeDeprecatedExperimentalAliases();

    const expected = {
      ...flatExpected,
      ...directoryExports,
      ...upstreamExports,
      ...deprecatedAliasExports,
    };

    const issues: string[] = [];
    for (const [key, entry] of Object.entries(expected)) {
      const current = existing[key];
      if (!current) {
        issues.push(`Missing subpath export: "${key}" — run bun run exports:generate`);
      } else if (JSON.stringify(current) !== JSON.stringify(entry)) {
        issues.push(`Stale subpath export: "${key}" — run bun run exports:generate`);
      }
    }

    // Orphan entries — a key in package.json that doesn't match either a flat
    // component or a directory-shaped component.
    const RESERVED = new Set([
      '.',
      './package.json',
      './styles',
      './styles/all',
      './styles/tokens',
      './styles/foundation',
      './styles/utilities',
      './styles/guard',
      './highlighters/shiki',
    ]);
    for (const key of Object.keys(existing)) {
      if (RESERVED.has(key)) continue;
      if (key in expected) continue;
      issues.push(
        `Orphan export "${key}" has no matching component — run bun run exports:generate`,
      );
    }

    expect(issues).toEqual([]);
  });

  test('reserved exports are preserved', async () => {
    const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
    const exports = packageJson.exports as Record<string, unknown>;
    expect(exports['.']).toBeDefined();
    expect(exports['./styles']).toBeDefined();
    expect(exports['./styles/all']).toBeDefined();
    expect(exports['./styles/tokens']).toBeDefined();
    expect(exports['./styles/foundation']).toBeDefined();
    expect(exports['./styles/utilities']).toBeDefined();
    // The slim base points at the layer-order + tokens/foundation/utilities
    // aggregator; the all-in entry points at the full-cascade aggregator.
    // Each CSS-only subpath also carries a `types` condition (first, per
    // nodenext ordering) pointing at an `export {};` stub so a side-effect
    // import typechecks under `moduleResolution: bundler`.
    expect(exports['./styles']).toEqual({
      types: './src/styles/index.css.d.ts',
      default: './src/styles/index.css',
    });
    expect(exports['./styles/all']).toEqual({
      types: './src/styles/all.css.d.ts',
      default: './src/styles/all.css',
    });
  });

  test('checked-in exports contain no forbidden keys', async () => {
    const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
    const exports = packageJson.exports as Record<string, unknown>;
    // Upstream re-export keys like `./editor/test-utilities` are legitimate
    // public sub-paths inherited from `@cinder/editor`'s exports map; they
    // bypass the forbidden-key pattern via an allow-list. The script does
    // the same in production.
    const upstreamReexports = await deriveUpstreamReexports();
    const allowList = new Set(upstreamReexports.map((r) => r.cinderKey));
    expect(() =>
      assertNoForbiddenExportKeys(exports, FORBIDDEN_EXPORT_KEY_PATTERN, allowList),
    ).not.toThrow();
  });

  test('no _internal components appear as export keys', async () => {
    const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
    const exports = packageJson.exports as Record<string, unknown>;

    const internalKeys = Object.keys(exports).filter((k) => {
      const basename = k.replace(/^\.\//, '');
      return basename.startsWith('_');
    });

    expect(internalKeys).toEqual([]);
  });

  test('every component has a matching barrel export in src/index.ts', async () => {
    const barrel = await readFile(join(ROOT, 'src', 'index.ts'), 'utf-8');
    const missing: string[] = [];

    // Migrated components are imported from `./components/<name>/index.ts`.
    const migrated = await discoverComponents();
    for (const component of migrated) {
      if (SUBPATH_ONLY_COMPONENTS.has(component.name)) continue;
      const expectedImport = component.isExperimental
        ? `from './components/experimental/${component.name}/index.ts'`
        : `from './components/${component.name}/index.ts'`;
      if (!barrel.includes(expectedImport)) missing.push(component.name);
    }

    // Flat (legacy) components are imported from `./components/<name>.svelte`.
    const migratedNames = new Set(migrated.map((c) => c.name));
    for await (const file of new Glob('src/components/*.svelte').scan(ROOT)) {
      const name = file
        .split('/')
        .pop()!
        .replace(/\.svelte$/, '');
      if (name.startsWith('_')) continue;
      if (migratedNames.has(name)) continue;
      const dir = join(COMPONENTS_ROOT, name);
      if (existsSync(dir)) continue;
      if (!barrel.includes(`from './components/${name}.svelte'`)) missing.push(name);
    }

    for await (const file of new Glob('src/components/experimental/*.svelte').scan(ROOT)) {
      const name = file
        .split('/')
        .pop()!
        .replace(/\.svelte$/, '');
      if (name.startsWith('_')) continue;
      if (migratedNames.has(name)) continue;
      const dir = join(COMPONENTS_ROOT, 'experimental', name);
      if (existsSync(dir) && existsSync(join(dir, `${name}.types.ts`))) continue;
      if (!barrel.includes(`from './components/experimental/${name}.svelte'`)) {
        missing.push(`experimental/${name}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
