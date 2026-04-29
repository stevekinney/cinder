import { $ } from 'bun';

const packageRoot = process.cwd();
const distributionDirectory = `${packageRoot}/dist`;
const entrypoints = [
  `${packageRoot}/src/index.ts`,
  `${packageRoot}/src/sanitize-html.ts`,
  `${packageRoot}/src/template-placeholders.ts`,
  `${packageRoot}/src/template-render.ts`,
  `${packageRoot}/src/test-utilities.ts`,
];

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

const expectedOutputs = [
  `${distributionDirectory}/index.js`,
  `${distributionDirectory}/index.d.ts`,
  `${distributionDirectory}/sanitize-html.js`,
  `${distributionDirectory}/sanitize-html.d.ts`,
  `${distributionDirectory}/template-placeholders.js`,
  `${distributionDirectory}/template-placeholders.d.ts`,
  `${distributionDirectory}/template-render.js`,
  `${distributionDirectory}/template-render.d.ts`,
  `${distributionDirectory}/test-utilities.js`,
  `${distributionDirectory}/test-utilities.d.ts`,
];

for (const outputPath of expectedOutputs) {
  if (!(await Bun.file(outputPath).exists())) {
    process.stderr.write(`Missing build output: ${outputPath}\n`);
    process.exit(1);
  }
}

process.stdout.write('Build complete.\n');
