import { $ } from 'bun';
import { emitDts } from 'svelte2tsx';

import { sveltePlugin } from './svelte-plugin.ts';

const repositoryRoot = process.cwd();
const distributionDirectory = `${repositoryRoot}/dist`;
const svelteShimsPath = Bun.resolveSync('svelte2tsx/svelte-shims-v4.d.ts', repositoryRoot);

await $`rm -rf dist`;

process.env['NODE_ENV'] = 'production';

const serverBuildResult = await Bun.build({
  entrypoints: [`${repositoryRoot}/src/index.ts`],
  outdir: `${distributionDirectory}/server`,
  target: 'node',
  format: 'esm',
  naming: '[dir]/[name].js',
  sourcemap: 'external',
  minify: false,
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

const expectedComponentDeclarations = `${distributionDirectory}/components/button.svelte.d.ts`;
const expectedBarrelDeclarations = `${distributionDirectory}/index.d.ts`;

for (const declarationPath of [expectedComponentDeclarations, expectedBarrelDeclarations]) {
  if (!(await Bun.file(declarationPath).exists())) {
    process.stderr.write(`Missing declaration output: ${declarationPath}\n`);
    process.exit(1);
  }
}

process.stdout.write('Build complete.\n');
