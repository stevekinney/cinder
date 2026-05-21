/**
 * Non-mutating staged pack for the `cinder` npm tarball.
 *
 * `bun pm pack` runs against the source `packages/components/package.json`,
 * which carries:
 *   - `devDependencies` on the four private `@cinder/*` workspace packages
 *     (PR 1 bundles their source into `dist/`; they must NOT appear in any
 *     published dep field).
 *   - `exports` entries for the 30 upstream re-export sub-paths whose
 *     `svelte` condition points at `./src/<pkg>/<subpath>.ts`. The published
 *     tarball does not ship `src/<pkg>/**`, so the `svelte` condition would
 *     dangle for downstream Svelte-aware bundlers if it survived.
 *
 * This script:
 *   1. Resolves the staging directory under `node_modules/.cache/`.
 *   2. Copies every file the `files` field allows (and a minimal set of
 *      additions like `README.md` and `LICENSE`) into staging.
 *   3. Writes a transformed `package.json` into staging (the source manifest
 *      is read but never written).
 *   4. Invokes `bun pm pack --destination <outputDirectory>` from the staging
 *      directory; the resulting tarball lands in the repository's standard
 *      artifacts location (`packages/components/`).
 *   5. Asserts post-pack invariants on the source worktree: the source
 *      `package.json` is byte-identical to its pre-pack state.
 *
 * Run with `bun run scripts/pack-for-publish.ts`. CI calls this from
 * `validate-consumers.ts` so the consumer-fixture install path uses the
 * transformed tarball, not a raw `bun pm pack` against the source manifest.
 */

import { $, Glob } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveUpstreamReexports, type UpstreamReexport } from './lib/derive-upstream-reexports.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..');
const stagingRoot = join(packageRoot, 'node_modules', '.cache', 'publish-staging');

type ExportConditional = {
  types?: string;
  svelte?: string;
  node?: string;
  default?: string;
  import?: string;
};

type ExportsMap = Record<string, ExportConditional | string>;

type SourceManifest = {
  name: string;
  version: string;
  files?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  exports: ExportsMap;
  [key: string]: unknown;
};

/**
 * Read the source manifest. Throws if the file is missing.
 */
async function readSourceManifest(): Promise<SourceManifest> {
  const path = join(packageRoot, 'package.json');
  return (await Bun.file(path).json()) as SourceManifest;
}

/**
 * Compute the SHA-256 of a file's content. Used to assert the source
 * manifest is byte-identical pre- and post-pack.
 */
async function fileHash(path: string): Promise<string> {
  const content = await Bun.file(path).bytes();
  return new Bun.CryptoHasher('sha256').update(content).digest('hex');
}

/**
 * Strip the four `@cinder/*` workspace entries from any dep field. They are
 * source-only inputs to cinder's build; the published tarball must not
 * reference them in any dep field (`workspace:` protocol leaks into the
 * registry-installed manifest otherwise).
 */
function stripCinderWorkspaceDeps(
  record: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!record) return record;
  const out: Record<string, string> = {};
  let touched = false;
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('@cinder/')) {
      touched = true;
      continue;
    }
    out[key] = value;
  }
  if (!touched) return record;
  return Object.keys(out).length === 0 ? undefined : out;
}

/**
 * Strip the `svelte` condition from every exports entry. The source manifest
 * uses `svelte` → `./src/...` for in-repo HMR and TypeScript source
 * resolution; the published tarball intentionally does not ship `src/**`, so
 * any `svelte` condition would point at a non-existent path and trap
 * Svelte-aware bundlers (SvelteKit, Vite + the Svelte plugin) into a broken
 * resolve. Strip the condition uniformly — `default` and `node` continue to
 * route consumers at `dist/`.
 */
function stripSvelteCondition(entry: ExportConditional | string): ExportConditional | string {
  if (typeof entry === 'string') return entry;
  if (entry.svelte === undefined) return entry;
  const result: ExportConditional = {};
  if (entry.types !== undefined) result.types = entry.types;
  if (entry.node !== undefined) result.node = entry.node;
  if (entry.import !== undefined) result.import = entry.import;
  if (entry.default !== undefined) result.default = entry.default;
  return result;
}

