/**
 * Validates a real, packed `@lostgradient/editor` publish artifact against
 * a fixture that installs only its *declared* peers and dependencies --
 * catching a missing `peerDependencies`/`dependencies` entry before it
 * reaches npm, rather than after a consumer's install breaks.
 *
 * ## Limitations of the static import-closure scan (`assertImportClosure`)
 *
 * This file's static scan (`assertImportClosure`) is deliberately not a
 * full bundler-grade static analyzer -- that has no finite closure short of
 * actually embedding one, which this gate script isn't. What it checks
 * comes from a real lexer's structured output (`Bun.Transpiler.scanImports`
 * for JS/TS, quote-aware tag extraction for Svelte markup) wherever one is
 * available, never from a regex scanning unlexed source text -- that
 * distinction is the entire lesson of cinder#1334 (a regex matching the
 * word "from" plus a quote character inside a doc comment, mistaken for a
 * real import) and cinder#1335's own round-1 regression (a narrower
 * "restore old behavior" regex for computed dynamic imports that reopened
 * the identical failure mode for `import(` specifically). A few import
 * shapes genuinely can't be covered that way with the tools actually
 * available here; each is named below, with why the gap is acceptable
 * rather than silently accepted:
 *
 * - **A dynamic `import()` with a non-static (computed) specifier** --
 *   `import('pkg/' + feature)` -- has no complete specifier for any lexer
 *   to report; `scanImports` correctly reports nothing for it. Verified via
 *   `npm pack --dry-run` against this package's actual published output:
 *   zero computed dynamic imports exist anywhere in it today (this is
 *   compiled Svelte component output, not hand-written app code with
 *   feature-flag-style dynamic imports). If one is ever added, the runtime
 *   fixture below (`buildConsumerEntries` / `runPlainNodeConsumer`) still
 *   catches it if it's genuinely reachable: both build and execute every
 *   export target with *only* the declared peers installed, so an
 *   undeclared dependency that's actually imported at runtime fails there
 *   regardless of what this static scan does or doesn't see.
 * - **A dynamic `import()` inside Svelte template markup** (an
 *   `onclick`/`{#await}` expression, outside every `<script>` block) --
 *   there's no Svelte-markup-aware lexer available here, and regexing
 *   markup text is exactly the class of check this file avoids. Verified
 *   empirically: zero instances anywhere in the actual published artifact
 *   (every `import(` call site is inside a `<script>` block, and every one
 *   is a fully static specifier). Same runtime-fixture backstop as above if
 *   that ever changes.
 * - **A `require()` call through a locally-shadowed `require` identifier**
 *   (`const require = (v) => v; require('not-a-package')`) would be
 *   misreported as a real import by `scanImports`, which has no binding
 *   awareness. Not just unlikely but structurally absent today: this
 *   package's actual published output contains zero `require()` call sites
 *   of any kind -- it's 100% ESM. Revisit if that ever stops being true.
 * - **A type-only import** (`import type { X } from 'pkg'`) in published
 *   `.svelte` *source* files is invisible to `Bun.Transpiler.scanImports`
 *   by design -- confirmed against the documented `TranspilerOptions` API
 *   (no flag surfaces type-only imports) and empirically (`scan`,
 *   `scanImports`, and `transformSync` all erase them identically). This is
 *   a real, live pattern in this package's actual output (`import type` is
 *   used throughout its `.svelte` sources, currently always against an
 *   already-declared peer or a relative import), so an undeclared type-only
 *   peer would pass this static check silently. Partially, not fully,
 *   backstopped: `runSvelteCheckConsumer`'s `svelte-check` pass against a
 *   packed consumer app currently only exercises `MarkdownEditor`'s own
 *   transitive type-import graph, not `ReviewEditor`'s or `DiffViewer`'s
 *   independently -- a genuine, narrow, currently-inert gap, named here
 *   rather than left to be rediscovered as a mystery.
 * - **CSS `@import`** (standalone `.css` files and a `.svelte` file's
 *   `<style>` block) has no real lexer available in this toolchain at all,
 *   so detection stays regex-based -- the one place in this file a pattern
 *   still runs over source text -- but scoped as narrowly as CSS's own
 *   `@import '...'` at-rule syntax allows, and validated against only the
 *   bare-package-name portion of a capture (see {@link
 *   isPlausibleCssImportSpecifier}) rather than the whole captured string,
 *   so a comment containing prose is still rejected while a real quoted
 *   path with a space in a later subpath segment (a real, legal filename)
 *   is not incorrectly discarded.
 *
 * @module
 */

import { Glob } from 'bun';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import {
  assertSourceManifest,
  exportTargets,
  packForPublish,
  parsePackageManifest,
  type PackageManifest,
} from './pack-for-publish.ts';

