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

import { computeExports, type ExportEntry } from '../scripts/generate-exports.ts';
import { discoverComponents } from '../scripts/lib/discover-components.ts';

const ROOT = join(import.meta.dir, '..');
const COMPONENTS_ROOT = join(ROOT, 'src', 'components');

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

    const expected = { ...flatExpected, ...directoryExports };

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
    for (const key of Object.keys(existing)) {
      if (key === '.' || key === './styles' || key === './package.json') continue;
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
