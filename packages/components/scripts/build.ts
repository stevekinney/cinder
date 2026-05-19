import { $ } from 'bun';
import { emitDts } from 'svelte2tsx';

import { createServerEntrySource } from './server-entry.ts';
import { sveltePlugin } from './svelte-plugin.ts';

const repositoryRoot = process.cwd();
const distributionDirectory = `${repositoryRoot}/dist`;
const svelteShimsPath = Bun.resolveSync('svelte2tsx/svelte-shims-v4.d.ts', repositoryRoot);

async function createServerEntry(): Promise<string> {
  const sourcePath = `${repositoryRoot}/src/index.ts`;
  const serverEntryPath = `${repositoryRoot}/node_modules/.cache/server-entry.ts`;
  const source = await Bun.file(sourcePath).text();

  await Bun.write(serverEntryPath, createServerEntrySource(source));

  return serverEntryPath;
}

// Fail fast if generated component artifacts have drifted from source.
// Run `bun run components:generate` to fix drift.
const componentsCheckResult = await $`bun run components:check`.nothrow();
if (componentsCheckResult.exitCode !== 0) {
  process.stderr.write(
    'Build aborted: component artifacts are out of sync. Run `bun run components:generate`.\n',
  );
  process.exit(1);
}

// Fail fast if package.json#exports has drifted from the component file system.
// Run `bun run exports:generate` to fix drift.
const checkResult = await $`bun run exports:check`.nothrow();
if (checkResult.exitCode !== 0) {
  process.stderr.write('Build aborted: exports are out of sync. Run `bun run exports:generate`.\n');
  process.exit(1);
}

await $`rm -rf dist`;

process.env['NODE_ENV'] = 'production';

const serverEntryPath = await createServerEntry();

const serverBuildResult = await Bun.build({
  entrypoints: [serverEntryPath],
  outdir: `${distributionDirectory}/server`,
  target: 'node',
  format: 'esm',
  naming: {
    entry: 'index.[ext]',
    chunk: '[name]-[hash].[ext]',
    asset: '[name]-[hash].[ext]',
  },
  sourcemap: 'external',
  minify: false,
  external: ['@cinder/*', 'svelte'],
  plugins: [sveltePlugin({ generate: 'server' })],
});

if (!serverBuildResult.success) {
  const messages = ['Server build failed:', ...serverBuildResult.logs.map(String)].join('\n');
  process.stderr.write(`${messages}\n`);
  process.exit(1);
}

await emitDts({
  declarationDir: distributionDirectory,
  svelteShimsPath,
  libRoot: `${repositoryRoot}/src`,
  tsconfig: `${repositoryRoot}/tsconfig.build.json`,
});

// Smoke-check declaration output for a migrated component (button is in the
// per-directory layout) and the root barrel.
const expectedComponentDeclarations = `${distributionDirectory}/components/button/button.svelte.d.ts`;
const expectedBarrelDeclarations = `${distributionDirectory}/index.d.ts`;

for (const declarationPath of [expectedComponentDeclarations, expectedBarrelDeclarations]) {
  if (!(await Bun.file(declarationPath).exists())) {
    process.stderr.write(`Missing declaration output: ${declarationPath}\n`);
    process.exit(1);
  }
}

process.stdout.write('Build complete.\n');