const packageRoot = join(import.meta.dir, '..');
const workspaceRoot = resolve(packageRoot, '../..');
// Host-supplied runtime singletons — the fixture symlinks these into its
// top-level node_modules the way a real host app would after installing
// them directly.
const requiredPeers = [
  '@lostgradient/cinder',
  '@lostgradient/markdown',
  '@milkdown/ctx',
  '@milkdown/kit',
  '@milkdown/prose',
  'prosemirror-inputrules',
  'prosemirror-model',
  'prosemirror-state',
  'prosemirror-view',
  'svelte',
] as const;
// Editor's own vendored-utility dependencies — the fixture symlinks these
// into the *installed editor package's own* node_modules, simulating what a
// package manager does automatically for a regular `dependencies` entry
// (nested resolution), never into the fixture's top-level node_modules. A
// host app never provides these.
const requiredOwnDependencies = ['@floating-ui/dom', 'esm-env'] as const;

type ValidationFixture = {
  root: string;
  extractedRoot: string;
  nodeModules: string;
  installedEditorRoot: string;
};

function fail(message: string): never {
  throw new Error(`[validate-consumer] ${message}`);
}

async function run(command: string, arguments_: string[], cwd = packageRoot): Promise<void> {
  const child = Bun.spawn([command, ...arguments_], {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) fail(`${command} ${arguments_.join(' ')} exited ${exitCode}`);
}

function assertPackedManifest(manifest: PackageManifest): void {
  // assertSourceManifest enforces the exact `dependencies` contract
  // (@floating-ui/dom + esm-env) and the exact peer set.
  assertSourceManifest(manifest);
  if (manifest.devDependencies !== undefined) fail('packed manifest must omit devDependencies');
  if (manifest.optionalDependencies !== undefined) {
    fail('packed manifest must omit optionalDependencies');
  }
  if (manifest.scripts !== undefined) fail('packed manifest must omit scripts');

  const serialized = JSON.stringify(manifest);
  if (serialized.includes('workspace:')) fail('packed manifest contains a workspace protocol');
  if (serialized.includes('./src/')) fail('packed manifest contains a source export target');
}

function assertPackedExports(manifest: PackageManifest, installedEditorRoot: string): void {
  for (const [subpath, entry] of Object.entries(manifest.exports)) {
    for (const target of exportTargets(entry)) {
      if (!target.startsWith('./')) continue;
      if (!existsSync(join(installedEditorRoot, target.slice(2)))) {
        fail(`${subpath} points at missing packed target ${target}`);
      }
    }
  }
}

async function assertPackedFileSet(installedEditorRoot: string): Promise<void> {
  const forbidden: string[] = [];
  for await (const relativePath of new Glob('**/*').scan({ cwd: installedEditorRoot })) {
    const normalizedPath = relativePath.replaceAll('\\', '/');
    const fileName = normalizedPath.split('/').at(-1) ?? normalizedPath;
    if (
      /\.(?:test|spec)\.[^.]+$/u.test(fileName) ||
      /(?:^|[-.])fixtures?(?:[-.]|$)/u.test(fileName) ||
      normalizedPath.includes('/test/') ||
      normalizedPath.endsWith('.map')
    ) {
      forbidden.push(normalizedPath);
    }
  }
  if (forbidden.length > 0) {
    fail(
      `packed artifact contains test, fixture, or source-map files:\n  ${forbidden.join('\n  ')}`,
    );
  }
}

/**
 * Neither host-supplied peers nor Editor-owned dependencies should ever be
 * inlined into the published server bundle — both resolve from
 * `node_modules` at install time instead.
 */
async function assertNoBundledRuntimeProvenance(
  manifest: PackageManifest,
  installedEditorRoot: string,
): Promise<void> {
  const bundledSpecifiers = new Set<string>();
  const serverSourceGlob = new Glob('dist/server/**/*.js');
  const runtimeSpecifiers = [
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.dependencies ?? {}),
  ];
  for await (const relativePath of serverSourceGlob.scan({ cwd: installedEditorRoot })) {
    const bundledSource = await Bun.file(join(installedEditorRoot, relativePath)).text();
    const source = bundledSource.replaceAll('\\', '/');
    for (const specifier of runtimeSpecifiers) {
      if (source.includes(`/node_modules/${specifier}/`)) bundledSpecifiers.add(specifier);
    }
  }
  if (bundledSpecifiers.size > 0) {
    fail(
      `packed server artifact bundles declared runtime imports: ${[...bundledSpecifiers].toSorted().join(', ')}`,
    );
  }
}

async function linkModule(
  specifier: string,
  destinationRoot: string,
  sourceOverride?: string,
): Promise<void> {
  const source = sourceOverride ?? join(workspaceRoot, 'node_modules', ...specifier.split('/'));
  if (!existsSync(source)) fail(`workspace module is unavailable: ${specifier}`);

  const destination = join(destinationRoot, ...specifier.split('/'));
  await mkdir(dirname(destination), { recursive: true });
  await symlink(source, destination, process.platform === 'win32' ? 'junction' : 'dir');
}

/** Links a host-supplied peer into the fixture's top-level node_modules, simulating a real host install. */
async function linkPeer(
  peer: (typeof requiredPeers)[number],
  fixtureNodeModules: string,
): Promise<void> {
  const sourceOverride =
    peer === '@lostgradient/cinder' ? join(workspaceRoot, 'packages', 'components') : undefined;
  await linkModule(peer, fixtureNodeModules, sourceOverride);
}

