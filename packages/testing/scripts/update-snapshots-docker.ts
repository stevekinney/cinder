import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSignalCleanupHandlers, terminateChildProcess } from './start-server.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const repoRoot = resolvePath(packageRoot, '../..');

type PackageManifest = { devDependencies?: Record<string, string> };

export function readPinnedPlaywrightVersion(): string {
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

export function run(
  command: string,
  args: readonly string[],
  options: { cwd?: string; onSpawn?: (child: ChildProcess) => void } = {},
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: 'inherit',
    });
    options.onSpawn?.(child);
    child.once('exit', (code) => resolve(code ?? 1));
    child.once('error', (error) => {
      console.error(`Failed to spawn ${command}:`, error);
      resolve(1);
    });
  });
}

export function dockerImageTagForVersion(playwrightVersion: string): string {
  return `cinder-playwright:${playwrightVersion}`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** Environment variable carrying the host user id into the container. */
export const HOST_UID_ENVIRONMENT_NAME = 'CINDER_HOST_UID';
/** Environment variable carrying the host group id into the container. */
export const HOST_GID_ENVIRONMENT_NAME = 'CINDER_HOST_GID';

/**
 * Repo-relative paths the containerised suite writes through the `/work` bind
 * mount. The image declares no `USER` and `docker run` passes no `--user`, so
 * everything written here lands root-owned on the host and later, non-root CI
 * steps (notably `Merge visual-report fragments`) fail with EACCES.
 *
 * `.playwright` is included because the container's prepare-manifest step
 * writes the manifest cache there.
 */
export const CONTAINER_WRITTEN_PATHS = [
  'packages/testing/test-results',
  'packages/testing/screenshots',
  'packages/testing/playwright-report',
  'packages/testing/.playwright',
] as const;

/**
 * Shell tail appended to every container command so container-written paths are
 * handed back to the host uid/gid before the container exits.
 *
 * The ENTRYPOINT is `/bin/bash -lc` with **no** `-e`, so the tail must capture
 * `$?` immediately after the suite and re-`exit` it verbatim. Fail-open here
 * (container exiting 0 on a red suite) would be far worse than an unreclaimed
 * file, hence: capture status first, swallow only the chown's own failure, and
 * always `exit $status`.
 */
export function ownershipReclaimSuffix(): string {
  const owner = `"$${HOST_UID_ENVIRONMENT_NAME}:$${HOST_GID_ENVIRONMENT_NAME}"`;
  return [
    '; status=$?',
    `; chown -R ${owner} ${CONTAINER_WRITTEN_PATHS.join(' ')} 2>/dev/null || true`,
    '; exit $status',
  ].join('');
}

/**
 * Host uid/gid forwarded into the container for {@link ownershipReclaimSuffix}.
 *
 * These are computed, not environmental, so they cannot ride along on an
 * allow-list read from `process.env`. On platforms without `process.getuid`
 * (Windows) both are omitted; `dockerRunArguments` skips undefined values, the
 * chown becomes a no-op, and behaviour is unchanged from before this fix.
 */
export function hostOwnershipEnvironment(
  processHandle: Pick<typeof process, 'getuid' | 'getgid'> = process,
): Record<string, string | undefined> {
  const { getuid, getgid } = processHandle;
  if (typeof getuid !== 'function' || typeof getgid !== 'function') {
    return {};
  }
  return {
    [HOST_UID_ENVIRONMENT_NAME]: String(getuid.call(processHandle)),
    [HOST_GID_ENVIRONMENT_NAME]: String(getgid.call(processHandle)),
  };
}

export function dockerUpdateCommand(extraArgs: string[]): string {
  return (
    [
      'cd /work',
      '&& git config --global --add safe.directory /work',
      '&& bun install --frozen-lockfile',
      '&& bun run --filter=@cinder/testing test:browser:update',
      ...(extraArgs.length > 0 ? ['--', ...extraArgs.map(shellQuote)] : []),
    ].join(' ') + ownershipReclaimSuffix()
  );
}

export function dockerBrowserCommand(extraArgs: string[]): string {
  return (
    [
      'cd /work',
      '&& git config --global --add safe.directory /work',
      '&& bun install --frozen-lockfile',
      '&& bun run test:browser',
      ...(extraArgs.length > 0 ? ['--', ...extraArgs.map(shellQuote)] : []),
    ].join(' ') + ownershipReclaimSuffix()
  );
}

export type DockerRunArgumentsOptions = {
  repoRoot: string;
  imageTag: string;
  containerCommand: string;
  environment?: Readonly<Record<string, string | undefined>>;
  gitMetadataMountPaths?: readonly string[];
};

function isInsideDirectory(path: string, directory: string): boolean {
  return path === directory || path.startsWith(`${directory}/`);
}

/**
 * A linked worktree's `.git` file can point at metadata outside the bind-mounted
 * checkout. Mount only those referenced directories at their host paths so Git
 * can resolve `HEAD` inside Docker without exposing the whole parent checkout.
 */
export function gitMetadataMountPaths(repoRoot: string): string[] {
  const gitDirectory = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const commonDirectory = spawnSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (gitDirectory.status !== 0 || commonDirectory.status !== 0) {
    throw new Error('failed to resolve Git metadata directories for the Docker bind mount');
  }

  return [...new Set([gitDirectory.stdout.trim(), commonDirectory.stdout.trim()])].filter(
    (path) => path.length > 0 && !isInsideDirectory(path, repoRoot),
  );
}

export function dockerRunArguments(options: DockerRunArgumentsOptions): string[] {
  const args = ['run', '--rm'];
  for (const [name, value] of Object.entries(options.environment ?? {})) {
    if (value !== undefined && value.trim().length > 0) {
      args.push('-e', `${name}=${value}`);
    }
  }
  for (const path of options.gitMetadataMountPaths ?? []) {
    args.push('-v', `${path}:${path}:ro`);
  }
  args.push(
    '-v',
    `${options.repoRoot}:/work`,
    '-w',
    '/work',
    options.imageTag,
    options.containerCommand,
  );
  return args;
}

export async function buildPlaywrightDockerImage(
  playwrightVersion: string,
  imageTag: string,
  onSpawn?: (child: ChildProcess) => void,
): Promise<number> {
  return run(
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
    { cwd: repoRoot, ...(onSpawn !== undefined ? { onSpawn } : {}) },
  );
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
  let activeChild: ChildProcess | null = null;
  installSignalCleanupHandlers(async () => {
    if (activeChild !== null) {
      await terminateChildProcess({
        childProcess: activeChild,
        name: 'docker',
        killProcessGroup: false,
      });
    }
  });

  const playwrightVersion = readPinnedPlaywrightVersion();
  const imageTag = dockerImageTagForVersion(playwrightVersion);

  console.log(`Building Docker image ${imageTag}...`);
  const buildExit = await buildPlaywrightDockerImage(
    playwrightVersion,
    imageTag,
    (child) => (activeChild = child),
  );
  activeChild = null;
  if (buildExit !== 0) {
    console.error(`docker build failed with exit code ${buildExit}`);
    process.exit(buildExit);
  }

  const extraArgs = process.argv.slice(2);
  const updateCommand = dockerUpdateCommand(extraArgs);

  console.log(`Running snapshot update inside ${imageTag}...`);
  const runExit = await run(
    'docker',
    dockerRunArguments({
      repoRoot,
      imageTag,
      containerCommand: updateCommand,
      gitMetadataMountPaths: gitMetadataMountPaths(repoRoot),
      environment: {
        CINDER_TEST_COMPONENTS: process.env['CINDER_TEST_COMPONENTS'],
        ...hostOwnershipEnvironment(),
      },
    }),
    { cwd: repoRoot, onSpawn: (child) => (activeChild = child) },
  );
  activeChild = null;

  process.exit(runExit);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('update-snapshots-docker failed:', error);
    process.exit(1);
  });
}
