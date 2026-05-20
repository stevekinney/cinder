import { spawn } from 'node:child_process';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDockerAuthenticity, formatFailures } from './docker-authenticity.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const packageJsonPath = resolvePath(packageRoot, 'package.json');

/**
 * Update committed visual-regression baselines.
 *
 * Refuses to run unless the structural Docker-authenticity check passes —
 * macOS / Linux dev hosts produce pixels that diverge from CI's Ubuntu
 * jammy Playwright image and will write flaky baselines. Use
 * `test:browser:update:docker` to run inside the canonical container.
 *
 * Forwards extra args to `start-server.ts`, which already owns the
 * playground lifecycle, manifest preparation, and `playwright test`
 * invocation. We append `--update-snapshots --retries=0` so the
 * underlying Playwright invocation writes new baselines and never
 * accepts a retry-passing run as authoritative.
 */
async function main(): Promise<void> {
  const result = await checkDockerAuthenticity(packageJsonPath);
  if (!result.ok) {
    console.error(formatFailures(result.failures));
    process.exit(1);
  }

  console.log(
    `Docker authenticity verified (playwright ${result.playwrightVersion}, ubuntu jammy). ` +
      'Writing baselines...',
  );

  const extraArgs = process.argv.slice(2);
  const startServer = resolvePath(packageRoot, 'scripts/start-server.ts');
  const child = spawn(
    'bun',
    ['run', startServer, '--', '--update-snapshots', '--retries=0', ...extraArgs],
    {
      cwd: packageRoot,
      stdio: 'inherit',
      env: { ...process.env, CINDER_UPDATE_SNAPSHOTS: '1' },
    },
  );

  const exitCode = await new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1));
    child.once('error', (error) => {
      console.error('Failed to spawn start-server.ts:', error);
      resolve(1);
    });
  });

  process.exit(exitCode);
}

main().catch((error: unknown) => {
  console.error('update-snapshots failed:', error);
  process.exit(1);
});
