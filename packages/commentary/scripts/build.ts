import { $ } from 'bun';

import {
  getBuildEntrypoints,
  getExpectedBuildOutputs,
  readPackageExports,
} from './package-exports.js';

const packageRoot = process.cwd();
const distributionDirectory = `${packageRoot}/dist`;
const packageExports = await readPackageExports();
const entrypoints = getBuildEntrypoints(packageRoot, packageExports);

await $`rm -rf dist`;

const buildResult = await Bun.build({
  entrypoints,
  outdir: distributionDirectory,
  root: `${packageRoot}/src`,
  target: 'browser',
  format: 'esm',
  naming: '[dir]/[name].js',
  sourcemap: 'external',
  minify: false,
  external: ['@cinder/*', 'svelte'],
});

if (!buildResult.success) {
  const messages = ['Build failed:', ...buildResult.logs.map(String)].join('\n');
  process.stderr.write(`${messages}\n`);
  process.exit(1);
}

await $`tsc -p tsconfig.build.json`;

const expectedOutputs = getExpectedBuildOutputs(packageRoot, packageExports);

for (const outputPath of expectedOutputs) {
  if (!(await Bun.file(outputPath).exists())) {
    process.stderr.write(`Missing build output: ${outputPath}\n`);
    process.exit(1);
  }
}

process.stdout.write('Build complete.\n');
