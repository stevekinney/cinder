import { $, Glob } from 'bun';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';

import { deriveUpstreamReexports } from './lib/derive-upstream-reexports.ts';
import { discoverComponents } from './lib/discover-components.ts';
import { packForPublish } from './pack-for-publish.ts';
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
    const result = await $`bun pm pack`.cwd(dependencyPackage.packageDirectory).nothrow();
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

/**
 * Assert structural invariants on the packed manifest:
 *   - No `workspace:` substrings anywhere (the dep flip would otherwise
 *     leak through `bun pm pack`).
 *   - No `@cinder/*` in any dep field or exports condition.
 *   - No exports entry retains a `svelte` condition (every published
 *     condition must resolve to `dist/`, since `src/**` is not packed).
 */
async function assertPackedManifestInvariants(extractedRoot: string): Promise<void> {
  const packedManifestPath = join(extractedRoot, 'package', 'package.json');
  const rawPackedManifest = await Bun.file(packedManifestPath).text();
  if (rawPackedManifest.includes('workspace:')) {
    fail(`packed manifest contains \`workspace:\` protocol`);
  }

  const packedManifest = JSON.parse(rawPackedManifest) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
  };

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

  const exportsMap = packedManifest.exports ?? {};
  for (const [key, value] of Object.entries(exportsMap)) {
    if (typeof value !== 'object' || value === null) continue;
    const conditions = value as Record<string, unknown>;
    if ('svelte' in conditions) {
      fail(
        `packed exports["${key}"] retains a \`svelte\` condition — the published map must resolve to \`dist/\` only`,
      );
    }
    // Verify that no condition target inside the entry points at `./src/`,
    // with three intentional exceptions:
    //   1. `./styles*` entries target hand-authored CSS in `src/styles/`.
    //   2. `<id>/examples` entries target `*.examples.json` sidecars
    //      under `src/components/<id>/`.
    //   3. `<id>/constraints` entries target `*.constraints.json` sidecars
    //      under `src/components/<id>/`.
    // The pack-for-publish flow ships exactly those files (plus the rest of
    // `dist/`) — nothing else from `src/**` lands in the tarball.
    const isStylesEntry =
      key === './styles' || key.startsWith('./styles/') || key.endsWith('/styles');
    const isExamplesEntry = key.endsWith('/examples');
    const isConstraintsEntry = key.endsWith('/constraints');
    for (const [condition, target] of Object.entries(conditions)) {
      if (typeof target !== 'string') continue;
      if (target.startsWith('./src/')) {
        if (isStylesEntry && target.startsWith('./src/styles/') && target.endsWith('.css')) {
          continue;
        }
        if (isExamplesEntry && /^\.\/src\/components\/[^/]+\/[^/]+\.examples\.json$/.test(target)) {
          continue;
        }
        if (
          isConstraintsEntry &&
          /^\.\/src\/components\/[^/]+\/[^/]+\.constraints\.json$/.test(target)
        ) {
          continue;
        }
        fail(
          `packed exports["${key}"]["${condition}"] points at "${target}" — only \`./styles*\`, \`*/examples\`, and \`*/constraints\` exports may resolve to \`./src/\``,
        );
      }
    }
  }
}

/**
 * Run a global grep over the extracted tarball for `@cinder/*` references.
 * Only quoted-string occurrences fail the gate — these are import
 * specifiers that would break at consumer install time. Doc-comment prose
 * and source-map embedded source are tolerated because they cannot break
 * runtime resolution.
 */
