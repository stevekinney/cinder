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
  `${packageRoot}/src/line-diff.ts`,
  `${packageRoot}/src/types.ts`,
];

// Build to a staging directory first so a concurrent reader of `dist/` never
// sees a partially-written tree. The `rm -rf dist` → write-to-dist pattern
// opens a window where another process (e.g. a sibling package's test script
// doing `bun run --filter=@cinder/diff build`) wipes `dist` while the first
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

// Atomically swap the staging directory into place via `atomicSwapDist`, which
// keeps `dist/` continuously accessible to concurrent readers and handles
// concurrent same-package builds. It renames the live tree to `dist.old-<pid>`
// before installing the staging tree, so there is NO window where `dist/` does
// not exist. A concurrent `tsc` (e.g. @lostgradient/cinder typecheck running in
// parallel) that holds dist declarations in its incremental cache can safely
// re-read them at any point — it sees either the old tree or the new tree,
// never ENOENT. The naive `rm -rf dist && rename(dist.tmp, dist)` approach
// exposes a brief ENOENT gap that tsc's incremental engine can interpret as a
// deleted file, triggering a full re-parse with a stale / partially-invalidated
// cache — the root cause of the TS1109 errors observed in concurrent pre-commit
// runs. See `./lib/atomic-swap-dist.ts` for the per-PID concurrent-winner logic.
atomicSwapDist(stagingDirectory, distributionDirectory);

process.stdout.write('Build complete.\n');
