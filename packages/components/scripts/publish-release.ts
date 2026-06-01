import { $ } from 'bun';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from './lib/read-json-file.ts';
import { packForPublish } from './pack-for-publish.ts';

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

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const skipValidation = process.argv.includes('--skip-validation');
  const manifest = await readJsonFile<PackageManifest>(join(packageRoot, 'package.json'));

  if (!dryRun && (await packageVersionExists(manifest.name, manifest.version))) {
    process.stdout.write(
      `publish-release — ${manifest.name}@${manifest.version} already exists on npm; nothing to publish.\n`,
    );
    return;
  }

  if (skipValidation) {
    process.stdout.write('publish-release — using prior validate:consumer result from this job.\n');
  } else {
    process.stdout.write('publish-release — validating consumer artifact before publish…\n');
    const validationResult = await $`bun run validate:consumer`.cwd(packageRoot).nothrow();
    if (validationResult.exitCode !== 0) {
      throw new Error(`validate:consumer failed with exit ${validationResult.exitCode}`);
    }
  }

  const { tarballPath } = await packForPublish();
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
