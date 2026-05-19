/**
 * Generates subpath exports for every directory-shaped component under
 * `src/components/`. Each component contributes three subpaths:
 *
 *   ./<name>            → component (svelte/types conditions)
 *   ./<name>/schema     → schema module (svelte/types conditions)
 *   ./<name>/variables  → variables module (svelte/types conditions)
 *
 * Experimental components export under `./experimental/<name>` etc.
 *
 * Reserved (non-component) entries are preserved verbatim from a hard-coded
 * allowlist snapshotted from today's manifest:
 *
 *   .          → root entry
 *   ./styles   → public styles entry
 *
 * If a newly-emitted subpath would collide with a non-generated reserved
 * entry, the generator aborts with a named error rather than silently
 * overwriting.
 *
 * Run with `bun run exports:generate` to update package.json (mutates the file).
 * Run with `bun run exports:check` to verify there is no drift — exits non-zero on drift.
 *
 * Flat (non-directory) components are NOT discovered; this generator only
 * operates on the new per-directory layout. Phase 3 of the migration will
 * land the remaining directory-shaped components.
 */

import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type ExportEntry = {
  svelte?: string;
  types?: string;
  default?: string;
  node?: string;
};

const RESERVED_KEYS = new Set(['.', './styles']);

export interface ComponentDiscovery {
  name: string;
  isExperimental: boolean;
}

const COMPONENTS_ROOT = join(import.meta.dir, '..', 'src', 'components');

export async function discoverDirectoryComponents(): Promise<ComponentDiscovery[]> {
  const result: ComponentDiscovery[] = [];
  for (const entry of await readdir(COMPONENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    if (entry.name === 'icons') continue;

    if (entry.name === 'experimental') {
      const experimentalRoot = join(COMPONENTS_ROOT, 'experimental');
      for (const subEntry of await readdir(experimentalRoot, { withFileTypes: true })) {
        if (!subEntry.isDirectory()) continue;
        if (subEntry.name.startsWith('_')) continue;
        const dir = join(experimentalRoot, subEntry.name);
        if (!existsSync(join(dir, `${subEntry.name}.svelte`))) continue;
        if (!existsSync(join(dir, `${subEntry.name}.types.ts`))) continue;
        result.push({ name: subEntry.name, isExperimental: true });
      }
      continue;
    }

    const dir = join(COMPONENTS_ROOT, entry.name);
    if (!existsSync(join(dir, `${entry.name}.svelte`))) continue;
    if (!existsSync(join(dir, `${entry.name}.types.ts`))) continue;
    result.push({ name: entry.name, isExperimental: false });
  }
  return result.toSorted((a, b) => {
    if (a.isExperimental !== b.isExperimental) return a.isExperimental ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function computeExports(components: ComponentDiscovery[]): Record<string, ExportEntry> {
  const out: Record<string, ExportEntry> = {};

  for (const { name, isExperimental } of components) {
    const prefix = isExperimental ? `./experimental/${name}` : `./${name}`;
    const srcDir = isExperimental
      ? `./src/components/experimental/${name}`
      : `./src/components/${name}`;
    const distDir = isExperimental
      ? `./dist/components/experimental/${name}`
      : `./dist/components/${name}`;

    // Hybrid contract preserved from the legacy flat components: `svelte`
    // condition resolves to source for Vite/Svelte bundlers; `types` resolves
    // to built declarations for TypeScript. This intentionally matches the
    // pre-migration shape; downstream tooling that needs raw source must opt
    // in via `--conditions svelte` (the project does so in `bun test` and
    // similar entry points).
    out[prefix] = {
      svelte: `${srcDir}/index.ts`,
      types: `${distDir}/index.d.ts`,
    };
    out[`${prefix}/schema`] = {
      svelte: `${srcDir}/${name}.schema.ts`,
      types: `${distDir}/${name}.schema.d.ts`,
    };
    out[`${prefix}/variables`] = {
      svelte: `${srcDir}/${name}.variables.ts`,
      types: `${distDir}/${name}.variables.d.ts`,
    };
  }

  return out;
}

interface PackageJson {
  exports: Record<string, ExportEntry>;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');
  const packageJsonPath = join(import.meta.dir, '..', 'package.json');
  const packageJson = (await Bun.file(packageJsonPath).json()) as PackageJson;

  const components = await discoverDirectoryComponents();
  const computed = computeExports(components);

  // Collision check: any computed subpath that collides with a non-component
  // reserved entry aborts. We never silently overwrite.
  for (const key of Object.keys(computed)) {
    if (RESERVED_KEYS.has(key)) {
      process.stderr.write(`exports collision: computed key "${key}" overlaps a reserved entry\n`);
      process.exit(1);
    }
  }

  if (checkMode) {
    const existing = packageJson.exports;
    const issues: string[] = [];

    for (const key of RESERVED_KEYS) {
      if (!existing[key]) issues.push(`Reserved export "${key}" is missing`);
    }

    for (const [key, entry] of Object.entries(computed)) {
      const current = existing[key];
      if (!current) {
        issues.push(`Missing subpath export: "${key}"`);
      } else if (JSON.stringify(current) !== JSON.stringify(entry)) {
        issues.push(`Stale subpath export: "${key}"`);
      }
    }

    for (const key of Object.keys(existing)) {
      if (RESERVED_KEYS.has(key)) continue;
      if (key in computed) continue;
      // Pre-migration flat component subpath that hasn't been migrated yet —
      // leave it alone during the partial-migration window. The check is
      // intentionally non-strict here.
      const flatPattern = /^\.\/(experimental\/)?[a-z][a-z0-9-]*$/;
      if (flatPattern.test(key)) continue;
      issues.push(`Orphan subpath export: "${key}"`);
    }

    if (issues.length > 0) {
      process.stderr.write(
        'exports:check — drift detected. Run `bun run exports:generate` to fix:\n',
      );
      for (const issue of issues) process.stderr.write(`  • ${issue}\n`);
      process.exit(1);
    }

    process.stdout.write('exports:check — OK\n');
    return;
  }

  // Generate mode: preserve reserved entries, replace computed entries,
  // preserve any flat (legacy) component entries that have not yet been
  // migrated. This is the partial-migration phase.
  const next: Record<string, ExportEntry> = {};
  for (const key of RESERVED_KEYS) {
    if (packageJson.exports[key]) next[key] = packageJson.exports[key];
  }

  // Preserve legacy flat component subpaths whose component still exists as
  // a flat .svelte file (not yet migrated to a directory).
  const migratedNames = new Set(
    components.map((c) => (c.isExperimental ? `./experimental/${c.name}` : `./${c.name}`)),
  );
  for (const [key, entry] of Object.entries(packageJson.exports)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (migratedNames.has(key)) continue;
    if (key.endsWith('/schema') || key.endsWith('/variables')) continue;
    const flatPattern = /^\.\/(experimental\/)?[a-z][a-z0-9-]*$/;
    if (flatPattern.test(key)) next[key] = entry;
  }

  for (const [key, entry] of Object.entries(computed)) {
    next[key] = entry;
  }

  packageJson.exports = next;
  await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  process.stdout.write(
    `exports:generate — wrote ${Object.keys(computed).length} computed subpaths (${components.length} components)\n`,
  );
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error('generate-exports failed:', err);
    process.exit(1);
  });
}
