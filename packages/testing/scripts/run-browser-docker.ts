import type { ChildProcess } from 'node:child_process';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSignalCleanupHandlers, terminateChildProcess } from './start-server.ts';
import {
  buildPlaywrightDockerImage,
  dockerBrowserCommand,
  dockerImageTagForVersion,
  dockerRunArguments,
  readPinnedPlaywrightVersion,
  run,
} from './update-snapshots-docker.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const repoRoot = resolvePath(packageRoot, '../..');

const FORWARDED_ENVIRONMENT_NAMES = [
  'CI',
  'CINDER_TEST_COMPONENTS',
  'CINDER_VISUAL_DIFF',
  'PLAYGROUND_URL',
  'PLAYWRIGHT_REUSE_SERVER',
  'PLAYWRIGHT_TRACE',
] as const;

export function dockerBrowserEnvironment(
  environment: NodeJS.ProcessEnv,
): Record<string, string | undefined> {
  const forwarded: Record<string, string | undefined> = {};
  for (const name of FORWARDED_ENVIRONMENT_NAMES) {
    forwarded[name] = environment[name];
  }
  return forwarded;
}

/**
 * Host-side wrapper that runs the browser suite inside the canonical
 * cinder-playwright Docker image used to author committed baselines.
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
  const browserCommand = dockerBrowserCommand(extraArgs);

  console.log(`Running browser suite inside ${imageTag}...`);
  const runExit = await run(
    'docker',
    dockerRunArguments({
      repoRoot,
      imageTag,
      containerCommand: browserCommand,
      environment: dockerBrowserEnvironment(process.env),
    }),
    { cwd: repoRoot, onSpawn: (child) => (activeChild = child) },
  );
  activeChild = null;

  process.exit(runExit);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('run-browser-docker failed:', error);
    process.exit(1);
  });
}
