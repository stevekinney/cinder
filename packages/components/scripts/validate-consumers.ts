import { $, Glob } from 'bun';
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'postcss';

import { waitForReadyHtml } from './consumer-readiness.ts';
import { installHookProcessCleanup, withLocalValidationGateLock } from './husky/utilities.ts';
import { type CommentScanState, lineHasCinderResidue } from './lib/cinder-specifier-residue.ts';
import { deriveUpstreamReexports } from './lib/derive-upstream-reexports.ts';
import { discoverComponents } from './lib/discover-components.ts';
import { parseJsonFile } from './lib/read-json-file.ts';
import { getSourceMapReferences, packForPublish } from './pack-for-publish.ts';
import { sveltePeerContract } from './validate-svelte-peer-contract.ts';
import { isObjectRecord } from './validation-utilities.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolvePath(scriptDirectory, '..');
const workspaceRoot = resolvePath(repositoryRoot, '../..');

type PackageIdentity = { name: string; version: string };
type WorkspaceDependencyPackage = PackageIdentity & {
  packageDirectory: string;
  tarballFileName: string;
  tarballFilePath: string;
};

function getPackFileName(identity: PackageIdentity): string {
  const packageFileNamePrefix = identity.name.replace(/^@/, '').replaceAll('/', '-');
  return `${packageFileNamePrefix}-${identity.version}.tgz`;
}

/** Derive the tarball filename from package.json so version bumps don't silently break validation. */
function readPackageIdentity(packageDirectory = repositoryRoot): PackageIdentity {
  const parsed: unknown = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  if (!isObjectRecord(parsed)) {
    throw new Error('package.json must be a JSON object');
  }
  const name = parsed['name'];
  const version = parsed['version'];
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw new Error('package.json must have string `name` and `version`');
  }
  return { name, version };
}
const packageIdentity = readPackageIdentity();
const tarballFileName = getPackFileName(packageIdentity);
const tarballFilePath = join(repositoryRoot, tarballFileName);
const workspaceDependencyPackages = ['diff', 'markdown', 'editor', 'commentary'].map(
  (packageDirectoryName): WorkspaceDependencyPackage => {
    const packageDirectory = join(workspaceRoot, 'packages', packageDirectoryName);
    const identity = readPackageIdentity(packageDirectory);
    const workspaceDependencyTarballFileName = getPackFileName(identity);
    return {
      ...identity,
      packageDirectory,
      tarballFileName: workspaceDependencyTarballFileName,
      tarballFilePath: join(packageDirectory, workspaceDependencyTarballFileName),
    };
  },
);

const RICH_FEATURE_DEPENDENCY_NAMES = [
  '@milkdown/ctx',
  '@milkdown/kit',
  '@milkdown/prose',
  '@shikijs/engine-oniguruma',
  '@shikijs/langs',
  '@shikijs/rehype',
  '@shikijs/types',
  '@types/hast',
  '@types/mdast',
  '@types/unist',
  'comlink',
  'hast-util-sanitize',
  'js-yaml',
  'prosemirror-inputrules',
  'prosemirror-model',
  'prosemirror-state',
  'prosemirror-view',
  'rehype-katex',
  'rehype-sanitize',
  'rehype-stringify',
  'remark-gfm',
  'remark-html',
  'remark-math',
  'remark-parse',
  'remark-rehype',
  'remark-stringify',
  'shiki',
  'unified',
  'unist-util-remove',
  'unist-util-visit',
] as const;

const BASE_TRANSITIVE_RICH_FEATURE_DEPENDENCY_NAMES = new Set<string>([
  // `conversationalist` depends on `gray-matter`, which depends on `js-yaml`.
  // The styles fixture cannot use its presence as proof that the rich markdown
  // or editor dependency tree leaked onto the base install path.
  'js-yaml',
]);

const RICH_FEATURE_LEAK_CHECK_NAMES = RICH_FEATURE_DEPENDENCY_NAMES.filter(
  (dependencyName) => !BASE_TRANSITIVE_RICH_FEATURE_DEPENDENCY_NAMES.has(dependencyName),
);

const REQUIRED_PEER_DEPENDENCY_NAMES = ['conversationalist'] as const;