async function assertNoQuotedCinderReferences(extractedRoot: string): Promise<void> {
  const packageRoot = join(extractedRoot, 'package');
  const glob = new Glob('**/*.{js,mjs,cjs,d.ts,d.mts,d.cts}');
  const offenders: string[] = [];
  // Match `'@cinder/...'`, `"@cinder/..."`, or a backtick-quoted dynamic
  // import specifier. Excludes doc-comment prose like
  // ` * @cinder/markdown ...` and excludes the `_upstream/` source-map
  // shipped alongside vendored .d.ts files.
  const pattern = /(['"`])@cinder\/[^'"`]+\1/;
  for await (const relative of glob.scan({ cwd: packageRoot })) {
    const filePath = join(packageRoot, relative);
    const content = await Bun.file(filePath).text();
    if (pattern.test(content)) {
      offenders.push(relative);
    }
  }
  if (offenders.length > 0) {
    fail(`tarball contains quoted \`@cinder/*\` references in:\n  ${offenders.join('\n  ')}`);
  }
}

/**
 * Assert that the source `packages/components/package.json` is byte-identical
 * pre- and post-pack. The staged pack-for-publish flow must NEVER mutate the
 * source manifest; `packForPublish` already enforces this via SHA-256, but
 * we re-check via `git diff --exit-code` so the gate catches editor-driven
 * mutations between the script's read and the consumer's pack invocation.
 */
async function assertSourceManifestUnchanged(): Promise<void> {
  const result = await $`git diff --exit-code -- packages/components/package.json`
    .cwd(workspaceRoot)
    .nothrow();
  if (result.exitCode !== 0) {
    fail(
      `pack-for-publish mutated packages/components/package.json (git diff --exit-code returned ${result.exitCode}).\n` +
        result.stdout.toString(),
    );
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

type TarballExpectations = {
  required: string[];
  forbiddenPatterns: RegExp[];
  forbiddenPrefixes: string[];
};

/**
 * Build the tarball expectations from the live filesystem.
 *
 * Every directory-shaped component contributes both its Svelte source
 * (`package/src/components/<name>/<name>.svelte`) and its compiled
 * declaration (`package/dist/components/<name>/<name>.svelte.d.ts`).
 * Experimental components contribute the same paths under `experimental/`.
 *
 * This replaces the previous hand-maintained `PUBLIC_COMPONENTS` allowlist —
 * `discoverComponents()` is the same walk the exports generator uses, so the
 * two cannot drift.
 */
async function buildTarballExpectations(): Promise<TarballExpectations> {
  const components = await discoverComponents();
  const componentRequiredEntries: string[] = [];
  for (const { name, isExperimental } of components) {
    const distributionDirectory = isExperimental
      ? `package/dist/components/experimental/${name}`
      : `package/dist/components/${name}`;
    // PR 1 publishing model: the tarball ships `dist/` only (plus
    // `src/styles/**/*.css`). Every component sub-path resolves via the
    // `default` or `node` condition, so we assert the built JS + types are
    // present rather than the Svelte source.
    componentRequiredEntries.push(
      `${distributionDirectory}/index.js`,
      `${distributionDirectory}/index.d.ts`,
    );
  }
  return {
    required: [
      'package/package.json',
      'package/src/styles/index.css',
      'package/src/styles/tokens.css',
      'package/src/styles/tokens-base.css',
      'package/src/styles/foundation.css',
      'package/src/styles/components.css',
      'package/src/styles/utilities.css',
      'package/dist/index.d.ts',
      'package/dist/index.js',
      'package/dist/server/index.js',
      ...componentRequiredEntries,
    ],
    // PR 1: src/** stays out of the tarball except for hand-authored CSS
    // files in `src/styles/` and per-component `*.examples.json` /
    // `*.constraints.json` sidecars. The exports map's `default` and `node`
    // conditions point at `dist/`, so any leaked `src/components/**.svelte`,
    // `*.ts`, `src/utilities/**` etc. entry signals a broken
    // pack-for-publish.
    forbiddenPatterns: [
      /\.(test|spec)\.ts$/,
      /\.a11y\.md$/,
      /^package\/src\/(?!styles\/)(?!components\/[^/]+\/[^/]+\.(examples|constraints)\.json$).*$/,
    ],
    forbiddenPrefixes: [
      'package/fixtures/',
      'package/tmp/',
      'package/dist/client/',
      'package/dist/test/',
      'package/scripts/',
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
    .nothrow();
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

  // Every published `*/styles` export must resolve to a real CSS artifact
  // inside the tarball. `generate-exports.ts` gates emission on the source
  // sidecar existing (`hasCss`), but that only proves the input — this is the
  // post-build assertion that catches a CSS file silently dropped from the
  // build output (e.g. a build step that skips a component, a `files`
  // whitelist that omits the path).
  const packageJsonPath = join(repositoryRoot, 'package.json');
  const packageJsonContent = JSON.parse(await Bun.file(packageJsonPath).text()) as {
    exports?: Record<string, { default?: string }>;
  };
  const stylesExports = Object.entries(packageJsonContent.exports ?? {}).filter(
    ([key, entry]) =>
      key.endsWith('/styles') && key !== './styles' && typeof entry.default === 'string',
  );
  const tarballEntrySet = new Set(entries);
  const danglingStylesExports: string[] = [];
  for (const [key, entry] of stylesExports) {
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
function injectTarballIntoFixture(fixtureDirectory: string): () => void {
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

  dependencies['cinder'] = `file:${tarballFilePath}`;
  for (const dependencyPackage of workspaceDependencyPackages) {
    const fileSpecifier = `file:${dependencyPackage.tarballFilePath}`;
    dependencies[dependencyPackage.name] = fileSpecifier;
    overrides[dependencyPackage.name] = fileSpecifier;
  }
  writeFileSync(manifestPath, JSON.stringify(parsed, null, 2) + '\n');
  return () => writeFileSync(manifestPath, originalContent);
}

async function runSveltekitFixture(): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/sveltekit-consumer');
  process.stdout.write('[validate-consumers] step 4: sveltekit-consumer…\n');

  const restoreManifest = injectTarballIntoFixture(fixtureDirectory);

  try {
    await $`rm -rf node_modules .svelte-kit build`.cwd(fixtureDirectory);
    const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
    if (installResult.exitCode !== 0) fail(`sveltekit-consumer bun install failed`);

    const syncResult = await $`bunx svelte-kit sync`.cwd(fixtureDirectory).nothrow();
    if (syncResult.exitCode !== 0) {
      fail(
        `svelte-kit sync failed:\n${syncResult.stdout.toString()}\n${syncResult.stderr.toString()}`,
      );
    }

    const checkResult = await $`bunx svelte-check --tsconfig tsconfig.json --threshold error`
      .cwd(fixtureDirectory)
      .nothrow();
    if (checkResult.exitCode !== 0) {
      fail(`svelte-check failed in sveltekit-consumer:\n${checkResult.stdout.toString()}`);
    }

    const viteBuildResult = await $`bunx vite build`.cwd(fixtureDirectory).nothrow();
    if (viteBuildResult.exitCode !== 0) fail(`vite build failed in sveltekit-consumer`);

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
    // The /a-la-carte route imports only `cinder/button` + `cinder/button/styles`
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

    // No-styles import contract: the /no-styles route imports `cinder/button`
    // only — no `/styles` subpath, no aggregator. Its route-scoped CSS must
    // not contain button selectors. Proves component JS does not pull CSS as
    // a side effect.
    //
    // Triangulation against false-positives (route walk silently broken):
    //   1. The /a-la-carte assertion above proved the route-scoped walk DOES
    //      surface .cinder-button when the route opts into the CSS.
    //   2. The build-wide combinedStylesheet check above proved .cinder-button
    //      exists somewhere in the client CSS output.
    //   3. The walk below resolves the SvelteKit wrapper or fails loudly
    //      (readRouteCssArtifacts calls fail() if the wrapper isn't found).
    // Together these mean: a passing absence assertion below cannot be
    // explained by a silently-empty walk — it can only mean the no-styles
    // route legitimately has no transitive .cinder-button CSS.
    const noStylesCss = await readRouteCssArtifacts(
      fixtureDirectory,
      'src/routes/no-styles/+page.svelte',
    );
    if (hasSelectorContaining(noStylesCss, '.cinder-button')) {
      fail(
        `/no-styles route CSS contains .cinder-button — component JS pulled CSS as a side effect`,
      );
    }
    // Also assert that any --cinder-button-* custom property is absent,
    // catching the case where CSS leaks via custom-property declarations on
    // a shared chunk even if no selector tokens match.
    if (hasCustomPropertyStartingWith(noStylesCss, '--cinder-button-')) {
      fail(
        `/no-styles route CSS contains --cinder-button-* — component JS pulled CSS as a side effect`,
      );
    }

    // Runtime-truth check (defends against hoisted shared CSS): the route
    // walk above reads from the Vite client manifest, which can drift from
    // what the runtime SvelteKit loader actually serves if Vite hoists CSS
    // into a shared chunk. Below, after the fixture server is up, we ALSO
    // fetch the rendered /no-styles HTML and assert no CSS file referenced
    // via <link rel="stylesheet"> contains .cinder-button. That closes the
    // loop: if any path — manifest, shared chunk, or otherwise — caused
    // .cinder-button CSS to load on /no-styles, the runtime HTML would
    // reference a stylesheet that contains it, and the check below fails.

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
      'cinder-page-layout',
      'cinder-pagination',
      'cinder-select-field',
      'cinder-skeleton',
      'cinder-spinner',
      'cinder-textarea-field',
      'cinder-toggle',
    ];

    // Lazy-mount: popup element must be ABSENT in default-closed SSR HTML.
    const LAZY_ABSENT_STRINGS = ['<dialog', 'role="menu"'];

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
      const response = await fetch(`http://127.0.0.1:${httpPort}/`);
      if (response.status !== 200) fail(`fixture / returned ${response.status}, want 200`);
      const body = await response.text();
      for (const cls of ALWAYS_RENDERED_CLASSES) {
        if (!body.includes(cls)) {
          fail(`fixture HTML (/) does not contain class "${cls}"`);
        }
      }
      for (const absent of LAZY_ABSENT_STRINGS) {
        if (body.includes(absent)) {
          fail(
            `fixture HTML (/) should not contain "${absent}" for lazy-mount components in closed state`,
          );
        }
      }

      // Subpath page
      const subpathResponse = await fetch(`http://127.0.0.1:${httpPort}/subpath`);
      if (subpathResponse.status !== 200)
        fail(`fixture /subpath returned ${subpathResponse.status}, want 200`);
      const subpathBody = await subpathResponse.text();
      for (const cls of ALWAYS_RENDERED_CLASSES) {
        if (!subpathBody.includes(cls)) {
          fail(`fixture HTML (/subpath) does not contain class "${cls}"`);
        }
      }

      // Runtime-truth check for the no-styles side-effect contract.
      // Fetch the rendered /no-styles HTML, extract every stylesheet href,
      // resolve it under the client build, and assert none of those CSS
      // files contain `.cinder-button`. This is the strongest possible
      // in-fixture assertion: if any path (manifest, shared chunk, server
      // injection) caused button CSS to load on /no-styles, the runtime
      // would reference a stylesheet that contains it.
      const noStylesResponse = await fetch(`http://127.0.0.1:${httpPort}/no-styles`);
      if (noStylesResponse.status !== 200) {
        fail(`fixture /no-styles returned ${noStylesResponse.status}, want 200`);
      }
      const noStylesBody = await noStylesResponse.text();
      // Match every <link> tag, then check attributes order-insensitively.
      // SvelteKit can emit href before rel, and `rel` is a space-separated
      // token list (`rel="preload stylesheet"`) — we must not miss stylesheets
      // because of attribute ordering or compound rel values.
      const linkTagPattern = /<link\b[^>]*>/gi;
      const noStylesUrl = `http://127.0.0.1:${httpPort}/no-styles`;
      const stylesheetHrefs: string[] = [];
      for (const match of noStylesBody.matchAll(linkTagPattern)) {
        const tag = match[0];
        const relMatch = /\brel\s*=\s*["']([^"']+)["']/i.exec(tag);
        if (!relMatch) continue;
        const relTokens = relMatch[1]!.toLowerCase().split(/\s+/);
        if (!relTokens.includes('stylesheet')) continue;
        const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
        if (!hrefMatch) continue;
        stylesheetHrefs.push(hrefMatch[1]!);
      }
      // Fetch each stylesheet through the running fixture server. The server
      // is the source of truth for what /no-styles actually loads, and this
      // avoids fragile on-disk path resolution (relative hrefs like
      // `../_app/immutable/...` would otherwise resolve outside the client
      // output directory and silently be skipped).
      const offendingStylesheets: string[] = [];
      for (const href of stylesheetHrefs) {
        const stylesheetUrl = new URL(href, noStylesUrl).toString();
        const stylesheetResponse = await fetch(stylesheetUrl);
        if (stylesheetResponse.status !== 200) {
          fail(
            `/no-styles references stylesheet ${href} (resolved to ${stylesheetUrl}) which returned ${stylesheetResponse.status} — cannot verify the side-effect contract`,
          );
        }
        const source = await stylesheetResponse.text();
        if (source.includes('.cinder-button') || /--cinder-button-/.test(source)) {
          offendingStylesheets.push(`${href} contains .cinder-button or --cinder-button-*`);
        }
      }
      if (offendingStylesheets.length > 0) {
        fail(
          `/no-styles rendered HTML references stylesheets that contain button CSS — component JS pulled CSS as a side effect:\n  ${offendingStylesheets.join('\n  ')}`,
        );
      }
    } finally {
      fixtureServer.kill();
      await fixtureServer.exited;
    }
  } finally {
    restoreManifest();
  }
}

type CssArtifact = {
  /** Absolute path to the CSS file. */
  filePath: string;
  /** Selector strings encountered at the top level of the AST (or inside @layer). */
  selectors: string[];
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
  const manifest = JSON.parse(await Bun.file(manifestPath).text()) as Record<
    string,
    { css?: string[]; imports?: string[]; dynamicImports?: string[]; file?: string }
  >;

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
    const root_ = postcss.parse(source, { from: filePath });
    const selectors: string[] = [];
    const customProperties: string[] = [];
    root_.walkRules((rule) => {
      for (const selector of rule.selectors) selectors.push(selector);
    });
    root_.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) customProperties.push(decl.prop);
    });
    artifacts.push({ filePath, selectors, customProperties });
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
      'cinder/markdown/diff/line-diff#computeLineDiff imported OK',
      'cinder/markdown/rendering#renderMarkdown imported OK',
      'cinder/markdown/utilities/safe-url#isSafeUrl imported OK',
      'cinder/markdown/utilities/sort-keys#sortKeys imported OK',
      'cinder/diff/line-diff#computeLineDiff imported OK',
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

try {
  ensureSupportedPlatform();
  await ensureNodeOnPath();
  await runBuild();
  await packWorkspaceDependencyTarballs();
  await packTarball();
  await inspectTarball();

  // PR 1 publish-path gates: assert the staged pack produced a self-contained
  // tarball with no `workspace:`, `@cinder/*`, or stale `svelte` conditions.
  const tarballInspectionDirectory = join(repositoryRoot, 'tmp', 'pack-inspection');
  await extractTarballForInspection(tarballInspectionDirectory);
  process.stdout.write('[validate-consumers] asserting packed manifest invariants…\n');
  await assertPackedManifestInvariants(tarballInspectionDirectory);
  await assertNoQuotedCinderReferences(tarballInspectionDirectory);
  await assertUpstreamReexportsResolveInTarball(tarballInspectionDirectory);
  await assertSourceManifestUnchanged();
  process.stdout.write('[validate-consumers] publish-path invariants OK.\n');

  await runSveltekitFixture();
  await runNodeFixture();
  process.stdout.write('[validate-consumers] all checks passed.\n');
} catch (error) {
  if (error instanceof ValidationError) {
    process.stderr.write(`[validate-consumers] ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