/**
 * Links an Editor-owned dependency into the *installed editor package's own*
 * node_modules — never the fixture's top-level node_modules. This is what
 * proves the fix: a host app that never installed `@floating-ui/dom` or
 * `esm-env` itself can still resolve them, because they arrive nested under
 * `@lostgradient/editor` the way a package manager installs any other
 * regular `dependencies` entry.
 */
async function linkOwnDependency(
  dependency: (typeof requiredOwnDependencies)[number],
  installedEditorRoot: string,
): Promise<void> {
  await linkModule(dependency, join(installedEditorRoot, 'node_modules'));
}

/** Extracts the packed tarball only — no linking yet, so the pure-artifact assertions below inspect exactly what was published. */
async function extractPackedArtifact(
  tarballPath: string,
  fixture: ValidationFixture,
): Promise<PackageManifest> {
  const tar = Bun.which('tar');
  if (tar === null) fail('tar is required to inspect the publish artifact');

  await mkdir(fixture.extractedRoot, { recursive: true });
  await run(tar, ['-xzf', tarballPath, '-C', fixture.extractedRoot]);
  const extractedPackage = join(fixture.extractedRoot, 'package');
  if (!existsSync(extractedPackage)) fail('publish tarball does not contain package/');

  await mkdir(dirname(fixture.installedEditorRoot), { recursive: true });
  await rename(extractedPackage, fixture.installedEditorRoot);

  return parsePackageManifest(
    await Bun.file(join(fixture.installedEditorRoot, 'package.json')).text(),
  );
}

/** Links the fixture's simulated install graph: host peers at the top level, Editor's own dependencies nested under it. */
async function linkFixtureDependencyGraph(fixture: ValidationFixture): Promise<void> {
  for (const peer of requiredPeers) await linkPeer(peer, fixture.nodeModules);
  for (const dependency of requiredOwnDependencies) {
    await linkOwnDependency(dependency, fixture.installedEditorRoot);
  }
}

export function barePackageName(specifier: string): string {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] ?? specifier);
}

/**
 * Locate a real Node.js executable -- not Bun's own `bun-node` shim, which
 * `Bun.which('node')` can resolve to depending on `PATH` ordering. Shared by
 * {@link runPlainNodeConsumer} (which needs a real Node to prove the packed
 * artifact's server entries actually run there) and {@link
 * nodeBuiltinMembership} (which needs to ask a real Node which specifiers
 * it considers builtin -- see that function's own doc for why Bun's own
 * `node:module` cannot answer that question correctly).
 *
 * Probes every `node`/`node.exe` found on `PATH` plus a handful of common
 * install locations, running each candidate and checking
 * `process.release.name === 'node'` with no `process.versions.bun` --
 * `realpathSync` first, so a `bun-node` shim symlinked as `node` is caught
 * even when its un-resolved path doesn't say so.
 */