function collectInstalledPackageNamesFromNodeModulesTree(
  nodeModulesDirectory: string,
): Set<string> {
  const installedPackageNames = new Set<string>();
  if (!existsSync(nodeModulesDirectory)) return installedPackageNames;

  const pendingNodeModulesDirectories = [nodeModulesDirectory];

  while (pendingNodeModulesDirectories.length > 0) {
    const currentNodeModulesDirectory = pendingNodeModulesDirectories.pop();
    if (currentNodeModulesDirectory === undefined) continue;

    for (const entry of readdirSync(currentNodeModulesDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === '.bin') continue;

      const entryPath = join(currentNodeModulesDirectory, entry.name);
      if (entry.name.startsWith('@')) {
        for (const scopedEntry of readdirSync(entryPath, { withFileTypes: true })) {
          if (!scopedEntry.isDirectory()) continue;
          installedPackageNames.add(`${entry.name}/${scopedEntry.name}`);

          const scopedNestedNodeModulesDirectory = join(
            entryPath,
            scopedEntry.name,
            'node_modules',
          );
          if (existsSync(scopedNestedNodeModulesDirectory)) {
            pendingNodeModulesDirectories.push(scopedNestedNodeModulesDirectory);
          }
        }
        continue;
      }

      installedPackageNames.add(entry.name);

      const nestedNodeModulesDirectory = join(entryPath, 'node_modules');
      if (existsSync(nestedNodeModulesDirectory)) {
        pendingNodeModulesDirectories.push(nestedNodeModulesDirectory);
      }
    }
  }

  return installedPackageNames;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function fail(message: string): never {
  throw new ValidationError(message);
}

let nodeBinaryPath = '';
const tarBinaryPath = Bun.which('tar');

function ensureSupportedPlatform(): void {
  if (process.platform !== 'win32') return;
  fail(
    'validate:consumer currently supports macOS and Linux only. Phase 1 still shells out to Unix tooling and does not yet implement a Windows-specific fixture/runtime strategy.',
  );
}

/**
 * Resolve a real Node binary (not Bun's `bun-node-*` shim) to execute the node-consumer
 * fixture. Prefer the user's PATH so GitHub Actions, nvm, and asdf installs work, then fall
 * back to common macOS/Linux locations. Reject Bun's `bun-node-*` shim and obvious
 * temporary-directory paths so a poisoned PATH cannot silently redirect the validator.
 */
const ALLOWED_NODE_DIRECTORIES = [
  '/usr/local/bin',
  '/usr/bin',
  '/opt/homebrew/bin',
  '/opt/local/bin',
];

const DISALLOWED_NODE_DIRECTORY_PREFIXES = ['/tmp/', '/private/tmp/', '/var/tmp/'];

function resolveUsableNodeBinaryPath(candidatePath: string): string | null {
  if (!existsSync(candidatePath)) return null;
  const resolvedPath = realpathSync(candidatePath);
  if (resolvedPath.includes('bun-node')) return null;
  if (
    DISALLOWED_NODE_DIRECTORY_PREFIXES.some(
      (directoryPrefix) =>
        resolvedPath === directoryPrefix.slice(0, -1) || resolvedPath.startsWith(directoryPrefix),
    )
  ) {
    return null;
  }
  const probe = Bun.spawnSync([resolvedPath, '--version']);
  if (probe.exitCode !== 0) return null;
  const version = probe.stdout.toString().trim();
  const majorVersion = /^v(\d+)\./.exec(version)?.[1];
  if (majorVersion === undefined || Number(majorVersion) < 22) return null;
  return resolvedPath;
}

function resolveRealNodeBinary(): string {
  const pathCandidate = Bun.which('node');
  if (pathCandidate !== null) {
    const resolvedPathCandidate = resolveUsableNodeBinaryPath(pathCandidate);
    if (resolvedPathCandidate !== null) return resolvedPathCandidate;
  }

  for (const directory of ALLOWED_NODE_DIRECTORIES) {
    const resolvedPathCandidate = resolveUsableNodeBinaryPath(join(directory, 'node'));
    if (resolvedPathCandidate !== null) return resolvedPathCandidate;
  }
  fail(
    'Node is required on PATH or in a standard system directory (/usr/local/bin, /usr/bin, /opt/homebrew/bin, /opt/local/bin) for the node-consumer fixture.\n' +
      '  Install Node 22+ and re-run. Phase 1 verifies the "node" export condition under real\n' +
      '  Node, not Bun, so Bun shims and temporary-directory PATH entries are rejected.',
  );
}

async function ensureNodeOnPath(): Promise<void> {
  nodeBinaryPath = resolveRealNodeBinary();
  const versionResult = Bun.spawnSync([nodeBinaryPath, '--version']);
  if (versionResult.exitCode !== 0) {
    fail(`Failed to run ${nodeBinaryPath} --version`);
  }
  const version = versionResult.stdout.toString().trim();
  const match = /^v(\d+)\./.exec(version);
  const majorVersion = match?.[1] ? Number(match[1]) : 0;
  if (majorVersion < 22) {
    fail(`Node >= 22 required. Found ${version}.`);
  }
  process.stdout.write(`[validate-consumers] using node ${version} at ${nodeBinaryPath}\n`);
}

async function runBuild(): Promise<void> {
  for (const dependencyPackage of workspaceDependencyPackages) {
    process.stdout.write(`[validate-consumers] building ${dependencyPackage.name}…\n`);
    const result = await $`bun run build`.cwd(dependencyPackage.packageDirectory).nothrow();
    if (result.exitCode !== 0) {
      fail(`${dependencyPackage.name} build failed with exit ${result.exitCode}`);
    }
  }

  process.stdout.write('[validate-consumers] step 1: building cinder…\n');
  const result = await $`bun run build`.cwd(repositoryRoot).nothrow();
  if (result.exitCode !== 0) fail(`bun run build failed with exit ${result.exitCode}`);
}

async function packWorkspaceDependencyTarballs(): Promise<void> {
  for (const dependencyPackage of workspaceDependencyPackages) {
    process.stdout.write(`[validate-consumers] packing ${dependencyPackage.tarballFileName}…\n`);
    if (existsSync(dependencyPackage.tarballFilePath)) {
      await Bun.file(dependencyPackage.tarballFilePath).delete();
    }
    const result = await $`bun pm pack`.cwd(dependencyPackage.packageDirectory).nothrow().quiet();
    if (result.exitCode !== 0) {
      fail(`${dependencyPackage.name} bun pm pack failed: ${result.stderr.toString()}`);
    }
    if (!existsSync(dependencyPackage.tarballFilePath)) {
      fail(
        `${dependencyPackage.name} tarball not at ${dependencyPackage.tarballFilePath} after pack.`,
      );
    }
  }
}

async function packTarball(): Promise<void> {
  process.stdout.write(
    `[validate-consumers] step 2: staged pack-for-publish → ${tarballFileName}…\n`,
  );
  // `packForPublish` runs the non-mutating staged pack and asserts the source
  // manifest is byte-identical pre- and post-pack. The resulting tarball is
  // dist-only and has zero `@cinder/*` references in any dep field or
  // exports condition (verified below by `assertPackedManifestInvariants`).
  try {
    await packForPublish();
  } catch (error) {
    fail(`pack-for-publish failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!existsSync(tarballFilePath)) fail(`Tarball not at ${tarballFilePath} after pack.`);
}

/**
 * Extract the packed `package.json` from the published tarball into the
 * given destination and return the parsed manifest. Used by
 * `assertPackedManifestInvariants` and the tarball grep gate.
 */
async function extractTarballForInspection(destinationDirectory: string): Promise<void> {
  if (existsSync(destinationDirectory)) {
    await $`rm -rf ${destinationDirectory}`;
  }
  await $`mkdir -p ${destinationDirectory}`;
  if (tarBinaryPath === null) fail(`tar binary not on PATH`);
  const result =
    await $`${tarBinaryPath} -xzf ${tarballFilePath} -C ${destinationDirectory}`.nothrow();
  if (result.exitCode !== 0) {
    fail(`tar extract failed: ${result.stderr.toString()}`);
  }
}

function assertPackedExportConditionOrder(
  exportsMap: Record<string, unknown>,
  exportKey: string,
): void {
  const entry = exportsMap[exportKey];
  if (!isObjectRecord(entry)) {
    fail(`packed exports["${exportKey}"] must be a conditional export object`);
  }

  const expectedOrder = ['types', 'browser', 'node', 'svelte', 'import', 'default'];
  const actualOrder = Object.keys(entry);
  if (actualOrder.join(',') !== expectedOrder.join(',')) {
    fail(
      `packed exports["${exportKey}"] condition order is [${actualOrder.join(', ')}], expected [${expectedOrder.join(', ')}]`,
    );
  }
}

/**
 * Assert structural invariants on the packed manifest:
 *   - No `workspace:` substrings anywhere (the dep flip would otherwise
 *     leak through `bun pm pack`).
 *   - No `@cinder/*` in any dep field or exports condition.
 *   - Svelte-aware runtime exports may resolve to shipped `src/`; upstream
 *     re-export paths whose source is not published must resolve to `dist/`.
 */
async function assertPackedManifestInvariants(extractedRoot: string): Promise<void> {
  const packedManifestPath = join(extractedRoot, 'package', 'package.json');
  const rawPackedManifest = await Bun.file(packedManifestPath).text();
  if (rawPackedManifest.includes('workspace:')) {
    fail(`packed manifest contains \`workspace:\` protocol`);
  }

  const packedManifest = parseJsonFile<{
    bin?: Record<string, string>;
    svelte?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    optionalDependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
  }>(rawPackedManifest);

  if (packedManifest.bin?.['cinder'] !== './dist/cli/index.js') {
    fail(
      `packed manifest bin.cinder is ${JSON.stringify(
        packedManifest.bin?.['cinder'],
      )}, expected "./dist/cli/index.js"`,
    );
  }
  if (packedManifest.svelte !== './src/index.ts') {
    fail(
      `packed manifest svelte is ${JSON.stringify(
        packedManifest.svelte,
      )}, expected "./src/index.ts"`,
    );
  }

  const depFields: Array<keyof typeof packedManifest> = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];
  for (const field of depFields) {
    const record = packedManifest[field];
    if (!record || typeof record !== 'object') continue;
    for (const key of Object.keys(record)) {
      if (key.startsWith('@cinder/')) {
        fail(`packed manifest ${String(field)}["${key}"] references a private workspace package`);
      }
    }
  }
  for (const dependencyName of RICH_FEATURE_DEPENDENCY_NAMES) {
    if (packedManifest.dependencies?.[dependencyName] !== undefined) {
      fail(
        `packed manifest dependencies["${dependencyName}"] keeps a rich editor/markdown package on the base install path`,
      );
    }
    if (packedManifest.peerDependencies?.[dependencyName] === undefined) {
      fail(`packed manifest is missing optional peer dependency "${dependencyName}"`);
    }
    if (packedManifest.peerDependenciesMeta?.[dependencyName]?.optional !== true) {
      fail(`packed manifest peerDependenciesMeta["${dependencyName}"].optional must be true`);
    }
  }
  for (const dependencyName of REQUIRED_PEER_DEPENDENCY_NAMES) {
    if (packedManifest.dependencies?.[dependencyName] !== undefined) {
      fail(`packed manifest dependencies["${dependencyName}"] must be a peer dependency`);
    }
    if (packedManifest.peerDependencies?.[dependencyName] === undefined) {
      fail(`packed manifest is missing required peer dependency "${dependencyName}"`);
    }
    if (packedManifest.peerDependenciesMeta?.[dependencyName]?.optional === true) {
      fail(`packed manifest peerDependenciesMeta["${dependencyName}"].optional must not be true`);
    }
  }

  const exportsMap = packedManifest.exports ?? {};
  assertPackedExportConditionOrder(exportsMap, '.');
  assertPackedExportConditionOrder(exportsMap, './button');

  const upstreamReexports = await deriveUpstreamReexports();
  const upstreamKeys = new Set(upstreamReexports.map((r) => r.cinderKey));
  for (const [key, value] of Object.entries(exportsMap)) {
    if (!isObjectRecord(value)) continue;
    const conditions = value;
    if (upstreamKeys.has(key)) {
      if ('svelte' in conditions) {
        fail(
          `packed exports["${key}"] retains a \`svelte\` condition — upstream re-export sub-paths must resolve to \`dist/\` only`,
        );
      }
      for (const [condition, target] of Object.entries(conditions)) {
        if (typeof target === 'string' && target.startsWith('./src/')) {
          fail(
            `packed exports["${key}"]["${condition}"] points at "${target}" — upstream re-exports must resolve to \`./dist/\``,
          );
        }
      }
    }
    for (const [condition, target] of Object.entries(conditions)) {
      if (
        typeof target === 'string' &&
        target.startsWith('./src/') &&
        !target.endsWith('.css') &&
        !target.endsWith('.css.d.ts') &&
        !target.endsWith('.json')
      ) {
        const sourceTargetPath = join(extractedRoot, 'package', target.slice(2));
        if (!existsSync(sourceTargetPath)) {
          fail(
            `packed exports["${key}"]["${condition}"] points at "${target}", but the tarball does not contain that source target`,
          );
        }
      }
    }
  }
}

/**
 * Run a global grep over the extracted tarball for `@cinder/*` references
 * that look like real import specifiers. Doc-comment prose and source-map
 * embedded source are tolerated because they cannot break runtime
 * resolution.
 *
 * "Looks like a real import specifier" means: the `@cinder/...` token sits
 * inside a single-quote, double-quote, OR backtick-quoted *static* string on
 * a non-comment line. Backticks are flagged in code positions because
 * `await import(\`@cinder/markdown/rendering\`)` is a valid runtime import
 * — JavaScript accepts a template literal with no interpolation as a
 * dynamic-import specifier. The JSDoc/prose backtick form `` `@cinder/x` ``
 * sits on lines that start with `*` or `//` and is filtered by the comment
 * skip below.
 */
async function assertNoQuotedCinderReferences(extractedRoot: string): Promise<void> {
  const packageRoot = join(extractedRoot, 'package');
  const glob = new Glob('**/*.{js,mjs,cjs,d.ts,d.mts,d.cts}');
  const offenders: string[] = [];
  // Patterns + comment-stripping live in `lib/cinder-specifier-residue.ts`
  // so this gate and the fast post-build gate in `build.ts` share one
  // implementation. The previous inline ladder skipped any line starting
  // with `/*` even when `*/` closed on the same line, letting
  // `/* x */ import from '@cinder/markdown'` slip through.
  for await (const scriptPath of glob.scan({ cwd: packageRoot })) {
    const filePath = join(packageRoot, scriptPath);
    const content = await Bun.file(filePath).text();
    if (!content.includes('@cinder/')) continue;
    const scanState: CommentScanState = { inBlockComment: false };
    let offenderLine: string | undefined;
    for (const rawLine of content.split('\n')) {
      if (lineHasCinderResidue(rawLine, scanState)) {
        offenderLine = rawLine.trim();
        break;
      }
    }
    if (offenderLine !== undefined) {
      offenders.push(`${scriptPath}  ←  ${offenderLine.slice(0, 120)}`);
    }
  }
  if (offenders.length > 0) {
    fail(`tarball contains quoted \`@cinder/*\` references in:\n  ${offenders.join('\n  ')}`);
  }
}

/**
 * Assert that every cinder/<pkg>/<subpath> sub-path emitted by the upstream
 * re-export generator resolves to a real file inside the packed tarball.
 * Mirrors the post-build resolution gate in `build.ts` but operates against
 * the tarball-shaped layout (`package/dist/...`).
 */
async function assertUpstreamReexportsResolveInTarball(extractedRoot: string): Promise<void> {
  const reexports = await deriveUpstreamReexports();
  const packageRoot = join(extractedRoot, 'package');
  const missing: string[] = [];
  for (const reexport of reexports) {
    const candidates = [
      join(packageRoot, 'dist', reexport.distRelativePath),
      join(packageRoot, 'dist', reexport.distRelativePath.replace(/\.js$/, '.d.ts')),
    ];
    for (const candidate of candidates) {
      if (!existsSync(candidate)) {
        missing.push(candidate.replace(packageRoot + '/', ''));
      }
    }
  }
  if (missing.length > 0) {
    fail(`tarball missing upstream re-export artifacts:\n  ${missing.join('\n  ')}`);
  }
}

async function assertNoDanglingSourceMapComments(extractedRoot: string): Promise<void> {
  const packageRoot = join(extractedRoot, 'package');
  const glob = new Glob('dist/**/*.{js,mjs,cjs}');
  const offenders: string[] = [];
  for await (const scriptPath of glob.scan({ cwd: packageRoot })) {
    const filePath = join(packageRoot, scriptPath);
    const content = await Bun.file(filePath).text();
    if (!content.includes('sourceMappingURL=')) continue;
    for (const reference of getSourceMapReferences(content)) {
      const resolvedReferencePath = resolvePath(dirname(filePath), reference.reference);
      const pathFromPackageRoot = relative(packageRoot, resolvedReferencePath);
      const resolvesInsidePackageRoot =
        pathFromPackageRoot === '' ||
        (!pathFromPackageRoot.startsWith('..') && !pathFromPackageRoot.startsWith('/'));
      if (resolvesInsidePackageRoot && existsSync(resolvedReferencePath)) continue;
      offenders.push(`${scriptPath}:${reference.line} -> ${reference.reference}`);
    }
  }
  if (offenders.length > 0) {
    fail(`tarball contains dangling sourceMappingURL comments:\n  ${offenders.join('\n  ')}`);
  }
}

type TarballExpectations = {
  required: string[];
  forbiddenPatterns: RegExp[];
  forbiddenPrefixes: string[];
};

/**
 * Build the tarball expectations from the live filesystem.
 *
 * Every directory-shaped component contributes its generated JSON sidecars and
 * built runtime/types artifacts. Experimental components contribute the same
 * paths under `experimental/`.
 *
 * This replaces the previous hand-maintained `PUBLIC_COMPONENTS` allowlist —
 * `discoverComponents()` is the same walk the exports generator uses, so the
 * two cannot drift.
 */
async function buildTarballExpectations(): Promise<TarballExpectations> {
  const components = await discoverComponents();
  const componentRequiredEntries: string[] = [];
  for (const { name, isExperimental, hasCss } of components) {
    const distributionDirectory = isExperimental
      ? `package/dist/components/experimental/${name}`
      : `package/dist/components/${name}`;
    // Published component sub-paths resolve through `dist/`; source CSS and
    // JSON sidecars still ship because style and sidecar exports target them.
    componentRequiredEntries.push(
      `${distributionDirectory}/index.js`,
      `${distributionDirectory}/index.d.ts`,
    );
    if (hasCss) {
      componentRequiredEntries.push(
        `${distributionDirectory}/${name}.css`,
        `${distributionDirectory}/${name}.css.d.ts`,
      );
    }
  }
  return {
    required: [
      'package/package.json',
      'package/src/index.ts',
      'package/src/styles/index.css',
      'package/src/styles/all.css',
      'package/src/styles/tokens.css',
      'package/src/styles/tokens-base.css',
      'package/src/styles/foundation.css',
      'package/src/styles/components.css',
      'package/src/styles/utilities.css',
      // Type stubs for every reserved `./styles*` subpath. The `types`
      // condition in package.json#exports points at these files; if they are
      // absent consumers see "Cannot find module or type declarations for
      // side-effect import" under moduleResolution: bundler.
      'package/src/styles/index.css.d.ts',
      'package/src/styles/all.css.d.ts',
      'package/src/styles/tokens.css.d.ts',
      'package/src/styles/foundation.css.d.ts',
      'package/src/styles/utilities.css.d.ts',
      // The `./styles/guard` export's `svelte` condition points at
      // `./src/styles/base-guard.ts`; ship the source so Svelte-aware
      // consumers don't resolve a dangling path (build emits only
      // `dist/styles/base-guard.js`).
      'package/src/styles/base-guard.ts',
      'package/dist/index.d.ts',
      'package/dist/index.js',
      'package/dist/server/index.js',
      'package/dist/cli/index.js',
      // First-party Shiki adapter: ship both source (for the `svelte`
      // condition) and built JS + types (for `default`/`node`).
      'package/src/highlighters/shiki/index.ts',
      'package/dist/highlighters/shiki/index.js',
      'package/dist/highlighters/shiki/index.d.ts',
      ...componentRequiredEntries,
    ],
    // PR 1: `src/markdown/**`, `src/editor/**`, `src/commentary/**`, and
    // `src/diff/**` (the generated re-export shells) stay out of the
    // tarball — upstream sub-paths resolve through `dist/` only. The rest
    // of `src/**` (component Svelte/TS source, utilities, `_internal/`,
    // styles, JSON sidecars) ships because the published `svelte`
    // condition on component sub-paths targets it.
    forbiddenPatterns: [
      /\.(test|spec)\.[cm]?[jt]s$/,
      /\.type-test\./,
      /(^|\/)[^/]*-fixtures\./,
      /(^|\/)[^/]*fixtures\./,
      /(^|\/)_.*-test-harness\./,
      /\.js\.map$/,
      /\.a11y\.md$/,
    ],
    forbiddenPrefixes: [
      'package/fixtures/',
      'package/tmp/',
      'package/dist/client/',
      'package/dist/test/',
      'package/scripts/',
      // Upstream re-export shells (`src/markdown/`, `src/editor/`,
      // `src/commentary/`, `src/diff/`) resolve via `dist/_upstream/`; the
      // shell sources are build-only inputs.
      'package/src/markdown/',
      'package/src/editor/',
      'package/src/commentary/',
      'package/src/diff/',
    ],
  };
}

async function inspectTarball(): Promise<void> {
  process.stdout.write('[validate-consumers] step 3: inspecting tarball…\n');
  if (tarBinaryPath === null) {
    fail('tar is required to inspect the packed tarball. Install a tar CLI and re-run.');
  }
  const tarballExpectations = await buildTarballExpectations();
  // Bun's $ passes `tarballFilePath` as a single argv value, not interpolated into a shell
  // string, so it can't be split on whitespace or interpreted as flags. BSD tar (macOS) doesn't
  // accept `--` as end-of-options the way GNU tar does, so omitting it is correct here.
  const listingResult = await $`${tarBinaryPath} -tzf ${tarballFilePath}`
    .cwd(repositoryRoot)
    .nothrow()
    .quiet();
  if (listingResult.exitCode !== 0) {
    fail(
      `tar failed while listing ${tarballFileName}:\nstdout: ${listingResult.stdout.toString()}\nstderr: ${listingResult.stderr.toString()}`,
    );
  }
  const entries = listingResult.stdout
    .toString()
    .split('\n')
    .filter((entry) => entry.length > 0);

  const missingEntries = tarballExpectations.required.filter(
    (required) => !entries.includes(required),
  );
  if (missingEntries.length) {
    fail(`Tarball missing required entries:\n  ${missingEntries.join('\n  ')}`);
  }

  const leakedEntries = [
    ...tarballExpectations.forbiddenPrefixes.flatMap((forbiddenPrefix) =>
      entries.filter((entry) => entry.startsWith(forbiddenPrefix)),
    ),
    ...tarballExpectations.forbiddenPatterns.flatMap((forbiddenPattern) =>
      entries.filter((entry) => forbiddenPattern.test(entry)),
    ),
  ];
  if (leakedEntries.length) {
    fail(`Tarball contains forbidden entries:\n  ${leakedEntries.join('\n  ')}`);
  }

  const packedSize = statSync(tarballFilePath).size;
  process.stdout.write(
    `[validate-consumers] package artifact: ${entries.length} files, ${(packedSize / 1_000_000).toFixed(2)} MB packed.\n`,
  );

  // Every published `*/styles` export must resolve to a real CSS artifact
  // inside the tarball. `generate-exports.ts` gates emission on the source
  // sidecar existing (`hasCss`), but that only proves the input — this is the
  // post-build assertion that catches a CSS file silently dropped from the
  // build output (e.g. a build step that skips a component, a `files`
  // whitelist that omits the path).
  const packageJsonPath = join(repositoryRoot, 'package.json');
  const packageJsonContent = parseJsonFile<{
    exports?: Record<string, { types?: string; default?: string }>;
  }>(await Bun.file(packageJsonPath).text());
  const stylesExports = Object.entries(packageJsonContent.exports ?? {}).filter(
    ([key, entry]) =>
      key.endsWith('/styles') && key !== './styles' && typeof entry.default === 'string',
  );
  const tarballEntrySet = new Set(entries);
  const danglingStylesExports: string[] = [];
  const missingStylesTypeTargets: string[] = [];
  for (const [key, entry] of stylesExports) {
    if (typeof entry.types !== 'string') {
      missingStylesTypeTargets.push(`${key} is missing a string "types" target`);
      continue;
    }
    const tarballTypesEntry = `package/${entry.types.replace(/^\.\//, '')}`;
    if (!tarballEntrySet.has(tarballTypesEntry)) {
      missingStylesTypeTargets.push(
        `${key} -> ${entry.types} (expected tarball entry ${tarballTypesEntry})`,
      );
    }
    // package.json `default` paths are package-relative (`./dist/...`); npm
    // pack rewrites tarball entries as `package/dist/...`.
    const tarballEntry = `package/${entry.default!.replace(/^\.\//, '')}`;
    if (!tarballEntrySet.has(tarballEntry)) {
      danglingStylesExports.push(
        `${key} -> ${entry.default} (expected tarball entry ${tarballEntry})`,
      );
    }
  }
  if (danglingStylesExports.length > 0) {
    fail(
      `Tarball is missing CSS artifacts for published /styles exports:\n  ${danglingStylesExports.join('\n  ')}`,
    );
  }
  if (missingStylesTypeTargets.length > 0) {
    fail(
      `Tarball is missing style type declaration artifacts for published /styles exports:\n  ${missingStylesTypeTargets.join('\n  ')}`,
    );
  }
}

/** Allocate an ephemeral port so concurrent CI runs don't collide on a shared one.
 *
 * NOTE: brief TOCTOU window between closing the probe server and the fixture server binding
 * the port. Accepted tradeoff — alternative requires modifying the fixture server's startup
 * contract. In practice the window is sub-millisecond and the ephemeral range is wide enough
 * that conflicts are rare even under parallel CI runs.
 */
async function pickEphemeralPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const probeServer = createServer();
    probeServer.once('error', reject);
    probeServer.listen(0, '127.0.0.1', () => {
      const address = probeServer.address();
      if (address === null || typeof address === 'string') {
        probeServer.close();
        reject(new Error('unexpected server address shape'));
        return;
      }
      const port = address.port;
      probeServer.close(() => resolve(port));
    });
  });
}

