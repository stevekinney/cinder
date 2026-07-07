/**
 * Non-mutating staged pack for the `@lostgradient/cinder` npm tarball.
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

import { Glob } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { BUILD_INPUT_HASH_MARKER } from './lib/build-cache.ts';
import { deriveUpstreamReexports, type UpstreamReexport } from './lib/derive-upstream-reexports.ts';
import { readJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..');
const stagingRoot = join(packageRoot, 'node_modules', '.cache', 'publish-staging');

type ExportConditional = {
  types?: string;
  browser?: string;
  svelte?: string;
  node?: string;
  import?: string;
  default?: string;
};

type ExportsMap = Record<string, ExportConditional | string>;

type SourceManifest = {
  name: string;
  version: string;
  bin?: Record<string, string>;
  svelte?: string;
  files?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  husky?: unknown;
  'lint-staged'?: unknown;
  exports: ExportsMap;
};

type SourceMapStripResult = {
  text: string;
  strippedCount: number;
};

export type SourceMapReference = {
  line: number;
  reference: string;
};

/**
 * Read the source manifest. Throws if the file is missing.
 */
async function readSourceManifest(): Promise<SourceManifest> {
  const path = join(packageRoot, 'package.json');
  return readJsonFile<SourceManifest>(path);
}

/**
 * Remove the build cache's `dist/.build-input-hash` marker from a staged
 * tarball tree. `node:fs` `cp(..., { recursive: true })` (used to stage the
 * `files` field's `dist` directory) — unlike the `Bun.Glob` scans used
 * elsewhere for dist vendoring — does not skip dotfiles, so the marker gets
 * staged along with everything else. It is a build-cache implementation
 * detail, not a publishable artifact — remove it deterministically rather
 * than via a `!`-prefixed glob pattern (which shares the same dotfile-
 * skipping behavior as the vendoring scan and would silently match nothing).
 *
 * Exported and parameterized over `stagingDirectory` so a regression test can
 * exercise the real removal logic against a synthetic staged tree, rather
 * than reimplementing the `rm` call and proving nothing about production code.
 */
