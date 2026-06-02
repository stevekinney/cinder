import { $, Glob } from 'bun';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emitDts } from 'svelte2tsx';

import { checkComponentCss, formatViolation } from './check-component-css.ts';
import { componentStylesSpecifier, cssImportPlugin } from './css-import-plugin.ts';
import { DEPRECATED_EXPERIMENTAL_ALIASES } from './generate-exports.ts';
import { lineHasCinderResidue, type CommentScanState } from './lib/cinder-specifier-residue.ts';
import { deriveUpstreamReexports } from './lib/derive-upstream-reexports.ts';
import { discoverComponents, type ComponentDiscovery } from './lib/discover-components.ts';
import { createServerEntrySource } from './server-entry.ts';
import { sveltePlugin } from './svelte-plugin.ts';

const repositoryRoot = process.cwd();
const workspaceRoot = `${repositoryRoot}/../..`;
const sourceRoot = `${repositoryRoot}/src`;
const distributionDirectory = `${repositoryRoot}/dist`;
const svelteShimsPath = Bun.resolveSync('svelte2tsx/svelte-shims-v4.d.ts', repositoryRoot);

async function createServerEntry(): Promise<string> {
  const sourcePath = `${sourceRoot}/index.ts`;
  const serverEntryPath = `${repositoryRoot}/node_modules/.cache/server-entry.ts`;
  const source = await Bun.file(sourcePath).text();

  await Bun.write(serverEntryPath, createServerEntrySource(source));

  return serverEntryPath;
}

/**
 * Build the absolute path to `src/components/[experimental/]<name>/index.ts`
 * for a discovered component, matching the on-disk layout that
 * `discoverComponents()` walks.
 */
function componentEntrypoint(component: ComponentDiscovery): string {
  return component.isExperimental
    ? `${sourceRoot}/components/experimental/${component.name}/index.ts`
    : `${sourceRoot}/components/${component.name}/index.ts`;
}

/**
 * Build the absolute path to a component's `<name>.schema.ts` /
 * `<name>.variables.ts` metadata source. These compile to standalone JS
 * entrypoints (`<name>.schema.js` / `<name>.variables.js`) so the
 * `cinder/<name>/schema` and `cinder/<name>/variables` subpaths are runtime
 * entry points (their `node`/`default` export conditions resolve to real files).
 * Every discovered component ships both, so callers list these unconditionally.
 */
function componentMetadataEntrypoints(component: ComponentDiscovery): string[] {
  const directory = component.isExperimental
    ? `${sourceRoot}/components/experimental/${component.name}`
    : `${sourceRoot}/components/${component.name}`;
  return [
    `${directory}/${component.name}.schema.ts`,
    `${directory}/${component.name}.variables.ts`,
  ];
}

/**
 * Per-component CSS sidecar location under `src/`. Not every component has a
 * sidecar — domain-suite components (`chat`, `markdown-editor`, etc.) inject
 * styles directly, and several smaller composition components have no styles
 * of their own. Callers should check `existsSync` before relying on this.
 */
function componentCssSource(component: ComponentDiscovery): string {
  return component.isExperimental
    ? `${sourceRoot}/components/experimental/${component.name}/${component.name}.css`
    : `${sourceRoot}/components/${component.name}/${component.name}.css`;
}

/**
 * Per-component CSS sidecar destination under `dist/`. Mirrors the source
 * layout so consumers can resolve `cinder/<name>/styles` and the eventual
 * Track 5 subpath export points at exactly one file.
 */
function componentCssDestination(component: ComponentDiscovery): string {
  return component.isExperimental
    ? `${distributionDirectory}/components/experimental/${component.name}/${component.name}.css`
    : `${distributionDirectory}/components/${component.name}/${component.name}.css`;
}

function componentDistributionDirectory(component: ComponentDiscovery): string {
  return component.isExperimental
    ? `${distributionDirectory}/components/experimental/${component.name}`
    : `${distributionDirectory}/components/${component.name}`;
}

// Fail fast if generated component artifacts have drifted from source.
// Run `bun run components:generate` to fix drift.
const componentsCheckResult = await $`bun run components:check`.nothrow();
if (componentsCheckResult.exitCode !== 0) {
  process.stderr.write(
    'Build aborted: component artifacts are out of sync. Run `bun run components:generate`.\n',
  );
  process.exit(1);
}

// Fail fast if package.json#exports has drifted from the component file system.
// Run `bun run exports:generate` to fix drift.
const checkResult = await $`bun run exports:check`.nothrow();
if (checkResult.exitCode !== 0) {
  process.stderr.write('Build aborted: exports are out of sync. Run `bun run exports:generate`.\n');
  process.exit(1);
}

await $`rm -rf dist`;

