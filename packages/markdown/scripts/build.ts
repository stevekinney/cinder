import { $ } from 'bun';

const packageRoot = process.cwd();
const distributionDirectory = `${packageRoot}/dist`;
const entrypoints = [
  `${packageRoot}/src/index.ts`,
  `${packageRoot}/src/pipeline/index.ts`,
  `${packageRoot}/src/diff/index.ts`,
  `${packageRoot}/src/diff/line-diff.ts`,
  `${packageRoot}/src/diff/types.ts`,
  `${packageRoot}/src/rendering/index.ts`,
  `${packageRoot}/src/rendering/types.ts`,
  `${packageRoot}/src/rendering/highlighter.ts`,
  `${packageRoot}/src/rendering/mermaid-cache.ts`,
  `${packageRoot}/src/utilities/safe-url.ts`,
  `${packageRoot}/src/utilities/sort-keys.ts`,
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
  `${distributionDirectory}/pipeline/index.js`,
  `${distributionDirectory}/pipeline/index.d.ts`,
  `${distributionDirectory}/diff/index.js`,
  `${distributionDirectory}/diff/index.d.ts`,
  `${distributionDirectory}/diff/line-diff.js`,
  `${distributionDirectory}/diff/line-diff.d.ts`,
  `${distributionDirectory}/diff/types.js`,
  `${distributionDirectory}/diff/types.d.ts`,
  `${distributionDirectory}/rendering/index.js`,
  `${distributionDirectory}/rendering/index.d.ts`,
  `${distributionDirectory}/rendering/types.js`,
  `${distributionDirectory}/rendering/types.d.ts`,
  `${distributionDirectory}/rendering/highlighter.js`,
  `${distributionDirectory}/rendering/highlighter.d.ts`,
  `${distributionDirectory}/rendering/mermaid-cache.js`,
  `${distributionDirectory}/rendering/mermaid-cache.d.ts`,
  `${distributionDirectory}/utilities/safe-url.js`,
  `${distributionDirectory}/utilities/safe-url.d.ts`,
  `${distributionDirectory}/utilities/sort-keys.js`,
  `${distributionDirectory}/utilities/sort-keys.d.ts`,
];

for (const outputPath of expectedOutputs) {
  if (!(await Bun.file(outputPath).exists())) {
    process.stderr.write(`Missing build output: ${outputPath}\n`);
    process.exit(1);
  }
}

process.stdout.write('Build complete.\n');