export async function removeBuildCacheMarker(stagingDirectory: string): Promise<void> {
  await rm(join(stagingDirectory, 'dist', BUILD_INPUT_HASH_MARKER), { force: true });
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

function rewriteComponentMetadataNodeEntry(
  key: string,
  entry: ExportConditional,
): ExportConditional {
  if (!/\/(?:schema|variables)$/u.test(key)) return entry;
  if (entry.node === undefined || entry.default === undefined) return entry;
  if (!entry.node.startsWith('./dist/server/components/')) return entry;
  if (!entry.default.startsWith('./dist/components/')) return entry;
  return { ...entry, node: entry.default };
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
    transformedExports[key] =
      typeof entry === 'object' ? rewriteComponentMetadataNodeEntry(key, entry) : entry;
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
  delete published.scripts;
  // Husky / dev-only fields.
  delete published.husky;
  delete published['lint-staged'];
  // The published tarball ships:
  //   - `dist/` — every component / upstream / server build target plus the CLI.
  //   - `src/index.ts`, `src/schema-types.ts`, and `src/components/**` —
  //     retained source entry points for Svelte-aware consumers. Shipping
  //     component source avoids coupling compiled component output to one
  //     specific Svelte internal runtime shape.
  //   - `src/utilities/**/*.ts` and `src/_internal/**/*.ts` — runtime
  //     helpers and the constraints DSL the components import.
  //   - `src/styles/**/*.css` and `src/components/**/*.css` — hand-authored
  //     CSS targets for `@lostgradient/cinder/styles*` and `@lostgradient/cinder/<id>/styles`.
  //   - `src/components/**/*.{examples,constraints}.json` — JSON sidecars
  //     surfaced via `@lostgradient/cinder/<id>/{examples,constraints}`.
  //   - `components.json` — `@lostgradient/cinder/manifest`.
  //
  // Test files are excluded via `!**/*.{test,spec}.ts` so the tarball never
  // ships test infra.
  published.files = [
    'dist',
    '!dist/**/*.js.map',
    '!dist/server/**/*.d.ts',
    '!dist/server/components/**/*.schema.js',
    '!dist/server/components/**/*.variables.js',
    '!dist/**/*.type-test.*',
    '!dist/**/*.fixture.*',
    '!dist/**/*-fixture.*',
    '!dist/**/*-fixtures.*',
    '!dist/**/*fixtures.*',
    '!dist/**/*fixture*.svelte.d.ts',
    '!dist/**/_*-test-harness.*',
    '!dist/**/test/**',
    'src/index.ts',
    'src/schema-types.ts',
    'src/components/**/*.ts',
    'src/components/**/*.svelte',
    '!src/components/**/*.test.ts',
    '!src/components/**/*.spec.ts',
    '!src/components/**/*.type-test.ts',
    '!src/components/**/*.type-test.svelte',
    '!src/components/**/*.fixture.ts',
    '!src/components/**/*-fixture.ts',
    '!src/components/**/*-fixtures.ts',
    '!src/components/**/*fixtures.ts',
    '!src/components/**/*fixture*.svelte',
    '!src/components/**/_*-test-harness.svelte',
    '!src/components/**/test/**',
    'src/components/**/*.schema.json',
    'src/components/**/*.variables.json',
    'src/components/**/*.examples.json',
    'src/components/**/*.constraints.json',
    'src/components/**/*.css',
    'src/_internal/**/*.ts',
    '!src/_internal/**/*.test.ts',
    'src/utilities/**/*.ts',
    '!src/utilities/**/*.test.ts',
    // Non-component static sub-paths whose exports map carries a `svelte`
    // condition pointing at `./src/highlighters/<name>/index.ts` (the
    // first-party Shiki adapter today; future siblings live here too).
    // Without this glob, a Svelte-aware consumer resolving the source
    // condition for `@lostgradient/cinder/highlighters/shiki` would hit a dangling path
    // because the build only emits `dist/highlighters/**` — the source
    // remains in `src/`.
    'src/highlighters/**/*.ts',
    '!src/highlighters/**/*.test.ts',
    '!src/highlighters/**/*.spec.ts',
    'src/styles/**/*.css',
    // Type stubs for the reserved `./styles*` subpaths. The `types` condition
    // in each export entry points at `./src/styles/<name>.css.d.ts`; without
    // this glob those files are absent from the tarball and consumers get
    // "Cannot find module or type declarations for side-effect import" under
    // moduleResolution: bundler.
    'src/styles/**/*.css.d.ts',
    // The `./styles/guard` export carries a `svelte` condition pointing at
    // `./src/styles/base-guard.ts` (the build only emits `dist/styles/base-guard.js`),
    // so a Svelte-aware consumer resolving that source condition would hit a
    // dangling path without this file. Listed explicitly rather than via a
    // `src/styles/**/*.ts` glob to keep the publish surface narrow — this is the
    // only `.ts` under `src/styles/` that needs to ship.
    'src/styles/base-guard.ts',
    'components.json',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
  ];
  published.exports = transformedExports;
  return published;
}

function isResolvableRelativeSourceMapReference(reference: string): boolean {
  if (!reference.endsWith('.map')) return false;
  if (reference.startsWith('data:')) return false;
  if (reference.startsWith('file:')) return false;
  return !/^[a-z]+:\/\//iu.test(reference);
}

export function getSourceMapReferences(content: string): SourceMapReference[] {
  const references: SourceMapReference[] = [];
  const lines = content.split('\n');
  for (const [index, line] of lines.entries()) {
    const lineCommentMatch = line.match(/^\s*\/\/[#@]\s*sourceMappingURL=([^\s]+)\s*$/u);
    if (lineCommentMatch?.[1] && isResolvableRelativeSourceMapReference(lineCommentMatch[1])) {
      references.push({ line: index + 1, reference: lineCommentMatch[1] });
      continue;
    }

    const blockCommentMatch = line.match(/^\s*\/\*#\s*sourceMappingURL=([^*\s]+)\s*\*\/\s*$/u);
    if (blockCommentMatch?.[1] && isResolvableRelativeSourceMapReference(blockCommentMatch[1])) {
      references.push({ line: index + 1, reference: blockCommentMatch[1] });
    }
  }
  return references;
}

export function stripDanglingSourceMapUrlComments(
  text: string,
  hasSourceMap: (reference: string) => boolean,
): SourceMapStripResult {
  let strippedCount = 0;
  const outputLines: string[] = [];
  const lines = text.split('\n');
  const sourceMapReferencesByLine = new Map(
    getSourceMapReferences(text).map((sourceMapReference) => [
      sourceMapReference.line,
      sourceMapReference,
    ]),
  );
  for (const [index, line] of lines.entries()) {
    const sourceMapReference = sourceMapReferencesByLine.get(index + 1);
    if (sourceMapReference && !hasSourceMap(sourceMapReference.reference)) {
      strippedCount += 1;
      continue;
    }

    outputLines.push(line);
  }

  const outputText = outputLines.join('\n');
  if (outputText.length === 0) {
    return { text: outputText, strippedCount };
  }
  if (!text.endsWith('\n') && outputText.endsWith('\n')) {
    return { text: outputText.slice(0, -1), strippedCount };
  }
  if (text.endsWith('\n') && !outputText.endsWith('\n')) {
    return { text: `${outputText}\n`, strippedCount };
  }
  return { text: outputText, strippedCount };
}

export function transpileSvelteTypeScriptModuleForPublish(source: string): string {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      verbatimModuleSyntax: true,
    },
  }).outputText;
}

export function transpileSvelteComponentScriptsForPublish(source: string): string {
  return source.replace(
    /<script(?<attributes>[^>]*)>(?<content>[\s\S]*?)<\/script>/gu,
    (match: string, attributes: string, content: string) => {
      if (!/\blang\s*=\s*["']ts["']/u.test(attributes)) return match;
      const transformed = transpileSvelteTypeScriptModuleForPublish(content).trimEnd();
      return `<script${attributes}>${transformed.length > 0 ? `\n${transformed}\n` : '\n'}</script>`;
    },
  );
}

async function stripDanglingSourceMapCommentsInStaging(): Promise<number> {
  const scriptGlob = new Glob('dist/**/*.{js,mjs,cjs}');
  let strippedCount = 0;
  for await (const relative of scriptGlob.scan({ cwd: stagingRoot })) {
    const filePath = join(stagingRoot, relative);
    const original = await Bun.file(filePath).text();
    if (!original.includes('sourceMappingURL=')) continue;
    const fileDirectory = dirname(filePath);
    const stripped = stripDanglingSourceMapUrlComments(original, (reference) =>
      existsSync(join(fileDirectory, reference)),
    );
    if (stripped.strippedCount === 0) continue;
    await Bun.write(filePath, stripped.text);
    strippedCount += stripped.strippedCount;
  }
  return strippedCount;
}

async function transpileStagedSvelteTypeScriptModules(): Promise<number> {
  const moduleGlob = new Glob('src/**/*.svelte.ts');
  let transpiledCount = 0;
  for await (const relative of moduleGlob.scan({ cwd: stagingRoot })) {
    const filePath = join(stagingRoot, relative);
    const source = await Bun.file(filePath).text();
    await Bun.write(filePath, transpileSvelteTypeScriptModuleForPublish(source));
    transpiledCount += 1;
  }
  return transpiledCount;
}

async function transpileStagedSvelteComponentScripts(): Promise<number> {
  const componentGlob = new Glob('src/**/*.svelte');
  let transpiledCount = 0;
  for await (const relative of componentGlob.scan({ cwd: stagingRoot })) {
    const filePath = join(stagingRoot, relative);
    const source = await Bun.file(filePath).text();
    const transformed = transpileSvelteComponentScriptsForPublish(source);
    if (transformed === source) continue;
    await Bun.write(filePath, transformed);
    transpiledCount += 1;
  }
  return transpiledCount;
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
  const excludedPatterns = filesField
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => pattern.slice(1));
  for (const pattern of filesField) {
    if (pattern.startsWith('!')) {
      // Applied after positive staging below.
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

  for (const pattern of excludedPatterns) {
    const glob = new Glob(pattern);
    for await (const relative of glob.scan({ cwd: stagingRoot })) {
      await rm(join(stagingRoot, relative), { force: true, recursive: true });
    }
  }

  await removeBuildCacheMarker(stagingRoot);

  // `build.ts` emits `//# sourceMappingURL=*.map` comments for dist JS outputs,
  // while the publish manifest intentionally excludes `dist/**/*.js.map`. Strip
  // dangling source-map references from staged JS files so consumer bundlers
  // do not warn about missing map files.
  await stripDanglingSourceMapCommentsInStaging();

  // Vite's dependency optimizer parses dependency modules before Svelte's
  // compileModule pass. Keep `.svelte.ts` file names so source imports stay
  // stable, but strip TypeScript-only syntax so the optimizer can parse the
  // staged modules and then hand the remaining runes to the Svelte plugin.
  await transpileStagedSvelteTypeScriptModules();

  // The same optimizer path scans component script blocks before the full
  // Svelte compiler pass. Strip TypeScript-only syntax from staged component
  // scripts while preserving the component markup and Svelte source shape.
  await transpileStagedSvelteComponentScripts();

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

type PackCommandResult = {
  readonly exitCode: number | null;
  readonly stderr: { toString(): string };
};

type PackCommandRunner = (
  command: readonly string[],
  options: { readonly cwd: string; readonly stderr: 'pipe'; readonly stdout: 'pipe' },
) => PackCommandResult;

export function runPackCommand(
  stagingDirectory: string,
  destinationDirectory: string,
  runner: PackCommandRunner = (command, options) =>
    Bun.spawnSync([...command], {
      cwd: options.cwd,
      stderr: options.stderr,
      stdout: options.stdout,
    }),
): void {
  const result = runner(['bun', 'pm', 'pack', '--destination', destinationDirectory], {
    cwd: stagingDirectory,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(`bun pm pack failed: ${result.stderr.toString()}`);
  }
}

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

  // Stage from the PUBLISHED manifest's `files` list, not the source's.
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

  runPackCommand(stagingRoot, packageRoot);
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
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`pack-for-publish — emitted ${tarballPath}\n`, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

if (import.meta.main) {
  try {
    await main();
    process.exit(0);
  } catch (error: unknown) {
    console.error('pack-for-publish failed:', error);
    process.exit(1);
  }
}

// Re-export helpers used by `validate-consumers.ts` invariants.
export { buildPublishedManifest, readSourceManifest, type SourceManifest };
