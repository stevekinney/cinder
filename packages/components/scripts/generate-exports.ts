/**
 * Generates subpath exports for every directory-shaped component under
 * `src/components/`. Each component contributes up to six subpaths:
 *
 *   ./<name>             → component (types/svelte/node/default conditions)
 *   ./<name>/schema      → schema module (types/svelte/node/default conditions)
 *   ./<name>/variables   → variables module (types/svelte/node/default conditions)
 *   ./<name>/styles      → layer-wrapped CSS sidecar (default condition; emitted when the component ships a source <name>.css). Compound parents (tabs/table/accordion/side-navigation) @import their leaves' sidecars so the family arrives together.
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
 *   ./styles             → slim base: layer-order declaration + tokens + foundation + shared internals + utilities (NO per-component CSS)
 *   ./styles/all         → full-cascade convenience aggregator (base + EVERY component, not tree-shaken)
 *   ./styles/tokens      → token-layer-only aggregator
 *   ./styles/foundation  → foundation-layer-only aggregator
 *   ./styles/utilities   → utility-layer-only aggregator
 *   ./styles/guard       → dev-only base-loaded guard (warns once when cinder/styles is not imported first)
 *
 * The per-component `/styles` exports ship layer-WRAPPED CSS (every sidecar
 * self-declares `@layer cinder.components { … }`), so a direct
 * `cinder/<name>/styles` import lands inside the cascade layer. Consumers must
 * still import `cinder/styles` FIRST so the `@layer` order is declared before
 * any per-component CSS arrives; otherwise layer priority is set by insertion
 * order.
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
import { readJsonFile } from './lib/read-json-file.ts';

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
const STYLES_ALL_KEY = './styles/all';
const STYLES_TOKENS_KEY = './styles/tokens';
const STYLES_FOUNDATION_KEY = './styles/foundation';
const STYLES_UTILITIES_KEY = './styles/utilities';
const STYLES_GUARD_KEY = './styles/guard';
const ROOT_KEY = '.';
const PACKAGE_JSON_KEY = './package.json';
const HIGHLIGHTERS_SHIKI_KEY = './highlighters/shiki';

/**
 * Keys that the generator owns at the top level but never emits via
 * {@link computeExports}. They are stitched in by {@link main} so the final
 * exports map keeps them and the generator never overwrites them with a
 * computed value.
 */
const RESERVED_KEYS = new Set([
  ROOT_KEY,
  STYLES_KEY,
  STYLES_ALL_KEY,
  STYLES_TOKENS_KEY,
  STYLES_FOUNDATION_KEY,
  STYLES_UTILITIES_KEY,
  STYLES_GUARD_KEY,
  PACKAGE_JSON_KEY,
  HIGHLIGHTERS_SHIKI_KEY,
]);

/**
 * The five hand-authored `cinder/styles*` subpaths and their canonical CSS
 * targets. These are reserved (never computed from component discovery) and
 * emitted/checked verbatim. Ordered base-first so the generated exports map
 * lists the base entry point before its variants.
 */
const RESERVED_STYLES_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  [STYLES_KEY, './src/styles/index.css'],
  [STYLES_ALL_KEY, './src/styles/all.css'],
  [STYLES_TOKENS_KEY, './src/styles/tokens.css'],
  [STYLES_FOUNDATION_KEY, './src/styles/foundation.css'],
  [STYLES_UTILITIES_KEY, './src/styles/utilities.css'],
];

/** Canonical `{ default: <css> }` entry for a reserved styles subpath. */
function stylesExport(cssPath: string): ExportEntry {
  return { default: cssPath };
}

/**
 * Canonical four-condition entry for `cinder/highlighters/shiki`. Hand-shaped
 * because the adapter is a single static sub-path (not a discovered component
 * and not an upstream re-export); the generator stitches this in alongside
 * the styles entries.
 */
function highlightersShikiExport(): ExportEntry {
  return orderedExportEntry({
    types: './dist/highlighters/shiki/index.d.ts',
    svelte: './src/highlighters/shiki/index.ts',
    node: './dist/server/highlighters/shiki/index.js',
    default: './dist/highlighters/shiki/index.js',
  });
}

