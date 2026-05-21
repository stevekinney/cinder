import { $, Glob } from 'bun';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emitDts } from 'svelte2tsx';

import { checkComponentCss, formatViolation } from './check-component-css.ts';
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
  external: ['svelte', ...upstreamTransitiveExternals],
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
const browserEntrypoints = [
  `${sourceRoot}/index.ts`,
  ...perComponentEntrypoints,
  ...upstreamReexportEntrypoints,
];

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
  external: ['svelte', 'svelte/*', ...upstreamTransitiveExternals],
  naming: {
    entry: '[dir]/[name].[ext]',
    chunk: '[name]-[hash].[ext]',
    asset: '[name]-[hash].[ext]',
  },
  sourcemap: 'external',
  minify: false,
  plugins: [sveltePlugin({ generate: 'client' })],
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
  entrypoints: [...perComponentEntrypoints, ...upstreamReexportEntrypoints],
  outdir: `${distributionDirectory}/server`,
  root: sourceRoot,
  target: 'node',
  format: 'esm',
  splitting: false,
  external: ['svelte', 'svelte/*', ...upstreamTransitiveExternals],
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
// 4. Copy per-component CSS sidecars verbatim. We do NOT have the JS import
//    `./<name>.css`, so the only way these reach `dist/` is an explicit copy
//    driven by `discoverComponents()`.
// -----------------------------------------------------------------------------