/**
 * Point a fixture's `package.json#dependencies.cinder` at the just-built tarball and return
 * a restore function that reverts the file back to its committed state. Fixtures ship with a
 * `CINDER_TARBALL_PLACEHOLDER.tgz` path; this function rewrites it to the real
 * `cinder-<version>.tgz` so version bumps don't silently install a stale (or missing)
 * tarball, and the restore runs in a `finally` so the working tree stays clean.
 */
function injectTarballIntoFixture(
  fixtureDirectory: string,
  options: {
    svelteVersion?: string;
    typescriptVersion?: string;
    includeRichFeatureDependencies?: boolean;
    includeWorkspaceDependencyPackages?: boolean;
  } = {},
): () => void {
  const manifestPath = join(fixtureDirectory, 'package.json');
  const originalContent = readFileSync(manifestPath, 'utf8');
  const parsed: unknown = JSON.parse(originalContent);
  if (!isObjectRecord(parsed)) {
    fail(`${manifestPath} is not a JSON object`);
  }
  const dependencies = parsed['dependencies'];
  if (!isObjectRecord(dependencies)) {
    fail(`${manifestPath} is missing a dependencies object`);
  }
  const rawOverrides = parsed['overrides'];
  if (rawOverrides !== undefined && !isObjectRecord(rawOverrides)) {
    fail(`${manifestPath} has an overrides field that is not a JSON object`);
  }
  const overrides: Record<string, unknown> = rawOverrides ?? {};
  parsed['overrides'] = overrides;
  const rawPeerDependencies = parseJsonFile<{
    peerDependencies?: Record<string, string>;
  }>(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')).peerDependencies;

  dependencies['@lostgradient/cinder'] = `file:${tarballFilePath}`;
  for (const dependencyName of REQUIRED_PEER_DEPENDENCY_NAMES) {
    const version = rawPeerDependencies?.[dependencyName];
    if (version === undefined) {
      fail(`@lostgradient/cinder/package.json is missing peer dependency "${dependencyName}"`);
    }
    dependencies[dependencyName] = version;
  }
  if (options.svelteVersion !== undefined || options.typescriptVersion !== undefined) {
    const rawDevDependencies = parsed['devDependencies'];
    if (!isObjectRecord(rawDevDependencies)) {
      fail(
        `${manifestPath} is missing a devDependencies object for compatibility testing overrides`,
      );
    }
    if (options.svelteVersion !== undefined) {
      rawDevDependencies['svelte'] = options.svelteVersion;
    }
    if (options.typescriptVersion !== undefined) {
      rawDevDependencies['typescript'] = options.typescriptVersion;
    }
  }
  if (options.includeRichFeatureDependencies !== false) {
    for (const dependencyName of RICH_FEATURE_DEPENDENCY_NAMES) {
      const version = rawPeerDependencies?.[dependencyName];
      if (version === undefined) {
        fail(`@lostgradient/cinder/package.json is missing peer dependency "${dependencyName}"`);
      }
      dependencies[dependencyName] = version;
    }
  }
  if (options.includeWorkspaceDependencyPackages !== false) {
    for (const dependencyPackage of workspaceDependencyPackages) {
      const fileSpecifier = `file:${dependencyPackage.tarballFilePath}`;
      dependencies[dependencyPackage.name] = fileSpecifier;
      overrides[dependencyPackage.name] = fileSpecifier;
    }
  }
  writeFileSync(manifestPath, JSON.stringify(parsed, null, 2) + '\n');
  return () => writeFileSync(manifestPath, originalContent);
}

async function runStylesConsumerFixture(): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/styles-consumer');
  process.stdout.write('[validate-consumers] step: styles-consumer (base install shape)…\n');

  const restoreManifest = injectTarballIntoFixture(fixtureDirectory, {
    includeRichFeatureDependencies: false,
    includeWorkspaceDependencyPackages: false,
  });

  try {
    await $`rm -rf node_modules dist`.cwd(fixtureDirectory);
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) {
      fail(
        `styles-consumer bun install failed:\n${installResult.stdout.toString()}\n${installResult.stderr.toString()}`,
      );
    }

    const fixtureNodeModulesDirectory = join(fixtureDirectory, 'node_modules');
    const installedPackageNames = collectInstalledPackageNamesFromNodeModulesTree(
      fixtureNodeModulesDirectory,
    );
    const leakedPackages = RICH_FEATURE_LEAK_CHECK_NAMES.filter((dependencyName) =>
      installedPackageNames.has(dependencyName),
    );
    if (leakedPackages.length > 0) {
      fail(
        `styles-consumer installed rich editor/markdown packages on a styles-only path:\n  ${leakedPackages.join('\n  ')}`,
      );
    }

    const buildResult = await $`bun run build`.cwd(fixtureDirectory).nothrow();
    if (buildResult.exitCode !== 0) {
      fail(
        `styles-consumer build failed:\n${buildResult.stdout.toString()}\n${buildResult.stderr.toString()}`,
      );
    }

    process.stdout.write('[validate-consumers] styles-consumer OK.\n');
  } finally {
    restoreManifest();
  }
}