/**
 * Rewrite the exports entry for an upstream re-export sub-path so the
 * published tarball points its `types` and `default` at `dist/` and drops
 * the `svelte` condition. The source manifest's `svelte` condition is used
 * in-repo for HMR and TS source resolution; published consumers must resolve
 * the built artifacts.
 */
function rewriteUpstreamReexportEntry(
  entry: ExportConditional,
  reexport: UpstreamReexport,
): ExportConditional {
  const distRelative = reexport.distRelativePath;
  const result: ExportConditional = {};
  if (entry.types !== undefined) {
    result.types = `./dist/${distRelative.replace(/\.js$/, '.d.ts')}`;
  }
  if (entry.node !== undefined) {
    result.node = `./dist/server/${distRelative}`;
  }
  if (entry.default !== undefined) {
    result.default = `./dist/${distRelative}`;
  }
  return result;
}

/**
 * Build the transformed manifest written into staging.
 */
function buildPublishedManifest(
  source: SourceManifest,
  reexports: UpstreamReexport[],
): SourceManifest {
  const reexportKeys = new Set(reexports.map((r) => r.cinderKey));
  const reexportByKey = new Map(reexports.map((r) => [r.cinderKey, r] as const));

  const transformedExports: ExportsMap = {};
  for (const [key, entry] of Object.entries(source.exports)) {
    if (reexportKeys.has(key) && typeof entry === 'object') {
      const reexport = reexportByKey.get(key);
      if (!reexport) throw new Error(`Internal error: missing reexport for ${key}`);
      transformedExports[key] = rewriteUpstreamReexportEntry(entry, reexport);
      continue;
    }
    // Strip `svelte` conditions from every other entry. The source manifest
    // uses `svelte` → `./src/...` for in-repo HMR and TS source resolution,
    // but the published tarball intentionally does not ship `src/**`.
    transformedExports[key] = stripSvelteCondition(entry);
  }

  // Shallow clone, then strip `@cinder/*` from every dep field and replace
  // `exports` with the rewritten map.
  const published: SourceManifest = { ...source };
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const) {
    const stripped = stripCinderWorkspaceDeps(source[field]);
    if (stripped === undefined) {
      delete published[field];
    } else {
      published[field] = stripped;
    }
  }
  // `scripts` are not consumer-facing; drop everything except `prepack` and
  // any other hooks that would re-run inside the staging dir (none today).
  // Removing scripts entirely keeps the published manifest minimal.
  delete (published as { scripts?: unknown }).scripts;
  // Husky / dev-only fields.
  delete (published as { husky?: unknown }).husky;
  delete (published as { 'lint-staged'?: unknown })['lint-staged'];
  // The published tarball ships:
  //   - `dist/` — every component / upstream / server build target.
  //   - `src/styles/**/*.css` — `cinder/styles*` exports target these CSS
  //     files directly (the build does not transform them).
  //   - `src/components/**/*.examples.json` and
  //     `src/components/**/*.constraints.json` — per-component sidecars
  //     consumed by the `<id>/examples` and `<id>/constraints` exports.
  //   - `components.json` — `cinder/manifest`.
  //
  // Everything else under `src/**` (TS source, Svelte source, tests) stays
  // out so `@cinder/*` import-statement noise never reaches the tarball.
  published.files = [
    'dist',
    'src/styles/**/*.css',
    'src/components/**/*.examples.json',
    'src/components/**/*.constraints.json',
    'components.json',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
  ];
  published.exports = transformedExports;
  return published;
}

/**
 * Copy a file relative to `packageRoot` into the same relative path under
 * `stagingRoot`. Creates intermediate directories as needed.
 */
async function copyIntoStaging(relative: string): Promise<void> {
  const source = join(packageRoot, relative);
  const destination = join(stagingRoot, relative);
  if (!existsSync(source)) return;
  await mkdir(dirname(destination), { recursive: true });
  const stat = statSync(source);
  if (stat.isDirectory()) {
    await cp(source, destination, { recursive: true });
  } else {
    await cp(source, destination);
  }
}

/**
 * Stage every file the `files` field allows, plus README/LICENSE if present.
 * `bun pm pack` honors `files` against the working directory it runs in;
 * staging mirrors that subset rather than the whole source tree so we don't
 * leak test files, fixtures, scripts, etc. into the tarball.
 */
