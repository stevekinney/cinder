/**
 * Generates subpath exports for every directory-shaped component under
 * `src/components/`. Each component contributes three subpaths:
 *
 *   ./<name>            → component (types/svelte/node/default conditions)
 *   ./<name>/schema     → schema module (svelte + types only)
 *   ./<name>/variables  → variables module (svelte + types only)
 *
 * Experimental components export under `./experimental/<name>` etc.
 *
 * Condition ordering follows TypeScript `nodenext` requirements: `types` MUST
 * be first within any conditional object, followed by `svelte` (source for
 * Svelte-aware tooling), `node` (per-component SSR build), and `default`
 * (per-component browser ESM build) last.
 *
 * Reserved (non-component) entries are preserved verbatim from a hard-coded
 * allowlist snapshotted from today's manifest:
 *
 *   .              → root entry (also rewritten with the four-condition shape)
 *   ./styles       → public styles entry
 *   ./package.json → self-export, required for some resolvers
 *
 * If a newly-emitted subpath would collide with a non-generated reserved
 * entry, the generator aborts with a named error rather than silently
 * overwriting.
 *
 * Run with `bun run exports:generate` to update package.json (mutates the file).
 * Run with `bun run exports:check` to verify there is no drift — exits non-zero on drift.
 */

import { join } from 'node:path';

import { discoverComponents, type ComponentDiscovery } from './lib/discover-components.ts';

export type ExportEntry = {
  types?: string;
  svelte?: string;
  node?: string;
  default?: string;
};

const STYLES_KEY = './styles';
const ROOT_KEY = '.';
const PACKAGE_JSON_KEY = './package.json';

/**
 * Keys that the generator owns at the top level but never emits via
 * {@link computeExports}. They are stitched in by {@link main} so the final
 * exports map keeps them and the generator never overwrites them with a
 * computed value.
 */
const RESERVED_KEYS = new Set([ROOT_KEY, STYLES_KEY, PACKAGE_JSON_KEY]);

/**
 * The exports map must never contain entries whose key matches this pattern.
 * CI enforces this as a hard guard against accidentally shipping debug,
 * scratch, or test-only subpaths. See {@link assertNoForbiddenExportKeys}.
 */
export const FORBIDDEN_EXPORT_KEY_PATTERN = /__|test|temp|scratch/i;

/**
 * Reorders an export entry into the strict order required by TypeScript
 * `nodenext` resolution and our resolver matrix:
 *
 *   1. `types`
 *   2. `svelte`
 *   3. `node`
 *   4. `default`
 *
 * Returns a fresh object so callers can rely on JSON.stringify output order.
 */
export function orderedExportEntry(entry: ExportEntry): ExportEntry {
  const out: ExportEntry = {};
  if (entry.types !== undefined) out.types = entry.types;
  if (entry.svelte !== undefined) out.svelte = entry.svelte;
  if (entry.node !== undefined) out.node = entry.node;
  if (entry.default !== undefined) out.default = entry.default;
  return out;
}

/**
 * Builds the root `.` export entry. The root barrel is the only entry whose
 * `node` target points at the preserved single-file server bundle Track 4
 * left in place (`dist/server/index.js`); everything else points at the
 * per-component output.
 */
