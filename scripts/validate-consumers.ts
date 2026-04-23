import { $ } from 'bun';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const TARBALL_NAME = 'cinder-0.0.1.tgz';
const TARBALL_PATH = join(ROOT, TARBALL_NAME);

function die(message: string): never {
  process.stderr.write(`[validate-consumers] ${message}\n`);
  process.exit(1);
}

let NODE_BIN = '';

function resolveRealNode(): string {
  const pathEntries = (process.env['PATH'] ?? '').split(':');
  for (const entry of pathEntries) {
    const candidate = join(entry, 'node');
    try {
      const stat = Bun.file(candidate);
      if (stat.size > 0 && !candidate.includes('bun-node-')) {
        return candidate;
      }
    } catch {
      // continue
    }
  }
  die(
    'Node is required on PATH for the node-consumer fixture. Install Node 22+ and re-run.\n' +
      '  Phase 1 verifies the "node" export condition under real Node, not Bun.',
  );
}

async function ensureNodeOnPath(): Promise<void> {
  NODE_BIN = resolveRealNode();
  const versionResult = Bun.spawnSync([NODE_BIN, '--version']);
  if (versionResult.exitCode !== 0) {
    die(`Failed to run ${NODE_BIN} --version`);
  }
  const version = versionResult.stdout.toString().trim();
  const match = /^v(\d+)\./.exec(version);
  const major = match?.[1] ? Number(match[1]) : 0;
  if (major < 22) {
    die(`Node >= 22 required. Found ${version}.`);
  }
  process.stdout.write(`[validate-consumers] using node ${version} at ${NODE_BIN}\n`);
}

async function runBuild(): Promise<void> {
  process.stdout.write('[validate-consumers] step 1: building cinder…\n');
  const result = await $`bun run build`.cwd(ROOT).nothrow();
  if (result.exitCode !== 0) die(`bun run build failed with exit ${result.exitCode}`);
}

async function packTarball(): Promise<void> {
  process.stdout.write('[validate-consumers] step 2: packing tarball…\n');
  if (existsSync(TARBALL_PATH)) {
    await Bun.file(TARBALL_PATH).delete();
  }
  const result = await $`bun pm pack`.cwd(ROOT).nothrow();
  if (result.exitCode !== 0) die(`bun pm pack failed: ${result.stderr.toString()}`);
  if (!existsSync(TARBALL_PATH)) die(`Tarball not at ${TARBALL_PATH} after pack.`);
}

type ExpectedPaths = { required: string[]; forbidden: string[] };

const EXPECTATIONS: ExpectedPaths = {
  required: [
    'package/package.json',
    'package/src/index.ts',
    'package/src/components/button.svelte',
    'package/src/utilities/class-names.ts',
    'package/src/styles/index.css',
    'package/src/styles/tokens.css',
    'package/src/styles/foundation.css',
    'package/src/styles/components.css',
    'package/src/styles/utilities.css',
    'package/dist/index.d.ts',
    'package/dist/components/button.svelte.d.ts',
    'package/dist/server/index.js',
  ],
  forbidden: ['package/fixtures/', 'package/tmp/', 'package/dist/client/', 'package/scripts/'],
};

async function inspectTarball(): Promise<void> {
  process.stdout.write('[validate-consumers] step 3: inspecting tarball…\n');
  const listing = await $`tar -tzf ${TARBALL_PATH}`.text();
  const entries = listing.split('\n').filter((l) => l.length > 0);

  const missing = EXPECTATIONS.required.filter((r) => !entries.includes(r));
  if (missing.length) {
    die(`Tarball missing required entries:\n  ${missing.join('\n  ')}`);
  }

  const leaked = EXPECTATIONS.forbidden.map((f) => entries.filter((e) => e.startsWith(f))).flat();
  if (leaked.length) {
    die(`Tarball contains forbidden entries:\n  ${leaked.join('\n  ')}`);
  }
}

