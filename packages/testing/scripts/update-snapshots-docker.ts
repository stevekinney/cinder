import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const repoRoot = resolvePath(packageRoot, '../..');

type PackageManifest = { devDependencies?: Record<string, string> };

function readPinnedPlaywrightVersion(): string {
  const raw = readFileSync(resolvePath(packageRoot, 'package.json'), 'utf8');
  const parsed = JSON.parse(raw) as PackageManifest;
  const pinned = parsed.devDependencies?.['@playwright/test'];
  if (!pinned || /^[\^~]/.test(pinned)) {
    throw new Error(
      `@playwright/test must be exact-pinned (no ^ or ~) in packages/testing/package.json; got ${pinned ?? 'undefined'}`,
    );
  }
  return pinned;
}

function run(
  command: string,
  args: readonly string[],
  options: { cwd?: string } = {},
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: 'inherit',
    });
    child.once('exit', (code) => resolve(code ?? 1));
    child.once('error', (error) => {
      console.error(`Failed to spawn ${command}:`, error);
      resolve(1);
    });
  });
}

/**
 * Host-side wrapper that builds and runs the canonical cinder-playwright
 * Docker image, then invokes `bun run test:browser:update` inside it.
 *
 * The image tag is derived from the exact-pinned `@playwright/test`
 * version in `packages/testing/package.json` — hardcoded tags are
 * forbidden by the plan.
 */
async function main(): Promise<void> {
  const playwrightVersion = readPinnedPlaywrightVersion();
  const imageTag = `cinder-playwright:${playwrightVersion}`;

  console.log(`Building Docker image ${imageTag}...`);
  const buildExit = await run(
    'docker',
    [
      'build',
      '--build-arg',
      `PLAYWRIGHT_VERSION=${playwrightVersion}`,
      '-t',
      imageTag,
      '-f',
      resolvePath(packageRoot, 'Dockerfile'),
      packageRoot,
    ],
    { cwd: repoRoot },
  );
  if (buildExit !== 0) {
    console.error(`docker build failed with exit code ${buildExit}`);
    process.exit(buildExit);
  }

  const extraArgs = process.argv.slice(2);
  const updateCommand = [
    'cd /work',
    '&& bun install --frozen-lockfile',
    '&& bun run --filter=@cinder/testing test:browser:update',
    ...(extraArgs.length > 0 ? ['--', ...extraArgs] : []),
  ].join(' ');

  console.log(`Running snapshot update inside ${imageTag}...`);
  const runExit = await run(
    'docker',
    ['run', '--rm', '-v', `${repoRoot}:/work`, '-w', '/work', imageTag, updateCommand],
    { cwd: repoRoot },
  );

  process.exit(runExit);
}

main().catch((error: unknown) => {
  console.error('update-snapshots-docker failed:', error);
  process.exit(1);
});
