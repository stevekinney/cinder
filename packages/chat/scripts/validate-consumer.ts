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
const requiredPeers = ['@lostgradient/cinder', 'conversationalist', 'svelte', 'zod'] as const;

type ValidationFixture = {
  root: string;
  extractedRoot: string;
  nodeModules: string;
  installedChatRoot: string;
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
  assertSourceManifest({ ...manifest, dependencies: manifest.dependencies ?? {} });
  if (manifest.dependencies !== undefined) {
    fail('packed manifest must omit dependencies');
  }
  if (manifest.devDependencies !== undefined) fail('packed manifest must omit devDependencies');
  if (manifest.optionalDependencies !== undefined) {
    fail('packed manifest must omit optionalDependencies');
  }
  if (manifest.scripts !== undefined) fail('packed manifest must omit scripts');

  const serialized = JSON.stringify(manifest);
  if (serialized.includes('workspace:')) fail('packed manifest contains a workspace protocol');
  if (serialized.includes('./src/')) fail('packed manifest contains a source export target');
}

function assertPackedExports(manifest: PackageManifest, installedChatRoot: string): void {
  for (const [subpath, entry] of Object.entries(manifest.exports)) {
    for (const target of exportTargets(entry)) {
      if (!target.startsWith('./')) continue;
      if (!existsSync(join(installedChatRoot, target.slice(2)))) {
        fail(`${subpath} points at missing packed target ${target}`);
      }
    }
  }
}

async function assertPackedFileSet(installedChatRoot: string): Promise<void> {
  const forbidden: string[] = [];
  for await (const relativePath of new Glob('**/*').scan({ cwd: installedChatRoot })) {
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

async function assertNoBundledPeerProvenance(
  manifest: PackageManifest,
  installedChatRoot: string,
): Promise<void> {
  const bundledPeers = new Set<string>();
  const serverSourceGlob = new Glob('dist/server/**/*.js');
  for await (const relativePath of serverSourceGlob.scan({ cwd: installedChatRoot })) {
    const bundledSource = await Bun.file(join(installedChatRoot, relativePath)).text();
    const source = bundledSource.replaceAll('\\', '/');
    for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
      if (source.includes(`/node_modules/${peer}/`)) bundledPeers.add(peer);
    }
  }
  if (bundledPeers.size > 0) {
    fail(
      `packed server artifact bundles declared peers: ${[...bundledPeers].toSorted().join(', ')}`,
    );
  }
}

async function linkPeer(
  peer: (typeof requiredPeers)[number],
  fixtureNodeModules: string,
): Promise<void> {
  const source =
    peer === '@lostgradient/cinder'
      ? join(workspaceRoot, 'packages', 'components')
      : join(workspaceRoot, 'node_modules', ...peer.split('/'));
  if (!existsSync(source)) fail(`workspace peer is unavailable: ${peer}`);

  const destination = join(fixtureNodeModules, ...peer.split('/'));
  await mkdir(dirname(destination), { recursive: true });
  await symlink(source, destination, process.platform === 'win32' ? 'junction' : 'dir');
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

  await mkdir(dirname(fixture.installedChatRoot), { recursive: true });
  await rename(extractedPackage, fixture.installedChatRoot);
  for (const peer of requiredPeers) await linkPeer(peer, fixture.nodeModules);

  return parsePackageManifest(
    await Bun.file(join(fixture.installedChatRoot, 'package.json')).text(),
  );
}

function barePackageName(specifier: string): string {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] ?? specifier);
}