const copiedSidecars: string[] = [];
for (const component of components) {
  const source = componentCssSource(component);
  if (!existsSync(source)) continue;
  const destination = componentCssDestination(component);
  await mkdir(dirname(destination), { recursive: true });
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
// 5b. Vendor upstream `@cinder/*` declarations into `cinder/dist/_upstream/`
//     and rewrite the generated re-export `.d.ts` files so the published
//     tarball does not contain unresolvable `@cinder/*` type references.
//
//     The four upstream workspace packages emit their own `dist/**/*.d.ts`
//     via their per-package build. cinder's build:
//       1. Builds each upstream first so its `dist/` is populated.
//       2. Copies each upstream's declarations into
//          `dist/_upstream/<pkg>/**` mirroring the upstream layout.
//       3. Rewrites every `@cinder/<pkg>[/...]` specifier in cinder's own
//          `dist/**/*.d.ts` to a relative path into `dist/_upstream/<pkg>/`.
//       4. Rewrites cross-package `@cinder/*` specifiers inside the vendored
//          declarations to local relative paths so the `_upstream/` tree is
//          self-contained.
// -----------------------------------------------------------------------------

const upstreamPackageNames = ['markdown', 'editor', 'commentary', 'diff'] as const;

// Build each upstream package so its `dist/**/*.d.ts` is fresh.
for (const upstreamName of upstreamPackageNames) {
  const upstreamRoot = `${workspaceRoot}/packages/${upstreamName}`;
  const buildResult = await $`bun run --cwd ${upstreamRoot} build`.nothrow();
  if (buildResult.exitCode !== 0) {
    process.stderr.write(
      `Build aborted: upstream @cinder/${upstreamName} build failed (exit ${buildResult.exitCode}).\n` +
        `${buildResult.stderr.toString()}\n`,
    );
    process.exit(1);
  }
}

const upstreamVendorRoot = `${distributionDirectory}/_upstream`;
await $`rm -rf ${upstreamVendorRoot}`;

// Copy each upstream's `dist/**/*.d.ts` (and any source maps that accompany
// them) into `dist/_upstream/<pkg>/`.
async function copyUpstreamDeclarations(upstreamName: string): Promise<void> {
  const sourceDist = `${workspaceRoot}/packages/${upstreamName}/dist`;
  const destinationDist = `${upstreamVendorRoot}/${upstreamName}`;
  if (!existsSync(sourceDist)) {
    process.stderr.write(
      `Build aborted: expected upstream dist ${sourceDist} to exist after upstream build.\n`,
    );
    process.exit(1);
  }
  const glob = new Glob('**/*.d.{ts,mts,cts}');
  for await (const relative of glob.scan({ cwd: sourceDist })) {
    const sourcePath = `${sourceDist}/${relative}`;
    const destinationPath = `${destinationDist}/${relative}`;
    await mkdir(dirname(destinationPath), { recursive: true });
    await Bun.write(destinationPath, await Bun.file(sourcePath).text());
  }
}

for (const upstreamName of upstreamPackageNames) {
  await copyUpstreamDeclarations(upstreamName);
}

/**
 * Rewrite every `@cinder/<pkg>[/subpath]` import specifier in a `.d.ts` file
 * to a relative path pointing into `dist/_upstream/<pkg>/`. The rewrite is
 * file-position-aware: the relative segment depends on how deep the source
 * `.d.ts` lives under `dist/`.
 */
function rewriteUpstreamSpecifiers(content: string, fileDistRelative: string): string {
  // Use the directory portion of the file's path within `dist/` to compute
  // the relative path back up to `dist/_upstream/`.
  const fileDirectory = dirname(fileDistRelative);
  const upwards =
    fileDirectory === '.'
      ? '.'
      : fileDirectory
          .split('/')
          .map(() => '..')
          .join('/');
  const upstreamRelativeBase = `${upwards}/_upstream`;

  return content.replace(
    /(['"])@cinder\/(markdown|editor|commentary|diff)(\/[^'"]*)?\1/g,
    (_match, quote: string, pkg: string, rest: string | undefined) => {
      const subpath = rest ?? '';
      // Upstream emits flattened `.d.ts` files mirroring `src/`, but the
      // emitted JS specifiers carry no extension. The relative TypeScript
      // import resolves against the same path with `.d.ts` appended at
      // resolution time, so we keep the specifier extensionless.
      return `${quote}${upstreamRelativeBase}/${pkg}${subpath}${quote}`;
    },
  );
}

const dtsGlob = new Glob('**/*.d.{ts,mts,cts}');
let rewrittenDtsCount = 0;
for await (const relative of dtsGlob.scan({ cwd: distributionDirectory })) {
  // Don't rewrite anything inside `_upstream/` until we've handled non-vendored
  // declarations first — the loop below covers vendored files in a second pass.
  if (relative.startsWith('_upstream/')) continue;
  const filePath = `${distributionDirectory}/${relative}`;
  const original = await Bun.file(filePath).text();
  if (!original.includes('@cinder/')) continue;
  const rewritten = rewriteUpstreamSpecifiers(original, relative);
  if (rewritten !== original) {
    await Bun.write(filePath, rewritten);
    rewrittenDtsCount += 1;
  }
}

// Second pass: rewrite cross-upstream `@cinder/*` specifiers inside the
// vendored declarations themselves so the `_upstream/` tree is self-contained.
// e.g. `@cinder/markdown/src/diff/line-diff.d.ts` referencing `@cinder/diff`
// becomes a relative hop into `_upstream/diff/`.
for await (const relative of dtsGlob.scan({ cwd: upstreamVendorRoot })) {
  const filePath = `${upstreamVendorRoot}/${relative}`;
  const original = await Bun.file(filePath).text();
  if (!original.includes('@cinder/')) continue;
  // Relative path here is anchored at `dist/_upstream`, but
  // `rewriteUpstreamSpecifiers` expects a path anchored at `dist/`. Prepend
  // `_upstream/` so the upwards-walk math points back at the same root.
  const rewritten = rewriteUpstreamSpecifiers(original, `_upstream/${relative}`);
  if (rewritten !== original) {
    await Bun.write(filePath, rewritten);
    rewrittenDtsCount += 1;
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

const missingPaths = expectedPaths.filter((path) => !existsSync(path));
if (missingPaths.length > 0) {
  process.stderr.write('Build aborted: expected output paths missing:\n');
  for (const path of missingPaths) process.stderr.write(`  - ${path}\n`);
  process.exit(1);
}

// Component JS must NOT import the CSS sidecar. Contract: à la carte CSS is
// opt-in by the consumer via `cinder/<name>/styles`. Scan EVERY per-component
// bundle (including experimental) for CSS imports in all the forms a bundler
// could emit — bare side-effect imports, named imports, namespace imports,
// and dynamic `import('./foo.css')`. Spot-checking a handful of components
// leaves a backdoor where any unsweep'd bundle could ship a CSS import.
const cssImportPattern =
  /(?:\bimport\s*(?:[\w*${},\s]+\s+from\s*)?['"][^'"]*\.css['"]|\bimport\s*\(\s*['"][^'"]*\.css['"])/i;
for (const component of components) {
  const distributionFile = `${componentDistributionDirectory(component)}/index.js`;
  if (!existsSync(distributionFile)) continue;
  const text = await Bun.file(distributionFile).text();
  if (cssImportPattern.test(text)) {
    process.stderr.write(
      `Build aborted: ${distributionFile} contains a CSS import. Component JS must not pull its sidecar — à la carte CSS is opt-in via \`cinder/<name>/styles\`.\n`,
    );
    process.exit(1);
  }
}

process.stdout.write(
  `Build complete. ${components.length} components, ${copiedSidecars.length} CSS sidecars copied.\n`,
);
