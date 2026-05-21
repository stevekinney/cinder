/**
 * Generates subpath exports for every directory-shaped component under
 * `src/components/`. Each component contributes up to six subpaths:
 *
 *   ./<name>             → component (types/svelte/node/default conditions)
 *   ./<name>/schema      → schema module (types + svelte only)
 *   ./<name>/variables   → variables module (types + svelte only)
 *   ./<name>/styles      → layer-unwrapped CSS sidecar (default condition; emitted when the component ships a source <name>.css)
 *   ./<name>/examples    → examples JSON (import/default only; emitted when file exists)
 *   ./<name>/constraints → constraints JSON (import/default only; emitted when file exists)
 *
 * Experimental components export under `./experimental/<name>` etc.
 *
 * Condition ordering for component subpaths follows TypeScript `nodenext`
 * requirements: `types` MUST be first within any conditional object, followed
 * by `svelte` (source for Svelte-aware tooling), `node` (per-component SSR
 * build), and `default` (per-component browser ESM build) last.
 *
 * Additionally, a package-level `./manifest` entry is emitted pointing at
 * `./components.json` with `import`/`default` conditions only (no `svelte` or
 * `types` — JSON isn't Svelte source and TS resolves JSON via
 * `resolveJsonModule`).
 *
 * Reserved (non-component) entries are preserved verbatim:
 *
 *   .                    → root entry (also rewritten with the four-condition shape)
 *   ./package.json       → self-export, required for some resolvers
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
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  cinderExportEntry,
  deriveUpstreamReexports,
  reexportFileBody,
  reexportSourceAbsolutePath,
  type UpstreamReexport,
} from './lib/derive-upstream-reexports.ts';
import { discoverComponents, type ComponentDiscovery } from './lib/discover-components.ts';

export type { ComponentDiscovery } from './lib/discover-components.ts';

/**
 * Back-compat alias used by AI-agent-legibility generators that were authored
 * before `discoverComponents` was extracted to `lib/`. New callers should
 * import directly from `./lib/discover-components.ts`.
 */
export const discoverDirectoryComponents = discoverComponents;

export type ExportEntry = {
  types?: string;
  svelte?: string;
  import?: string;
  node?: string;
  default?: string;
};

/** JSON-only export entry: no `svelte` or `types` conditions. */
type JsonExportEntry = {
  import: string;
  default: string;
};

const STYLES_KEY = './styles';
const STYLES_TOKENS_KEY = './styles/tokens';
const STYLES_FOUNDATION_KEY = './styles/foundation';
const ROOT_KEY = '.';
const PACKAGE_JSON_KEY = './package.json';

/**
 * Keys that the generator owns at the top level but never emits via
 * {@link computeExports}. They are stitched in by {@link main} so the final
 * exports map keeps them and the generator never overwrites them with a
 * computed value.
 */
const RESERVED_KEYS = new Set([
  ROOT_KEY,
  STYLES_KEY,
  STYLES_TOKENS_KEY,
  STYLES_FOUNDATION_KEY,
  PACKAGE_JSON_KEY,
]);

/**
 * The exports map must never contain entries whose key contains a forbidden
 * path segment. CI enforces this as a hard guard against accidentally
 * shipping debug, scratch, or test-only subpaths.
 *
 * Anchored on `/` boundaries so legitimate component names that merely
 * contain a forbidden substring (e.g. `./template`, `./temporal`,
 * `./testament`) are NOT rejected. Matches a segment that:
 *   - starts with `__` followed by any word/hyphen characters, OR
 *   - is exactly `test`, `temp`, or `scratch`, with an optional
 *     kebab-case suffix (e.g. `test-helpers`).
 *
 * See {@link assertNoForbiddenExportKeys}.
 */
export const FORBIDDEN_EXPORT_KEY_PATTERN =
  /(?:^|\/)(?:__[\w-]*|(?:test|temp|scratch)(?:-[\w-]*)?)(?:\/|$)/i;

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

