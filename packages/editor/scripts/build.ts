import type { BunPlugin } from 'bun';
import { Glob } from 'bun';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { shortHash, shouldSkipBuild, writeBuildInputHash } from './lib/build-cache.ts';
import { parsePackageManifest, runtimeExternalSpecifiers } from './pack-for-publish.ts';

const PACKAGE_ROOT = join(import.meta.dir, '..');
const WORKSPACE_ROOT = `${PACKAGE_ROOT}/../..`;
const DISTRIBUTION_DIRECTORY = join(PACKAGE_ROOT, 'dist');

// `shouldSkipBuild` computes this package's input hash from source, config,
// and workspace-level inputs (bun.lock, the base tsconfig). This package's
// build does not stage into a scratch dir and atomically swap it in (unlike
// markdown's — `svelte-package` writes directly into `dist/`, and
// restructuring that CLI-driven build to stage first is a separate concern),
// so this hash-skip guard only covers the cheap "nothing changed, skip
// entirely" case, not a mid-build crash leaving a partial `dist/`.
//
// `upstreamDistDirectories` intentionally omits `@lostgradient/cinder` and
// `@lostgradient/markdown`: this package peer-depends on cinder (a genuine
// circular dependency — cinder dev-depends on editor too, see
// `packages/components/scripts/build.ts`'s own `upstreamPackageNames`
// comment) and shelling out to build cinder as an upstream step here would
// recurse into cinder's build, which shells back out to build editor.
const buildCacheInputs = {
  packageRoot: PACKAGE_ROOT,
  sourceGlobRoots: [`${PACKAGE_ROOT}/src`, `${PACKAGE_ROOT}/scripts`],
  extraFiles: [
    `${PACKAGE_ROOT}/package.json`,
    `${PACKAGE_ROOT}/tsconfig.json`,
    `${WORKSPACE_ROOT}/bun.lock`,
    `${WORKSPACE_ROOT}/tsconfig.base.json`,
    // Shared compiler plugin this build imports from cinder's scripts
    // directory (outside `sourceGlobRoots` above) — a change to it (e.g. a
    // server-identity or scoped-CSS filename fix) must invalidate this
    // package's hash too, or a stale dist survives an "up to date" skip.
    `${WORKSPACE_ROOT}/packages/components/scripts/svelte-plugin.ts`,
  ],
  upstreamDistDirectories: [],
};

const skipDecision = await shouldSkipBuild(buildCacheInputs);
if (skipDecision.skip) {
  process.stdout.write(`[build] up to date (hash ${shortHash(skipDecision.hash)}), skipping\n`);
  process.exit(0);
}

const result = Bun.spawnSync(['svelte-package'], {
  cwd: PACKAGE_ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);

const emittedSourceGlob = new Glob('dist/**/*.{js,ts,svelte}');
let rewrittenFiles = 0;
for await (const relativePath of emittedSourceGlob.scan({ cwd: PACKAGE_ROOT })) {
  const path = join(PACKAGE_ROOT, relativePath);
  const source = await Bun.file(path).text();
  const publishedSource = source.replace(/(['"])(\.\.?\/[^'"]+)\.ts\1/g, '$1$2.js$1');
  if (publishedSource === source) continue;
  await Bun.write(path, publishedSource);
  rewrittenFiles += 1;
}

process.stdout.write(
  `build — rewrote TypeScript import specifiers in ${rewrittenFiles} emitted files\n`,
);

// Only `review-editor` has a standalone top-level CSS file (imported once by
// `review-editor.svelte`, matching Chat's per-component convention).
// `markdown-editor` and `diff-viewer` style entirely through per-file scoped
// `<style>` blocks compiled inline by Svelte — there is no separate CSS
// asset to stub a declaration for, and no `./markdown-editor/styles` or
// `./diff-viewer/styles` export in `package.json` (matching the shape they
// had as cinder components before this move).
for (const cssPath of ['dist/components/review-editor/review-editor.css']) {
  await Bun.write(join(PACKAGE_ROOT, `${cssPath}.d.ts`), 'export {};\n');
}

const sourceRoot = join(PACKAGE_ROOT, 'src', 'lib');
const serverOutputRoot = join(PACKAGE_ROOT, 'dist', 'server');
// The root export (`.`) is plain TypeScript — comments, sessions, export, and
// the ProseMirror/Milkdown runtime, no Svelte — so it needs no server-target
// Svelte compilation, only the three real components do.
const serverEntrypoints = [
  join(sourceRoot, 'index.ts'),
  join(sourceRoot, 'components', 'markdown-editor', 'index.ts'),
  join(sourceRoot, 'components', 'review-editor', 'index.ts'),
  join(sourceRoot, 'components', 'diff-viewer', 'index.ts'),
];
const serverCssNoopPlugin: BunPlugin = {
  name: 'editor-server-css-noop',
  setup(builder) {
    builder.onResolve({ filter: /\.css$/ }, ({ path }) => ({ path, namespace: 'css-noop' }));
    builder.onLoad({ filter: /.*/, namespace: 'css-noop' }, () => ({ contents: '', loader: 'js' }));
  },
};
const packageManifest = parsePackageManifest(
  await Bun.file(join(PACKAGE_ROOT, 'package.json')).text(),
);
const runtimeExternals = runtimeExternalSpecifiers(packageManifest);
async function buildServerEntries() {
  const previousNodeEnvironment = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';

  try {
    return await Bun.build({
      entrypoints: serverEntrypoints,
      outdir: serverOutputRoot,
      root: sourceRoot,
      target: 'node',
      format: 'esm',
      splitting: true,
      external: runtimeExternals,
      naming: {
        entry: '[dir]/[name].[ext]',
        chunk: '_chunks/[name]-[hash].[ext]',
        asset: '_assets/[name]-[hash].[ext]',
      },
      minify: false,
      plugins: [serverCssNoopPlugin, sveltePlugin({ generate: 'server' })],
    });
  } finally {
    if (previousNodeEnvironment === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = previousNodeEnvironment;
  }
}

const serverBuild = await buildServerEntries();
if (!serverBuild.success) {
  process.stderr.write(`Editor server build failed:\n${serverBuild.logs.map(String).join('\n')}\n`);
  process.exit(1);
}

for (const expectedPath of [
  join(serverOutputRoot, 'index.js'),
  join(serverOutputRoot, 'components', 'markdown-editor', 'index.js'),
  join(serverOutputRoot, 'components', 'review-editor', 'index.js'),
  join(serverOutputRoot, 'components', 'diff-viewer', 'index.js'),
]) {
  if (!existsSync(expectedPath)) throw new Error(`server build is missing ${expectedPath}`);
  const serverSource = await Bun.file(expectedPath).text();
  if (/from\s+['"][^'"]+\.(?:css|svelte)['"]/u.test(serverSource)) {
    throw new Error(`server build retained a CSS or Svelte import in ${expectedPath}`);
  }
}
process.stdout.write('build — emitted plain-Node server entries for 4 public exports\n');

// Written only now that both the svelte-package build and the server build
// have succeeded, so the marker never claims a failed or partial build is up
// to date. See the comment on `buildCacheInputs` above for why this stamps
// the hash directly (no staging/atomic-swap step here to make conditional).
if (skipDecision.hash !== null) {
  await writeBuildInputHash(DISTRIBUTION_DIRECTORY, skipDecision.hash);
}
