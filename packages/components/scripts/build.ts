import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emitDts } from 'svelte2tsx';

import { checkComponentCss, formatViolation } from './check-component-css.ts';
import { discoverComponents, type ComponentDiscovery } from './lib/discover-components.ts';
import { createServerEntrySource } from './server-entry.ts';
import { sveltePlugin } from './svelte-plugin.ts';

const repositoryRoot = process.cwd();
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
  external: ['@cinder/*', 'svelte'],
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
const browserEntrypoints = [`${sourceRoot}/index.ts`, ...perComponentEntrypoints];

const browserBuildResult = await Bun.build({
  entrypoints: browserEntrypoints,
  outdir: distributionDirectory,
  root: sourceRoot,
  target: 'browser',
  format: 'esm',
  splitting: false,
  external: ['svelte', 'svelte/*', '@cinder/*'],
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
  entrypoints: perComponentEntrypoints,
  outdir: `${distributionDirectory}/server`,
  root: sourceRoot,
  target: 'node',
  format: 'esm',
  splitting: false,
  external: ['svelte', 'svelte/*', '@cinder/*'],
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
  expectedPaths.push(
    component.isExperimental
      ? `${distributionDirectory}/server/components/experimental/${component.name}/index.js`
      : `${distributionDirectory}/server/components/${component.name}/index.js`,
  );
  if (existsSync(componentCssSource(component))) {
    expectedPaths.push(componentCssDestination(component));
  }
}

const missingPaths = expectedPaths.filter((path) => !existsSync(path));
if (missingPaths.length > 0) {
  process.stderr.write('Build aborted: expected output paths missing:\n');
  for (const path of missingPaths) process.stderr.write(`  - ${path}\n`);
  process.exit(1);
}

// Component JS must NOT import the CSS sidecar. Contract: à la carte CSS is
// opt-in by the consumer via `cinder/<name>/styles`. Spot-check a few well-
// known components rather than scanning every output for performance.
const noCssImportSpotChecks = ['button', 'alert', 'card'];
for (const name of noCssImportSpotChecks) {
  const distributionFile = `${distributionDirectory}/components/${name}/index.js`;
  if (!existsSync(distributionFile)) continue;
  const text = await Bun.file(distributionFile).text();
  if (/\bimport\s+['"][^'"]*\.css['"]/i.test(text)) {
    process.stderr.write(
      `Build aborted: ${distributionFile} contains a CSS import. Component JS must not pull its sidecar.\n`,
    );
    process.exit(1);
  }
}

process.stdout.write(
  `Build complete. ${components.length} components, ${copiedSidecars.length} CSS sidecars copied.\n`,
);
