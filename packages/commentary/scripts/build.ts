import { $ } from 'bun';

import { getExpectedBuildOutputs, readPackageExports } from './package-exports.js';

const packageRoot = process.cwd();
const packageExports = await readPackageExports();

await $`rm -rf dist`;

const compileResult = await $`tsc -p tsconfig.build.json`.nothrow();
if (compileResult.exitCode !== 0) {
  process.stderr.write(compileResult.stdout.toString());
  process.stderr.write(compileResult.stderr.toString());
  process.exit(1);
}

const expectedOutputs = getExpectedBuildOutputs(packageRoot, packageExports);

for (const outputPath of expectedOutputs) {
  if (!(await Bun.file(outputPath).exists())) {
    process.stderr.write(`Missing build output: ${outputPath}\n`);
    process.exit(1);
  }
}

process.stdout.write('Build complete.\n');