async function assertImportClosure(
  manifest: PackageManifest,
  installedChatRoot: string,
): Promise<void> {
  const declaredPeers = new Set(Object.keys(manifest.peerDependencies ?? {}));
  const violations: string[] = [];
  const sourceGlob = new Glob('dist/**/*.{js,svelte,css}');
  for await (const relativePath of sourceGlob.scan({ cwd: installedChatRoot })) {
    const source = await Bun.file(join(installedChatRoot, relativePath)).text();
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
        if (!declaredPeers.has(barePackageName(specifier))) {
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
  await Bun.write(
    clientEntryPath,
    `import Chat, { ArtifactPanel } from '@lostgradient/chat';\n` +
      `import ChatComposerPopover from '@lostgradient/chat/composer-popover';\n` +
      `import ChatConversationHeader from '@lostgradient/chat/conversation-header';\n` +
      `import ChatConversationList from '@lostgradient/chat/conversation-list';\n` +
      `if (![Chat, ArtifactPanel, ChatComposerPopover, ChatConversationHeader, ChatConversationList].every(Boolean)) throw new Error('missing Chat export');\n`,
  );
  await Bun.write(
    serverEntryPath,
    `import { render } from 'svelte/server';\n` +
      `import Chat, { ArtifactPanel, createConversation } from '@lostgradient/chat';\n` +
      `if (!ArtifactPanel) throw new Error('missing ArtifactPanel export');\n` +
      `const rendered = render(Chat, { props: { id: 'consumer-chat', conversation: createConversation({ id: 'consumer-conversation' }) } });\n` +
      `if (!rendered.body.includes('chat-container')) throw new Error('Chat SSR output is missing its root');\n`,
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
    'artifact-panel',
    'packed client build',
  );
  const serverScopedCssToken = scopedCssTokenForClass(
    serverSource,
    'artifact-panel',
    'packed server build',
  );
  if (clientScopedCssToken !== serverScopedCssToken) {
    fail(
      `packed client/server scoped CSS identity differs for ArtifactPanel (${clientScopedCssToken} !== ${serverScopedCssToken})`,
    );
  }

  const typeEntryPath = join(fixture.root, 'type-consumer.ts');
  const tsconfigPath = join(fixture.root, 'tsconfig.json');
  await Bun.write(
    typeEntryPath,
    `import '@lostgradient/chat/styles';\n` +
      `import '@lostgradient/chat/composer-popover/styles';\n` +
      `import '@lostgradient/chat/conversation-header/styles';\n` +
      `import '@lostgradient/chat/conversation-list/styles';\n` +
      `import Chat from '@lostgradient/chat';\n` +
      `void Chat;\n`,
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
      `import Chat, { createConversation } from '@lostgradient/chat';\n` +
      `import ChatComposerPopover from '@lostgradient/chat/composer-popover';\n` +
      `import ChatConversationHeader from '@lostgradient/chat/conversation-header';\n` +
      `import ChatConversationList from '@lostgradient/chat/conversation-list';\n` +
      `if (process.release.name !== 'node') throw new Error('fixture is not running under Node');\n` +
      `if (![ChatComposerPopover, ChatConversationHeader, ChatConversationList].every(Boolean)) throw new Error('missing Node subpath export');\n` +
      `const rendered = render(Chat, { props: { id: 'node-chat', conversation: createConversation({ id: 'node-conversation' }) } });\n` +
      `if (!rendered.body.includes('chat-container')) throw new Error('plain Node SSR output is missing Chat');\n`,
  );
  await run(node, [entryPath], fixture.root);
}

export async function validateConsumer(): Promise<void> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'lostgradient-chat-consumer-'));
  const fixture: ValidationFixture = {
    root: fixtureRoot,
    extractedRoot: join(fixtureRoot, 'extracted'),
    nodeModules: join(fixtureRoot, 'node_modules'),
    installedChatRoot: join(fixtureRoot, 'node_modules', '@lostgradient', 'chat'),
  };
  try {
    process.stdout.write('[validate-consumer] building the Cinder peer server entries…\n');
    await run('bun', ['run', 'build'], join(workspaceRoot, 'packages', 'components'));
    process.stdout.write('[validate-consumer] building @lostgradient/chat…\n');
    await run('bun', ['run', 'build']);
    const { tarballPath } = await packForPublish();
    const packedManifest = await installPackedArtifact(tarballPath, fixture);
    assertPackedManifest(packedManifest);
    assertPackedExports(packedManifest, fixture.installedChatRoot);
    await assertPackedFileSet(fixture.installedChatRoot);
    await assertNoBundledPeerProvenance(packedManifest, fixture.installedChatRoot);
    await assertImportClosure(packedManifest, fixture.installedChatRoot);
    await buildConsumerEntries(fixture);
    await runPlainNodeConsumer(fixture);
    process.stdout.write(
      `[validate-consumer] OK — isolated peer-only artifact, import closure, client build, plugin SSR, and plain-Node SSR verified.\n`,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) await validateConsumer();