async function stageFiles(manifest: SourceManifest): Promise<void> {
  if (existsSync(stagingRoot)) {
    await rm(stagingRoot, { recursive: true, force: true });
  }
  await mkdir(stagingRoot, { recursive: true });

  const filesField = manifest.files ?? [];
  for (const pattern of filesField) {
    if (pattern.startsWith('!')) {
      // Negative patterns are honored later by `bun pm pack` reading the
      // staged `files` field directly; nothing to stage from them.
      continue;
    }
    // Patterns can be plain paths, directories, or globs. Resolve each into
    // concrete files under the source tree and copy.
    const absolute = join(packageRoot, pattern);
    if (existsSync(absolute) && statSync(absolute).isDirectory()) {
      await copyIntoStaging(pattern);
      continue;
    }
    if (pattern.includes('*')) {
      const glob = new Glob(pattern);
      for await (const relative of glob.scan({ cwd: packageRoot })) {
        await copyIntoStaging(relative);
      }
      continue;
    }
    await copyIntoStaging(pattern);
  }

  // Always include README and LICENSE if present, regardless of `files`.
  for (const additional of ['README.md', 'LICENSE', 'LICENSE.md', 'CHANGELOG.md']) {
    await copyIntoStaging(additional);
  }
}

/**
 * Compute the cinder tarball filename `bun pm pack` will emit for the given
 * manifest (`<name>-<version>.tgz`, with leading `@` stripped and slashes
 * flattened).
 */
function tarballFileName(manifest: SourceManifest): string {
  const namePart = manifest.name.replace(/^@/, '').replaceAll('/', '-');
  return `${namePart}-${manifest.version}.tgz`;
}

export type PackForPublishResult = {
  /** Absolute path to the emitted tarball. */
  tarballPath: string;
  /** Path to the staging directory used. Removed by callers if desired. */
  stagingDirectory: string;
};

/**
 * Stage, transform, pack, and return the path to the emitted tarball.
 * Asserts that the source `package.json` is byte-identical pre- and
 * post-pack.
 */
export async function packForPublish(): Promise<PackForPublishResult> {
  const sourceManifestPath = join(packageRoot, 'package.json');
  const sourceHashBefore = await fileHash(sourceManifestPath);

  const sourceManifest = await readSourceManifest();
  const reexports = await deriveUpstreamReexports();
  const publishedManifest = buildPublishedManifest(sourceManifest, reexports);

  // Stage from the PUBLISHED manifest's `files` list, not the source's —
  // the source ships `src/**` for in-repo Svelte tooling but the published
  // tarball is dist-only.
  await stageFiles(publishedManifest);
  await Bun.write(
    join(stagingRoot, 'package.json'),
    JSON.stringify(publishedManifest, null, 2) + '\n',
  );

  const expectedTarballName = tarballFileName(sourceManifest);
  const tarballPath = join(packageRoot, expectedTarballName);
  if (existsSync(tarballPath)) {
    await Bun.file(tarballPath).delete();
  }

  const result = await $`bun pm pack --destination ${packageRoot}`.cwd(stagingRoot).nothrow();
  if (result.exitCode !== 0) {
    throw new Error(`bun pm pack failed: ${result.stderr.toString()}`);
  }
  if (!existsSync(tarballPath)) {
    throw new Error(`Expected tarball at ${tarballPath} after pack`);
  }

  const sourceHashAfter = await fileHash(sourceManifestPath);
  if (sourceHashBefore !== sourceHashAfter) {
    throw new Error(
      `pack-for-publish mutated the source manifest at ${sourceManifestPath} ` +
        `(sha256 ${sourceHashBefore} → ${sourceHashAfter}). The staged pack must be non-mutating.`,
    );
  }

  return { tarballPath, stagingDirectory: stagingRoot };
}

async function main(): Promise<void> {
  const { tarballPath } = await packForPublish();
  process.stdout.write(`pack-for-publish — emitted ${tarballPath}\n`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('pack-for-publish failed:', error);
    process.exit(1);
  });
}

// Re-export helpers used by `validate-consumers.ts` invariants.
export { buildPublishedManifest, readSourceManifest, type SourceManifest };