function generateTypescriptConsumerProbe(fixtureDirectory: string, label: string): void {
  const generateResult = Bun.spawnSync([nodeBinaryPath, 'generate-probe.mjs'], {
    cwd: fixtureDirectory,
    env: { ...Bun.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
  });
  if (generateResult.exitCode !== 0) {
    fail(
      `typescript-consumer ${label} generate-probe.mjs failed:\n${generateResult.stdout.toString()}\n${generateResult.stderr.toString()}`,
    );
  }
}

async function runTypescriptConsumerSvelteGate(
  fixtureDirectory: string,
  label: string,
): Promise<void> {
  generateTypescriptConsumerProbe(fixtureDirectory, label);

  const tscResult = await $`bunx tsc --noEmit -p tsconfig.svelte.json`
    .cwd(fixtureDirectory)
    .nothrow();
  if (tscResult.exitCode !== 0) {
    fail(
      `typescript-consumer ${label} tsc with Svelte condition failed:\n${tscResult.stdout.toString()}\n${tscResult.stderr.toString()}`,
    );
  }

  const checkResult = await $`bunx svelte-check --tsconfig tsconfig.json --threshold error`
    .cwd(fixtureDirectory)
    .nothrow();
  if (checkResult.exitCode !== 0) {
    fail(
      `typescript-consumer ${label} svelte-check failed:\n${checkResult.stdout.toString()}\n${checkResult.stderr.toString()}`,
    );
  }
}

type InstallLikeResult = {
  stdout: { toString(): string };
  stderr: { toString(): string };
};

function assertNoPeerDependencyWarnings(installResult: InstallLikeResult, label: string): void {
  const installOutput = `${installResult.stdout.toString()}\n${installResult.stderr.toString()}`;
  const peerWarningPatterns = [
    /issues with peer dependencies found/i,
    /unmet peer/i,
    /incorrect peer dependency/i,
  ];
  if (peerWarningPatterns.some((pattern) => pattern.test(installOutput))) {
    fail(
      `typescript-consumer ${label} bun install reported peer dependency warnings:\n${installOutput}`,
    );
  }
}

async function runTypescriptConsumerNodenextGate(
  fixtureDirectory: string,
  label: string,
): Promise<void> {
  generateTypescriptConsumerProbe(fixtureDirectory, label);

  const result = await $`bunx tsc --noEmit -p tsconfig.nodenext.json`
    .cwd(fixtureDirectory)
    .nothrow();
  if (result.exitCode !== 0) {
    fail(
      `typescript-consumer ${label} NodeNext without Svelte condition failed:\n${result.stdout.toString()}\n${result.stderr.toString()}`,
    );
  }
}

async function runSveltePeerCompatibilityFixture(
  label: string,
  svelteVersion: string,
): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/typescript-consumer');
  process.stdout.write(
    `[validate-consumers] step: svelte peer compatibility (${label}: ${svelteVersion})…\n`,
  );
  const restoreManifest = injectTarballIntoFixture(fixtureDirectory, { svelteVersion });

  try {
    await $`rm -rf node_modules src/generated`.cwd(fixtureDirectory);
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) {
      fail(
        `typescript-consumer ${label} bun install failed for svelte@${svelteVersion}:\n${installResult.stdout.toString()}\n${installResult.stderr.toString()}`,
      );
    }
    await runTypescriptConsumerSvelteGate(fixtureDirectory, label);
    process.stdout.write(
      `[validate-consumers] svelte peer compatibility OK (${label}: ${svelteVersion}).\n`,
    );
  } finally {
    restoreManifest();
  }
}

async function runTypescriptCompatibilityFixture(
  label: string,
  typescriptVersion: string,
): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/typescript-consumer');
  process.stdout.write(
    `[validate-consumers] step: typescript compatibility (${label}: ${typescriptVersion})…\n`,
  );
  const restoreManifest = injectTarballIntoFixture(fixtureDirectory, { typescriptVersion });

  try {
    await $`rm -rf node_modules src/generated`.cwd(fixtureDirectory);
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) {
      fail(
        `typescript-consumer ${label} bun install failed for typescript@${typescriptVersion}:\n${installResult.stdout.toString()}\n${installResult.stderr.toString()}`,
      );
    }
    assertNoPeerDependencyWarnings(installResult, label);
    await runTypescriptConsumerSvelteGate(fixtureDirectory, label);
    await runTypescriptConsumerNodenextGate(fixtureDirectory, label);
    process.stdout.write(
      `[validate-consumers] typescript compatibility OK (${label}: ${typescriptVersion}).\n`,
    );
  } finally {
    restoreManifest();
  }
}

function ensureSvelteKitAdapterNodeStaticAssetLink(fixtureDirectory: string): void {
  const clientDirectory = join(fixtureDirectory, 'build/client');
  const chunkRelativeClientDirectory = join(fixtureDirectory, 'build/server/chunks/client');

  if (!existsSync(clientDirectory) || existsSync(chunkRelativeClientDirectory)) return;
  if (!existsSync(dirname(chunkRelativeClientDirectory))) return;

  try {
    symlinkSync('../../client', chunkRelativeClientDirectory, 'dir');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(
      `sveltekit-consumer could not expose adapter-node static assets for runtime CSS verification: ${message}`,
    );
  }
}

