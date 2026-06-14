import { $ } from 'bun';

import { atomicSwapDist } from './lib/atomic-swap-dist.ts';

const packageRoot = process.cwd();
const distributionDirectory = `${packageRoot}/dist`;
// Per-PID staging directory so concurrent same-package builds never collide on
// a shared `dist.tmp` (each writer owns its own `dist.tmp-<pid>`).
const stagingName = `dist.tmp-${process.pid}`;
const stagingDirectory = `${packageRoot}/${stagingName}`;
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

// Build to a staging directory first so a concurrent reader of `dist/` never
// sees a partially-written tree. The `rm -rf dist` → write-to-dist pattern
// opens a window where another process (e.g. a sibling package's test script
// doing `bun run --filter=@cinder/markdown build`) wipes `dist` while the first
// process's bundler is still writing into it. Building to `dist.tmp-<pid>` then
// atomically renaming over `dist` closes that window: on POSIX, `rename(2)` is
// atomic — a concurrent reader either sees the old tree or the new tree, never
// a partial write. This is the root fix for issue #364.
await $`rm -rf ${stagingDirectory}`;

const buildResult = await Bun.build({
  entrypoints,
  outdir: stagingDirectory,
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

// `tsc` is configured to emit into `./dist` via tsconfig.build.json, but we
// override `--outDir` on the command line so it emits into the staging
// directory alongside the Bun.build output. The CLI flag takes precedence over
// the tsconfig value.
await $`tsc -p tsconfig.build.json --outDir ./${stagingName}`;

const expectedOutputs = [
  `${stagingDirectory}/index.js`,
  `${stagingDirectory}/index.d.ts`,
  `${stagingDirectory}/pipeline/index.js`,
  `${stagingDirectory}/pipeline/index.d.ts`,
  `${stagingDirectory}/diff/index.js`,
  `${stagingDirectory}/diff/index.d.ts`,
  `${stagingDirectory}/diff/line-diff.js`,
  `${stagingDirectory}/diff/line-diff.d.ts`,
  `${stagingDirectory}/diff/types.js`,
  `${stagingDirectory}/diff/types.d.ts`,
  `${stagingDirectory}/rendering/index.js`,
  `${stagingDirectory}/rendering/index.d.ts`,
  `${stagingDirectory}/rendering/types.js`,
  `${stagingDirectory}/rendering/types.d.ts`,
  `${stagingDirectory}/rendering/highlighter.js`,
  `${stagingDirectory}/rendering/highlighter.d.ts`,
  `${stagingDirectory}/rendering/mermaid-cache.js`,
  `${stagingDirectory}/rendering/mermaid-cache.d.ts`,
  `${stagingDirectory}/utilities/safe-url.js`,
  `${stagingDirectory}/utilities/safe-url.d.ts`,
  `${stagingDirectory}/utilities/sort-keys.js`,
  `${stagingDirectory}/utilities/sort-keys.d.ts`,
];

for (const outputPath of expectedOutputs) {
  if (!(await Bun.file(outputPath).exists())) {
    process.stderr.write(`Missing build output: ${outputPath}\n`);
    process.exit(1);
  }
}

// Atomically swap the staging directory into place without ever removing dist/
// while it is live (see packages/diff/scripts/lib/atomic-swap-dist.ts for the
// full concurrent-build rationale).
atomicSwapDist(stagingDirectory, distributionDirectory);

process.stdout.write('Build complete.\n');