export async function findRealNodeExecutable(): Promise<string | undefined> {
  const nodeFromPath = Bun.which('node');
  const nodeCandidates = new Set([
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    '/opt/local/bin/node',
    ...(process.env['PATH'] ?? '')
      .split(delimiter)
      .filter((directory) => directory.length > 0)
      .map((directory) => join(directory, process.platform === 'win32' ? 'node.exe' : 'node')),
    ...(nodeFromPath === null ? [] : [nodeFromPath]),
  ]);
  for (const candidate of nodeCandidates) {
    if (!existsSync(candidate)) continue;

    const resolvedCandidate = realpathSync(candidate);
    if (resolvedCandidate.includes('bun-node')) continue;
    const probe = Bun.spawnSync(
      [
        resolvedCandidate,
        '--print',
        "[process.release.name, process.execPath, process.versions.bun ?? ''].join('\\n')",
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const [releaseName, executablePath, bunVersion] = new TextDecoder()
      .decode(probe.stdout)
      .trimEnd()
      .split('\n');
    if (
      probe.exitCode === 0 &&
      releaseName === 'node' &&
      executablePath !== undefined &&
      !executablePath.includes('bun') &&
      (bunVersion === undefined || bunVersion.length === 0)
    ) {
      return resolvedCandidate;
    }
  }
  return undefined;
}

/**
 * Ask a real Node executable which of `specifiers` it considers a builtin
 * module (bare, `node:`-prefixed, or a legitimate subpath of either --
 * `node:fs/promises` is builtin, `assert/not-real` is not, and only Node's
 * own `module.isBuiltin()` gets that distinction right).
 *
 * Deliberately does NOT use Bun's own `node:module` (`builtinModules` or
 * `isBuiltin`) -- verified empirically that Bun's compatibility surface
 * disagrees with real Node's in both directions: under Bun,
 * `isBuiltin('ws')` and `isBuiltin('undici')` both incorrectly return
 * `true` (Bun ships these as built-in shims; real Node does not, so a
 * packed `import 'ws'` would pass this check without a declared dependency
 * and then fail for every actual Node consumer -- cinder#1335 round-3
 * finding). Spawning the actual target Node and asking it directly is the
 * only way to get an answer that matches what a real consumer's runtime
 * will do, matching this module's `runPlainNodeConsumer` step, which
 * already runs the packed artifact under a real Node for the same reason.
 *
 * A single batch call (specifiers piped in as JSON over stdin, builtin
 * membership piped back as JSON over stdout) rather than one process spawn
 * per specifier -- cheap regardless of how many distinct specifiers a scan
 * turns up, and `assertImportClosure` only calls this at all when there's
 * at least one specifier not already resolved by a declared peer/dependency,
 * so the common case (nothing undeclared) never spawns a process.
 */
export async function nodeBuiltinMembership(
  nodeExecutable: string,
  specifiers: readonly string[],
): Promise<Set<string>> {
  if (specifiers.length === 0) return new Set();
  const script =
    'const { isBuiltin } = require("node:module");' +
    'const specifiers = JSON.parse(require("fs").readFileSync(0, "utf8"));' +
    'process.stdout.write(JSON.stringify(specifiers.filter((s) => isBuiltin(s))));';
  const probe = Bun.spawnSync([nodeExecutable, '-e', script], {
    stdin: new TextEncoder().encode(JSON.stringify(specifiers)),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (probe.exitCode !== 0) {
    fail(
      `failed to query the target Node executable for builtin-module membership:\n${new TextDecoder().decode(probe.stderr)}`,
    );
  }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(probe.stdout));
  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === 'string')) {
    fail('the target Node executable returned an unexpected result for builtin-module membership');
  }
  return new Set(parsed);
}

/**
 * Finds the index of the `>` that closes an opening tag starting at
 * `openIndex` (the index of its `<`), respecting quoted attribute values --
 * a `>` inside a quoted attribute (`generics="T extends Array<string>"`, a
 * real Svelte generics annotation) is not the tag's own closing bracket.
 * The original `[^>]*` regex-based extraction had no such awareness: it
 * stopped at the FIRST `>`, wherever it fell, so a script tag with this
 * kind of attribute produced a malformed extracted block starting mid
 * attribute-value, which `Bun.Transpiler.scanImports` then threw on
 * ("Unterminated string literal") -- failing the release validator on
 * legitimate Editor source (cinder#1335 round-2 finding). Returns -1 if no
 * unquoted `>` is found before the end of `source` (a malformed or
 * truncated tag).
 */
function findTagEnd(source: string, openIndex: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = openIndex; index < source.length; index++) {
    const character = source[index];
    if (quote !== null) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') return index;
  }
  return -1;
}

/**
 * Extract the content of every `<script>` or `<style>` block from a
 * `.svelte` file's markup, using {@link findTagEnd} to find each opening
 * tag's real closing `>` rather than a regex that can't tell a quoted
 * attribute's `>` from the tag's own.
 */
function extractSvelteTagBlocks(source: string, tagName: 'script' | 'style'): string[] {
  const blocks: string[] = [];
  const openTagPattern = new RegExp(`<${tagName}\\b`, 'giu');
  const closeTag = `</${tagName}>`;
  let match: RegExpExecArray | null;
  while ((match = openTagPattern.exec(source)) !== null) {
    const tagEnd = findTagEnd(source, match.index);
    if (tagEnd === -1) break; // malformed opening tag -- nothing more to extract safely
    const closeIndex = source.toLowerCase().indexOf(closeTag, tagEnd + 1);
    if (closeIndex === -1) break; // malformed -- no matching close tag
    blocks.push(source.slice(tagEnd + 1, closeIndex));
    openTagPattern.lastIndex = closeIndex + closeTag.length;
  }
  return blocks;
}

/**
 * Extract the JS/TS content of every `<script>` block (both a `module`
 * block and an instance block) from a `.svelte` file's markup, so it can be
 * fed through the same real lexer {@link assertImportClosure} uses for
 * `.js` files. There is no Svelte-markup-aware import lexer available here,
 * but isolating just the script content first, then handing only that to
 * `Bun.Transpiler`, still means nothing outside a `<script>` tag -- markup,
 * text content, a `<style>` block -- is ever scanned for imports at all.
 */
export function extractSvelteScriptBlocks(source: string): string[] {
  return extractSvelteTagBlocks(source, 'script');
}

/**
 * Extract the content of every `<style>` block from a `.svelte` file's
 * markup, so its CSS `@import`s can be checked the same way a standalone
 * `.css` file's are. Scanning only `<script>` blocks and skipping `<style>`
 * entirely was a real coverage regression from the original regex-based
 * scanner, which (despite its comment-prose bug) did at least scan the
 * whole `.svelte` file: a component declaring
 * `@import 'undeclared-package/styles.css';` in its `<style>` block would
 * previously pass this check silently (cinder#1335 round-2 finding).
 */
export function extractSvelteStyleBlocks(source: string): string[] {
  return extractSvelteTagBlocks(source, 'style');
}

