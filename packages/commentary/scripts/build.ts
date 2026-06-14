import { $ } from 'bun';

import { atomicSwapDist } from './lib/atomic-swap-dist.ts';
import { getExpectedBuildOutputs, readPackageExports } from './package-exports.js';

const packageRoot = process.cwd();
const distributionDirectory = `${packageRoot}/dist`;
// Per-PID staging directory so concurrent same-package builds never collide on
// a shared `dist.tmp` (each writer owns its own `dist.tmp-<pid>`).
const stagingName = `dist.tmp-${process.pid}`;
const stagingDirectory = `${packageRoot}/${stagingName}`;
const packageExports = await readPackageExports();

// Build to a staging directory first so a concurrent reader of `dist/` never
// sees a partially-written tree. The `rm -rf dist` → write-to-dist pattern
// opens a window where another process (e.g. a sibling package's test script
// doing `bun run --filter=@cinder/commentary build`) wipes `dist` while the
// first process's compiler is still writing into it. Building to
// `dist.tmp-<pid>` then atomically renaming over `dist` closes that window: on
// POSIX, `rename(2)` is atomic — a concurrent reader either sees the old tree
// or the new tree, never a partial write. This is the root fix for issue #364.
await $`rm -rf ${stagingDirectory}`;

// `tsc` is configured to emit into `./dist` via tsconfig.build.json, but we
// override `--outDir` on the command line so it emits into the staging
// directory. The CLI flag takes precedence over the tsconfig value.
const compileResult = await $`tsc -p tsconfig.build.json --outDir ./${stagingName}`.nothrow();
if (compileResult.exitCode !== 0) {
  process.stderr.write(compileResult.stdout.toString());
  process.stderr.write(compileResult.stderr.toString());
  process.exit(1);
}

// `getExpectedBuildOutputs` returns absolute paths rooted at the package root,
// pointing into `dist/`. Substitute `dist` with the staging dir for the staging
// validation — we must verify the staging tree before promoting it.
const expectedOutputs = getExpectedBuildOutputs(packageRoot, packageExports).map((path) =>
  path.replace(`${packageRoot}/dist/`, `${stagingDirectory}/`),
);

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
