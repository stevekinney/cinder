/**
 * Validates that package.json#exports stays in sync with the component file system.
 *
 * If this test fails, run `bun run exports:generate` to update package.json.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';

import { computeExports } from '../scripts/generate-exports.ts';

const ROOT = join(import.meta.dir, '..');

describe('exports drift', () => {
  test('package.json#exports matches src/components/*.svelte', async () => {
    const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
    const existing = packageJson.exports as Record<string, unknown>;

    // Glob top-level .svelte files (not _internal/).
    const glob = new Glob('src/components/*.svelte');
    const files: string[] = [];
    for await (const file of glob.scan(ROOT)) {
      files.push(file);
    }
    files.sort();

    const expected = computeExports(files);

    // Every expected subpath must be present and match.
    const issues: string[] = [];

    for (const [key, entry] of Object.entries(expected)) {
      const current = existing[key];
      if (!current) {
        issues.push(`Missing subpath export: "${key}" — run bun run exports:generate`);
      } else if (JSON.stringify(current) !== JSON.stringify(entry)) {
        issues.push(`Stale subpath export: "${key}" — run bun run exports:generate`);
      }
    }

    // Orphan entries in package.json with no matching file.
    for (const key of Object.keys(existing)) {
      if (key === '.' || key === './styles') continue;
      if (!(key in expected)) {
        issues.push(
          `Orphan export "${key}" has no matching .svelte file — run bun run exports:generate`,
        );
      }
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

  test('every component .svelte has a matching barrel export in src/index.ts', async () => {
    const barrel = await readFile(join(ROOT, 'src', 'index.ts'), 'utf-8');
    const glob = new Glob('src/components/*.svelte');

    const missing: string[] = [];

    for await (const file of glob.scan(ROOT)) {
      const name = file
        .split('/')
        .pop()!
        .replace(/\.svelte$/, '');
      if (name.startsWith('_')) continue;
      if (!barrel.includes(`from './components/${name}.svelte'`)) {
        missing.push(name);
      }
    }

    expect(missing).toEqual([]);
  });
});
