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

function barePackageName(specifier: string): string {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] ?? specifier);
}

async function assertImportClosure(
  manifest: PackageManifest,
  installedEditorRoot: string,
): Promise<void> {
  const declaredRuntimeSpecifiers = new Set([
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.dependencies ?? {}),
  ]);
  const violations: string[] = [];
  const sourceGlob = new Glob('dist/**/*.{js,svelte,css}');
  for await (const relativePath of sourceGlob.scan({ cwd: installedEditorRoot })) {
    const source = await Bun.file(join(installedEditorRoot, relativePath)).text();
    const patterns = [
      /(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/gu,
      /@import\s+['"]([^'"]+)['"]/gu,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        if (
          specifier === undefined ||
          specifier.startsWith('.') ||
          specifier.startsWith('/') ||
          specifier.startsWith('node:')
        ) {
          continue;
        }
        if (!declaredRuntimeSpecifiers.has(barePackageName(specifier))) {
          violations.push(`${relativePath}: ${specifier}`);
        }
      }
    }
  }
  if (violations.length > 0) {
    fail(`packed production imports are not declared peers:\n  ${violations.join('\n  ')}`);
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
