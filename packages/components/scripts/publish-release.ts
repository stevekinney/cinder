import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = join(scriptDirectory, '..');

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
  return input.versionExists ? 'skip-existing-version' : 'publish';
}

export function existingVersionMessage(identity: PackageManifest): string {
  return `publish-release — ${identity.name}@${identity.version} already exists on npm; nothing to publish.\n`;
}

async function packageVersionExists(name: string, version: string): Promise<boolean> {
  const result = await $`npm view ${`${name}@${version}`} version --json`.nothrow();
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}

export function getPackFileName(identity: PackageManifest): string {
  const packageFileNamePrefix = identity.name.replace(/^@/, '').replaceAll('/', '-');
  return `${packageFileNamePrefix}-${identity.version}.tgz`;
}

function getPublishArguments(tarballPath: string, dryRun: boolean): string[] {
  return dryRun ? ['publish', tarballPath, '--dry-run'] : ['publish', tarballPath];
}

async function validateConsumerArtifact(packageRootPath: string): Promise<void> {
  const validationResult = await $`bun run validate:consumer`.cwd(packageRootPath).nothrow();
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

/** Resolve an optional package root for another public workspace package. */
export function resolvePackageRootArgument(
  arguments_: readonly string[],
  options: { defaultRoot: string; currentWorkingDirectory: string },
): string {
  const inlineArgument = arguments_.find((argument) => argument.startsWith('--package-root='));
  if (inlineArgument !== undefined) {
    const value = inlineArgument.slice('--package-root='.length);
    if (value.length === 0) throw new Error('--package-root requires a non-empty path');
    return resolve(options.currentWorkingDirectory, value);
  }

  const argumentIndex = arguments_.indexOf('--package-root');
  if (argumentIndex === -1) return options.defaultRoot;
  const value = arguments_[argumentIndex + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error('--package-root requires a path argument');
  }
  return resolve(options.currentWorkingDirectory, value);
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
    dependencies.writeOutput(existingVersionMessage(manifest));
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
  const arguments_ = process.argv.slice(2);
  const dryRun = arguments_.includes('--dry-run');
  const skipValidation = arguments_.includes('--skip-validation');
  const packageRoot = resolvePackageRootArgument(arguments_, {
    defaultRoot: defaultPackageRoot,
    currentWorkingDirectory: process.cwd(),
  });

  await runPublishRelease({
    dryRun,
    skipValidation,
    packageRootPath: packageRoot,
    dependencies: {
      readManifest: () => readJsonFile<PackageManifest>(join(packageRoot, 'package.json')),
      versionExists: packageVersionExists,
      artifactExists: existsSync,
      validateConsumerArtifact: () => validateConsumerArtifact(packageRoot),
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