process.env['NODE_ENV'] = 'production';

const components = await discoverComponents();
const upstreamReexports = await deriveUpstreamReexports();

/**
 * Entrypoints for the bundled `@cinder/*` workspace re-exports. PR 1 bundles
 * the upstream sources into `cinder`'s `dist/` so the published package has
 * zero runtime dependency on the four private workspace packages.
 */
const upstreamReexportEntrypoints = upstreamReexports.map(
  (reexport) => `${sourceRoot}/${reexport.sourceRelativePath}`,
);

/**
 * Transitive third-party runtime dependencies inherited from the four
 * `@cinder/*` workspace packages. Bundling the upstream Svelte/TS source
 * into `cinder/dist` pulls these into esbuild's resolution graph; they must
 * stay external so they are installed from the npm registry at the consumer
 * site (declared in `cinder`'s own `dependencies`) rather than vendored into
 * the published bundle. Sourced from each upstream `package.json#dependencies`
 * minus `@cinder/*` workspace entries.
 */
const upstreamTransitiveExternals = [
  '@shikijs/rehype',
  '@milkdown/kit',
  '@milkdown/prose',
  '@milkdown/kit/*',
  '@milkdown/prose/*',
  'comlink',
  'diff-match-patch',
  'hast-util-sanitize',
  'js-yaml',
  'prosemirror-inputrules',
  'prosemirror-model',
  'prosemirror-state',
  'prosemirror-view',
  'rehype-katex',
  'rehype-sanitize',
  'rehype-stringify',
  'remark-gfm',
  'remark-html',
  'remark-math',
  'remark-parse',
  'remark-rehype',
  'remark-stringify',
  'shiki',
  'unified',
  'unist-util-remove',
  'unist-util-visit',
];

// Pre-emit sidecar lint: every component CSS that exists must conform to the
// "scoped + custom properties only" contract before any output lands in
// `dist/`. Layer assignment and global rules belong on the import side via
// `cinder/styles`, not in the per-component sidecar.
const cssLintViolations = [];
for (const component of components) {
  const cssPath = componentCssSource(component);
  if (!existsSync(cssPath)) continue;
  cssLintViolations.push(...(await checkComponentCss(cssPath)));
}
if (cssLintViolations.length > 0) {
  process.stderr.write('Build aborted: component CSS sidecar violations:\n');
  for (const violation of cssLintViolations) {
    process.stderr.write(`  ${formatViolation(violation)}\n`);
  }
  process.exit(1);
}

