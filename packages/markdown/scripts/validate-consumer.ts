import { Glob } from 'bun';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';

import {
  assertSourceManifest,
  exportTargets,
  packForPublish,
  parsePackageManifest,
  type PackageManifest,
} from './pack-for-publish.ts';

const packageRoot = join(import.meta.dir, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');

type ValidationFixture = {
  root: string;
  extractedRoot: string;
  nodeModules: string;
  installedMarkdownRoot: string;
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
  assertSourceManifest(manifest);
  if (manifest.devDependencies !== undefined) fail('packed manifest must omit devDependencies');
  if (manifest.scripts !== undefined) fail('packed manifest must omit scripts');

  const serialized = JSON.stringify(manifest);
  if (serialized.includes('workspace:')) fail('packed manifest contains a workspace protocol');
  if (serialized.includes('./src/')) fail('packed manifest contains a source export target');
}

function assertPackedExports(manifest: PackageManifest, installedRoot: string): void {
  for (const [subpath, entry] of Object.entries(manifest.exports)) {
    for (const target of exportTargets(entry)) {
      if (!target.startsWith('./')) continue;
      if (!existsSync(join(installedRoot, target.slice(2)))) {
        fail(`${subpath} points at missing packed target ${target}`);
      }
    }
  }
}

async function assertPackedFileSet(installedRoot: string): Promise<void> {
  const forbidden: string[] = [];
  for await (const relativePath of new Glob('**/*').scan({ cwd: installedRoot })) {
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
 * `.map` files are stripped from the published tarball (see
 * `assertPackedFileSet` above), but `scripts/build.ts` compiles with
 * `sourcemap: 'external'`, emitting a trailing `//# sourceMappingURL=...`
 * comment into every `dist/**\/*.js`. `pack-for-publish.ts`'s
 * `stripDanglingSourceMapCommentsInStaging` is supposed to remove those
 * comments during staging — assert against the REAL packed tarball that it
 * actually did, so a regression here fails loudly instead of shipping a
 * package whose scripts reference source maps that don't exist.
 */
async function assertNoDanglingSourceMapComments(installedRoot: string): Promise<void> {
  const offenders: string[] = [];
  for await (const relativePath of new Glob('dist/**/*.{js,mjs,cjs}').scan({
    cwd: installedRoot,
  })) {
    const content = await Bun.file(join(installedRoot, relativePath)).text();
    if (/sourceMappingURL=/.test(content)) offenders.push(relativePath);
  }
  if (offenders.length > 0) {
    fail(`packed artifact has dangling sourceMappingURL comments in:\n  ${offenders.join('\n  ')}`);
  }
}

function barePackageName(specifier: string): string {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] ?? specifier);
}

/**
 * Every bare external import reachable from the packed `dist/**` must be a
 * declared runtime `dependency` — markdown has no peers, so (unlike chat) the
 * declared set to check against is `dependencies`, not `peerDependencies`.
 * This is the guard that would have caught the misplaced `@shikijs/*` deps
 * described in `docs/decisions/package-boundaries.md`.
 *
 * Uses `Bun.Transpiler.scanImports` rather than a text regex — the compiled
 * `dist/**` output still carries doc-comment code samples (e.g.
 * `import { renderMarkdown } from '$lib/document/rendering';` inside a
 * JSDoc `@example` block), which a regex would misread as a real import. The
 * transpiler parses real syntax and ignores comment text entirely.
 */
async function assertImportClosure(
  manifest: PackageManifest,
  installedRoot: string,
): Promise<void> {
  const declaredDependencies = new Set(Object.keys(manifest.dependencies ?? {}));
  const violations: string[] = [];
  const transpiler = new Bun.Transpiler({ loader: 'js' });
  const sourceGlob = new Glob('dist/**/*.js');
  for await (const relativePath of sourceGlob.scan({ cwd: installedRoot })) {
    const source = await Bun.file(join(installedRoot, relativePath)).text();
    for (const { path: specifier } of transpiler.scanImports(source)) {
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) {
        continue;
      }
      if (!declaredDependencies.has(barePackageName(specifier))) {
        violations.push(`${relativePath}: ${specifier}`);
      }
    }
  }
  if (violations.length > 0) {
    fail(`packed production imports are not declared dependencies:\n  ${violations.join('\n  ')}`);
  }
}

/**
 * Symlink each of markdown's declared runtime `dependencies` from the
 * workspace root's already-installed `node_modules` into the fixture. The
 * packed tarball only contains markdown's own `dist/**` — its third-party
 * dependencies must resolve from somewhere for the plain-Node consumer to
 * actually run, and the workspace root already has them installed.
 */