const SVELTEKIT_DEV_SSR_MARKERS = [
  'data-dev-ssr-card-body',
  'data-dev-ssr-sidebar-brand',
  'data-dev-ssr-sidebar-navigation',
  'data-dev-ssr-side-navigation-item',
  'data-dev-ssr-tabs-namespace-trigger',
  'data-dev-ssr-tabs-namespace-panel',
  'data-dev-ssr-tabs-direct-trigger',
  'data-dev-ssr-tabs-direct-panel',
];

const SVELTEKIT_DEV_SSR_READINESS_TIMEOUT_MS = 25_000;
const SVELTEKIT_DEV_SSR_POLL_INTERVAL_MS = 200;

function formatHtmlExcerpt(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 1_000);
}

function extractCinderSourceMapWarnings(logOutput: string): string[] {
  const warningLines = logOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('@lostgradient/cinder/dist/'))
    .filter((line) => /(sourcemap|source map|\.js\.map)/i.test(line))
    .filter((line) =>
      /(missing|not found|can't resolve|could not read|enoent|points to missing)/i.test(line),
    );
  return [...new Set(warningLines)];
}

async function assertSvelteKitDevSsrRoute(fixtureDirectory: string, label: string): Promise<void> {
  const httpPort = await pickEphemeralPort();
  let devSsrAssertionsPassed = false;
  const devServer = Bun.spawn(
    ['bunx', 'vite', 'dev', '--host', '127.0.0.1', '--port', String(httpPort), '--strictPort'],
    {
      cwd: fixtureDirectory,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...Bun.env,
        TZ: 'UTC',
        LANG: 'en_US.UTF-8',
      },
    },
  );
  const devServerStdout = devServer.stdout
    ? new Response(devServer.stdout).text()
    : Promise.resolve('');
  const devServerStderr = devServer.stderr
    ? new Response(devServer.stderr).text()
    : Promise.resolve('');

  try {
    const routeUrl = `http://127.0.0.1:${httpPort}/dev-ssr`;
    const body = await waitForReadyHtml({
      url: routeUrl,
      timeoutMs: SVELTEKIT_DEV_SSR_READINESS_TIMEOUT_MS,
      pollIntervalMs: SVELTEKIT_DEV_SSR_POLL_INTERVAL_MS,
      runningServer: devServer,
      isReady: (html) => SVELTEKIT_DEV_SSR_MARKERS.every((marker) => html.includes(marker)),
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      fail(`sveltekit-consumer ${label} /dev-ssr dev SSR readiness failed: ${message}`);
    });

    const missingMarkers = SVELTEKIT_DEV_SSR_MARKERS.filter((marker) => !body.includes(marker));
    if (missingMarkers.length > 0) {
      fail(
        `sveltekit-consumer ${label} /dev-ssr dev SSR missing marker(s): ${missingMarkers.join(', ')}\n${formatHtmlExcerpt(body)}`,
      );
    }

    devSsrAssertionsPassed = true;
  } finally {
    devServer.kill();
    await devServer.exited;
    const devServerOutput = `${await devServerStdout}\n${await devServerStderr}`;
    const sourceMapWarnings = extractCinderSourceMapWarnings(devServerOutput);
    if (sourceMapWarnings.length > 0) {
      const warningMessage =
        `sveltekit-consumer ${label} dev SSR emitted source-map warnings for published cinder dist artifacts:\n` +
        sourceMapWarnings.map((warning) => `  ${warning}`).join('\n');
      // Preserve the primary SSR failure if one occurred in the try block.
      if (!devSsrAssertionsPassed) {
        process.stderr.write(`[validate-consumers] ${warningMessage}\n`);
      } else {
        fail(warningMessage);
      }
    }
  }
}