/**
 * Canonical four-condition entry for `cinder/styles/guard`. This is the
 * dev-only base-loaded guard module: it warns once in browser + dev environments
 * when a per-component CSS subpath is imported without first importing
 * `cinder/styles`. The guard is stripped by any bundler that performs constant
 * folding on `esm-env`'s `DEV` and `BROWSER` constants.
 */
export function stylesGuardExport(): ExportEntry {
  return orderedExportEntry({
    types: './dist/styles/base-guard.d.ts',
    svelte: './src/styles/base-guard.ts',
    node: './dist/server/styles/base-guard.js',
    default: './dist/styles/base-guard.js',
  });
}

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
 * Components promoted out of `src/components/experimental/<name>/` into the
 * main tree that must keep their old `cinder/experimental/<name>` import paths
 * working as deprecated aliases for one major version.
 *
 * Each entry keeps a thin shim at `src/components/experimental/<name>/index.ts`
 * that re-exports the promoted component and emits a one-time dev warning. The
 * `./experimental/<name>` export resolves to that shim; the metadata subpaths
 * (`/schema`, `/variables`, `/styles`, `/examples`) resolve to the promoted
 * component's new location since those files moved with it.
 *
 * Remove an entry — and delete its shim directory — when the deprecation
 * window closes.
 */
export type DeprecatedExperimentalAlias = {
  /** Kebab-case component name (its new, non-experimental directory name). */
  name: string;
  /** True when the promoted component ships a CSS sidecar (`./experimental/<name>/styles`). */
  hasCss: boolean;
  /** True when the promoted component ships an examples sidecar (`./experimental/<name>/examples`). */
  hasExamples: boolean;
};

export const DEPRECATED_EXPERIMENTAL_ALIASES: readonly DeprecatedExperimentalAlias[] = [
  { name: 'connection-indicator', hasCss: true, hasExamples: false },
  { name: 'json-viewer', hasCss: true, hasExamples: false },
  { name: 'message', hasCss: true, hasExamples: false },
  { name: 'timeline', hasCss: true, hasExamples: true },
  { name: 'timeline-item', hasCss: true, hasExamples: false },
];

/**
 * Compute the deprecated `./experimental/<name>` alias entries for components
 * promoted into the main tree. The component entry resolves to the shim under
 * `src/components/experimental/<name>/` (so the dev warning fires); every
 * metadata subpath resolves to the promoted component's new location.
 */