export function computeRootExport(): ExportEntry {
  return orderedExportEntry({
    types: './dist/index.d.ts',
    svelte: './src/index.ts',
    node: './dist/server/index.js',
    default: './dist/index.js',
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
    const serverDistDir = isExperimental
      ? `./dist/server/components/experimental/${name}`
      : `./dist/server/components/${name}`;

    // Component subpath: full four-condition shape. `types` first for
    // TypeScript `nodenext`, `svelte` second so Svelte-aware tooling
    // (SvelteKit, svelte-preprocess consumers) gets source, `node` third so
    // Node SSR without Svelte tooling gets the SSR build, `default` last as
    // the catch-all for Vite/Rollup/esbuild/Webpack/Bun browser bundles.
    out[prefix] = orderedExportEntry({
      types: `${distDir}/index.d.ts`,
      svelte: `${srcDir}/index.ts`,
      node: `${serverDistDir}/index.js`,
      default: `${distDir}/index.js`,
    });

    // Schema and variables modules ship as source + types only. They are
    // metadata, not runtime entry points; no JS is emitted for them so we
    // intentionally do not add `node`/`default` here.
    out[`${prefix}/schema`] = orderedExportEntry({
      types: `${distDir}/${name}.schema.d.ts`,
      svelte: `${srcDir}/${name}.schema.ts`,
    });
    out[`${prefix}/variables`] = orderedExportEntry({
      types: `${distDir}/${name}.variables.d.ts`,
      svelte: `${srcDir}/${name}.variables.ts`,
    });
  }

  return out;
}

/**
 * The published exports map must never include keys that look like debug,
 * scratch, or test-only subpaths. Throws on the first offender so CI fails
 * with a clear message.
 */
export function assertNoForbiddenExportKeys(
  exportsMap: Record<string, unknown>,
  pattern: RegExp = FORBIDDEN_EXPORT_KEY_PATTERN,
): void {
  for (const key of Object.keys(exportsMap)) {
    if (pattern.test(key)) {
      throw new Error(
        `Forbidden exports key "${key}" matches /${pattern.source}/${pattern.flags} — refusing to publish`,
      );
    }
  }
}

interface PackageJson {
  exports: Record<string, ExportEntry | string>;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');
  const packageJsonPath = join(import.meta.dir, '..', 'package.json');
  const packageJson = (await Bun.file(packageJsonPath).json()) as PackageJson;

  const components = await discoverComponents();
  const computed = computeExports(components);
  const rootExport = computeRootExport();

  // Collision check: any computed subpath that collides with a reserved
  // entry aborts. We never silently overwrite.
  for (const key of Object.keys(computed)) {
    if (RESERVED_KEYS.has(key)) {
      process.stderr.write(`exports collision: computed key "${key}" overlaps a reserved entry\n`);
      process.exit(1);
    }
  }

  if (checkMode) {
    const existing = packageJson.exports;
    const issues: string[] = [];

    // Root entry: must match the four-condition ordered shape exactly.
    if (!existing[ROOT_KEY]) {
      issues.push(`Reserved export "${ROOT_KEY}" is missing`);
    } else if (JSON.stringify(existing[ROOT_KEY]) !== JSON.stringify(rootExport)) {
      issues.push(`Stale root export "${ROOT_KEY}"`);
    }

    if (!existing[STYLES_KEY]) issues.push(`Reserved export "${STYLES_KEY}" is missing`);

    if (existing[PACKAGE_JSON_KEY] !== './package.json') {
      issues.push(`Missing or stale self-export "${PACKAGE_JSON_KEY}"`);
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

    try {
      assertNoForbiddenExportKeys(existing);
    } catch (error) {
      issues.push((error as Error).message);
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

  // Generate mode: build the next exports map in deterministic order:
  //   1. `.` (root, four-condition shape)
  //   2. `./package.json` self-export
  //   3. `./styles` (preserved verbatim)
  //   4. computed component subpaths
  //   5. preserved legacy flat component subpaths (partial-migration window)
  const next: Record<string, ExportEntry | string> = {};
  next[ROOT_KEY] = rootExport;
  next[PACKAGE_JSON_KEY] = './package.json';
  if (packageJson.exports[STYLES_KEY]) next[STYLES_KEY] = packageJson.exports[STYLES_KEY];

  // Preserve legacy flat component subpaths whose component still exists as
  // a flat .svelte file (not yet migrated to a directory).
  const migratedNames = new Set(
    components.map((c) => (c.isExperimental ? `./experimental/${c.name}` : `./${c.name}`)),
  );
  const legacy: Record<string, ExportEntry | string> = {};
  for (const [key, entry] of Object.entries(packageJson.exports)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (migratedNames.has(key)) continue;
    if (key.endsWith('/schema') || key.endsWith('/variables')) continue;
    const flatPattern = /^\.\/(experimental\/)?[a-z][a-z0-9-]*$/;
    if (flatPattern.test(key)) legacy[key] = entry;
  }

  for (const [key, entry] of Object.entries(computed)) {
    next[key] = entry;
  }
  for (const [key, entry] of Object.entries(legacy)) {
    next[key] = entry;
  }

  assertNoForbiddenExportKeys(next);

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
