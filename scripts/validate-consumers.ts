import { $, Glob } from 'bun';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');

// Derive tarball name from package.json so version bumps don't silently break validation.
function readPackageIdentity(): { name: string; version: string } {
  const parsed: unknown = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('package.json must be a JSON object');
  }
  const record: Record<string, unknown> = { ...parsed } as Record<string, unknown>;
  const name = record['name'];
  const version = record['version'];
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw new Error('package.json must have string `name` and `version`');
  }
  return { name, version };
}
const packageIdentity = readPackageIdentity();
const tarballFileName = `${packageIdentity.name}-${packageIdentity.version}.tgz`;
const tarballFilePath = join(repositoryRoot, tarballFileName);

function fail(message: string): never {
  process.stderr.write(`[validate-consumers] ${message}\n`);
  process.exit(1);
}

let nodeBinaryPath = '';

/**
 * Walk PATH for a `node` binary that is not one of Bun's shims. `Bun.which` prefers Bun's own
 * `bun-node-*` shim which returns Bun's Node-compatibility runtime rather than real Node — we
 * need real Node for the node-consumer fixture to genuinely exercise the `"node"` export
 * condition under Node's module resolution.
 */
function resolveRealNodeBinary(): string {
  const pathEntries = (process.env['PATH'] ?? '').split(':');
  for (const pathEntry of pathEntries) {
    if (pathEntry.length === 0) continue;
    const candidatePath = join(pathEntry, 'node');
    if (candidatePath.includes('bun-node')) continue;
    if (!existsSync(candidatePath)) continue;
    const probe = Bun.spawnSync([candidatePath, '--version']);
    if (probe.exitCode === 0) return candidatePath;
  }
  fail(
    'Node is required on PATH for the node-consumer fixture. Install Node 22+ and re-run.\n' +
      '  Phase 1 verifies the "node" export condition under real Node, not Bun.',
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
  process.stdout.write('[validate-consumers] step 1: building cinder…\n');
  const result = await $`bun run build`.cwd(repositoryRoot).nothrow();
  if (result.exitCode !== 0) fail(`bun run build failed with exit ${result.exitCode}`);
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

type TarballExpectations = { required: string[]; forbidden: string[] };

const tarballExpectations: TarballExpectations = {
  required: [
    'package/package.json',
    'package/src/index.ts',
    'package/src/components/button.svelte',
    'package/src/utilities/class-names.ts',
    'package/src/styles/index.css',
    'package/src/styles/tokens.css',
    'package/src/styles/foundation.css',
    'package/src/styles/components.css',
    'package/src/styles/components/button.css',
    'package/src/styles/utilities.css',
    'package/dist/index.d.ts',
    'package/dist/components/button.svelte.d.ts',
    'package/dist/server/index.js',
  ],
  forbidden: ['package/fixtures/', 'package/tmp/', 'package/dist/client/', 'package/scripts/'],
};

async function inspectTarball(): Promise<void> {
  process.stdout.write('[validate-consumers] step 3: inspecting tarball…\n');
  // Bun's $ passes `tarballFilePath` as a single argv value, not interpolated into a shell
  // string, so it can't be split on whitespace or interpreted as flags. BSD tar (macOS) doesn't
  // accept `--` as end-of-options the way GNU tar does.
  const listing = await $`tar -tzf ${tarballFilePath}`.text();
  const entries = listing.split('\n').filter((entry) => entry.length > 0);

  const missingEntries = tarballExpectations.required.filter(
    (required) => !entries.includes(required),
  );
  if (missingEntries.length) {
    fail(`Tarball missing required entries:\n  ${missingEntries.join('\n  ')}`);
  }

  const leakedEntries = tarballExpectations.forbidden
    .map((forbiddenPrefix) => entries.filter((entry) => entry.startsWith(forbiddenPrefix)))
    .flat();
  if (leakedEntries.length) {
    fail(`Tarball contains forbidden entries:\n  ${leakedEntries.join('\n  ')}`);
  }
}

/** Allocate an ephemeral port so concurrent CI runs don't collide on a shared one. */
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

async function runSveltekitFixture(): Promise<void> {
  const fixtureDirectory = join(repositoryRoot, 'fixtures/sveltekit-consumer');
  process.stdout.write('[validate-consumers] step 4: sveltekit-consumer…\n');

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

  const combinedStylesheet = await readAllBuiltStylesheets(
    join(fixtureDirectory, '.svelte-kit/output'),
  );
  if (!combinedStylesheet.includes('.cinder-button')) {
    fail(`no built CSS file contains .cinder-button — check ./styles export`);
  }
  if (!combinedStylesheet.includes('@layer cinder')) {
    fail(`no built CSS contains @layer cinder — @layer declaration lost during bundling`);
  }

  const httpPort = await pickEphemeralPort();
  const fixtureServer = Bun.spawn([nodeBinaryPath, 'build/index.js'], {
    cwd: fixtureDirectory,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env, PORT: String(httpPort), HOST: '127.0.0.1' },
  });

  try {
    await waitForUrl(`http://127.0.0.1:${httpPort}/`, 10_000, fixtureServer);
    const response = await fetch(`http://127.0.0.1:${httpPort}/`);
    if (response.status !== 200) fail(`fixture returned ${response.status}, want 200`);
    const body = await response.text();
    if (!body.includes('cinder-button')) {
      fail('fixture HTML does not contain cinder-button class');
    }
  } finally {
    fixtureServer.kill();
    await fixtureServer.exited;
  }
}

async function readAllBuiltStylesheets(root: string): Promise<string> {
  const stylesheetGlob = new Glob('**/*.css');
  const stylesheetContents: string[] = [];
  for await (const stylesheetPath of stylesheetGlob.scan({ cwd: root, absolute: true })) {
    stylesheetContents.push(await Bun.file(stylesheetPath).text());
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

  await $`rm -rf node_modules dist`.cwd(fixtureDirectory);
  const installResult = await $`bun install --no-save`.cwd(fixtureDirectory).nothrow();
  if (installResult.exitCode !== 0) fail(`node-consumer bun install failed`);

  const compileResult = await $`bunx tsc`.cwd(fixtureDirectory).nothrow();
  if (compileResult.exitCode !== 0) fail(`tsc failed in node-consumer`);

  const renderResult = Bun.spawnSync([nodeBinaryPath, 'dist/render.js'], {
    cwd: fixtureDirectory,
  });
  if (renderResult.exitCode !== 0) {
    fail(
      `node dist/render.js exited ${renderResult.exitCode}\n` +
        `stdout: ${renderResult.stdout.toString()}\n` +
        `stderr: ${renderResult.stderr.toString()}`,
    );
  }
  const renderedOutput = renderResult.stdout.toString();
  if (!renderedOutput.includes('cinder-button')) {
    fail(`node render output missing cinder-button class. Output:\n${renderedOutput}`);
  }
}

await ensureNodeOnPath();
await runBuild();
await packTarball();
await inspectTarball();
await runSveltekitFixture();
await runNodeFixture();

process.stdout.write('[validate-consumers] all checks passed.\n');
