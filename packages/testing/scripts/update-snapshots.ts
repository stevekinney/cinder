import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BaselineComponentScope,
  createBaselineProvenance,
  dockerImageTagForPlaywrightVersion,
  normalizeProvenanceComponentScope,
  readOsCodename,
  writeBaselineProvenance,
} from './baseline-provenance.ts';
import { checkDockerAuthenticity, formatFailures } from './docker-authenticity.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const packageJsonPath = resolvePath(packageRoot, 'package.json');
const repoRoot = resolvePath(packageRoot, '../..');

export function startServerArguments(startServerPath: string, extraArgs: string[]): string[] {
  return ['run', startServerPath, '--', '--update-snapshots', '--retries=0', ...extraArgs];
}

export function snapshotUpdateEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...environment, CINDER_UPDATE_SNAPSHOTS: '1', CINDER_VISUAL_DIFF: 'block' };
}

export function provenanceComponentScope(
  rawComponentScope: string | undefined,
): BaselineComponentScope {
  return rawComponentScope !== undefined && rawComponentScope.trim().length > 0
    ? normalizeProvenanceComponentScope(rawComponentScope)
    : 'all';
}

export function readRenderedSourceSha(cwd: string): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`failed to resolve rendered source sha: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

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
  const renderedSourceSha = readRenderedSourceSha(repoRoot);
  const child = spawn('bun', startServerArguments(startServer, extraArgs), {
    cwd: packageRoot,
    stdio: 'inherit',
    // CINDER_VISUAL_DIFF=block ensures toHaveScreenshot is active so
    // Playwright actually writes/updates the committed baseline PNGs rather
    // than writing legacy review screenshots under screenshots/.
    env: snapshotUpdateEnvironment(process.env),
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1));
    child.once('error', (error) => {
      console.error('Failed to spawn start-server.ts:', error);
      resolve(1);
    });
  });

  if (exitCode === 0) {
    await writeBaselineProvenance(
      resolvePath(packageRoot, 'snapshots', 'provenance.json'),
      createBaselineProvenance({
        componentScope: provenanceComponentScope(process.env['CINDER_TEST_COMPONENTS']),
        renderedSourceSha,
        playwrightVersion: result.playwrightVersion,
        osCodename: readOsCodename() ?? '<missing /etc/os-release>',
        architecture: process.arch,
        dockerImageTag: dockerImageTagForPlaywrightVersion(result.playwrightVersion),
      }),
    );
  }

  process.exit(exitCode);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('update-snapshots failed:', error);
    process.exit(1);
  });
}
