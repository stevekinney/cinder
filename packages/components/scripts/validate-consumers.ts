import { $, Glob } from 'bun';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';

import { discoverComponents } from './lib/discover-components.ts';
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
  process.stdout.write(`[validate-consumers] step 2: packing ${tarballFileName}…\n`);
  if (existsSync(tarballFilePath)) {
    await Bun.file(tarballFilePath).delete();
  }
  const result = await $`bun pm pack`.cwd(repositoryRoot).nothrow();
  if (result.exitCode !== 0) fail(`bun pm pack failed: ${result.stderr.toString()}`);
  if (!existsSync(tarballFilePath)) fail(`Tarball not at ${tarballFilePath} after pack.`);
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
    const sourceDirectory = isExperimental
      ? `package/src/components/experimental/${name}`
      : `package/src/components/${name}`;
    const distributionDirectory = isExperimental
      ? `package/dist/components/experimental/${name}`
      : `package/dist/components/${name}`;
    componentRequiredEntries.push(
      `${sourceDirectory}/${name}.svelte`,
      `${distributionDirectory}/${name}.svelte.d.ts`,
    );
  }
  return {
    required: [
      'package/package.json',
      'package/src/index.ts',
      'package/src/utilities/class-names.ts',
      'package/src/utilities/use-history.svelte.ts',
      'package/src/styles/index.css',
      'package/src/styles/tokens.css',
      'package/src/styles/tokens-base.css',
      'package/src/styles/foundation.css',
      'package/src/styles/components.css',
      'package/src/styles/utilities.css',
      'package/dist/index.d.ts',
      'package/dist/server/index.js',
      ...componentRequiredEntries,
    ],
    forbiddenPatterns: [/\.(test|spec)\.ts$/, /\.a11y\.md$/],
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
    const noStylesCss = await readRouteCssArtifacts(
      fixtureDirectory,
      'src/routes/no-styles/+page.svelte',
    );
    if (hasSelectorContaining(noStylesCss, '.cinder-button')) {
      fail(
        `/no-styles route CSS contains .cinder-button — component JS pulled CSS as a side effect`,
      );
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