/**
 * True for a CSS `@import` capture whose *bare package-name portion* --
 * not necessarily the whole captured string -- looks like a real
 * specifier. A real npm package name can never contain whitespace, but a
 * legal quoted CSS path's *subpath* can (`'undeclared-package/theme
 * dark.css'` is a real, valid quoted path to a file with a space in its
 * name) -- so validating the whole capture for "any whitespace at all"
 * (the round-2 shape) incorrectly discarded that case as if it were
 * comment prose (cinder#1335 round-3 finding). Validating only {@link
 * barePackageName}'s portion instead stays fail-closed against prose
 * (which has no `/`, so its own "bare name portion" is the whole string,
 * still whitespace-laden) while no longer discarding a real quoted path
 * just because a later subpath segment has a space in it.
 */
export function isPlausibleCssImportSpecifier(specifier: string): boolean {
  if (specifier.length === 0) return false;
  const name = barePackageName(specifier);
  return name.length > 0 && !/\s/u.test(name);
}

/**
 * Scan CSS `@import` statements in `content`, calling `record` for each
 * plausible specifier. Shared between standalone `.css` files and the
 * `<style>` block content extracted from `.svelte` files. The one place in
 * this file a regex still runs over raw source text -- see the module
 * header's limitations section for why CSS has no real-lexer alternative
 * here, and why this stays narrowly scoped to CSS's own `@import '...'`
 * at-rule syntax rather than anything broader.
 */
function scanCssImports(content: string, record: (specifier: string) => void): void {
  for (const match of content.matchAll(/@import\s+['"]([^'"]+)['"]/gu)) {
    const specifier = match[1];
    if (specifier !== undefined && isPlausibleCssImportSpecifier(specifier)) {
      record(specifier);
    }
  }
}

/**
 * Scan JS/TS-shaped `content` for import specifiers, calling `record` for
 * each one found. `Bun.Transpiler.scanImports` only -- a real lexer, no
 * supplementary regex. An earlier version of this function added a
 * supplementary `import(` regex specifically to catch a dynamic import
 * with a computed specifier (`import('pkg/' + feature)`, which
 * `scanImports` can't report since the full specifier isn't statically
 * known); that regex ran over the same raw, comment-bearing source text
 * that caused cinder#1334 in the first place, and reopened the identical
 * failure mode for `import(` specifically (a doc comment containing
 * `import('example')` as sample code would be misread as a real dynamic
 * import). Removed entirely rather than narrowed further -- see the module
 * header's limitations section for why this specific gap (verified: zero
 * live instances in this package's actual published output) is an accepted
 * one, backed by the runtime fixture below, not a hole.
 */
function scanJsLikeImports(content: string, record: (specifier: string) => void): void {
  const transpiler = new Bun.Transpiler({ loader: 'ts' });
  for (const { path: specifier } of transpiler.scanImports(content)) {
    record(specifier);
  }
}

/**
 * Every bare external import reachable from the packed `dist/**` must be a
 * declared runtime peer or dependency, or a real Node.js builtin module
 * (see {@link nodeBuiltinMembership} for why that check has to ask an
 * actual Node executable rather than trusting Bun's own `node:module`).
 * Uses {@link scanJsLikeImports} (a real lexer, never a text regex) for
 * `.js` files and for the `<script>` content extracted from `.svelte`
 * files, because the compiled output preserves doc comments verbatim, and
 * prose in those comments can contain the literal word "from" followed by
 * a quote character (a scare-quote, a contraction) that a regex like
 * `/(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/` cannot distinguish
 * from a real `import ... from '...'` statement. This is exactly what
 * happened in practice (cinder#1334): captured "specifiers" like `for
 * every node the\n * parser understood, with no string comparison
 * anywhere` from a doc comment, not an import path. The transpiler
 * tokenizes the file the way it would to actually run it, so comment text
 * is structurally invisible to it -- mirrors
 * `packages/markdown/scripts/validate-consumer.ts`'s own
 * `assertImportClosure`, which already used this approach for its `.js`-only
 * case; this is the same fix applied to Editor's larger `.js` + `.svelte` +
 * `.css` surface.
 *
 * CSS (both standalone `.css` files and a `.svelte` file's `<style>` block,
 * via {@link scanCssImports}) has no equivalent lexer available here, so
 * `@import` detection stays regex-based, guarded by {@link
 * isPlausibleCssImportSpecifier}.
 *
 * Two passes, not one: the file scan below only *collects* candidate
 * violations (already filtered against declared peers/dependencies and
 * relative/absolute specifiers); Node-builtin membership is resolved
 * afterward, in one batched call to a real Node executable, only if there's
 * at least one unresolved candidate at all. See the module header's
 * limitations section for what this static scan deliberately does not
 * cover and why.
 */
