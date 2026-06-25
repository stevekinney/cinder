import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..');

type PackageManifest = {
  name: string;
  version: string;
};

type PublishAction = 'publish' | 'skip-existing-version';
type PublishResult = {
  exitCode: number | null;
};
type PublishReleaseDependencies = {
  readManifest: () => Promise<PackageManifest>;
  versionExists: (name: string, version: string) => Promise<boolean>;
  artifactExists: (path: string) => boolean;
  validateConsumerArtifact: () => Promise<void>;
  spawnPublish: (publishArguments: string[]) => PublishResult;
  writeOutput: (message: string) => void;
};

export function resolvePublishAction(input: {
  dryRun: boolean;
  versionExists: boolean;
}): PublishAction {
  return !input.dryRun && input.versionExists ? 'skip-existing-version' : 'publish';
}

export function existingVersionMessage(identity: PackageManifest, dryRun: boolean): string {
  if (dryRun) {
    return `publish-release — ${identity.name}@${identity.version} already exists on npm; skipping dry-run publish.\n`;
  }

  return `publish-release — ${identity.name}@${identity.version} already exists on npm; nothing to publish.\n`;
}

async function packageVersionExists(name: string, version: string): Promise<boolean> {
  const result = await $`npm view ${`${name}@${version}`} version --json`.nothrow();
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}

function getPackFileName(identity: PackageManifest): string {
  const packageFileNamePrefix = identity.name.replace(/^@/, '').replaceAll('/', '-');
  return `${packageFileNamePrefix}-${identity.version}.tgz`;
}

function getPublishArguments(tarballPath: string, dryRun: boolean): string[] {
  return dryRun ? ['publish', tarballPath, '--dry-run'] : ['publish', tarballPath];
}

async function validateConsumerArtifact(): Promise<void> {
  const validationResult = await $`bun run validate:consumer`.cwd(packageRoot).nothrow();
  if (validationResult.exitCode !== 0) {
    const stdout = validationResult.stdout.toString().trim();
    const stderr = validationResult.stderr.toString().trim();
    throw new Error(
      [
        `validate:consumer failed with exit ${validationResult.exitCode}`,
        stdout.length > 0 ? `stdout:\n${stdout}` : undefined,
        stderr.length > 0 ? `stderr:\n${stderr}` : undefined,
      ]
        .filter((line): line is string => line !== undefined)
        .join('\n\n'),
    );
  }
}

export async function runPublishRelease(input: {
  dryRun: boolean;
  skipValidation: boolean;
  packageRootPath: string;
  dependencies: PublishReleaseDependencies;
}): Promise<void> {
  const { dependencies, dryRun, packageRootPath, skipValidation } = input;
  const manifest = await dependencies.readManifest();
  const tarballPath = join(packageRootPath, getPackFileName(manifest));

  const publishAction = resolvePublishAction({
    dryRun,
    versionExists: await dependencies.versionExists(manifest.name, manifest.version),
  });

  if (publishAction === 'skip-existing-version') {
    dependencies.writeOutput(existingVersionMessage(manifest, dryRun));
    return;
  }

  if (skipValidation) {
    dependencies.writeOutput(
      'publish-release — using prior validate:consumer artifact from this job.\n',
    );
    if (!dependencies.artifactExists(tarballPath)) {
      dependencies.writeOutput(
        `publish-release — no validated artifact found at ${tarballPath}; running validate:consumer…\n`,
      );
      await dependencies.validateConsumerArtifact();
    }
  } else {
    dependencies.writeOutput('publish-release — validating consumer artifact before publish…\n');
    await dependencies.validateConsumerArtifact();
  }

  if (!dependencies.artifactExists(tarballPath)) {
    throw new Error(`validated package artifact not found at ${tarballPath}`);
  }

  const publishArguments = getPublishArguments(tarballPath, dryRun);
  dependencies.writeOutput(
    `publish-release — npm ${publishArguments.join(' ')} (${manifest.name}@${manifest.version})\n`,
  );
  const publishResult = dependencies.spawnPublish(publishArguments);
  if (publishResult.exitCode !== 0) {
    throw new Error(`npm publish exited ${publishResult.exitCode}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const skipValidation = process.argv.includes('--skip-validation');

  await runPublishRelease({
    dryRun,
    skipValidation,
    packageRootPath: packageRoot,
    dependencies: {
      readManifest: () => readJsonFile<PackageManifest>(join(packageRoot, 'package.json')),
      versionExists: packageVersionExists,
      artifactExists: existsSync,
      validateConsumerArtifact,
      spawnPublish: (publishArguments) =>
        Bun.spawnSync(['npm', ...publishArguments], {
          cwd: packageRoot,
          stdio: ['inherit', 'inherit', 'inherit'],
          env: {
            ...Bun.env,
            NPM_CONFIG_PROVENANCE: Bun.env['NPM_CONFIG_PROVENANCE'] ?? 'true',
          },
        }),
      writeOutput: (message) => {
        process.stdout.write(message);
      },
    },
  });
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `publish-release failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
