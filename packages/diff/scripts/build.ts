import { $ } from 'bun';

import { atomicSwapDist, stagingDirectoryName } from './lib/atomic-swap-dist.ts';

const packageRoot = process.cwd();
const distributionDirectory = `${packageRoot}/dist`;
// Unique-per-invocation staging directory (a `dist.tmp-*` sibling of `dist`, so
// the same filesystem `atomicSwapDist`'s rename requires). Each build owns its
// own staging dir, so two concurrent same-package builds never collide on it.
const stagingName = stagingDirectoryName();
const stagingDirectory = `${packageRoot}/${stagingName}`;
const entrypoints = [
  `${packageRoot}/src/index.ts`,
  `${packageRoot}/src/line-diff.ts`,
  `${packageRoot}/src/types.ts`,
];

// Build into the staging directory, then promote it via `atomicSwapDist`. A
// build never writes into `dist/` in place, so a concurrent reader (a sibling
// package's test running `bun run --filter=@cinder/diff build`, or a typecheck
// holding dist declarations) can never observe a half-written tree. NOTE: this
// is defense-in-depth, not the #364 fix — the husky test gate serializes its
// test phase, and THAT is what stops concurrent same-package rebuilds inside
// the hook. See `./lib/atomic-swap-dist.ts` for the exact guarantees (and the
// residual transient-ENOENT window this does not close).
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
  `${stagingDirectory}/line-diff.js`,
  `${stagingDirectory}/line-diff.d.ts`,
  `${stagingDirectory}/types.js`,
  `${stagingDirectory}/types.d.ts`,
];

for (const outputPath of expectedOutputs) {
  if (!(await Bun.file(outputPath).exists())) {
    process.stderr.write(`Missing build output: ${outputPath}\n`);
    process.exit(1);
  }
}

// Promote the validated staging tree into `dist/`. `atomicSwapDist` handles a
// concurrent same-package build (turbo/CI/manual) winning the race, and never
// exposes a partially-written tree. It does NOT keep `dist/` continuously
// present — there is a sub-millisecond window in the rebuild path where `dist/`
// is absent — so it is not, on its own, sufficient for fully concurrent
// rebuilds; the test-gate serialization is what makes the hook path safe.
atomicSwapDist(stagingDirectory, distributionDirectory);

process.stdout.write('Build complete.\n');