export async function assertImportClosure(
  manifest: PackageManifest,
  installedEditorRoot: string,
): Promise<void> {
  const declaredRuntimeSpecifiers = new Set([
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.dependencies ?? {}),
  ]);
  const candidates: { relativePath: string; specifier: string }[] = [];
  const sourceGlob = new Glob('dist/**/*.{js,svelte,css}');

  function collectCandidate(relativePath: string, specifier: string): void {
    if (specifier.startsWith('.') || specifier.startsWith('/')) return;
    if (declaredRuntimeSpecifiers.has(barePackageName(specifier))) return;
    candidates.push({ relativePath, specifier });
  }

  for await (const relativePath of sourceGlob.scan({ cwd: installedEditorRoot })) {
    const source = await Bun.file(join(installedEditorRoot, relativePath)).text();

    if (relativePath.endsWith('.js')) {
      scanJsLikeImports(source, (specifier) => collectCandidate(relativePath, specifier));
      continue;
    }

    if (relativePath.endsWith('.svelte')) {
      for (const scriptContent of extractSvelteScriptBlocks(source)) {
        scanJsLikeImports(scriptContent, (specifier) => collectCandidate(relativePath, specifier));
      }
      for (const styleContent of extractSvelteStyleBlocks(source)) {
        scanCssImports(styleContent, (specifier) => collectCandidate(relativePath, specifier));
      }
      continue;
    }

    scanCssImports(source, (specifier) => collectCandidate(relativePath, specifier));
  }

  if (candidates.length === 0) return;

  const nodeExecutable = await findRealNodeExecutable();
  if (nodeExecutable === undefined) {
    fail('a real Node executable is required to check builtin-module membership');
  }
  const uniqueSpecifiers = [...new Set(candidates.map((candidate) => candidate.specifier))];
  const builtinSpecifiers = await nodeBuiltinMembership(nodeExecutable, uniqueSpecifiers);

  const violations = new Set(
    candidates
      .filter((candidate) => !builtinSpecifiers.has(candidate.specifier))
      .map((candidate) => `${candidate.relativePath}: ${candidate.specifier}`),
  );

  if (violations.size > 0) {
    fail(`packed production imports are not declared peers:\n  ${[...violations].join('\n  ')}`);
  }
}

function formatBuildLogs(logs: readonly { message: string }[]): string {
  return logs.map((log) => log.message).join('\n');
}

function scopedCssTokenForClass(source: string, className: string, artifactLabel: string): string {
  const match = new RegExp(`${className}(?:\\s+|\\.)(svelte-[a-z0-9]+)`, 'u').exec(source);
  const token = match?.[1];
  if (token === undefined) {
    fail(`${artifactLabel} does not retain the scoped CSS token for .${className}`);
  }
  return token;
}