async function runSveltekitFixture(label = 'workspace', svelteVersion?: string): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/sveltekit-consumer');
  process.stdout.write(
    `[validate-consumers] step 4: sveltekit-consumer (${label}${svelteVersion ? `: ${svelteVersion}` : ''})…\n`,
  );

  const restoreManifest =
    svelteVersion === undefined
      ? injectTarballIntoFixture(fixtureDirectory)
      : injectTarballIntoFixture(fixtureDirectory, { svelteVersion });

  try {
    await $`rm -rf node_modules .svelte-kit build`.cwd(fixtureDirectory);
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) {
      fail(
        `sveltekit-consumer ${label} bun install failed:\n${installResult.stdout.toString()}\n${installResult.stderr.toString()}`,
      );
    }

    const syncResult = await $`bunx svelte-kit sync`.cwd(fixtureDirectory).nothrow();
    if (syncResult.exitCode !== 0) {
      fail(
        `svelte-kit sync failed in sveltekit-consumer ${label}:\n${syncResult.stdout.toString()}\n${syncResult.stderr.toString()}`,
      );
    }

    const checkResult = await $`bunx svelte-check --tsconfig tsconfig.json --threshold error`
      .cwd(fixtureDirectory)
      .nothrow();
    if (checkResult.exitCode !== 0) {
      fail(
        `svelte-check failed in sveltekit-consumer ${label}:\n${checkResult.stdout.toString()}\n${checkResult.stderr.toString()}`,
      );
    }

    await assertSvelteKitDevSsrRoute(fixtureDirectory, label);

    const viteBuildResult = await $`bunx vite build`.cwd(fixtureDirectory).nothrow();
    if (viteBuildResult.exitCode !== 0) {
      fail(
        `vite build failed in sveltekit-consumer ${label}:\n${viteBuildResult.stdout.toString()}\n${viteBuildResult.stderr.toString()}`,
      );
    }
    ensureSvelteKitAdapterNodeStaticAssetLink(fixtureDirectory);

    // Scan BOTH the intermediate Vite output and the final adapter-node output. SvelteKit's
    // CSS layout in `.svelte-kit/output/` is version-dependent; asserting only there risks a
    // false green if a future SvelteKit version moves the CSS.
    const combinedStylesheet = await readAllBuiltStylesheets([
      join(fixtureDirectory, '.svelte-kit/output'),
      join(fixtureDirectory, 'build'),
    ]);
    if (!combinedStylesheet.includes('.cinder-button')) {
      fail(`no built CSS file contains .cinder-button — check ./styles export`);
    }
    if (!combinedStylesheet.includes('@layer cinder')) {
      fail(`no built CSS contains @layer cinder — @layer declaration lost during bundling`);
    }

    // À la carte CSS contract — AST assertions (no text grep).
    //
    // The /a-la-carte route imports only `@lostgradient/cinder/button` + `@lostgradient/cinder/button/styles`
    // + tokens + foundation. Its route-scoped CSS must contain a button selector
    // and a `--cinder-button-*` custom property, and must NOT leak any selector
    // or custom property unique to the accordion component.
    const aLaCarteCss = await readRouteCssArtifacts(
      fixtureDirectory,
      'src/routes/a-la-carte/+page.svelte',
    );
    if (!hasSelectorContaining(aLaCarteCss, '.cinder-button')) {
      fail(`/a-la-carte route CSS missing .cinder-button selector (à la carte presence)`);
    }
    if (!hasCustomPropertyStartingWith(aLaCarteCss, '--cinder-button-')) {
      fail(
        `/a-la-carte route CSS missing any --cinder-button-* custom property (à la carte presence)`,
      );
    }
    if (hasSelectorContaining(aLaCarteCss, '.cinder-accordion')) {
      fail(`/a-la-carte route CSS leaked .cinder-accordion selector (à la carte absence)`);
    }
    if (hasCustomPropertyStartingWith(aLaCarteCss, '--cinder-accordion-')) {
      fail(
        `/a-la-carte route CSS leaked --cinder-accordion-* custom property (à la carte absence)`,
      );
    }

    // Auto-CSS import contract: the /no-styles route imports `@lostgradient/cinder/button`
    // ONLY — no `/styles` subpath, no aggregator — and its route-scoped CSS
    // MUST contain the button selectors anyway, because importing a component
    // now pulls its CSS as a side effect. This is the whole point of the
    // auto-CSS change: a consumer can no longer forget the style import and end
    // up with a silently-unstyled component. (The route name is historical —
    // it once tested the opposite, pre-auto-CSS contract.)
    //
    // Triangulation against false-positives (route walk silently broken):
    //   1. The /a-la-carte assertion above proved the route-scoped walk DOES
    //      surface .cinder-button when the route opts into the CSS.
    //   2. The build-wide combinedStylesheet check above proved .cinder-button
    //      exists somewhere in the client CSS output.
    //   3. readRouteCssArtifacts resolves the SvelteKit wrapper or fails loudly.
    // Together these mean the presence assertion below is meaningful: the walk
    // works, so finding .cinder-button proves the bare `@lostgradient/cinder/button` import
    // pulled its CSS.
    const noStylesCss = await readRouteCssArtifacts(
      fixtureDirectory,
      'src/routes/no-styles/+page.svelte',
    );
    if (!hasSelectorContaining(noStylesCss, '.cinder-button')) {
      fail(
        `/no-styles route CSS is missing .cinder-button — a bare \`@lostgradient/cinder/button\` import did NOT auto-pull its CSS (the auto-CSS side-effect contract is broken)`,
      );
    }
    // NOTE: we assert the `.cinder-button` SELECTOR only, not `--cinder-button-*`
    // custom properties. The component sidecar (button.css) only *consumes* those
    // properties via `var(...)`; their *declarations* live in `@lostgradient/cinder/styles`
    // (the tokens/foundation base), which the /no-styles route does not import.
    // So the auto-CSS contract here is exactly "the component's own selectors
    // arrive", which is what proves the import pulled the sidecar.

    const chatLayoutCss = await readRouteCssArtifacts(
      fixtureDirectory,
      'src/routes/chat-layout/+page.svelte',
    );
    const chatLayoutDeclarations: Array<[string, string, string]> = [
      ['.chat-container', 'display', 'flex'],
      ['.chat-container', 'flex-direction', 'column'],
      ['.chat-container', 'height', '100%'],
      ['.chat-container', 'min-height', '0'],
      ['.chat-timeline', 'flex', '1'],
      ['.chat-timeline', 'min-height', '0'],
      ['.chat-timeline', 'overflow-y', 'auto'],
    ];
    for (const [selectorFragment, prop, value] of chatLayoutDeclarations) {
      if (!hasDeclaration(chatLayoutCss, selectorFragment, prop, value)) {
        fail(
          `/chat-layout route CSS missing ${selectorFragment} { ${prop}: ${value} } — the exported Chat consumer build lost its internal scroll layout contract`,
        );
      }
    }

    // Always-rendered components (not lazy-mount): their root class MUST appear in SSR HTML.
    // Modal, Dropdown, Tooltip are lazy-mount — they render only the trigger surface at open=false.
    const ALWAYS_RENDERED_CLASSES = [
      'cinder-accordion',
      'cinder-alert',
      'cinder-badge',
      'cinder-button',
      'cinder-data-list',
      'cinder-empty-state',
      'cinder-input-field',
      'cinder-navigation-bar',
      'cinder-pagination',
      'cinder-select-field',
      'cinder-skeleton',
      'cinder-spinner',
      'cinder-textarea-field',
      'cinder-toggle',
    ];

    // Strings that must be ABSENT from the `/` route's SSR HTML, each with the
    // reason it is forbidden (so a future false positive is not misdiagnosed).
    //
    // The ShareCard native-share entry catches an *always-render* regression: the
    // button is hydration-gated (depends on `navigator.share`, gated behind a
    // `hydrated` $effect), so if it were rendered unconditionally (e.g. pushed into
    // the rendered action list without a client-only gate) it would leak into SSR
    // and trip here. It does NOT catch the flag-CHOICE regression (gating on a bare
    // browser flag vs `hydrated`): `esm-env`'s `BROWSER` is false in the server
    // build, so both gates produce identical SSR HTML — the difference is
    // observable only in a real client hydration pass, which `fetch()` here does
    // not perform. That residual is tracked as a shared hydration-mismatch harness
    // task.
    const SSR_ABSENT_STRINGS = [
      {
        string: '<dialog',
        reason: 'lazy-mount overlay (Modal) must not render in default-closed SSR',
      },
      {
        string: 'role="menu"',
        reason: 'lazy-mount menu (Dropdown) must not render in default-closed SSR',
      },
      {
        string: 'data-cinder-action="native-share"',
        reason:
          "ShareCard's native-share button is hydration-gated and must not be rendered unconditionally into SSR",
      },
    ];

    const httpPort = await pickEphemeralPort();
    const fixtureServer = Bun.spawn([nodeBinaryPath, 'build/index.js'], {
      cwd: fixtureDirectory,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...Bun.env,
        PORT: String(httpPort),
        HOST: '127.0.0.1',
        TZ: 'UTC',
        LANG: 'en_US.UTF-8',
      },
    });

    try {
      await waitForUrl(`http://127.0.0.1:${httpPort}/`, 10_000, fixtureServer);

      // Barrel page
      const response = await fetchWithTimeout(
        `http://127.0.0.1:${httpPort}/`,
        10_000,
        'sveltekit-consumer / SSR',
      );
      if (response.status !== 200) fail(`fixture / returned ${response.status}, want 200`);
      const body = await response.text();
      for (const cls of ALWAYS_RENDERED_CLASSES) {
        if (!body.includes(cls)) {
          fail(`fixture HTML (/) does not contain class "${cls}"`);
        }
      }
      for (const { string: absent, reason } of SSR_ABSENT_STRINGS) {
        if (body.includes(absent)) {
          fail(`fixture HTML (/) should not contain "${absent}": ${reason}`);
        }
      }

      // ShareCard SSR contract (only on `/`, where it is mounted). Pairs with the
      // `data-cinder-action="native-share"` entry in SSR_ABSENT_STRINGS: the root
      // MUST render server-side (proving the component SSRs at all), while the
      // native-share button MUST NOT (proving it is not rendered unconditionally).
      // Asserting both on the same SSR body is what makes the absence meaningful —
      // without the presence check, a component that failed to render entirely
      // would also pass the absence check. This is an SSR-leak guard, not a
      // hydration-mismatch guard (see the SSR_ABSENT_STRINGS note above).
      if (!body.includes('cinder-share-card')) {
        fail(`fixture HTML (/) does not contain class "cinder-share-card" (ShareCard did not SSR)`);
      }
      if (!body.includes('data-fixture-nav-toggle="barrel"')) {
        fail(
          'fixture HTML (/) is missing the NavigationBar menuToggle trigger marker (barrel route SSR did not render the toggle snippet)',
        );
      }

      await assertSvelteKitClientHydrates(httpPort, label, '/subpath');

      // Subpath page
      const subpathResponse = await fetchWithTimeout(
        `http://127.0.0.1:${httpPort}/subpath`,
        10_000,
        'sveltekit-consumer /subpath SSR',
      );
      if (subpathResponse.status !== 200)
        fail(`fixture /subpath returned ${subpathResponse.status}, want 200`);
      const subpathBody = await subpathResponse.text();
      for (const cls of ALWAYS_RENDERED_CLASSES) {
        if (!subpathBody.includes(cls)) {
          fail(`fixture HTML (/subpath) does not contain class "${cls}"`);
        }
      }
      if (!subpathBody.includes('data-fixture-nav-toggle="subpath"')) {
        fail(
          'fixture HTML (/subpath) is missing the NavigationBar menuToggle trigger marker (subpath route SSR did not render the toggle snippet)',
        );
      }

      async function assertRenderedRouteServesButtonCss(
        routePath: '/a-la-carte',
        contractLabel: string,
      ): Promise<void> {
        // Runtime-truth check for route CSS. Fetch the rendered route HTML,
        // extract every stylesheet href, fetch each through the running server,
        // and assert that AT LEAST ONE contains `.cinder-button`. The server is
        // the source of truth for what the route actually loads and avoids
        // fragile on-disk path resolution (relative hrefs like
        // `../_app/immutable/...` would otherwise resolve outside the client
        // output directory and silently be skipped).
        const routeResponse = await fetchWithTimeout(
          `http://127.0.0.1:${httpPort}${routePath}`,
          10_000,
          `sveltekit-consumer ${routePath} SSR`,
        );
        if (routeResponse.status !== 200) {
          fail(`fixture ${routePath} returned ${routeResponse.status}, want 200`);
        }
        const routeBody = await routeResponse.text();
        // Match every <link> tag, then check attributes order-insensitively.
        // SvelteKit can emit href before rel, and `rel` is a space-separated
        // token list (`rel="preload stylesheet"`) — we must not miss stylesheets
        // because of attribute ordering or compound rel values.
        const linkTagPattern = /<link\b[^>]*>/gi;
        const routeUrl = `http://127.0.0.1:${httpPort}${routePath}`;
        const stylesheetHrefs: string[] = [];
        for (const match of routeBody.matchAll(linkTagPattern)) {
          const tag = match[0];
          const relMatch = /\brel\s*=\s*["']([^"']+)["']/i.exec(tag);
          if (!relMatch) continue;
          const relTokens = relMatch[1]!.toLowerCase().split(/\s+/);
          if (!relTokens.includes('stylesheet')) continue;
          const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
          if (!hrefMatch) continue;
          stylesheetHrefs.push(hrefMatch[1]!);
        }

        let buttonCssServed = false;
        for (const href of stylesheetHrefs) {
          const stylesheetUrl = new URL(href, routeUrl).toString();
          const stylesheetResponse = await fetchWithTimeout(
            stylesheetUrl,
            10_000,
            `${routePath} stylesheet fetch`,
          );
          if (stylesheetResponse.status !== 200) {
            fail(
              `${routePath} references stylesheet ${href} (resolved to ${stylesheetUrl}) which returned ${stylesheetResponse.status} — cannot verify the ${contractLabel} styles contract`,
            );
          }
          const source = await stylesheetResponse.text();
          // Require the `.cinder-button` SELECTOR (the component sidecar), not a
          // `--cinder-button-*` token: those custom properties are declared by
          // `@lostgradient/cinder/styles` (the tokens/foundation base) and can appear without
          // the component sidecar, so a token-only match would pass even when the
          // route-specific CSS import contract is broken.
          if (source.includes('.cinder-button')) {
            buttonCssServed = true;
          }
        }
        if (!buttonCssServed) {
          fail(
            `${routePath} rendered HTML references no stylesheet containing button CSS — ${contractLabel} did not reach runtime SSR HTML`,
          );
        }
      }

      // `/no-styles` is intentionally not checked through rendered SSR HTML:
      // SvelteKit's server manifest resolves the CSS-free `node` condition, so
      // that route has no SSR stylesheet links even though its client route
      // manifest includes `.cinder-button`. The client-manifest route walk above
      // is the contract check for bare-import auto-CSS.
      await assertRenderedRouteServesButtonCss(
        '/a-la-carte',
        'explicit `@lostgradient/cinder/button/styles` import',
      );
    } finally {
      fixtureServer.kill();
      await fixtureServer.exited;
    }
  } finally {
    restoreManifest();
  }
}

