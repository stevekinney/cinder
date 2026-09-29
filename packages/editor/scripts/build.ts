import type { BunPlugin } from 'bun';
import { Glob } from 'bun';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  findExtensionlessDeclarationSpecifiers,
  findSelfReferentialTypeImports,
  findUnresolvedArbitraryExtensionImports,
} from '../../components/scripts/lib/dist-relative-imports.ts';
import { emitArbitraryExtensionDeclarations } from '../../components/scripts/lib/emit-arbitrary-extension-declarations.ts';
import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { shortHash, shouldSkipBuild, writeBuildInputHash } from './lib/build-cache.ts';
import {
  parsePackageManifest,
  runtimeExternalSpecifiers,
  serverEntrypointsFromManifest,
  styleDeclarationPathsFromManifest,
} from './pack-for-publish.ts';

const PACKAGE_ROOT = join(import.meta.dir, '..');
const WORKSPACE_ROOT = `${PACKAGE_ROOT}/../..`;
const DISTRIBUTION_DIRECTORY = join(PACKAGE_ROOT, 'dist');
const packageManifest = parsePackageManifest(
  await Bun.file(join(PACKAGE_ROOT, 'package.json')).text(),
);

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
    `${WORKSPACE_ROOT}/packages/components/scripts/lib/dist-relative-imports.ts`,
    `${WORKSPACE_ROOT}/packages/components/scripts/lib/emit-arbitrary-extension-declarations.ts`,
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

// Svelte Package copies CSS assets but does not emit their exported type stubs.
// Derive every sidecar from the manifest so newly mirrored styles stay packable.
for (const declarationPath of styleDeclarationPathsFromManifest(packageManifest)) {
  await Bun.write(join(PACKAGE_ROOT, declarationPath), 'export {};\n');
}

// Node16/bundler ESM resolution (what a real consumer's `"types"` condition uses, and what
// `attw` checks) ADDITIONALLY needs a `<base>.d.svelte.ts` / `<base>.d.css.ts` companion — using
// the extension-before-`.ts` naming above, not the extension-after-`.ts` naming the stub loop just
// wrote — for every `.svelte`/`.css` specifier a `.d.ts` file references, and every extensionless
// relative specifier (e.g. `review-editor`'s own barrel importing `./review-editor-exports`)
// rewritten to carry the extension that resolution mode requires — neither `svelte-package` nor
// the stub loop above adds an extension to a bare relative specifier at all (see
// `emit-arbitrary-extension-declarations.ts`'s module doc for the `tsc --traceResolution` proof).
const arbitraryExtensionResult = await emitArbitraryExtensionDeclarations(
  join(PACKAGE_ROOT, 'dist'),
);
process.stdout.write(
  `build — created ${arbitraryExtensionResult.createdDeclarations.length} arbitrary-extension declaration(s), rewrote ${arbitraryExtensionResult.rewrittenSpecifiers.length} extensionless specifier(s)\n`,
);

// Dist relative-import guard: fail the build if a `.d.ts` file still references a `.svelte`/`.css`
// specifier with no Node16-correct declaration companion, or a bare extensionless relative
// specifier — the two classes `attw` flags under Node16/bundler resolution. The step above should
// have already fixed every instance of both; this is the regression gate.
{
  const declarationGlob = new Glob('dist/**/*.d.ts');
  const unresolvedArbitraryExtensionImports: ReturnType<
    typeof findUnresolvedArbitraryExtensionImports
  > = [];
  const extensionlessDeclarationSpecifiers: ReturnType<
    typeof findExtensionlessDeclarationSpecifiers
  > = [];
  const selfReferentialTypeImports: ReturnType<typeof findSelfReferentialTypeImports> = [];
  for await (const relative of declarationGlob.scan({ cwd: PACKAGE_ROOT })) {
    const distRelative = relative.slice('dist/'.length);
    const content = await Bun.file(join(PACKAGE_ROOT, relative)).text();
    unresolvedArbitraryExtensionImports.push(
      ...findUnresolvedArbitraryExtensionImports(distRelative, content, (distRelativePath) =>
        existsSync(join(PACKAGE_ROOT, 'dist', distRelativePath)),
      ),
    );
    extensionlessDeclarationSpecifiers.push(
      ...findExtensionlessDeclarationSpecifiers(distRelative, content),
    );
    selfReferentialTypeImports.push(...findSelfReferentialTypeImports(distRelative, content));
  }
  if (
    unresolvedArbitraryExtensionImports.length > 0 ||
    extensionlessDeclarationSpecifiers.length > 0 ||
    selfReferentialTypeImports.length > 0
  ) {
    process.stderr.write(
      'Build aborted: relative import(s) in compiled output do not resolve under Node16:\n' +
        unresolvedArbitraryExtensionImports
          .map(
            (offender) =>
              `  ${offender.file} -> ${offender.specifier} (needs ${offender.requiredDeclarationPath})`,
          )
          .join('\n') +
        extensionlessDeclarationSpecifiers
          .map((offender) => `  ${offender.file} -> ${offender.specifier}`)
          .join('\n') +
        selfReferentialTypeImports
          .map((offender) => `  ${offender.file} -> import(".").${offender.typeName}`)
          .join('\n') +
        '\n',
    );
    process.exit(1);
  }
}

const sourceRoot = join(PACKAGE_ROOT, 'src', 'lib');
const serverOutputRoot = join(PACKAGE_ROOT, 'dist', 'server');
// The root barrel is plain TypeScript; each component Node export needs its own
// compiled server entry. Derive those entries from the manifest the mirror emits.
const componentServerEntrypoints = serverEntrypointsFromManifest(packageManifest);
const serverEntrypoints = [
  join(sourceRoot, 'index.ts'),
  ...componentServerEntrypoints.map(({ sourceRelativePath }) =>
    join(sourceRoot, sourceRelativePath),
  ),
];
const serverCssNoopPlugin: BunPlugin = {
  name: 'editor-server-css-noop',
  setup(builder) {
    builder.onResolve({ filter: /\.css$/ }, ({ path }) => ({ path, namespace: 'css-noop' }));
    builder.onLoad({ filter: /.*/, namespace: 'css-noop' }, () => ({ contents: '', loader: 'js' }));
  },
};
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
  ...componentServerEntrypoints.map(({ outputRelativePath }) =>
    join(serverOutputRoot, outputRelativePath),
  ),
]) {
  if (!existsSync(expectedPath)) throw new Error(`server build is missing ${expectedPath}`);
  const serverSource = await Bun.file(expectedPath).text();
  if (/from\s+['"][^'"]+\.(?:css|svelte)['"]/u.test(serverSource)) {
    throw new Error(`server build retained a CSS or Svelte import in ${expectedPath}`);
  }
}
process.stdout.write(
  `build — emitted plain-Node server entries for ${serverEntrypoints.length} public exports\n`,
);

// Written only now that both the svelte-package build and the server build
// have succeeded, so the marker never claims a failed or partial build is up
// to date. See the comment on `buildCacheInputs` above for why this stamps
// the hash directly (no staging/atomic-swap step here to make conditional).
if (skipDecision.hash !== null) {
  await writeBuildInputHash(DISTRIBUTION_DIRECTORY, skipDecision.hash);
}