async function buildConsumerEntries(fixture: ValidationFixture): Promise<void> {
  const clientEntryPath = join(fixture.root, 'client.ts');
  const serverEntryPath = join(fixture.root, 'server.ts');
  // `DiffViewer` is the client/server SSR proof target: it needs no
  // `{#if browser}`-gated milkdown runtime the way `MarkdownEditor` and
  // `ReviewEditor` do, so it exercises the packed client build + real Svelte
  // SSR render without also re-testing the import-boundary guard those two
  // already cover in-package (markdown-editor.import-boundary.test.ts).
  await Bun.write(
    clientEntryPath,
    `import DiffViewer from '@lostgradient/editor/diff-viewer';\n` +
      `import MarkdownEditor from '@lostgradient/editor/markdown-editor';\n` +
      `import ReviewEditor from '@lostgradient/editor/review-editor';\n` +
      `if (![DiffViewer, MarkdownEditor, ReviewEditor].every(Boolean)) throw new Error('missing Editor component export');\n`,
  );
  await Bun.write(
    serverEntryPath,
    `import { render } from 'svelte/server';\n` +
      `import DiffViewer from '@lostgradient/editor/diff-viewer';\n` +
      `const rendered = render(DiffViewer, { props: { original: 'one\\ntwo', current: 'one\\nthree' } });\n` +
      `if (!rendered.body.includes('diff-viewer')) throw new Error('DiffViewer SSR output is missing its root');\n`,
  );

  const clientResult = await Bun.build({
    entrypoints: [clientEntryPath],
    target: 'browser',
    conditions: ['browser', 'svelte'],
    plugins: [sveltePlugin({ generate: 'client' })],
  });
  if (!clientResult.success)
    fail(`client consumer build failed:\n${formatBuildLogs(clientResult.logs)}`);
  const clientArtifact = clientResult.outputs[0];
  if (clientArtifact === undefined) fail('client consumer build emitted no entry artifact');

  const serverOutput = join(fixture.root, 'server-output');
  const serverResult = await Bun.build({
    entrypoints: [serverEntryPath],
    outdir: serverOutput,
    target: 'bun',
    conditions: ['svelte'],
    plugins: [sveltePlugin({ generate: 'server' })],
  });
  if (!serverResult.success)
    fail(`server consumer build failed:\n${formatBuildLogs(serverResult.logs)}`);
  await run('bun', [join(serverOutput, 'server.js')], fixture.root);

  const clientSource = await clientArtifact.text();
  const serverSource = await Bun.file(join(serverOutput, 'server.js')).text();
  const clientScopedCssToken = scopedCssTokenForClass(
    clientSource,
    'diff-warning',
    'packed client build',
  );
  const serverScopedCssToken = scopedCssTokenForClass(
    serverSource,
    'diff-warning',
    'packed server build',
  );
  if (clientScopedCssToken !== serverScopedCssToken) {
    fail(
      `packed client/server scoped CSS identity differs for DiffViewer (${clientScopedCssToken} !== ${serverScopedCssToken})`,
    );
  }

  const typeEntryPath = join(fixture.root, 'type-consumer.ts');
  const tsconfigPath = join(fixture.root, 'tsconfig.json');
  await Bun.write(
    typeEntryPath,
    `import '@lostgradient/editor/review-editor/styles';\n` +
      `import type { DiffViewerProps } from '@lostgradient/editor/diff-viewer';\n` +
      `import type { MarkdownEditorProps } from '@lostgradient/editor/markdown-editor';\n` +
      `import type { ReviewEditorProps } from '@lostgradient/editor/review-editor';\n` +
      `import { createReviewEditorState } from '@lostgradient/editor/review-editor';\n` +
      `import { computeLineDiff } from '@lostgradient/markdown/diff/line-diff';\n` +
      `import type { LineDiff } from '@lostgradient/markdown/diff/line-diff';\n` +
      `const diffProps: DiffViewerProps = { original: 'a', current: 'b' };\n` +
      `const editorProps: MarkdownEditorProps = { id: 'gateway-import-surface' };\n` +
      `const reviewProps: Pick<ReviewEditorProps, 'id' | 'value'> = { id: 'review', value: 'hello' };\n` +
      `const lines: LineDiff[] = computeLineDiff(diffProps.original, diffProps.current);\n` +
      `if (lines.length === 0) throw new Error('expected at least one line diff entry');\n` +
      `void [editorProps, reviewProps, createReviewEditorState];\n`,
  );
  await Bun.write(
    tsconfigPath,
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noUncheckedSideEffectImports: true,
          skipLibCheck: true,
        },
        files: ['./type-consumer.ts'],
      },
      null,
      2,
    )}\n`,
  );
  const typescript = join(workspaceRoot, 'node_modules', '.bin', 'tsc');
  if (!existsSync(typescript)) fail('TypeScript is required for the packed style type fixture');
  await run(typescript, ['--project', tsconfigPath], fixture.root);
}

async function runSvelteCheckConsumer(fixture: ValidationFixture): Promise<void> {
  // Regression guard mirroring Chat's #772/#786 guard: `svelte-check` against
  // a *packed, installed* @lostgradient/editor (not `bun link`, not a raw
  // .svelte source import) is the only place that class of symptom
  // reproduces — a package-local typecheck never sees it, because
  // svelte-package's dts emission can differ in subtle ways from the source
  // it was generated from. This step exercises `bind:value` / `bind:mode` on
  // the public `MarkdownEditor` export exactly as a consumer would.
  const svelteCheckSourceRoot = join(fixture.root, 'svelte-check-src');
  await mkdir(svelteCheckSourceRoot, { recursive: true });
  await Bun.write(
    join(svelteCheckSourceRoot, 'App.svelte'),
    `<script lang="ts">\n` +
      `  import MarkdownEditor from '@lostgradient/editor/markdown-editor';\n` +
      `  let value = $state('# Hello');\n` +
      `  let mode = $state<'wysiwyg' | 'source'>('wysiwyg');\n` +
      `</script>\n\n` +
      `<MarkdownEditor id="svelte-check-consumer" bind:value bind:mode />\n`,
  );
  // `.mjs`, not `.js`. The scratch fixture root has no `package.json`, so a
  // `.js` config is parsed as CommonJS and `export default` is a syntax error
  // under plain Node — an `.mjs` extension is unambiguous regardless of the
  // surrounding package type. Cheap insurance: this failure would surface as a
  // config-load error long before `svelte-check` ever reached `App.svelte`,
  // making the consumer regression guard silently useless off Bun.
  await Bun.write(join(fixture.root, 'svelte.config.mjs'), `export default {};\n`);
  const svelteCheckTsconfigPath = join(fixture.root, 'svelte-check-tsconfig.json');
  await Bun.write(
    svelteCheckTsconfigPath,
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          moduleResolution: 'bundler',
          module: 'ESNext',
          target: 'ESNext',
          skipLibCheck: true,
        },
        // An explicit .svelte glob, not a bare directory include: `svelte-check`
        // resolves included files the way `tsc` does, which does not treat
        // `.svelte` as a recognized extension by default. A bare directory
        // entry risks silently matching nothing, which would make this whole
        // step a no-op that always reports zero errors.
        include: ['svelte-check-src/**/*.svelte'],
      },
      null,
      2,
    )}\n`,
  );

  const typescriptRoot = join(workspaceRoot, 'node_modules', 'typescript');
  const svelteCheckRoot = join(workspaceRoot, 'node_modules', 'svelte-check');
  if (!existsSync(typescriptRoot)) fail('workspace peer is unavailable: typescript');
  if (!existsSync(svelteCheckRoot)) fail('workspace peer is unavailable: svelte-check');
  // Explicit link type, matching `linkModule` above: on Windows a directory
  // symlink without 'junction' needs elevated permissions and fails outright.
  const directoryLinkType = process.platform === 'win32' ? 'junction' : 'dir';
  await symlink(typescriptRoot, join(fixture.nodeModules, 'typescript'), directoryLinkType);
  await symlink(svelteCheckRoot, join(fixture.nodeModules, 'svelte-check'), directoryLinkType);

  // Run the workspace's own binary rather than symlinking it into the
  // fixture's `.bin`. A FILE symlink is a separate Windows problem from the
  // directory links above — it needs Developer Mode or elevation, and
  // 'junction' does not apply to files. Since the only goal is executing
  // svelte-check against the fixture, invoking it directly with `cwd` set to
  // the fixture sidesteps the issue entirely; module resolution still happens
  // from the fixture through the directory links above.
  const svelteCheck = join(workspaceRoot, 'node_modules', 'svelte-check', 'bin', 'svelte-check');
  if (!existsSync(svelteCheck)) fail('workspace svelte-check binary is unavailable');
  const node = Bun.which('node') ?? process.execPath;
  await run(node, [svelteCheck, '--tsconfig', svelteCheckTsconfigPath], fixture.root);
}

