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

async function packageVersionExists(name: string, version: string): Promise<boolean> {
  const result = await $`npm view ${`${name}@${version}`} version --json`.nothrow();
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}

function getPackFileName(identity: PackageManifest): string {
  const packageFileNamePrefix = identity.name.replace(/^@/, '').replaceAll('/', '-');
  return `${packageFileNamePrefix}-${identity.version}.tgz`;
}

async function validateConsumerArtifact(): Promise<void> {
  const validationResult = await $`bun run validate:consumer`.cwd(packageRoot).nothrow();
  if (validationResult.exitCode !== 0) {
    throw new Error(`validate:consumer failed with exit ${validationResult.exitCode}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const skipValidation = process.argv.includes('--skip-validation');
  const manifest = await readJsonFile<PackageManifest>(join(packageRoot, 'package.json'));
  const tarballPath = join(packageRoot, getPackFileName(manifest));

  if (!dryRun && (await packageVersionExists(manifest.name, manifest.version))) {
    process.stdout.write(
      `publish-release — ${manifest.name}@${manifest.version} already exists on npm; nothing to publish.\n`,
    );
    return;
  }

  if (skipValidation) {
    process.stdout.write(
      'publish-release — using prior validate:consumer artifact from this job.\n',
    );
    if (!existsSync(tarballPath)) {
      process.stdout.write(
        `publish-release — no validated artifact found at ${tarballPath}; running validate:consumer…\n`,
      );
      await validateConsumerArtifact();
    }
  } else {
    process.stdout.write('publish-release — validating consumer artifact before publish…\n');
    await validateConsumerArtifact();
  }

  if (!existsSync(tarballPath)) {
    throw new Error(`validated package artifact not found at ${tarballPath}`);
  }

  const publishArguments = dryRun
    ? ['publish', tarballPath, '--dry-run']
    : ['publish', tarballPath];
  process.stdout.write(
    `publish-release — npm ${publishArguments.join(' ')} (${manifest.name}@${manifest.version})\n`,
  );
  const publishResult = Bun.spawnSync(['npm', ...publishArguments], {
    cwd: packageRoot,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...Bun.env, NPM_CONFIG_PROVENANCE: Bun.env['NPM_CONFIG_PROVENANCE'] ?? 'true' },
  });
  if (publishResult.exitCode !== 0) {
    throw new Error(`npm publish exited ${publishResult.exitCode}`);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `publish-release failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