async function runSveltekitFixture(): Promise<void> {
  const dir = join(ROOT, 'fixtures/sveltekit-consumer');
  process.stdout.write('[validate-consumers] step 4: sveltekit-consumer…\n');

  await $`rm -rf node_modules .svelte-kit build`.cwd(dir);
  const install = await $`bun install --no-save`.cwd(dir).nothrow();
  if (install.exitCode !== 0) die(`sveltekit-consumer bun install failed`);

  const sync = await $`bunx svelte-kit sync`.cwd(dir).nothrow();
  if (sync.exitCode !== 0) {
    die(`svelte-kit sync failed:\n${sync.stdout.toString()}\n${sync.stderr.toString()}`);
  }

  const check = await $`bunx svelte-check --tsconfig tsconfig.json --threshold error`
    .cwd(dir)
    .nothrow();
  if (check.exitCode !== 0) {
    die(`svelte-check failed in sveltekit-consumer:\n${check.stdout.toString()}`);
  }

  const build = await $`bunx vite build`.cwd(dir).nothrow();
  if (build.exitCode !== 0) die(`vite build failed in sveltekit-consumer`);

  const builtHtmlOrCss = await findBuiltCssFile(join(dir, '.svelte-kit/output'));
  if (!builtHtmlOrCss) die('could not find built CSS file under .svelte-kit/output');
  const cssContent = readFileSync(builtHtmlOrCss, 'utf8');
  if (!cssContent.includes('.cinder-button')) {
    die(`built CSS bundle does not contain .cinder-button — check ./styles export`);
  }
  if (!cssContent.includes('@layer cinder.components')) {
    die(`built CSS bundle does not contain @layer cinder.components — @layer lost during bundling`);
  }

  const server = Bun.spawn([NODE_BIN, 'build/index.js'], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env, PORT: '4173', HOST: '127.0.0.1' },
  });

  try {
    await waitForUrl('http://127.0.0.1:4173/', 10_000);
    const response = await fetch('http://127.0.0.1:4173/');
    if (response.status !== 200) die(`fixture returned ${response.status}, want 200`);
    const body = await response.text();
    if (!body.includes('cinder-button')) {
      die('fixture HTML does not contain cinder-button class');
    }
  } finally {
    server.kill();
    await server.exited;
  }
}

async function findBuiltCssFile(root: string): Promise<string | null> {
  const result = await $`find ${root} -type f -name "*.css"`.nothrow().quiet();
  if (result.exitCode !== 0) return null;
  const files = result.stdout
    .toString()
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return files[0] ?? null;
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (r.status === 200) return;
    } catch {
      // server not ready yet
    }
    await Bun.sleep(200);
  }
  die(`timeout waiting for ${url}`);
}

async function runNodeFixture(): Promise<void> {
  const dir = join(ROOT, 'fixtures/node-consumer');
  process.stdout.write('[validate-consumers] step 5: node-consumer (under Node, not Bun)…\n');

  await $`rm -rf node_modules dist`.cwd(dir);
  const install = await $`bun install --no-save`.cwd(dir).nothrow();
  if (install.exitCode !== 0) die(`node-consumer bun install failed`);

  const build = await $`bunx tsc`.cwd(dir).nothrow();
  if (build.exitCode !== 0) die(`tsc failed in node-consumer`);

  const result = Bun.spawnSync([NODE_BIN, 'dist/render.js'], { cwd: dir });
  if (result.exitCode !== 0) {
    die(
      `node dist/render.js exited ${result.exitCode}\n` +
        `stdout: ${result.stdout.toString()}\n` +
        `stderr: ${result.stderr.toString()}`,
    );
  }
  const output = result.stdout.toString();
  if (!output.includes('cinder-button')) {
    die(`node render output missing cinder-button class. Output:\n${output}`);
  }
}

await ensureNodeOnPath();
await runBuild();
await packTarball();
await inspectTarball();
await runSveltekitFixture();
await runNodeFixture();

process.stdout.write('[validate-consumers] all checks passed.\n');