export function computeDeprecatedExperimentalAliases(
  aliases: readonly DeprecatedExperimentalAlias[] = DEPRECATED_EXPERIMENTAL_ALIASES,
): Record<string, ExportEntry | JsonExportEntry> {
  const out: Record<string, ExportEntry | JsonExportEntry> = {};

  for (const { name, hasCss, hasExamples } of aliases) {
    const aliasPrefix = `./experimental/${name}`;
    const shimSrcDir = `./src/components/experimental/${name}`;
    const shimDistDir = `./dist/components/experimental/${name}`;
    const shimServerDistDir = `./dist/server/components/experimental/${name}`;
    // Metadata files (schema/variables/styles/examples) moved with the
    // component, so they resolve at the promoted (non-experimental) location.
    const newSrcDir = `./src/components/${name}`;
    const newDistDir = `./dist/components/${name}`;
    const newServerDistDir = `./dist/server/components/${name}`;

    out[aliasPrefix] = orderedExportEntry({
      types: `${shimDistDir}/index.d.ts`,
      svelte: `${shimSrcDir}/index.ts`,
      node: `${shimServerDistDir}/index.js`,
      default: `${shimDistDir}/index.js`,
    });

    // Schema/variables are runtime entry points (see computeExports). The
    // promoted component's `<name>.schema.ts` / `.variables.ts` are compiled by
    // the build at the non-experimental location, so the alias's `node`/`default`
    // conditions resolve there too.
    out[`${aliasPrefix}/schema`] = orderedExportEntry({
      types: `${newDistDir}/${name}.schema.d.ts`,
      svelte: `${newSrcDir}/${name}.schema.ts`,
      node: `${newServerDistDir}/${name}.schema.js`,
      default: `${newDistDir}/${name}.schema.js`,
    });
    out[`${aliasPrefix}/variables`] = orderedExportEntry({
      types: `${newDistDir}/${name}.variables.d.ts`,
      svelte: `${newSrcDir}/${name}.variables.ts`,
      node: `${newServerDistDir}/${name}.variables.js`,
      default: `${newDistDir}/${name}.variables.js`,
    });

    if (hasCss) {
      out[`${aliasPrefix}/styles`] = {
        default: `${newDistDir}/${name}.css`,
      };
    }

    if (hasExamples) {
      out[`${aliasPrefix}/examples`] = jsonSidecarExport(`${newSrcDir}/${name}.examples.json`);
    }
  }

  return out;
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

    // Schema and variables modules are full four-condition runtime entry
    // points, exactly like the component barrel. Each ships:
    //   • `types`   → `<name>.schema.d.ts` / `<name>.variables.d.ts`
    //   • `svelte`  → the `.ts` source (so in-repo Svelte tooling resolves source)
    //   • `node`    → the per-component SSR build `<name>.schema.js`
    //   • `default` → the per-component browser build `<name>.schema.js`
    //
    // The build (scripts/build.ts) compiles each `<name>.schema.ts` /
    // `<name>.variables.ts` as its own browser + server entrypoint, so the
    // `node`/`default` targets resolve to real files. A plain Node or Vite
    // consumer can therefore `import schema from 'cinder/<name>/schema'` and get
    // the default-exported JSON Schema value at runtime — no
    // `ERR_PACKAGE_PATH_NOT_EXPORTED`.
    //
    // The unit test "emits a runtime condition on /schema and /variables"
    // (generate-exports.test.ts) and the manifest-consumer fixture
    // (fixtures/manifest-consumer/check.mjs) both pin this runtime-resolvable
    // contract.
    out[`${prefix}/schema`] = orderedExportEntry({
      types: `${distDir}/${name}.schema.d.ts`,
      svelte: `${srcDir}/${name}.schema.ts`,
      node: `${serverDistDir}/${name}.schema.js`,
      default: `${distDir}/${name}.schema.js`,
    });
    out[`${prefix}/variables`] = orderedExportEntry({
      types: `${distDir}/${name}.variables.d.ts`,
      svelte: `${srcDir}/${name}.variables.ts`,
      node: `${serverDistDir}/${name}.variables.js`,
      default: `${distDir}/${name}.variables.js`,
    });

    // Per-component CSS sidecar — layer-WRAPPED (the sidecar self-declares
    // `@layer cinder.components { … }`). Consumers must import `cinder/styles`
    // FIRST so the `@layer` order is established before per-component CSS
    // arrives; the sidecar then slots into the correct layer regardless of
    // import order.
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
  files: string[];
  [key: string]: unknown;
}

/**
 * The static `files` globs the package always ships, listed verbatim and in
 * order. The generator preserves these exactly (it does NOT flatten them into
 * hundreds of explicit per-component paths) and appends any computed root-level
 * artifact entries after them. Keep this in sync with the publishable source
 * surface — it is the single source of truth for the static portion of
 * `package.json#files`.
 */
export const STATIC_FILES_GLOBS: readonly string[] = [
  'dist',
  'src/index.ts',
  'src/schema-types.ts',
  'src/components/**/*.ts',
  '!src/components/**/*.test.ts',
  '!src/components/**/*.spec.ts',
  'src/components/**/*.svelte',
  'src/components/**/*.json',
  'src/components/**/*.md',
  '!src/components/**/*.a11y.md',
  'src/components/**/*.css',
  'src/_internal/**/*.ts',
  '!src/_internal/**/*.test.ts',
  'src/styles/**/*.css',
  'src/styles/base-guard.ts',
  'src/components/icons/index.ts',
  'src/utilities/**/*.ts',
  '!src/utilities/**/*.test.ts',
  'src/highlighters/**/*.ts',
  '!src/highlighters/**/*.test.ts',
  '!src/highlighters/**/*.spec.ts',
  'README.md',
];

/**
 * Root-level JSON artifacts the package must always ship explicitly. They live
 * at the package root (no directory prefix), so none of the `dist`/`src/**`
 * globs cover them:
 *   • `components.json`          — the machine-readable manifest (`./manifest` export target).
 *   • `examples-exclusions.json` — read by `generate-component-examples.ts`.
 * `package.json` is intentionally NOT listed: npm always publishes it.
 */
export const EXPLICIT_ROOT_FILE_ENTRIES: readonly string[] = [
  'components.json',
  'examples-exclusions.json',
];