async function assertSvelteKitClientHydrates(
  httpPort: number,
  label: string,
  routePath: '/subpath',
): Promise<void> {
  const { chromium } = await import('@playwright/test');
  const browser = await promiseWithTimeout(
    chromium.launch(),
    15_000,
    'launching Chromium for SvelteKit hydration validation',
  );
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' ||
      (message.type() === 'warning' && isHydrationConsoleWarning(text))
    ) {
      errors.push(text);
    }
  });

  try {
    await page.goto(`http://127.0.0.1:${httpPort}${routePath}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 5_000 });
    await page.getByRole('heading', { name: /subpath imports/i }).waitFor({ timeout: 5_000 });
    await page.getByRole('button', { name: 'subpath button' }).waitFor({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Subpath accordion' }).waitFor({ timeout: 5_000 });
    if (errors.length > 0) {
      fail(
        `sveltekit-consumer ${label} ${routePath} emitted client hydration/runtime errors:\n${errors.map((error) => `  ${error}`).join('\n')}`,
      );
    }
  } finally {
    await promiseWithTimeout(
      browser.close(),
      5_000,
      'closing Chromium after SvelteKit hydration validation',
    );
  }
}

function isHydrationConsoleWarning(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('hydration') ||
    normalizedMessage.includes('hydrate') ||
    normalizedMessage.includes('hydrating')
  );
}

async function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  description: string,
): Promise<T> {
  return await Promise.race([
    promise,
    Bun.sleep(timeoutMs).then(() => fail(`${description} timed out after ${timeoutMs}ms`)),
  ]);
}

type CssArtifact = {
  /** Absolute path to the CSS file. */
  filePath: string;
  /** Selector strings encountered at the top level of the AST (or inside @layer). */
  selectors: string[];
  /** Declarations grouped by selector. */
  declarations: Array<{ selector: string; prop: string; value: string }>;
  /** Custom-property names declared anywhere in the file (e.g. `--cinder-button-bg`). */
  customProperties: string[];
};

/**
 * Find the CSS artifacts that belong to a specific route's chunk. SvelteKit
 * emits per-page CSS chunks indexed by a generated wrapper at
 * `.svelte-kit/generated/client-optimized/nodes/<N>.js`. We find the wrapper
 * that re-exports our `+page.svelte` source, then look that wrapper up in
 * Vite's client manifest at `.svelte-kit/output/client/.vite/manifest.json`
 * and walk its CSS imports.
 */
async function readRouteCssArtifacts(
  fixtureDirectory: string,
  routeSourceRelative: string,
): Promise<CssArtifact[]> {
  const clientOutputDirectory = join(fixtureDirectory, '.svelte-kit/output/client');
  const generatedNodesDirectory = join(
    fixtureDirectory,
    '.svelte-kit/generated/client-optimized/nodes',
  );
  const manifestPath = join(clientOutputDirectory, '.vite/manifest.json');
  if (!existsSync(manifestPath)) {
    fail(`Vite client manifest not found at ${manifestPath}`);
  }
  const manifest = parseJsonFile<
    Record<string, { css?: string[]; imports?: string[]; dynamicImports?: string[]; file?: string }>
  >(await Bun.file(manifestPath).text());

  // Find the generated node wrapper that re-exports the target route source.
  let routeSource: string | null = null;
  const wrapperGlob = new Glob('*.js');
  for await (const wrapperPath of wrapperGlob.scan({
    cwd: generatedNodesDirectory,
    absolute: true,
  })) {
    const content = await Bun.file(wrapperPath).text();
    if (content.includes(`/${routeSourceRelative}`)) {
      // Normalize to the manifest key form (paths relative to fixtureDirectory).
      const wrapperFileName = wrapperPath.slice(generatedNodesDirectory.length + 1);
      routeSource = `.svelte-kit/generated/client-optimized/nodes/${wrapperFileName}`;
      break;
    }
  }
  if (routeSource === null) {
    fail(`could not locate SvelteKit node wrapper for route ${routeSourceRelative}`);
  }

  const entry = manifest[routeSource];
  if (!entry) {
    fail(
      `route wrapper ${routeSource} not in Vite manifest. Keys sample: ${Object.keys(manifest)
        .slice(0, 8)
        .join(', ')}`,
    );
  }
  const cssAssets = new Set<string>();
  const visited = new Set<string>();
  const stack = [routeSource];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined || visited.has(next)) continue;
    visited.add(next);
    const node = manifest[next];
    if (!node) continue;
    for (const css of node.css ?? []) cssAssets.add(css);
    for (const imp of node.imports ?? []) stack.push(imp);
    for (const imp of node.dynamicImports ?? []) stack.push(imp);
  }
  if (cssAssets.size === 0) return [];
  const artifacts: CssArtifact[] = [];
  for (const relativePath of cssAssets) {
    const filePath = join(clientOutputDirectory, relativePath);
    if (!existsSync(filePath)) continue;
    const source = await Bun.file(filePath).text();
    const root_ = parse(source, { from: filePath });
    const selectors: string[] = [];
    const declarations: Array<{ selector: string; prop: string; value: string }> = [];
    const customProperties: string[] = [];
    root_.walkRules((rule) => {
      for (const selector of rule.selectors) selectors.push(selector);
      rule.walkDecls((decl) => {
        for (const selector of rule.selectors) {
          declarations.push({ selector, prop: decl.prop, value: decl.value });
        }
      });
    });
    root_.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) customProperties.push(decl.prop);
    });
    artifacts.push({ filePath, selectors, declarations, customProperties });
  }
  return artifacts;
}

function hasSelectorContaining(artifacts: CssArtifact[], fragment: string): boolean {
  return artifacts.some((artifact) =>
    artifact.selectors.some((selector) => selector.includes(fragment)),
  );
}

function hasCustomPropertyStartingWith(artifacts: CssArtifact[], prefix: string): boolean {
  return artifacts.some((artifact) =>
    artifact.customProperties.some((property) => property.startsWith(prefix)),
  );
}

function hasDeclaration(
  artifacts: CssArtifact[],
  selectorFragment: string,
  prop: string,
  value: string,
): boolean {
  return artifacts.some((artifact) =>
    artifact.declarations.some(
      (declaration) =>
        declaration.selector.includes(selectorFragment) &&
        declaration.prop === prop &&
        declaration.value === value,
    ),
  );
}

function verifyNodeSsrConditionPrecedence(fixtureDirectory: string): void {
  const script = [
    "const root = import.meta.resolve('@lostgradient/cinder');",
    "const button = import.meta.resolve('@lostgradient/cinder/button');",
    'console.log(JSON.stringify({ root, button }));',
  ].join('\n');
  const result = Bun.spawnSync(
    [nodeBinaryPath, '--conditions=svelte', '--input-type=module', '-e', script],
    {
      cwd: fixtureDirectory,
      env: { ...Bun.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
    },
  );
  if (result.exitCode !== 0) {
    fail(
      `node --conditions=svelte resolver probe exited ${result.exitCode}\n` +
        `stdout: ${result.stdout.toString()}\n` +
        `stderr: ${result.stderr.toString()}`,
    );
  }

  const resolved = parseJsonFile<{ root: string; button: string }>(result.stdout.toString());
  if (!resolved.root.includes('/dist/server/index.js')) {
    fail(`node --conditions=svelte resolved @lostgradient/cinder to ${resolved.root}`);
  }
  if (!resolved.button.includes('/dist/server/components/button/index.js')) {
    fail(`node --conditions=svelte resolved @lostgradient/cinder/button to ${resolved.button}`);
  }
}

async function readAllBuiltStylesheets(roots: string[]): Promise<string> {
  const stylesheetGlob = new Glob('**/*.css');
  const stylesheetContents: string[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for await (const stylesheetPath of stylesheetGlob.scan({ cwd: root, absolute: true })) {
      stylesheetContents.push(await Bun.file(stylesheetPath).text());
    }
  }
  return stylesheetContents.join('\n');
}

async function waitForUrl(
  url: string,
  timeoutMs: number,
  runningServer: { exitCode: number | null },
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (runningServer.exitCode !== null) {
      fail(`server exited with code ${runningServer.exitCode} before becoming ready at ${url}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.status === 200) return;
    } catch {
      // Not ready yet — keep polling.
    }
    await Bun.sleep(200);
  }
  fail(`timeout waiting for ${url}`);
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  description: string,
): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${description} failed or timed out after ${timeoutMs}ms: ${message}`);
  }
}

async function runNodeFixture(): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/node-consumer');
  process.stdout.write('[validate-consumers] step 5: node-consumer (under Node, not Bun)…\n');

  const restoreManifest = injectTarballIntoFixture(fixtureDirectory);

  try {
    await $`rm -rf node_modules dist`.cwd(fixtureDirectory);
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) fail(`node-consumer bun install failed`);

    const compileResult = await $`bunx tsc`.cwd(fixtureDirectory).nothrow();
    if (compileResult.exitCode !== 0) fail(`tsc failed in node-consumer`);

    const renderResult = Bun.spawnSync([nodeBinaryPath, 'dist/render.js'], {
      cwd: fixtureDirectory,
      env: { ...Bun.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
    });
    if (renderResult.exitCode !== 0) {
      fail(
        `node dist/render.js exited ${renderResult.exitCode}\n` +
          `stdout: ${renderResult.stdout.toString()}\n` +
          `stderr: ${renderResult.stderr.toString()}`,
      );
    }
    const renderedOutput = renderResult.stdout.toString();
    const requiredInNodeOutput = [
      'cinder-button',
      'cinder-alert',
      'cinder-badge',
      'cinder-spinner',
      'cinder-skeleton',
    ];
    for (const cls of requiredInNodeOutput) {
      if (!renderedOutput.includes(cls)) {
        fail(`node render output missing "${cls}". Output:\n${renderedOutput}`);
      }
    }
    // Verify snippet-only components were imported (marked "OK" in render.ts output).
    if (!renderedOutput.includes('Card imported OK')) {
      fail(`node render output missing "Card imported OK" — subpath import failed`);
    }
    if (!renderedOutput.includes('useHistory imported OK')) {
      fail(`node render output missing "useHistory imported OK" — barrel utility import failed`);
    }
    // PR 1 upstream re-export sub-paths must resolve in the published tarball.
    const upstreamProbeMarkers = [
      '@lostgradient/cinder/markdown/diff/line-diff#computeLineDiff imported OK',
      '@lostgradient/cinder/markdown/rendering#renderMarkdown imported OK',
      '@lostgradient/cinder/markdown/utilities/safe-url#isSafeUrl imported OK',
      '@lostgradient/cinder/markdown/utilities/sort-keys#sortKeys imported OK',
      '@lostgradient/cinder/diff/line-diff#computeLineDiff imported OK',
    ];
    for (const marker of upstreamProbeMarkers) {
      if (!renderedOutput.includes(marker)) {
        fail(`node render output missing "${marker}" — upstream re-export resolution failed`);
      }
    }
  } finally {
    restoreManifest();
  }
}

/**
 * manifest-consumer — install the packed tarball into the fixture and run its
 * Node `.mjs` contract check (cinder/manifest resolution, runtime artifact
 * resolution via ESM+CJS, type/svelte-only schema/variables tripwire, two-way
 * export↔manifest consistency). Fastest fixture — pure Node resolution.
 */
async function runManifestConsumerFixture(): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/manifest-consumer');
  process.stdout.write('[validate-consumers] step: manifest-consumer (Node resolve)…\n');

  const restoreManifest = injectTarballIntoFixture(fixtureDirectory);

  try {
    await $`rm -rf node_modules`.cwd(fixtureDirectory);
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) fail(`manifest-consumer bun install failed`);

    verifyNodeSsrConditionPrecedence(fixtureDirectory);

    const checkResult = Bun.spawnSync([nodeBinaryPath, 'check.mjs'], {
      cwd: fixtureDirectory,
      env: { ...Bun.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
    });
    if (checkResult.exitCode !== 0) {
      fail(
        `manifest-consumer check.mjs exited ${checkResult.exitCode}\n` +
          `stdout: ${checkResult.stdout.toString()}\n` +
          `stderr: ${checkResult.stderr.toString()}`,
      );
    }
    process.stdout.write(`[validate-consumers] ${checkResult.stdout.toString().trim()}\n`);
  } finally {
    restoreManifest();
  }
}

/**
 * typescript-consumer — install the packed tarball, GENERATE a probe from the
 * installed `@lostgradient/cinder/manifest` covering every component + its schema/variables
 * artifacts, then run the TypeScript-facing gates:
 *   Gate 1 — tsc NodeNext type resolution (no `svelte` condition): proves every
 *            component main + schema + variables `types` condition resolves
 *            under plain Node/NodeNext, the lens a non-Svelte TS consumer uses.
 *   Gate 2 — tsc with `customConditions: ["svelte"]`: the Svelte-aware consumer's
 *            type-resolution lens. When a subpath has `types` it resolves the same
 *            target as Gate 1, but when a subpath has `svelte` and no `types` it
 *            falls back to the `.ts` source — a path Gate 1 cannot resolve. Guards
 *            that fallback (and that adding the condition never breaks resolution).
 *   Gate 3 — svelte-check over a generated `.svelte` probe: the real Svelte-aware
 *            view; resolves every component's `svelte` source condition.
 * Gate 4 (real Node ESM + CJS RUNTIME resolve with no `svelte` condition) is
 * owned by manifest-consumer so the resolver matrix is not duplicated; it is the
 * fixture that asserts the schema/variables subpaths intentionally do NOT
 * runtime-resolve today (the task-4176c51c tripwire).
 */
async function runTypescriptConsumerFixture(): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/typescript-consumer');
  process.stdout.write('[validate-consumers] step: typescript-consumer (tsc + svelte-check)…\n');

  const restoreManifest = injectTarballIntoFixture(fixtureDirectory);

  try {
    await $`rm -rf node_modules src/generated`.cwd(fixtureDirectory);
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) fail(`typescript-consumer bun install failed`);

    // Regenerate the probe from the INSTALLED manifest — stale output must not
    // survive a run, and the probe must cover whatever the tarball publishes.
    await runTypescriptConsumerSvelteGate(fixtureDirectory, 'workspace default');

    await runTypescriptConsumerNodenextGate(fixtureDirectory, 'workspace default');

    process.stdout.write('[validate-consumers] typescript-consumer OK (gates 1–3 green).\n');
  } finally {
    restoreManifest();
  }
}

/**
 * examples-consumer — a SvelteKit app that materializes EVERY published example
 * into a compilable component, builds + SSR-renders them, and asserts every
 * `examples[]` entry's COMPOSITE id (`${componentId}::${exampleId}`) appears in
 * the rendered HTML EXACTLY ONCE. Slowest fixture (full Vite build + server), so
 * it runs last.
 *
 * Generator lifecycle is explicit: delete `src/generated` + the generated
 * `+page.svelte`, regenerate from the INSTALLED manifest AFTER tarball install
 * and BEFORE `svelte-kit sync` → `vite build`. Stale output never survives.
 */
async function runExamplesConsumerFixture(): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/examples-consumer');
  process.stdout.write('[validate-consumers] step: examples-consumer (SvelteKit build + SSR)…\n');

  const restoreManifest = injectTarballIntoFixture(fixtureDirectory);

  try {
    await $`rm -rf node_modules .svelte-kit build src/generated src/routes/+page.svelte`.cwd(
      fixtureDirectory,
    );
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) fail(`examples-consumer bun install failed`);

    const generateResult = Bun.spawnSync([nodeBinaryPath, 'generate-examples.mjs'], {
      cwd: fixtureDirectory,
      env: { ...Bun.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
    });
    if (generateResult.exitCode !== 0) {
      fail(
        `examples-consumer generate-examples.mjs failed:\n${generateResult.stdout.toString()}\n${generateResult.stderr.toString()}`,
      );
    }

    const syncResult = await $`bunx svelte-kit sync`.cwd(fixtureDirectory).nothrow();
    if (syncResult.exitCode !== 0) {
      fail(
        `examples-consumer svelte-kit sync failed:\n${syncResult.stdout.toString()}\n${syncResult.stderr.toString()}`,
      );
    }

    const buildResult = await $`bunx vite build`.cwd(fixtureDirectory).nothrow();
    if (buildResult.exitCode !== 0) {
      fail(
        `examples-consumer vite build failed:\n${buildResult.stdout.toString()}\n${buildResult.stderr.toString()}`,
      );
    }

    // Load the exact expected composite-id set this run produced.
    const expectedRaw = await Bun.file(
      join(fixtureDirectory, 'src/generated/expected-example-ids.json'),
    ).text();
    const expected = parseJsonFile<{ entryCount: number; compositeIds: string[] }>(expectedRaw);

    const httpPort = await pickEphemeralPort();
    const fixtureServer = Bun.spawn([nodeBinaryPath, 'build/index.js'], {
      cwd: fixtureDirectory,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...Bun.env,
        PORT: String(httpPort),
        HOST: '127.0.0.1',
        TZ: 'UTC',
        LANG: 'en_US.UTF-8',
      },
    });

    try {
      await waitForUrl(`http://127.0.0.1:${httpPort}/`, 15_000, fixtureServer);
      const response = await fetch(`http://127.0.0.1:${httpPort}/`);
      if (response.status !== 200) {
        fail(`examples-consumer / returned ${response.status}, want 200`);
      }
      const body = await response.text();

      // Count every rendered composite id. The marker attribute is the source of
      // truth — extract them all, then compare exact multisets.
      const renderedIds = [...body.matchAll(/data-example-id="([^"]*)"/g)].map(
        (match) => match[1]!,
      );
      const renderedCounts = new Map<string, number>();
      for (const id of renderedIds) {
        renderedCounts.set(id, (renderedCounts.get(id) ?? 0) + 1);
      }

      const expectedSet = new Set(expected.compositeIds);
      const missing = expected.compositeIds.filter((id) => !renderedCounts.has(id));
      const duplicated = [...renderedCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([id, count]) => `${id} (×${count})`);
      const unexpected = [...renderedCounts.keys()].filter((id) => !expectedSet.has(id));

      const problems: string[] = [];
      if (missing.length > 0) problems.push(`missing (${missing.length}): ${missing.join(', ')}`);
      if (duplicated.length > 0) {
        problems.push(`rendered more than once: ${duplicated.join(', ')}`);
      }
      if (unexpected.length > 0) {
        problems.push(`rendered but not expected: ${unexpected.join(', ')}`);
      }
      if (problems.length > 0) {
        fail(
          `examples-consumer composite-id assertion failed (expected ${expected.entryCount} entries each exactly once):\n  ${problems.join('\n  ')}`,
        );
      }

      process.stdout.write(
        `[validate-consumers] examples-consumer OK — ${expected.entryCount} example entries each rendered exactly once.\n`,
      );
    } finally {
      fixtureServer.kill();
      await fixtureServer.exited;
    }
  } finally {
    restoreManifest();
  }
}

