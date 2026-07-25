import { $ } from 'bun';
import { chmod } from 'node:fs/promises';

import { atomicSwapDist, stagingDirectoryName } from './lib/atomic-swap-dist.ts';
import { shortHash, shouldSkipBuild, writeBuildInputHash } from './lib/build-cache.ts';

const packageRoot = process.cwd();
const workspaceRoot = `${packageRoot}/../..`;
const distributionDirectory = `${packageRoot}/dist`;

// `@lostgradient/cinder`'s own `dist/` must be fresh before the `tsc` build
// below runs: `errors.ts` imports `@lostgradient/cinder/knowledge`, whose
// `types` condition points at `dist/cli/knowledge.d.ts`, so declaration
// emission needs that file to exist. Mirrors how Cinder's own build.ts builds
// `@lostgradient/markdown` first for the same reason.
const cinderBuildResult =
  await $`bun run --cwd ${workspaceRoot}/packages/components build`.nothrow();
if (cinderBuildResult.exitCode !== 0) {
  process.stderr.write(
    `Build aborted: upstream @lostgradient/cinder build failed (exit ${cinderBuildResult.exitCode}).\n` +
      `${cinderBuildResult.stderr.toString()}\n`,
  );
  process.exit(1);
}

const buildCacheInputs = {
  packageRoot,
  sourceGlobRoots: [`${packageRoot}/src`, `${packageRoot}/scripts`],
  extraFiles: [
    `${packageRoot}/package.json`,
    `${packageRoot}/tsconfig.json`,
    `${packageRoot}/tsconfig.build.json`,
    `${workspaceRoot}/bun.lock`,
    `${workspaceRoot}/tsconfig.base.json`,
  ],
  // This package's `dist/index.js`/`dist/bin.js` import `@lostgradient/cinder/knowledge`
  // as an external — Cinder's own dist is not bundled in, so a Cinder-only
  // change never appears in this hash. That's intentional: the build cache
  // only needs to invalidate on inputs that change THIS package's bundle.
  upstreamDistDirectories: [],
};

const skipDecision = await shouldSkipBuild(buildCacheInputs);
if (skipDecision.skip) {
  process.stdout.write(`[build] up to date (hash ${shortHash(skipDecision.hash)}), skipping\n`);
  process.exit(0);
}

// Unique-per-invocation staging directory, promoted atomically at the end —
// see `packages/markdown/scripts/build.ts` for the concurrent-build rationale
// this mirrors.
const stagingName = stagingDirectoryName();
const stagingDirectory = `${packageRoot}/${stagingName}`;

await $`rm -rf ${stagingDirectory}`;

// `@lostgradient/cinder`, the MCP SDK, and zod are regular runtime dependencies of the
// published package (not bundled) — an npm install resolves them, and the
// packed tarball never vendors Cinder's component library or the SDK/zod
// source, matching the plan's "do not bundle Cinder's component library"
// non-goal.
const runtimeExternals = [
  '@lostgradient/cinder',
  '@lostgradient/cinder/*',
  '@modelcontextprotocol/sdk',
  '@modelcontextprotocol/sdk/*',
  'zod',
  'zod/*',
];

const buildResult = await Bun.build({
  entrypoints: [`${packageRoot}/src/index.ts`, `${packageRoot}/src/bin.ts`],
  outdir: stagingDirectory,
  root: `${packageRoot}/src`,
  target: 'node',
  format: 'esm',
  splitting: false,
  external: runtimeExternals,
  naming: '[dir]/[name].js',
  sourcemap: 'external',
  minify: false,
});

if (!buildResult.success) {
  const messages = ['Build failed:', ...buildResult.logs.map(String)].join('\n');
  process.stderr.write(`${messages}\n`);
  process.exit(1);
}

await $`tsc -p tsconfig.build.json --outDir ./${stagingName}`;

// Verify the external boundary held in the actual shipped output: `tsc`'s
// per-file emit (above) overwrites Bun's bundle in the same staging
// directory, so this must run after tsc and scan every emitted module —
// the literal `@lostgradient/cinder/knowledge` import lives in whichever
// file re-exports `server.ts`, not necessarily `index.js`/`bin.js` themselves.
// Never inline Cinder's knowledge-service source; a regression here would
// silently detach the built server from the installed Cinder package's
// `components.json`.
const emittedJsFiles = await Array.fromAsync(
  new Bun.Glob('**/*.js').scan({ cwd: stagingDirectory, absolute: true }),
);
const emittedFileContents = await Promise.all(emittedJsFiles.map((file) => Bun.file(file).text()));
const boundaryHeld = emittedFileContents.some((contents) =>
  contents.includes('@lostgradient/cinder/knowledge'),
);
if (!boundaryHeld) {
  process.stderr.write(
    "Build aborted: no emitted module imports '@lostgradient/cinder/knowledge' — " +
      'Cinder may have been bundled in instead of left external.\n',
  );
  process.exit(1);
}

const expectedOutputs = [
  `${stagingDirectory}/index.js`,
  `${stagingDirectory}/index.d.ts`,
  `${stagingDirectory}/bin.js`,
];

for (const outputPath of expectedOutputs) {
  if (!(await Bun.file(outputPath).exists())) {
    process.stderr.write(`Missing build output: ${outputPath}\n`);
    process.exit(1);
  }
}

// `bin.js` must keep its Node shebang and be executable — `npx --no-install
// cinder-mcp` and a direct `./node_modules/.bin/cinder-mcp` invocation both
// depend on it.
const binOutput = `${stagingDirectory}/bin.js`;
const binOutputText = await Bun.file(binOutput).text();
if (!binOutputText.startsWith('#!/usr/bin/env node')) {
  await Bun.write(binOutput, `#!/usr/bin/env node\n${binOutputText}`);
}
await chmod(binOutput, 0o755);

const installedDist = atomicSwapDist(stagingDirectory, distributionDirectory);

if (installedDist && skipDecision.hash !== null) {
  await writeBuildInputHash(distributionDirectory, skipDecision.hash);
}

process.stdout.write('Build complete.\n');