/**
 * A static `files` glob "covers" a root-level artifact path when the glob would
 * already publish that exact file. Our static globs only ever match inside
 * `dist/`, `src/`, or the exact file `README.md`, so a root-level `*.json`
 * artifact is covered only when a glob names it verbatim. This conservative
 * check is enough to dedupe `computeFiles`'s root-entry computation against the
 * static globs without pulling in a full glob engine.
 */
function isRootArtifactGlobCovered(rootArtifact: string, globs: readonly string[]): boolean {
  return globs.includes(rootArtifact);
}

/**
 * Extract the set of root-level artifact paths (e.g. `components.json`) that the
 * exports map points at. A "root-level" target has no directory segment after
 * the leading `./`. `package.json` is excluded because npm always publishes it
 * and listing it in `files` is redundant.
 */
export function rootLevelExportTargets(
  exportsMap: Record<string, ExportEntry | JsonExportEntry | string>,
): string[] {
  const out = new Set<string>();
  for (const value of Object.values(exportsMap)) {
    const targets = typeof value === 'string' ? [value] : Object.values(value);
    for (const target of targets) {
      if (typeof target !== 'string') continue;
      if (!target.startsWith('./')) continue;
      const rest = target.slice(2);
      if (rest.length === 0 || rest.includes('/')) continue; // not root-level
      if (rest === 'package.json') continue; // always published by npm
      out.add(rest);
    }
  }
  return [...out];
}

/**
 * Compute the canonical `package.json#files` array: the static globs verbatim,
 * followed by the computed root-level artifact entries appended in deterministic
 * (alphabetical) order. The computed set is the union of the explicit root
 * entries and any root-level artifact path the exports map references that the
 * static globs do not already cover — deduped, then sorted.
 *
 * This extends (never replaces) the static globs and never flattens the
 * per-component tree into explicit paths.
 */
