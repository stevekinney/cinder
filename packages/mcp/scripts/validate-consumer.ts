/**
 * `@lostgradient/cinder-mcp` validate-consumer — the real acceptance gate for this
 * package. Proves the published artifact runs under plain Node, with Bun
 * removed from the child environment, using ONLY what npm installs from the
 * two packed tarballs (this package's own, plus `@lostgradient/cinder`'s) —
 * never the workspace source tree, never a registry-resolved Cinder.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Glob } from 'bun';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';

import { packForPublish, parsePackageManifest, type PackageManifest } from './pack-for-publish.ts';

const packageRoot = join(import.meta.dir, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const componentsRoot = join(workspaceRoot, 'packages', 'components');

function fail(message: string): never {
  throw new Error(`[validate-consumer] ${message}`);
}

async function run(command: string, arguments_: string[], cwd: string, env?: NodeJS.Dict<string>) {
  const child = Bun.spawn([command, ...arguments_], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: env ?? Bun.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    fail(
      `${command} ${arguments_.join(' ')} exited ${exitCode}\nstdout: ${stdout}\nstderr: ${stderr}`,
    );
  }
  return { stdout, stderr };
}

/** Build + pack `@lostgradient/cinder`'s own tarball via its existing staged packer. */
async function packCinderTarball(): Promise<string> {
  process.stdout.write('[validate-consumer] building @lostgradient/cinder…\n');
  await run('bun', ['run', '--filter=@lostgradient/cinder', 'build'], workspaceRoot);
  const { packForPublish: packCinder } = await import(
    join(componentsRoot, 'scripts', 'pack-for-publish.ts')
  );
  const { tarballPath } = await packCinder();
  return tarballPath as string;
}

/** Build + pack this package's own tarball. */
async function packMcpTarball(): Promise<string> {
  process.stdout.write('[validate-consumer] building @lostgradient/cinder-mcp…\n');
  await run('bun', ['run', 'build'], packageRoot);
  const { tarballPath } = await packForPublish();
  return tarballPath;
}

/** Find a real Node executable — never Bun's own `node` shim. Mirrors `packages/markdown`'s finder. */
function findRealNode(): string {
  const nodeFromPath = Bun.which('node');
  const candidates = new Set([
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    '/opt/local/bin/node',
    ...(process.env['PATH'] ?? '')
      .split(delimiter)
      .filter((directory) => directory.length > 0)
      .map((directory) => join(directory, 'node')),
    ...(nodeFromPath === null ? [] : [nodeFromPath]),
  ]);
  for (const candidate of candidates) {
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
  fail('a real Node executable is required for the packed consumer fixture');
}

/**
 * A child environment with every directory that contains a `bun` executable
 * removed from `PATH`, plus Bun's own env vars cleared. `npx --no-install
 * cinder-mcp` and the server it launches must never be able to resolve `bun`
 * — this is what proves the published package needs no Bun installation, not
 * just that it happens to avoid Bun APIs.
 */
function bunFreeEnv(nodeExecutable: string): Record<string, string> {
  const nodeDirectory = dirname(nodeExecutable);
  const filteredPath = (process.env['PATH'] ?? '')
    .split(delimiter)
    .filter((directory) => directory.length > 0 && !existsSync(join(directory, 'bun')))
    .filter((directory) => directory !== dirname(Bun.which('bun') ?? '\0'));
  const path = [nodeDirectory, ...filteredPath].join(delimiter);
  const env: Record<string, string> = { TZ: 'UTC', LANG: 'en_US.UTF-8', PATH: path };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'PATH' && key !== 'BUN_INSTALL') env[key] = value;
  }
  return env;
}

function assertBunUnresolvable(env: Record<string, string>, cwd: string): void {
  try {
    const probe = Bun.spawnSync(['bun', '--version'], { cwd, env, stdout: 'pipe', stderr: 'pipe' });
    // A shell would report "command not found" via a non-zero exit, but
    // Bun.spawnSync on a genuinely-missing binary throws ENOENT instead of
    // returning — see the catch below for that (expected) path.
    if (probe.exitCode === 0) fail('expected `bun` to be unresolvable in the consumer environment');
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT') throw error;
  }
}