async function runPlainNodeConsumer(fixture: ValidationFixture): Promise<void> {
  const node = await findRealNodeExecutable();
  if (node === undefined) fail('a real Node executable is required for the packed SSR fixture');
  const entryPath = join(fixture.root, 'plain-node-consumer.mjs');
  await Bun.write(
    entryPath,
    `import { render } from 'svelte/server';\n` +
      `import DiffViewer from '@lostgradient/editor/diff-viewer';\n` +
      `import MarkdownEditor from '@lostgradient/editor/markdown-editor';\n` +
      `import ReviewEditor from '@lostgradient/editor/review-editor';\n` +
      `if (process.release.name !== 'node') throw new Error('fixture is not running under Node');\n` +
      `if (![MarkdownEditor, ReviewEditor].every(Boolean)) throw new Error('missing Node subpath export');\n` +
      `const rendered = render(DiffViewer, { props: { original: 'one\\ntwo', current: 'one\\nthree' } });\n` +
      `if (!rendered.body.includes('diff-viewer')) throw new Error('plain Node SSR output is missing DiffViewer');\n`,
  );
  await run(node, [entryPath], fixture.root);

  const browserConditionEntryPath = join(fixture.root, 'browser-condition-consumer.mjs');
  await Bun.write(
    browserConditionEntryPath,
    `const expected = new Map([\n` +
      `  ['@lostgradient/editor', '/node_modules/@lostgradient/editor/dist/index.js'],\n` +
      `  ['@lostgradient/editor/diff-viewer', '/node_modules/@lostgradient/editor/dist/components/diff-viewer/index.js'],\n` +
      `]);\n` +
      `if (typeof import.meta.resolve !== 'function') throw new Error('Node executable does not support import.meta.resolve for browser-condition validation');\n` +
      `for (const [specifier, expectedSuffix] of expected) {\n` +
      `  const resolved = new URL(import.meta.resolve(specifier)).pathname;\n` +
      `  if (!resolved.endsWith(expectedSuffix)) throw new Error(\`\${specifier} resolved to \${resolved}; expected suffix \${expectedSuffix}\`);\n` +
      `}\n`,
  );
  await run(node, ['--conditions=browser', browserConditionEntryPath], fixture.root);
}

export async function validateConsumer(): Promise<void> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'lostgradient-editor-consumer-'));
  const fixture: ValidationFixture = {
    root: fixtureRoot,
    extractedRoot: join(fixtureRoot, 'extracted'),
    nodeModules: join(fixtureRoot, 'node_modules'),
    installedEditorRoot: join(fixtureRoot, 'node_modules', '@lostgradient', 'editor'),
  };
  try {
    process.stdout.write('[validate-consumer] building the Cinder peer server entries…\n');
    await run('bun', ['run', 'build'], join(workspaceRoot, 'packages', 'components'));
    process.stdout.write('[validate-consumer] building the Markdown peer…\n');
    await run('bun', ['run', 'build'], join(workspaceRoot, 'packages', 'markdown'));
    process.stdout.write('[validate-consumer] building @lostgradient/editor…\n');
    await run('bun', ['run', 'build']);
    const { tarballPath } = await packForPublish();
    const packedManifest = await extractPackedArtifact(tarballPath, fixture);
    assertPackedManifest(packedManifest);
    assertPackedExports(packedManifest, fixture.installedEditorRoot);
    await assertPackedFileSet(fixture.installedEditorRoot);
    await assertNoBundledRuntimeProvenance(packedManifest, fixture.installedEditorRoot);
    await assertImportClosure(packedManifest, fixture.installedEditorRoot);
    await linkFixtureDependencyGraph(fixture);
    await buildConsumerEntries(fixture);
    await runPlainNodeConsumer(fixture);
    process.stdout.write('[validate-consumer] running svelte-check against the packed artifact…\n');
    await runSvelteCheckConsumer(fixture);
    process.stdout.write(
      `[validate-consumer] OK — isolated artifact, import closure, client build, plugin SSR, plain-Node SSR, and svelte-check bind: forwarding verified without a host-installed @floating-ui/dom or esm-env.\n`,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) await validateConsumer();
