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
const requiredPeers = ['@lostgradient/cinder', 'svelte'] as const;
// Chat's own conversation-model dependencies — the fixture symlinks these
// into the *installed chat package's own* node_modules, simulating what a
// package manager does automatically for a regular `dependencies` entry
// (nested resolution), never into the fixture's top-level node_modules. A
// host app never provides these.
const requiredOwnDependencies = ['conversationalist', 'zod'] as const;

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
  // assertSourceManifest enforces the exact `dependencies` contract
  // (conversationalist + zod) and the exact peer set.
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

/**
 * Neither host-supplied peers nor Chat-owned dependencies should ever be
 * inlined into the published server bundle — both resolve from
 * `node_modules` at install time instead.
 */
async function assertNoBundledRuntimeProvenance(
  manifest: PackageManifest,
  installedChatRoot: string,
): Promise<void> {
  const bundledSpecifiers = new Set<string>();
  const serverSourceGlob = new Glob('dist/server/**/*.js');
  const runtimeSpecifiers = [
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.dependencies ?? {}),
  ];
  for await (const relativePath of serverSourceGlob.scan({ cwd: installedChatRoot })) {
    const bundledSource = await Bun.file(join(installedChatRoot, relativePath)).text();
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
 * Links a Chat-owned dependency into the *installed chat package's own*
 * node_modules — never the fixture's top-level node_modules. This is what
 * proves the fix: a host app that never installed `conversationalist` or
 * `zod` itself can still resolve them, because they arrive nested under
 * `@lostgradient/chat` the way a package manager installs any other regular
 * `dependencies` entry.
 */
async function linkOwnDependency(
  dependency: (typeof requiredOwnDependencies)[number],
  installedChatRoot: string,
): Promise<void> {
  await linkModule(dependency, join(installedChatRoot, 'node_modules'));
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

  await mkdir(dirname(fixture.installedChatRoot), { recursive: true });
  await rename(extractedPackage, fixture.installedChatRoot);

  return parsePackageManifest(
    await Bun.file(join(fixture.installedChatRoot, 'package.json')).text(),
  );
}

/** Links the fixture's simulated install graph: host peers at the top level, Chat's own dependencies nested under it. */
async function linkFixtureDependencyGraph(fixture: ValidationFixture): Promise<void> {
  for (const peer of requiredPeers) await linkPeer(peer, fixture.nodeModules);
  for (const dependency of requiredOwnDependencies) {
    await linkOwnDependency(dependency, fixture.installedChatRoot);
  }
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
  const declaredRuntimeSpecifiers = new Set([
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.dependencies ?? {}),
  ]);
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
      `import Chat, { appendAssistantMessage, appendUserMessage, createConversation, getMessageText, isJSONValue } from '@lostgradient/chat';\n` +
      `import type { ChatSubmitEvent, ConversationHistory, MultiModalContent } from '@lostgradient/chat';\n` +
      `const userContent: MultiModalContent = { type: 'text', text: 'Hello' };\n` +
      `const assistantContent: MultiModalContent = { type: 'text', text: 'Hi there' };\n` +
      `const conversation: ConversationHistory = appendAssistantMessage(\n` +
      `  appendUserMessage(createConversation({ id: 'gateway-import-surface' }), [userContent]),\n` +
      `  [assistantContent],\n` +
      `);\n` +
      `const submitEvent: ChatSubmitEvent = { message: { role: 'user', content: 'Follow up' }, attachments: [] };\n` +
      `const firstMessage = conversation.messages[conversation.ids[0] ?? ''];\n` +
      `if (firstMessage === undefined) throw new Error('expected a first conversation message');\n` +
      `if (!isJSONValue(conversation.metadata)) throw new Error('expected conversation metadata to be a JSON value');\n` +
      `void [Chat, conversation, getMessageText(firstMessage), submitEvent];\n`,
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
  // Regression guard for #772/#786: `svelte-check` against a *packed,
  // installed* @lostgradient/chat (not `bun link`, not a raw .svelte source
  // import) is the only place the symptom reproduces — a package-local
  // typecheck never sees it, because svelte-package's dts emission can differ
  // in subtle ways from the source it was generated from. This step exercises
  // `bind:atBottom` / `bind:unreadCount` / `bind:newMessageIndicatorVisible`
  // on the public `Chat` export exactly as a consumer would.
  const svelteCheckSourceRoot = join(fixture.root, 'svelte-check-src');
  await mkdir(svelteCheckSourceRoot, { recursive: true });
  await Bun.write(
    join(svelteCheckSourceRoot, 'App.svelte'),
    `<script lang="ts">\n` +
      `  import { Chat, createConversation } from '@lostgradient/chat';\n` +
      `  let atBottom = $state(true);\n` +
      `  let unreadCount = $state(0);\n` +
      `  let newMessageIndicatorVisible = $state(false);\n` +
      `  const conversation = createConversation({ id: 'svelte-check-consumer' });\n` +
      `</script>\n\n` +
      `<Chat\n` +
      `  id="svelte-check-consumer"\n` +
      `  {conversation}\n` +
      `  bind:atBottom\n` +
      `  bind:unreadCount\n` +
      `  bind:newMessageIndicatorVisible\n` +
      `/>\n`,
  );
  await Bun.write(join(fixture.root, 'svelte.config.js'), `export default {};\n`);
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
        include: ['svelte-check-src'],
      },
      null,
      2,
    )}\n`,
  );

  const typescriptRoot = join(workspaceRoot, 'node_modules', 'typescript');
  const svelteCheckRoot = join(workspaceRoot, 'node_modules', 'svelte-check');
  if (!existsSync(typescriptRoot)) fail('workspace peer is unavailable: typescript');
  if (!existsSync(svelteCheckRoot)) fail('workspace peer is unavailable: svelte-check');
  await mkdir(join(fixture.nodeModules, '.bin'), { recursive: true });
  // Explicit link type, matching `linkModule` above: on Windows a directory
  // symlink without 'junction' needs elevated permissions and fails outright.
  const directoryLinkType = process.platform === 'win32' ? 'junction' : 'dir';
  await symlink(typescriptRoot, join(fixture.nodeModules, 'typescript'), directoryLinkType);
  await symlink(svelteCheckRoot, join(fixture.nodeModules, 'svelte-check'), directoryLinkType);
  // The .bin entry is a FILE, so it takes the default type rather than 'dir'.
  await symlink(
    join(workspaceRoot, 'node_modules', '.bin', 'svelte-check'),
    join(fixture.nodeModules, '.bin', 'svelte-check'),
  );

  const svelteCheck = join(fixture.nodeModules, '.bin', 'svelte-check');
  await run(svelteCheck, ['--tsconfig', svelteCheckTsconfigPath], fixture.root);
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

  const browserConditionEntryPath = join(fixture.root, 'browser-condition-consumer.mjs');
  await Bun.write(
    browserConditionEntryPath,
    `const expected = new Map([\n` +
      `  ['@lostgradient/chat', '/node_modules/@lostgradient/chat/dist/index.js'],\n` +
      `  ['@lostgradient/chat/composer-popover', '/node_modules/@lostgradient/chat/dist/components/chat-composer-popover/index.js'],\n` +
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
    const packedManifest = await extractPackedArtifact(tarballPath, fixture);
    assertPackedManifest(packedManifest);
    assertPackedExports(packedManifest, fixture.installedChatRoot);
    await assertPackedFileSet(fixture.installedChatRoot);
    await assertNoBundledRuntimeProvenance(packedManifest, fixture.installedChatRoot);
    await assertImportClosure(packedManifest, fixture.installedChatRoot);
    await linkFixtureDependencyGraph(fixture);
    await buildConsumerEntries(fixture);
    await runPlainNodeConsumer(fixture);
    process.stdout.write('[validate-consumer] running svelte-check against the packed artifact…\n');
    await runSvelteCheckConsumer(fixture);
    process.stdout.write(
      `[validate-consumer] OK — isolated artifact, import closure, client build, plugin SSR, plain-Node SSR, and svelte-check bind: forwarding verified without a host-installed conversationalist/zod.\n`,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) await validateConsumer();