async function linkDependencies(
  manifest: PackageManifest,
  fixtureNodeModules: string,
): Promise<void> {
  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    const source = join(workspaceRoot, 'node_modules', ...dependencyName.split('/'));
    if (!existsSync(source)) fail(`workspace dependency is unavailable: ${dependencyName}`);
    const destination = join(fixtureNodeModules, ...dependencyName.split('/'));
    await mkdir(dirname(destination), { recursive: true });
    await symlink(source, destination, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

async function installPackedArtifact(
  tarballPath: string,
  fixture: ValidationFixture,
): Promise<PackageManifest> {
  const tar = Bun.which('tar');
  if (tar === null) fail('tar is required to inspect the publish artifact');

  await mkdir(fixture.extractedRoot, { recursive: true });
  await run(tar, ['-xzf', tarballPath, '-C', fixture.extractedRoot]);
  const extractedPackage = join(fixture.extractedRoot, 'package');
  if (!existsSync(extractedPackage)) fail('publish tarball does not contain package/');

  await mkdir(dirname(fixture.installedMarkdownRoot), { recursive: true });
  await rename(extractedPackage, fixture.installedMarkdownRoot);

  const manifest = parsePackageManifest(
    await Bun.file(join(fixture.installedMarkdownRoot, 'package.json')).text(),
  );
  await linkDependencies(manifest, fixture.nodeModules);
  return manifest;
}

/** Every public subpath, and one representative call per subpath. */
async function runPlainNodeConsumer(fixture: ValidationFixture): Promise<void> {
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
  let node: string | undefined;
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
      node = resolvedCandidate;
      break;
    }
  }
  if (node === undefined)
    fail('a real Node executable is required for the packed consumer fixture');

  const entryPath = join(fixture.root, 'plain-node-consumer.mjs');
  await Bun.write(
    entryPath,
    [
      `import { parse, serialize } from '@lostgradient/markdown/pipeline';`,
      `import { computeLineDiff } from '@lostgradient/markdown/diff/line-diff';`,
      `import { computeDiff } from '@lostgradient/markdown/diff';`,
      `import { renderMarkdown } from '@lostgradient/markdown/rendering';`,
      `import { isSafeUrl } from '@lostgradient/markdown/utilities/safe-url';`,
      `import { sortKeys } from '@lostgradient/markdown/utilities/sort-keys';`,
      `import { sanitizeHtml } from '@lostgradient/markdown/templates/sanitize-html';`,
      `import { renderTemplate } from '@lostgradient/markdown/templates/template-render';`,
      `if (process.release.name !== 'node') throw new Error('fixture is not running under Node');`,
      `const parseResult = parse('# Hello');`,
      `if (!parseResult.success) throw new Error('pipeline#parse failed');`,
      `if (!serialize(parseResult.ast).includes('Hello')) throw new Error('pipeline#serialize round-trip failed');`,
      `const diff = computeLineDiff('a\\nb', 'a\\nc');`,
      `if (!Array.isArray(diff)) throw new Error('diff/line-diff#computeLineDiff failed');`,
      `const fullDiff = computeDiff('a', 'b');`,
      `if (!Array.isArray(fullDiff.changes)) throw new Error('diff#computeDiff failed');`,
      `const rendered = renderMarkdown('# Hi');`,
      `if (!rendered.html.includes('Hi')) throw new Error('rendering#renderMarkdown failed');`,
      `if (!isSafeUrl('https://example.com')) throw new Error('utilities/safe-url failed');`,
      `if (JSON.stringify(sortKeys({ b: 1, a: 2 })) !== '{"a":2,"b":1}') throw new Error('utilities/sort-keys failed');`,
      `if (sanitizeHtml('<script>x</script>hi').includes('<script>')) throw new Error('templates/sanitize-html failed');`,
      `const templated = renderTemplate('Hello {{name}}', { name: 'World' });`,
      `if (!templated.includes('World')) throw new Error('templates/template-render failed');`,
      `console.log('markdown consumer OK');`,
      '',
    ].join('\n'),
  );
  await run(node, [entryPath], fixture.root);
}

export async function validateConsumer(): Promise<void> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'lostgradient-markdown-consumer-'));
  const fixture: ValidationFixture = {
    root: fixtureRoot,
    extractedRoot: join(fixtureRoot, 'extracted'),
    nodeModules: join(fixtureRoot, 'node_modules'),
    installedMarkdownRoot: join(fixtureRoot, 'node_modules', '@lostgradient', 'markdown'),
  };
  try {
    process.stdout.write('[validate-consumer] building @lostgradient/markdown…\n');
    await run('bun', ['run', 'build']);
    const { tarballPath } = await packForPublish();
    const packedManifest = await installPackedArtifact(tarballPath, fixture);
    assertPackedManifest(packedManifest);
    assertPackedExports(packedManifest, fixture.installedMarkdownRoot);
    await assertPackedFileSet(fixture.installedMarkdownRoot);
    await assertNoDanglingSourceMapComments(fixture.installedMarkdownRoot);
    await assertImportClosure(packedManifest, fixture.installedMarkdownRoot);
    await runPlainNodeConsumer(fixture);
    process.stdout.write(
      '[validate-consumer] OK — isolated peer-free artifact, import closure, and plain-Node consumer verified.\n',
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) await validateConsumer();
