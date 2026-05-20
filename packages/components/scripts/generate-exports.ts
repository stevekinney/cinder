/**
 * Generates subpath exports for every directory-shaped component under
 * `src/components/`. Each component contributes up to six subpaths:
 *
 *   ./<name>             → component (svelte/types conditions)
 *   ./<name>/schema      → schema module (svelte/types conditions)
 *   ./<name>/variables   → variables module (svelte/types conditions)
 *   ./<name>/styles      → layer-unwrapped CSS sidecar (default condition; emitted when CSS exists)
 *   ./<name>/examples    → examples JSON (import/default only; emitted when file exists)
 *   ./<name>/constraints → constraints JSON (import/default only; emitted when file exists)
 *
 * Experimental components export under `./experimental/<name>` etc.
 *
 * Additionally, a package-level `./manifest` entry is emitted pointing at
 * `./components.json` with `import`/`default` conditions only (no `svelte`
 * or `types` — JSON isn't Svelte source and TS resolves JSON via
 * `resolveJsonModule`).
 *
 * Reserved (non-component) entries are preserved verbatim:
 *
 *   .                    → root entry
 *   ./styles             → full-cascade aggregator (tokens + foundation + components + utilities)
 *   ./styles/tokens      → token-layer-only aggregator
 *   ./styles/foundation  → foundation-layer-only aggregator
 *
 * The per-component `/styles` exports emit layer-unwrapped CSS. Consumers using
 * à la carte CSS must also import `cinder/styles/tokens` and
 * `cinder/styles/foundation` to get tokens, resets, and layer assignments.
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
import { join } from 'node:path';

import { discoverComponents, type ComponentDiscovery } from './lib/discover-components.ts';

export type { ComponentDiscovery } from './lib/discover-components.ts';

/**
 * Back-compat alias used by AI-agent-legibility generators that were authored
 * before `discoverComponents` was extracted to `lib/`. New callers should
 * import directly from `./lib/discover-components.ts`.
 */
export const discoverDirectoryComponents = discoverComponents;

export type ExportEntry = {
  svelte?: string;
  types?: string;
  import?: string;
  default?: string;
  node?: string;
};

/** JSON-only export entry: no `svelte` or `types` conditions. */
type JsonExportEntry = {
  import: string;
  default: string;
};

const RESERVED_KEYS = new Set(['.', './styles', './styles/tokens', './styles/foundation']);

/** Default package root used when `computeExports` is called without one. */
const DEFAULT_PACKAGE_ROOT = join(import.meta.dir, '..');

/** Emit the `./manifest` JSON entry pointing at `./components.json`. */
function manifestExport(): JsonExportEntry {
  return { import: './components.json', default: './components.json' };
}

/** Build a JSON-only export entry for a per-component sidecar file. */
function jsonSidecarExport(filePath: string): JsonExportEntry {
  return { import: filePath, default: filePath };
}

export function computeExports(
  components: ComponentDiscovery[],
  packageRoot: string = DEFAULT_PACKAGE_ROOT,
): Record<string, ExportEntry | JsonExportEntry> {
  const out: Record<string, ExportEntry | JsonExportEntry> = {};

  // Package-level manifest entry (always present).
  out['./manifest'] = manifestExport();

  for (const { name, isExperimental, hasCss } of components) {
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
    // Per-component CSS sidecar — layer-unwrapped. Consumers using these
    // à la carte must also import `cinder/styles/tokens` and
    // `cinder/styles/foundation` to get tokens, resets, and layer assignments.
    // Gated on `hasCss` to avoid publishing dead exports for components
    // without a `<name>.css` file.
    if (hasCss) {
      out[`${prefix}/styles`] = {
        default: `${distDir}/${name}.css`,
      };
    }

    // JSON sidecar subpaths — emitted only when the file exists on disk.
    // Uses import+default conditions only (no svelte/types).
    const examplesJsonPath = join(
      packageRoot,
      'src',
      'components',
      ...(isExperimental ? ['experimental', name] : [name]),
      `${name}.examples.json`,
    );
    if (existsSync(examplesJsonPath)) {
      const relPath = `${srcDir}/${name}.examples.json`;
      out[`${prefix}/examples`] = jsonSidecarExport(relPath);
    }

    const constraintsJsonPath = join(
      packageRoot,
      'src',
      'components',
      ...(isExperimental ? ['experimental', name] : [name]),
      `${name}.constraints.json`,
    );
    if (existsSync(constraintsJsonPath)) {
      const relPath = `${srcDir}/${name}.constraints.json`;
      out[`${prefix}/constraints`] = jsonSidecarExport(relPath);
    }
  }

  return out;
}

interface PackageJson {
  exports: Record<string, ExportEntry | JsonExportEntry>;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');
  const packageJsonPath = join(import.meta.dir, '..', 'package.json');
  const packageJson = (await Bun.file(packageJsonPath).json()) as PackageJson;

  const components = await discoverComponents();
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
  const next: Record<string, ExportEntry | JsonExportEntry> = {};
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
    if (
      key.endsWith('/schema') ||
      key.endsWith('/variables') ||
      key.endsWith('/styles') ||
      key.endsWith('/examples') ||
      key.endsWith('/constraints')
    )
      continue;
    if (key === './manifest') continue;
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