export function computeFiles(
  exportsMap: Record<string, ExportEntry | JsonExportEntry | string>,
  staticGlobs: readonly string[] = STATIC_FILES_GLOBS,
  explicitRootEntries: readonly string[] = EXPLICIT_ROOT_FILE_ENTRIES,
): string[] {
  const computedRoots = new Set<string>(explicitRootEntries);
  for (const target of rootLevelExportTargets(exportsMap)) {
    if (!isRootArtifactGlobCovered(target, staticGlobs)) {
      computedRoots.add(target);
    }
  }
  // Bytewise (not localeCompare) so the generated order is identical on every
  // machine regardless of locale/ICU — the generator's output must be stable.
  const appended = [...computedRoots].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return [...staticGlobs, ...appended];
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');
  const packageJsonPath = join(import.meta.dir, '..', 'package.json');
  const packageJson = await readJsonFile<PackageJson>(packageJsonPath);

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
  const deprecatedAliasComputed = computeDeprecatedExperimentalAliases();
  const computed: Record<string, ExportEntry | JsonExportEntry> = {
    ...componentComputed,
    ...upstreamComputed,
    ...deprecatedAliasComputed,
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

  /**
   * Build the next exports map in deterministic order:
   *   1. `.` (root, four-condition shape)
   *   2. `./package.json` self-export
   *   3. `./styles*` reserved entries (canonical, base-first)
   *   4. `./styles/guard` dev-only base-loaded guard
   *   5. `./highlighters/shiki`
   *   6. computed component subpaths (incl. /examples, /constraints when present)
   *   7. preserved legacy flat component subpaths (partial-migration window)
   *
   * Shared by both check and generate mode so the `files` array is computed from
   * the SAME exports map the generator would write — a newly-added root artifact
   * export is therefore reflected in `files` the very run it lands.
   */
  function buildNextExports(): Record<string, ExportEntry | JsonExportEntry | string> {
    const next: Record<string, ExportEntry | JsonExportEntry | string> = {};
    next[ROOT_KEY] = rootExport;
    next[PACKAGE_JSON_KEY] = './package.json';
    for (const [key, cssPath] of RESERVED_STYLES_ENTRIES) {
      next[key] = stylesExport(cssPath);
    }
    next[STYLES_GUARD_KEY] = stylesGuardExport();
    next[HIGHLIGHTERS_SHIKI_KEY] = highlightersShikiExport();

    // Preserve legacy flat component subpaths whose component still exists as
    // a flat .svelte file (not yet migrated to a directory).
    const migratedNames = new Set(
      components.map((c) => (c.isExperimental ? `./experimental/${c.name}` : `./${c.name}`)),
    );
    const legacy: Record<string, ExportEntry | JsonExportEntry | string> = {};
    for (const [key, entry] of Object.entries(packageJson.exports)) {
      if (RESERVED_KEYS.has(key)) continue;
      if (migratedNames.has(key)) continue;
      // Deprecated experimental aliases own their `./experimental/<name>` keys
      // via `computed`; never let a stale verbatim copy survive as "legacy".
      if (key in computed) continue;
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
    return next;
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
      const expectedBody = reexportFileBody(reexport.upstreamSpecifier, reexport);
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

    for (const [key, cssPath] of RESERVED_STYLES_ENTRIES) {
      const expected = stylesExport(cssPath);
      const current = existing[key];
      if (!current) {
        issues.push(`Reserved export "${key}" is missing`);
      } else if (JSON.stringify(current) !== JSON.stringify(expected)) {
        issues.push(`Stale reserved export "${key}"`);
      }
    }

    const expectedShikiEntry = highlightersShikiExport();
    const currentShikiEntry = existing[HIGHLIGHTERS_SHIKI_KEY];
    if (!currentShikiEntry) {
      issues.push(`Reserved export "${HIGHLIGHTERS_SHIKI_KEY}" is missing`);
    } else if (JSON.stringify(currentShikiEntry) !== JSON.stringify(expectedShikiEntry)) {
      issues.push(`Stale reserved export "${HIGHLIGHTERS_SHIKI_KEY}"`);
    }

    const expectedGuardEntry = stylesGuardExport();
    const currentGuardEntry = existing[STYLES_GUARD_KEY];
    if (!currentGuardEntry) {
      issues.push(`Reserved export "${STYLES_GUARD_KEY}" is missing`);
    } else if (JSON.stringify(currentGuardEntry) !== JSON.stringify(expectedGuardEntry)) {
      issues.push(`Stale reserved export "${STYLES_GUARD_KEY}"`);
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

    // `files` drift: the on-disk array must equal the computed one exactly. The
    // computed `files` is derived from the COMPUTED exports map (`next` below in
    // generate mode) so a freshly-added root artifact export is reflected the
    // same run it lands. We surface each missing/extra root entry distinctly so
    // the failure points at the precise drift rather than a wall of globs.
    const expectedFiles = computeFiles(buildNextExports());
    const actualFiles = packageJson.files ?? [];
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      const actualSet = new Set(actualFiles);
      const expectedSet = new Set(expectedFiles);
      const missing = expectedFiles.filter((entry) => !actualSet.has(entry));
      const extra = actualFiles.filter((entry) => !expectedSet.has(entry));
      if (missing.length === 0 && extra.length === 0) {
        // Same membership, wrong order — report the ordering drift explicitly.
        issues.push('files entries are out of order; run `bun run exports:generate` to fix');
      } else {
        for (const entry of missing) issues.push(`Missing files entry: "${entry}"`);
        for (const entry of extra) issues.push(`Extra files entry: "${entry}"`);
      }
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

  // Generate mode: build the next exports map (shared with check mode) and the
  // computed `files` array, then write both back to package.json.
  const next = buildNextExports();

  assertNoForbiddenExportKeys(next, FORBIDDEN_EXPORT_KEY_PATTERN, upstreamAllowList);

  packageJson.exports = next;
  packageJson.files = computeFiles(next);
  await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  // Emit (or refresh) the generated re-export source files. They are part of
  // the exports contract — drift detection lives in --check mode above.
  for (const reexport of upstreamReexports) {
    const filePath = reexportSourceAbsolutePath(reexport);
    await mkdir(dirname(filePath), { recursive: true });
    await Bun.write(filePath, reexportFileBody(reexport.upstreamSpecifier, reexport));
  }

  process.stdout.write(
    `exports:generate — wrote ${Object.keys(computed).length} computed subpaths ` +
      `(${components.length} components, ${upstreamReexports.length} upstream re-exports) ` +
      `and ${packageJson.files.length} files entries\n`,
  );
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error('generate-exports failed:', err);
    process.exit(1);
  });
}