// Pre-emit source-index CSS-import gate: every component with a CSS sidecar must
// import it from its SOURCE `index.ts`. The browser BUILD injects the styles
// import into dist, but the `svelte` export condition resolves the raw source
// `index.ts` (SvelteKit/Vite resolve it first), so a source entry that omits the
// import would silently render unstyled for SvelteKit consumers. Enforce it here
// rather than only in dist, since the source path bypasses the build plugin.
const sourceCssImportViolations: string[] = [];
for (const component of components) {
  const cssPath = componentCssSource(component);
  if (!existsSync(cssPath)) continue;
  const indexSource = await Bun.file(componentEntrypoint(component)).text();
  if (!indexSource.includes(`./${component.name}.css`)) {
    sourceCssImportViolations.push(componentEntrypoint(component));
  }
}
if (sourceCssImportViolations.length > 0) {
  process.stderr.write(
    "Build aborted: source index.ts entries missing their `import './<name>.css';`\n" +
      '(the `svelte` export condition resolves source, so it must auto-import its sidecar).\n' +
      'Run `bun run styles:source-css`:\n',
  );
  for (const path of sourceCssImportViolations) {
    process.stderr.write(`  ${path}\n`);
  }
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 1. Existing single-file server bundle. PRESERVED untouched in this PR —
//    removal is a follow-up after Track 3 + Track 5 prove the per-component
//    SSR path works in consumer fixtures.
// -----------------------------------------------------------------------------

const serverEntryPath = await createServerEntry();

const serverBuildResult = await Bun.build({
  entrypoints: [serverEntryPath],
  outdir: `${distributionDirectory}/server`,
  target: 'node',
  format: 'esm',
  naming: {
    entry: 'index.[ext]',
    chunk: '[name]-[hash].[ext]',
    asset: '[name]-[hash].[ext]',
  },
  sourcemap: 'external',
  minify: false,
  external: ['svelte', 'cinder', 'cinder/*', ...upstreamTransitiveExternals],
  plugins: [sveltePlugin({ generate: 'server' })],
});

if (!serverBuildResult.success) {
  const messages = ['Server build failed:', ...serverBuildResult.logs.map(String)].join('\n');
  process.stderr.write(`${messages}\n`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 2. Per-component browser ESM build (additive). Entrypoints: every component
//    `index.ts` plus the root barrel `src/index.ts`. Output shape is fixed by
//    `[dir]/[name].[ext]` naming relative to `root: src/`, which gives us:
//      dist/index.js
//      dist/components/<name>/index.js
//      dist/components/experimental/<name>/index.js
// -----------------------------------------------------------------------------

const perComponentEntrypoints = components.map((component) => componentEntrypoint(component));

// Per-component schema/variables metadata sources compile to their own JS so
// `cinder/<name>/schema` and `cinder/<name>/variables` are runtime entry points.
// Listed for both the browser and server builds so the `default` and `node`
// export conditions each resolve to a real file.
const perComponentMetadataEntrypoints = components.flatMap((component) =>
  componentMetadataEntrypoints(component),
);

/**
 * Static sub-paths cinder exposes outside the `components/` tree. Today this
 * is the first-party Shiki adapter at `cinder/highlighters/shiki` and the
 * dev-only base-loaded guard at `cinder/styles/guard`; new non-component
 * static sub-paths get listed here so the build emits a predictable
 * `dist/<rel>.js` for each one. `shiki` itself stays external (declared in
 * cinder's `dependencies` + the `upstreamTransitiveExternals` list) — the
 * adapter dynamic-imports it lazily so consumers who never use
 * `cinder/highlighters/shiki` ship zero Shiki bytes in their entry chunk.
 */
const staticSubpathEntrypoints = [
  `${sourceRoot}/highlighters/shiki/index.ts`,
  `${sourceRoot}/styles/base-guard.ts`,
];

/**
 * Deprecated `cinder/experimental/<name>` alias shims. Each promoted-out
 * component keeps a thin re-export shim at
 * `src/components/experimental/<name>/index.ts` so the old import path keeps
 * resolving (with a dev warning) during the deprecation window. They are not
 * discovered components (no `.svelte`/`.types.ts`), so the build must list
 * their entrypoints explicitly to emit `dist/components/experimental/<name>/index.js`.
 */
const deprecatedAliasEntrypoints = DEPRECATED_EXPERIMENTAL_ALIASES.map(
  ({ name }) => `${sourceRoot}/components/experimental/${name}/index.ts`,
);

const browserEntrypoints = [
  `${sourceRoot}/index.ts`,
  ...perComponentEntrypoints,
  ...perComponentMetadataEntrypoints,
  ...staticSubpathEntrypoints,
  ...deprecatedAliasEntrypoints,
];

// Components whose directory ships a CSS sidecar. The BROWSER build's
// `cssImportPlugin` prepends `import 'cinder/<name>/styles'` so
// `import Button from 'cinder/button'` (subpath) and `import { Button }
// from 'cinder'` (root barrel) auto-pull the component's CSS instead of
// rendering silently unstyled. The set is gated on sidecar presence so it
// lines up 1:1 with the `./<name>/styles` export subpaths (both derive from
// `existsSync(<name>.css)`); sidecar-less components and the deprecated alias
// shims (which carry no sidecar of their own and re-export the promoted
// component, whose entry injects its own styles in this same pass) are never
// handed a dead `/styles` specifier. The SERVER build deliberately omits this
// plugin: a CSS import under the `node` condition throws
// `ERR_UNKNOWN_FILE_EXTENSION` in plain Node SSR.
const componentsWithSidecar = components.filter((component) =>
  existsSync(componentCssSource(component)),
);
// SUBPATH injection target: map each component's own `index.ts` to the exact
// `cinder/<name>/styles` (or experimental) specifier its sidecar resolves to.
const perComponentStyleSpecifiers = new Map(
  componentsWithSidecar.map((component) => [
    componentEntrypoint(component),
    componentStylesSpecifier(component.name, component.isExperimental),
  ]),
);
// ROOT BARREL injection target: every used component's styles import is added
// directly to `src/index.ts`. The transitive imports the re-exports would pull
// in are tree-shaken away by `sideEffects: ["**/*.css"]` (which marks JS
// side-effect-free); a side-effect import in the entry file itself survives.
// The root barrel is the documented non-tree-shaken "everything" path, so
// loading every used component's CSS there matches its semantics.
const rootBarrelStyleSpecifiers = componentsWithSidecar.map((component) =>
  componentStylesSpecifier(component.name, component.isExperimental),
);

// `upstreamReexportEntrypoints` is intentionally NOT fed to Bun.build:
// the upstream packages have already produced fully-baked `dist/` trees
// (workers, source maps, declarations) through their own builds. Re-bundling
// them here drops Vite-specific patterns like
// `new Worker(new URL('./worker.js', import.meta.url))` because esbuild
// treats `import.meta.url` as opaque. Instead, step 5c below copies each
// upstream's `dist/**` verbatim into `packages/components/dist/<pkg>/` and
// rewrites cross-package `@cinder/*` specifiers to relative paths.
void upstreamReexportEntrypoints;

// `splitting: false` is a deliberate trade-off mandated by the Track 4 plan:
// it gives each entrypoint a predictable, single-file output so the eventual
// `default` condition in `package.json#exports` points at exactly one JS file
// per subpath. The cost is that shared internal modules (utilities, runes,
// helpers) get duplicated across component bundles. Module-identity-sensitive
// patterns (cross-component Svelte context keys, shared stores, exported
// singletons) MUST live in the root barrel and be imported from there by
// consumers — never re-imported from two different `cinder/<name>` subpaths.
// Track 5's à la carte fixture will assert this contract once it lands.
const browserBuildResult = await Bun.build({
  entrypoints: browserEntrypoints,
  outdir: distributionDirectory,
  root: sourceRoot,
  target: 'browser',
  format: 'esm',
  splitting: false,
  external: ['svelte', 'svelte/*', 'cinder', 'cinder/*', ...upstreamTransitiveExternals],
  naming: {
    entry: '[dir]/[name].[ext]',
    chunk: '[name]-[hash].[ext]',
    asset: '[name]-[hash].[ext]',
  },
  sourcemap: 'external',
  minify: false,
  plugins: [
    cssImportPlugin({
      perComponentStyleSpecifiers,
      rootBarrelEntrypoint: `${sourceRoot}/index.ts`,
      rootBarrelStyleSpecifiers,
    }),
    sveltePlugin({ generate: 'client' }),
  ],
});

if (!browserBuildResult.success) {
  const messages = [
    'Per-component browser build failed:',
    ...browserBuildResult.logs.map(String),
  ].join('\n');
  process.stderr.write(`${messages}\n`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 3. Per-component SSR ESM build (additive, lives alongside the existing
//    single-file server bundle). Outputs to dist/server/components/<name>/.
// -----------------------------------------------------------------------------

const perComponentServerBuildResult = await Bun.build({
  entrypoints: [
    ...perComponentEntrypoints,
    ...perComponentMetadataEntrypoints,
    ...staticSubpathEntrypoints,
    ...deprecatedAliasEntrypoints,
  ],
  outdir: `${distributionDirectory}/server`,
  root: sourceRoot,
  target: 'node',
  format: 'esm',
  splitting: false,
  external: ['svelte', 'svelte/*', 'cinder', 'cinder/*', ...upstreamTransitiveExternals],
  naming: {
    entry: '[dir]/[name].[ext]',
    chunk: '[name]-[hash].[ext]',
    asset: '[name]-[hash].[ext]',
  },
  sourcemap: 'external',
  minify: false,
  plugins: [sveltePlugin({ generate: 'server' })],
});

if (!perComponentServerBuildResult.success) {
  const messages = [
    'Per-component SSR build failed:',
    ...perComponentServerBuildResult.logs.map(String),
  ].join('\n');
  process.stderr.write(`${messages}\n`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 4. Copy per-component CSS sidecars verbatim. The browser entry's injected
//    `import 'cinder/<name>/styles'` resolves through the package `exports`
//    map to these copied files, so they must land in `dist/` for the
//    auto-import to have a target. Driven by `discoverComponents()`.
// -----------------------------------------------------------------------------

const copiedSidecars: string[] = [];
for (const component of components) {
  const source = componentCssSource(component);
  if (!existsSync(source)) continue;
  const destination = componentCssDestination(component);
  await mkdir(dirname(destination), { recursive: true });
  // The sidecar is copied verbatim. Its `@layer cinder.components { … }` wrapper
  // — required so a direct `cinder/<name>/styles` import keeps its rules inside
  // the cascade layer rather than outside every layer — was already enforced on
  // the source by the AST gate above (`cssLintViolations`), so the copy carries
  // it intact. No dist-side re-check is needed.
  const text = await Bun.file(source).text();
  await Bun.write(destination, text);
  copiedSidecars.push(destination);
}

// -----------------------------------------------------------------------------
// 5. Type declarations (unchanged from prior behavior).
// -----------------------------------------------------------------------------

await emitDts({
  declarationDir: distributionDirectory,
  svelteShimsPath,
  libRoot: sourceRoot,
  tsconfig: `${repositoryRoot}/tsconfig.build.json`,
});

// -----------------------------------------------------------------------------
// 5b. Vendor upstream `@cinder/*` build output verbatim into cinder's dist.
//
//     The four upstream workspace packages emit their own `dist/` trees via
//     their per-package build. Those trees include patterns esbuild can't
//     safely re-bundle — notably
//     `new Worker(new URL('./render-worker.js', import.meta.url))` and the
//     companion worker source file. Re-bundling drops the worker entirely
//     and breaks consumers under Vite + the Svelte plugin.
//
//     Instead, we:
//       1. Build each upstream first so its `dist/` is fresh.
//       2. Copy each upstream's entire `dist/**` into
//          `packages/components/dist/<pkg>/` (browser) and
//          `packages/components/dist/server/<pkg>/` (server), mirroring the
//          upstream's internal layout. Workers, assets, and source maps come
//          along untouched.
//       3. Rewrite every `@cinder/<pkg>[/subpath]` import specifier in the
//          copied JS/`.d.ts` to a relative path within the vendored tree, so
//          `dist/markdown/diff/line-diff.js` referencing `@cinder/diff/line-diff`
//          becomes `../../diff/line-diff` (no unresolvable `@cinder/*` after
//          install).
//
//     The cinder exports map points `./<pkg>[/subpath]` directly at the
//     vendored files via `cinderExportEntry` in
//     `scripts/lib/derive-upstream-reexports.ts`.
// -----------------------------------------------------------------------------

const upstreamPackageNames = ['markdown', 'editor', 'commentary', 'diff'] as const;

// Build each upstream package so its `dist/` is fresh. The four packages
// are independent (no upstream depends on another), so the builds run in
// parallel — this cuts ~30s off every `bun run build` on warm caches.
await Promise.all(
  upstreamPackageNames.map(async (upstreamName) => {
    const upstreamRoot = `${workspaceRoot}/packages/${upstreamName}`;
    const buildResult = await $`bun run --cwd ${upstreamRoot} build`.nothrow();
    if (buildResult.exitCode !== 0) {
      process.stderr.write(
        `Build aborted: upstream @cinder/${upstreamName} build failed (exit ${buildResult.exitCode}).\n` +
          `${buildResult.stderr.toString()}\n`,
      );
      process.exit(1);
    }
  }),
);

/**
 * Rewrite every `@cinder/<pkg>[/subpath]` import specifier in a file's
 * content to a relative path pointing at the sibling vendored upstream tree.
 *
 * Called for each file under `dist/<pkg>/**` after a verbatim copy. The
 * relative target depends on how deep the file lives under
 * `dist/<originPkg>/`.
 */
/** Sites where the rewrite couldn't resolve the target file. */
type RewriteMiss = {
  file: string;
  specifier: string;
};

function rewriteCrossUpstreamSpecifiers(
  content: string,
  fileDistRelative: string,
  misses: RewriteMiss[],
): string {
  // `fileDistRelative` is e.g. `markdown/diff/line-diff.js`. `dirname` gives
  // `markdown/diff`; the relative walk back to `dist/` is `../..`.
  const fileDirectory = dirname(fileDistRelative);
  const upwards =
    fileDirectory === '.'
      ? '.'
      : fileDirectory
          .split('/')
          .map(() => '..')
          .join('/');
  // Node ESM under `module: nodenext` rejects extensionless relative
  // imports, so we materialize the target file path explicitly:
  //   - `@cinder/markdown`           → `<up>/markdown/index.js`
  //   - `@cinder/markdown/pipeline`  → `<up>/markdown/pipeline.js` if there
  //     is a `pipeline.js` file at that path, otherwise `<up>/markdown/pipeline/index.js`.
  //   - `@cinder/markdown/diff/line-diff` → `<up>/markdown/diff/line-diff.js`.
  // The disambiguation depends on whether the target subpath is a directory
  // entry or a leaf file; we resolve that lazily by checking the vendored
  // dist for an `<subpath>/index.js`. If neither candidate exists the
  // rewrite cannot produce a valid Node ESM specifier — the caller fails
  // the build via the `misses` array instead of silently emitting an
  // extensionless path that would yield a broken module (and pass the
  // `@cinder/` residue gate because the prefix is gone).
  return content.replace(
    /(['"])@cinder\/(markdown|editor|commentary|diff)(\/[^'"]*)?\1/g,
    (_match, quote: string, pkg: string, rest: string | undefined) => {
      const subpath = rest ?? '';
      if (subpath === '') {
        return `${quote}${upwards}/${pkg}/index.js${quote}`;
      }
      // Check whether the subpath resolves to a directory entry by looking
      // at the vendored upstream dist on disk. If `dist/<pkg><subpath>/index.js`
      // exists, the import target is the index file; otherwise it's a leaf
      // `dist/<pkg><subpath>.js`.
      const directoryCandidate = `${distributionDirectory}/${pkg}${subpath}/index.js`;
      const leafCandidate = `${distributionDirectory}/${pkg}${subpath}.js`;
      if (existsSync(directoryCandidate)) {
        return `${quote}${upwards}/${pkg}${subpath}/index.js${quote}`;
      }
      if (existsSync(leafCandidate)) {
        return `${quote}${upwards}/${pkg}${subpath}.js${quote}`;
      }
      // Record the miss; the caller will abort the build after the pass.
      // We return the original specifier shape so the post-pass residue
      // gate also sees it (defense in depth — if for some reason the
      // miss collection isn't checked, the `@cinder/` token remains and
      // the residue gate trips).
      misses.push({ file: fileDistRelative, specifier: `@cinder/${pkg}${subpath}` });
      return `${quote}@cinder/${pkg}${subpath}${quote}`;
    },
  );
}

async function copyUpstreamDistInto(upstreamName: string, destinationRoot: string): Promise<void> {
  const sourceDist = `${workspaceRoot}/packages/${upstreamName}/dist`;
  const destinationDist = `${destinationRoot}/${upstreamName}`;
  if (!existsSync(sourceDist)) {
    process.stderr.write(
      `Build aborted: expected upstream dist ${sourceDist} to exist after upstream build.\n`,
    );
    process.exit(1);
  }
  const glob = new Glob('**/*');
  for await (const relative of glob.scan({ cwd: sourceDist })) {
    const sourcePath = `${sourceDist}/${relative}`;
    const destinationPath = `${destinationDist}/${relative}`;
    await mkdir(dirname(destinationPath), { recursive: true });
    const bytes = await Bun.file(sourcePath).bytes();
    await Bun.write(destinationPath, bytes);
  }
}

// First pass: copy every upstream dist verbatim into both `dist/<pkg>/` and
// `dist/server/<pkg>/`. Specifier rewrites happen in the second pass so
// `rewriteCrossUpstreamSpecifiers` can probe sibling vendored trees on
// disk to disambiguate directory-style vs leaf-style imports. Each copy
// writes to a disjoint destination directory, so they run in parallel.
await Promise.all(
  upstreamPackageNames.flatMap((upstreamName) => [
    copyUpstreamDistInto(upstreamName, distributionDirectory),
    copyUpstreamDistInto(upstreamName, `${distributionDirectory}/server`),
  ]),
);

// Second pass: rewrite `@cinder/*` import specifiers across every text
// artifact. Files under `dist/server/**` are walked with `dist/server/` as
// their root so the relative `../..` hops point at sibling server files,
// not back into the browser tree. Files outside `dist/server/**` are walked
// with `dist/` as root.
async function rewriteSpecifiersUnder(
  root: string,
  options: { skipPrefix?: string } = {},
): Promise<RewriteMiss[]> {
  const misses: RewriteMiss[] = [];
  // Only JS and `.d.ts` artifacts carry import specifiers the rewrite needs
  // to touch. `*.map` files are vendored upstream source maps (including
  // any `sourcesContent`) — rewriting them mutates debugging metadata that
  // should stay verbatim, and the post-build residue gate only scans
  // JS/`.d.ts` anyway. Keep maps out of the rewrite pass.
  const textGlob = new Glob('**/*.{js,mjs,cjs,d.ts,d.mts,d.cts}');
  for await (const relative of textGlob.scan({ cwd: root })) {
    if (options.skipPrefix !== undefined && relative.startsWith(options.skipPrefix)) continue;
    const filePath = `${root}/${relative}`;
    const original = await Bun.file(filePath).text();
    if (!original.includes('@cinder/')) continue;
    const rewritten = rewriteCrossUpstreamSpecifiers(original, relative, misses);
    if (rewritten !== original) {
      await Bun.write(filePath, rewritten);
    }
  }
  return misses;
}

const rewriteMisses: RewriteMiss[] = [
  ...(await rewriteSpecifiersUnder(`${distributionDirectory}/server`)),
  ...(await rewriteSpecifiersUnder(distributionDirectory, { skipPrefix: 'server/' })),
];

if (rewriteMisses.length > 0) {
  process.stderr.write(
    'Build aborted: rewriteCrossUpstreamSpecifiers could not resolve target files for the\n' +
      'following specifiers — neither a directory `index.js` nor a leaf `.js` exists in the\n' +
      'vendored upstream tree. An extensionless relative path here would yield a module\n' +
      'Node ESM rejects under `module: nodenext`. Check that the upstream `dist/` actually\n' +
      'emits the file these specifiers reference; if it does, the verbatim-copy step in\n' +
      'build.ts likely missed it (a new file extension or directory layout the copy glob\n' +
      "doesn't match):\n" +
      rewriteMisses.map((m) => `  ${m.file}  →  ${m.specifier}`).join('\n') +
      '\n',
  );
  process.exit(1);
}

// Fast residue guard: after the rewrite pass, scan every emitted JS/`.d.ts`
// file for surviving quoted `@cinder/*` import specifiers. `validate-consumers`
// runs the same check against the published tarball, but that flow takes
// minutes; this one catches the same class of bug at the end of `bun run
// build` (~ms) so a missed rewrite surfaces immediately instead of waiting
// for the slow consumer-validation pass.
{
  // Comment-stripping + pattern logic lives in
  // `lib/cinder-specifier-residue.ts` so this gate and the slower tarball
  // gate in `validate-consumers.ts` share one implementation — previously
  // each maintained its own line-skip ladder, and a single-line
  // `/* x */ import from '@cinder/...'` could bypass both.
  const residueGlob = new Glob('**/*.{js,mjs,cjs,d.ts,d.mts,d.cts}');
  const residueOffenders: string[] = [];
  for await (const relative of residueGlob.scan({ cwd: distributionDirectory })) {
    const filePath = `${distributionDirectory}/${relative}`;
    const content = await Bun.file(filePath).text();
    if (!content.includes('@cinder/')) continue;
    const scanState: CommentScanState = { inBlockComment: false };
    let hit = false;
    for (const rawLine of content.split('\n')) {
      if (lineHasCinderResidue(rawLine, scanState)) {
        hit = true;
        break;
      }
    }
    if (hit) residueOffenders.push(relative);
  }
  if (residueOffenders.length > 0) {
    process.stderr.write(
      'Build aborted: unresolved @cinder/* specifiers remain after rewrite:\n' +
        residueOffenders.map((file) => `  ${file}`).join('\n') +
        '\n' +
        'If the offender is a computed `import(`@cinder/${...}`)`, the rewrite\n' +
        'pass cannot safely transform it — change the upstream source to use a\n' +
        'static specifier instead.\n',
    );
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// 6. Hard acceptance checks. Verify the output shape matches the contract
//    rather than trust the build's success flag. Fails loudly so a future
//    `Bun.build()` change that quietly drops outputs surfaces immediately.
// -----------------------------------------------------------------------------

const expectedPaths: string[] = [
  `${distributionDirectory}/index.js`,
  `${distributionDirectory}/index.d.ts`,
  `${distributionDirectory}/server/index.js`,
  `${distributionDirectory}/components/button/button.svelte.d.ts`,
  // Static sub-paths emitted alongside the components tree.
  `${distributionDirectory}/highlighters/shiki/index.js`,
  `${distributionDirectory}/highlighters/shiki/index.d.ts`,
  `${distributionDirectory}/server/highlighters/shiki/index.js`,
  // Dev-only base-loaded guard — browser + server builds, plus types.
  `${distributionDirectory}/styles/base-guard.js`,
  `${distributionDirectory}/styles/base-guard.d.ts`,
  `${distributionDirectory}/server/styles/base-guard.js`,
];

for (const component of components) {
  const directory = componentDistributionDirectory(component);
  expectedPaths.push(`${directory}/index.js`);
  // The per-component declaration entrypoint is what `package.json#exports`
  // resolves for the `types` condition once Track 3 lands. Check it lands
  // alongside the JS so consumers cannot end up with untyped per-component
  // subpaths.
  expectedPaths.push(`${directory}/index.d.ts`);
  expectedPaths.push(
    component.isExperimental
      ? `${distributionDirectory}/server/components/experimental/${component.name}/index.js`
      : `${distributionDirectory}/server/components/${component.name}/index.js`,
  );
  // Schema/variables metadata JS — both builds. These back the `node`/`default`
  // export conditions for `cinder/<name>/schema` and `cinder/<name>/variables`.
  const serverDirectory = component.isExperimental
    ? `${distributionDirectory}/server/components/experimental/${component.name}`
    : `${distributionDirectory}/server/components/${component.name}`;
  for (const metadataKind of ['schema', 'variables'] as const) {
    expectedPaths.push(`${directory}/${component.name}.${metadataKind}.js`);
    expectedPaths.push(`${directory}/${component.name}.${metadataKind}.d.ts`);
    expectedPaths.push(`${serverDirectory}/${component.name}.${metadataKind}.js`);
  }
  if (existsSync(componentCssSource(component))) {
    expectedPaths.push(componentCssDestination(component));
  }
}

// Post-build resolution gate for the bundled `@cinder/*` re-exports. Each
// sub-path in `package.json#exports` for the four upstream packages must
// resolve to a real file in `dist/` (and a matching `.d.ts` for the `types`
// condition) so consumers cannot import a dead sub-path.
for (const reexport of upstreamReexports) {
  expectedPaths.push(`${distributionDirectory}/${reexport.distRelativePath}`);
  expectedPaths.push(
    `${distributionDirectory}/${reexport.distRelativePath.replace(/\.js$/, '.d.ts')}`,
  );
  expectedPaths.push(`${distributionDirectory}/server/${reexport.distRelativePath}`);
}

// Deprecated `cinder/experimental/<name>` alias shims must emit a browser
// bundle, a server bundle, and a declaration file — the `./experimental/<name>`
// export conditions resolve to all three.
for (const { name } of DEPRECATED_EXPERIMENTAL_ALIASES) {
  expectedPaths.push(`${distributionDirectory}/components/experimental/${name}/index.js`);
  expectedPaths.push(`${distributionDirectory}/components/experimental/${name}/index.d.ts`);
  expectedPaths.push(`${distributionDirectory}/server/components/experimental/${name}/index.js`);
}

const missingPaths = expectedPaths.filter((path) => !existsSync(path));
if (missingPaths.length > 0) {
  process.stderr.write('Build aborted: expected output paths missing:\n');
  for (const path of missingPaths) process.stderr.write(`  - ${path}\n`);
  process.exit(1);
}

// CSS-import split contract. The auto-import footgun fix flips the old "no CSS
// in component JS" rule into an asymmetric pair:
//
//   - The BROWSER entry (`dist/components/<name>/index.js`) MUST carry the
//     injected `import 'cinder/<name>/styles'` so `import Button from
//     'cinder/button'` and `import { Button } from 'cinder'` auto-pull styles.
//   - The SERVER entry (`dist/server/components/<name>/index.js`) MUST stay
//     completely CSS-free. A bare CSS import (`*.css`) OR a `cinder/<name>/styles`
//     specifier resolves under the `node` export condition to a `.css` file,
//     which plain Node SSR rejects with `ERR_UNKNOWN_FILE_EXTENSION`. Keeping
//     the server tree CSS-free is the entire reason the injection is
//     browser-build-only.
//
// Both halves are enforced for EVERY component (including experimental) — a
// missing browser import reintroduces the silent-unstyled footgun, and a stray
// server import breaks Node SSR. Spot-checking a handful leaves a backdoor.
//
// `cssFileImportPattern` matches every `*.css` import form a bundler can emit
// (bare side-effect, named, namespace, dynamic). `styles` is a side-effect
// subpath import, so only the bare-specifier form can appear.
const cssFileImportPattern =
  /(?:\bimport\s*(?:[\w*${},\s]+\s+from\s*)?['"][^'"]*\.css['"]|\bimport\s*\(\s*['"][^'"]*\.css['"])/i;
function importsComponentStyles(text: string, component: ComponentDiscovery): boolean {
  const specifier = componentStylesSpecifier(component.name, component.isExperimental);
  return (
    text.includes(`'${specifier}'`) ||
    text.includes(`"${specifier}"`) ||
    cssFileImportPattern.test(text)
  );
}
for (const component of components) {
  const browserFile = `${componentDistributionDirectory(component)}/index.js`;
  const serverFile = component.isExperimental
    ? `${distributionDirectory}/server/components/experimental/${component.name}/index.js`
    : `${distributionDirectory}/server/components/${component.name}/index.js`;

  // Server entry must NEVER import CSS, sidecar or `/styles` subpath.
  if (existsSync(serverFile)) {
    const serverText = await Bun.file(serverFile).text();
    if (importsComponentStyles(serverText, component)) {
      process.stderr.write(
        `Build aborted: ${serverFile} imports CSS. Server (\`node\`) entries must stay CSS-free — a CSS import under the \`node\` condition throws ERR_UNKNOWN_FILE_EXTENSION in plain Node SSR. The CSS auto-import must land ONLY in the browser entry.\n`,
      );
      process.exit(1);
    }
  }

  // Browser entry must import its styles when the component ships a sidecar.
  if (!existsSync(browserFile)) continue;
  const browserText = await Bun.file(browserFile).text();
  const hasSidecar = existsSync(componentCssSource(component));
  if (hasSidecar && !importsComponentStyles(browserText, component)) {
    process.stderr.write(
      `Build aborted: ${browserFile} is missing its \`import '${componentStylesSpecifier(
        component.name,
        component.isExperimental,
      )}'\` side-effect. The browser entry MUST auto-pull its CSS so consumers do not render silently unstyled.\n`,
    );
    process.exit(1);
  }
  // A sidecar-less component must not import any CSS at all.
  if (!hasSidecar && cssFileImportPattern.test(browserText)) {
    process.stderr.write(
      `Build aborted: ${browserFile} imports a CSS file but ships no sidecar. Only components with a \`<name>.css\` sidecar may auto-import styles.\n`,
    );
    process.exit(1);
  }
}

process.stdout.write(
  `Build complete. ${components.length} components, ${copiedSidecars.length} CSS sidecars copied.\n`,
);