async function main(): Promise<void> {
  installHookProcessCleanup();
  ensureSupportedPlatform();
  await ensureNodeOnPath();
  await runBuild();
  await packWorkspaceDependencyTarballs();
  await packTarball();
  await inspectTarball();

  // PR 1 publish-path gates: assert the staged pack produced a self-contained
  // tarball with no `workspace:`, `@cinder/*`, or stale `svelte` conditions.
  const tarballInspectionDirectory = join(repositoryRoot, 'tmp', 'pack-inspection');
  const publishStagingDirectory = join(repositoryRoot, 'node_modules', '.cache', 'publish-staging');
  await extractTarballForInspection(tarballInspectionDirectory);
  try {
    process.stdout.write('[validate-consumers] asserting packed manifest invariants…\n');
    await assertPackedManifestInvariants(tarballInspectionDirectory);
    await assertNoQuotedCinderReferences(tarballInspectionDirectory);
    await assertUpstreamReexportsResolveInTarball(tarballInspectionDirectory);
    await assertNoDanglingSourceMapComments(tarballInspectionDirectory);
    process.stdout.write('[validate-consumers] publish-path invariants OK.\n');
  } finally {
    // Both directories carry hundreds of MB of extracted/staged artifacts;
    // leave them behind across runs and the working tree balloons.
    // Removal is best-effort — a failed cleanup must not mask an assertion
    // failure above.
    await rm(tarballInspectionDirectory, { recursive: true, force: true }).catch(() => {});
    await rm(publishStagingDirectory, { recursive: true, force: true }).catch(() => {});
  }

  // Fastest-first fixture ordering: manifest-consumer (Node resolution, seconds)
  // → node-consumer (tsc + SSR render) → typescript-consumer (tsc + svelte-check)
  // → sveltekit-consumer (full Vite build) → examples-consumer (SvelteKit build +
  // SSR over every example, slowest).
  await runStylesConsumerFixture();
  await runManifestConsumerFixture();
  await runNodeFixture();
  await runTypescriptConsumerFixture();
  await runTypescriptCompatibilityFixture('latest TypeScript 6', '^6.0.3');
  await runSveltePeerCompatibilityFixture('minimum', sveltePeerContract.minimum);
  await runSveltePeerCompatibilityFixture('latest Svelte 5', sveltePeerContract.latest);
  await runSveltekitFixture('minimum', sveltePeerContract.minimum);
  await runSveltekitFixture('latest Svelte 5', sveltePeerContract.latest);
  await runExamplesConsumerFixture();
  process.stdout.write('[validate-consumers] all checks passed.\n');
}

try {
  await withLocalValidationGateLock(main);
} catch (error) {
  if (error instanceof ValidationError) {
    process.stderr.write(`[validate-consumers] ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