async function assertPackedManifest(installedMcpRoot: string): Promise<PackageManifest> {
  const manifest = parsePackageManifest(
    await Bun.file(join(installedMcpRoot, 'package.json')).text(),
  );
  const serialized = JSON.stringify(manifest);
  if (serialized.includes('workspace:')) fail('installed manifest contains a workspace: range');
  if (manifest.devDependencies !== undefined) fail('installed manifest must omit devDependencies');
  if (manifest.scripts !== undefined) fail('installed manifest must omit scripts');
  if (!manifest.dependencies?.['@lostgradient/cinder']) {
    fail('installed manifest is missing the @lostgradient/cinder dependency');
  }
  if (!manifest.dependencies?.['zod']) fail('installed manifest is missing the zod dependency');
  if (!manifest.dependencies?.['@modelcontextprotocol/sdk']) {
    fail('installed manifest is missing the @modelcontextprotocol/sdk dependency');
  }
  if (!manifest.engines?.['node']) fail('installed manifest is missing engines.node');
  if (manifest.engines?.['bun'] !== undefined)
    fail('installed manifest must not declare engines.bun');
  const binTarget = manifest.bin?.['cinder-mcp'];
  if (!binTarget) fail('installed manifest is missing bin.cinder-mcp');
  if (!existsSync(join(installedMcpRoot, binTarget.replace(/^\.\//, '')))) {
    fail(`bin.cinder-mcp points at a missing file: ${binTarget}`);
  }
  return manifest;
}

async function assertNoDevArtifacts(installedMcpRoot: string): Promise<void> {
  const offenders: string[] = [];
  for await (const relativePath of new Glob('**/*').scan({ cwd: installedMcpRoot })) {
    const normalized = relativePath.replaceAll('\\', '/');
    const fileName = normalized.split('/').at(-1) ?? normalized;
    if (
      /\.(?:test|spec)\.[^/]+$/u.test(fileName) ||
      /(?:^|[-.])fixtures?(?:[-.]|$)/u.test(fileName) ||
      normalized.includes('/scripts/') ||
      normalized.endsWith('.map')
    ) {
      offenders.push(normalized);
    }
  }
  if (offenders.length > 0) {
    fail(
      `packed artifact contains test, fixture, script, or source-map files:\n  ${offenders.join('\n  ')}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textContent(result: unknown): string {
  if (!isRecord(result) || !Array.isArray(result['content'])) return '';
  const item = result['content'].find(
    (entry): entry is { type: 'text'; text: string } =>
      isRecord(entry) && entry['type'] === 'text' && typeof entry['text'] === 'string',
  );
  return item?.text ?? '';
}

async function readResourceError(client: Client, uri: string): Promise<McpError> {
  try {
    await client.readResource({ uri });
  } catch (error: unknown) {
    if (error instanceof McpError) return error;
    throw error;
  }
  throw new Error(`Expected ${uri} to fail.`);
}

/**
 * The full MCP handshake, launched exactly the way the README tells
 * consumers to launch it: `npx --no-install cinder-mcp`, resolved from the
 * fixture's own `node_modules/.bin`, under a Bun-free Node environment.
 */
async function runMcpHandshake(fixtureRoot: string, env: Record<string, string>): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['--no-install', 'cinder-mcp'],
    cwd: fixtureRoot,
    env,
    stderr: 'pipe',
  });
  const stderrChunks: string[] = [];
  transport.stderr?.on('data', (chunk) => stderrChunks.push(String(chunk)));

  const client = new Client({ name: 'cinder-mcp-consumer-smoke', version: '0.0.0' });
  await client.connect(transport);

  try {
    const serverVersion = client.getServerVersion();
    if (serverVersion?.name !== 'cinder') fail(`unexpected server name: ${serverVersion?.name}`);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name).toSorted();
    const expectedTools = [
      'compare_components',
      'get_best_practices',
      'get_component',
      'search_components',
    ];
    if (JSON.stringify(toolNames) !== JSON.stringify(expectedTools)) {
      fail(`unexpected tool list: ${JSON.stringify(toolNames)}`);
    }

    const resources = await client.listResources();
    const resourceUris = resources.resources.map((resource) => resource.uri);
    if (!resourceUris.includes('cinder://manifest')) fail('missing cinder://manifest resource');

    const resourceTemplates = await client.listResourceTemplates();
    const templateUris = resourceTemplates.resourceTemplates.map(
      (template) => template.uriTemplate,
    );
    for (const suffix of ['schema', 'variables', 'examples', 'constraints']) {
      if (!templateUris.includes(`cinder://component/{id}/${suffix}`)) {
        fail(`missing cinder://component/{id}/${suffix} resource template`);
      }
    }

    const prompts = await client.listPrompts();
    const promptNames = prompts.prompts.map((prompt) => prompt.name).toSorted();
    if (
      JSON.stringify(promptNames) !==
      JSON.stringify(['choose_cinder_component', 'review_cinder_usage'])
    ) {
      fail(`unexpected prompt list: ${JSON.stringify(promptNames)}`);
    }

    const search = await client.callTool({
      name: 'search_components',
      arguments: { query: 'button', limit: 5 },
    });
    if (!textContent(search).includes('"id": "button"'))
      fail('search_components did not find button');

    const component = await client.readResource({ uri: 'cinder://component/button' });
    const firstComponent = component.contents[0];
    const text = firstComponent && 'text' in firstComponent ? firstComponent.text : '';
    if (!text.includes('"id": "button"')) fail('cinder://component/button did not resolve');

    const missingComponent = await readResourceError(client, 'cinder://component/buton');
    if (missingComponent.code !== ErrorCode.InvalidParams)
      fail('missing-component error code mismatch');

    const missingArtifact = await readResourceError(
      client,
      'cinder://component/access-gate/constraints',
    );
    if (missingArtifact.code !== ErrorCode.InvalidParams)
      fail('missing-artifact error code mismatch');
  } finally {
    await client.close();
  }

  const stderrText = stderrChunks.join('').trim();
  if (stderrText.length > 0) fail(`consumer server wrote to stderr:\n${stderrText}`);
}

export async function validateConsumer(): Promise<void> {
  const cinderTarballPath = await packCinderTarball();
  const mcpTarballPath = await packMcpTarball();

  const fixtureRoot = await mkdtemp(join(tmpdir(), 'lostgradient-cinder-mcp-consumer-'));
  try {
    process.stdout.write('[validate-consumer] writing minimal consumer manifest…\n');
    await mkdir(fixtureRoot, { recursive: true });
    await Bun.write(
      join(fixtureRoot, 'package.json'),
      `${JSON.stringify(
        {
          name: 'cinder-mcp-consumer-smoke',
          private: true,
          version: '0.0.0',
          dependencies: {
            '@lostgradient/cinder-mcp': `file:${mcpTarballPath}`,
          },
          // Forces npm to resolve @lostgradient/cinder-mcp's own `^<version>` dependency
          // to THIS staged tarball instead of the public registry — the plan's
          // required failure signal is npm silently substituting a registry
          // Cinder for the one we just built.
          overrides: {
            '@lostgradient/cinder': `file:${cinderTarballPath}`,
          },
        },
        null,
        2,
      )}\n`,
    );

    process.stdout.write('[validate-consumer] npm install --ignore-scripts…\n');
    await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], fixtureRoot, {
      ...Bun.env,
      PATH: process.env['PATH'] ?? '',
    });

    const installedMcpRoot = join(fixtureRoot, 'node_modules', '@lostgradient', 'cinder-mcp');
    if (!existsSync(installedMcpRoot)) fail('@lostgradient/cinder-mcp did not install');
    const installedCinderRoot = join(fixtureRoot, 'node_modules', '@lostgradient', 'cinder');
    if (!existsSync(installedCinderRoot))
      fail('@lostgradient/cinder did not install (override failed)');

    await assertPackedManifest(installedMcpRoot);
    await assertNoDevArtifacts(installedMcpRoot);

    const node = findRealNode();
    const env = bunFreeEnv(node);
    assertBunUnresolvable(env, fixtureRoot);

    process.stdout.write(
      '[validate-consumer] npx --no-install cinder-mcp handshake (Bun-free Node)…\n',
    );
    await runMcpHandshake(fixtureRoot, env);

    process.stdout.write(
      '[validate-consumer] OK — packed @lostgradient/cinder-mcp + @lostgradient/cinder tarballs, ' +
        'installed by npm with no direct zod/SDK/Bun dependency, served a full MCP handshake under ' +
        'plain Node with Bun unresolvable.\n',
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) await validateConsumer();