/**
 * Compute the cinder-side exports entries for every public sub-path of the
 * four `@cinder/*` workspace packages. Each entry mirrors the four-condition
 * shape used by component sub-paths so in-repo Svelte tooling resolves the
 * generated `.ts` source while published consumers resolve `dist/`.
 */
export function computeUpstreamReexports(
  reexports: UpstreamReexport[],
): Record<string, ExportEntry> {
  const out: Record<string, ExportEntry> = {};
  for (const reexport of reexports) {
    out[reexport.cinderKey] = orderedExportEntry(cinderExportEntry(reexport));
  }
  return out;
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

    // Per-component CSS sidecar — layer-unwrapped. Consumers using these
    // à la carte must also import `cinder/styles/tokens` and
    // `cinder/styles/foundation` to get tokens, resets, and layer assignments.
    //
    // Only emitted when the component ships a source CSS sidecar — emitting
    // `/styles` for a component without CSS would publish a dead export
    // pointing at a non-existent dist artifact.
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

/**
 * The published exports map must never include keys that look like debug,
 * scratch, or test-only subpaths. Throws on the first offender so CI fails
 * with a clear message.
 */
export function assertNoForbiddenExportKeys(
  exportsMap: Record<string, unknown>,
  pattern: RegExp = FORBIDDEN_EXPORT_KEY_PATTERN,
  allowList: ReadonlySet<string> = new Set(),
): void {
  for (const key of Object.keys(exportsMap)) {
    if (allowList.has(key)) continue;
    if (pattern.test(key)) {
      throw new Error(
        `Forbidden exports key "${key}" matches /${pattern.source}/${pattern.flags} — refusing to publish`,
      );
    }
  }
}

interface PackageJson {
  exports: Record<string, ExportEntry | JsonExportEntry | string>;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');
  const packageJsonPath = join(import.meta.dir, '..', 'package.json');
  const packageJson = (await Bun.file(packageJsonPath).json()) as PackageJson;

  // Derive upstream re-exports first so the forbidden-key guard knows which
  // keys are legitimate even when they contain segments like `test-utilities`
  // (a public `@cinder/editor` sub-path) that would otherwise trip the
  // pattern.
  const upstreamReexports = await deriveUpstreamReexports();
  const upstreamAllowList = new Set(upstreamReexports.map((r) => r.cinderKey));

  // First gate: surface any forbidden keys already on disk BEFORE we filter
  // or rewrite anything. Otherwise generate mode would silently drop a key
  // like `./__debug` during regeneration and never raise it as a violation.
  // Track 3 requires the guard to fire in both check and generate modes.
  assertNoForbiddenExportKeys(packageJson.exports, FORBIDDEN_EXPORT_KEY_PATTERN, upstreamAllowList);

  const components = await discoverComponents();
  const componentComputed = computeExports(components);
  const upstreamComputed = computeUpstreamReexports(upstreamReexports);
  const computed: Record<string, ExportEntry | JsonExportEntry> = {
    ...componentComputed,
    ...upstreamComputed,
  };
  const rootExport = computeRootExport();

  // Collision check: any computed subpath that collides with a reserved
  // entry aborts. We never silently overwrite.
  for (const key of Object.keys(computed)) {
    if (RESERVED_KEYS.has(key)) {
      process.stderr.write(`exports collision: computed key "${key}" overlaps a reserved entry\n`);
      process.exit(1);
    }
  }

  // Component sub-paths and upstream re-export sub-paths must not collide
  // (e.g. a component named `markdown` would clash with the `./markdown`
  // upstream entry). Surface as a hard error rather than silently
  // overwriting one with the other.
  for (const key of Object.keys(upstreamComputed)) {
    if (key in componentComputed) {
      process.stderr.write(
        `exports collision: upstream re-export "${key}" overlaps a component sub-path\n`,
      );
      process.exit(1);
    }
  }

  if (checkMode) {
    const existing = packageJson.exports;
    const issues: string[] = [];

    // Drift check: every generated re-export source file must exist on disk
    // and match the canonical body.
    for (const reexport of upstreamReexports) {
      const filePath = reexportSourceAbsolutePath(reexport);
      if (!existsSync(filePath)) {
        issues.push(`Missing upstream re-export source: ${filePath}`);
        continue;
      }
      const expectedBody = reexportFileBody(reexport.upstreamSpecifier);
      const actualBody = await readFile(filePath, 'utf8');
      if (actualBody !== expectedBody) {
        issues.push(`Stale upstream re-export source: ${filePath}`);
      }
    }

    // Root entry: must match the four-condition ordered shape exactly.
    if (!existing[ROOT_KEY]) {
      issues.push(`Reserved export "${ROOT_KEY}" is missing`);
    } else if (JSON.stringify(existing[ROOT_KEY]) !== JSON.stringify(rootExport)) {
      issues.push(`Stale root export "${ROOT_KEY}"`);
    }

    if (!existing[STYLES_KEY]) issues.push(`Reserved export "${STYLES_KEY}" is missing`);
    if (!existing[STYLES_TOKENS_KEY]) {
      issues.push(`Reserved export "${STYLES_TOKENS_KEY}" is missing`);
    }
    if (!existing[STYLES_FOUNDATION_KEY]) {
      issues.push(`Reserved export "${STYLES_FOUNDATION_KEY}" is missing`);
    }

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

    // The forbidden-key guard already ran at the top of main() against
    // packageJson.exports; we don't need to repeat it here.

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
  //   4. computed component subpaths (incl. /examples, /constraints when present)
  //   5. preserved legacy flat component subpaths (partial-migration window)
  const next: Record<string, ExportEntry | JsonExportEntry | string> = {};
  next[ROOT_KEY] = rootExport;
  next[PACKAGE_JSON_KEY] = './package.json';
  if (packageJson.exports[STYLES_KEY]) next[STYLES_KEY] = packageJson.exports[STYLES_KEY];
  if (packageJson.exports[STYLES_TOKENS_KEY]) {
    next[STYLES_TOKENS_KEY] = packageJson.exports[STYLES_TOKENS_KEY];
  }
  if (packageJson.exports[STYLES_FOUNDATION_KEY]) {
    next[STYLES_FOUNDATION_KEY] = packageJson.exports[STYLES_FOUNDATION_KEY];
  }

  // Preserve legacy flat component subpaths whose component still exists as
  // a flat .svelte file (not yet migrated to a directory).
  const migratedNames = new Set(
    components.map((c) => (c.isExperimental ? `./experimental/${c.name}` : `./${c.name}`)),
  );
  const legacy: Record<string, ExportEntry | JsonExportEntry | string> = {};
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
    if (flatPattern.test(key)) legacy[key] = entry;
  }

  for (const [key, entry] of Object.entries(computed)) {
    next[key] = entry;
  }
  for (const [key, entry] of Object.entries(legacy)) {
    next[key] = entry;
  }

  assertNoForbiddenExportKeys(next, FORBIDDEN_EXPORT_KEY_PATTERN, upstreamAllowList);

  packageJson.exports = next;
  await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  // Emit (or refresh) the generated re-export source files. They are part of
  // the exports contract — drift detection lives in --check mode above.
  for (const reexport of upstreamReexports) {
    const filePath = reexportSourceAbsolutePath(reexport);
    await mkdir(dirname(filePath), { recursive: true });
    await Bun.write(filePath, reexportFileBody(reexport.upstreamSpecifier));
  }

  process.stdout.write(
    `exports:generate — wrote ${Object.keys(computed).length} computed subpaths ` +
      `(${components.length} components, ${upstreamReexports.length} upstream re-exports)\n`,
  );
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error('generate-exports failed:', err);
    process.exit(1);
  });
}
