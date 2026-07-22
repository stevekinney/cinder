import { Glob } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

type ConditionalExport = {
  types?: string;
  browser?: string;
  node?: string;
  svelte?: string;
  import?: string;
  default?: string;
};

export type PackageManifest = {
  name: string;
  version: string;
  files?: string[];
  exports: Record<string, string | ConditionalExport>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
};

const PACKAGE_ROOT = join(import.meta.dir, '..');
const STAGING_ROOT = join(PACKAGE_ROOT, 'node_modules', '.cache', 'publish-staging');
// Every runtime need — Cinder, Markdown, Svelte, and the milkdown/prosemirror
// stack — is a host-supplied singleton: a consuming app must control which
// single copy of each renders, so all of them are peers. Unlike Chat (which
// owns `conversationalist`/`zod` as regular dependencies), Editor has no
// implementation-detail dependency of its own to bundle.
const REQUIRED_PEERS = new Set([
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
]);
const REQUIRED_DEPENDENCIES: Record<string, string> = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isConditionalExport(value: unknown): value is ConditionalExport {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => entry === undefined || typeof entry === 'string')
  );
}

function isPackageManifest(parsed: unknown): parsed is PackageManifest {
  if (
    !isRecord(parsed) ||
    typeof parsed['name'] !== 'string' ||
    typeof parsed['version'] !== 'string' ||
    !isRecord(parsed['exports']) ||
    !Object.values(parsed['exports']).every(
      (entry) => typeof entry === 'string' || isConditionalExport(entry),
    )
  ) {
    return false;
  }
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
    'scripts',
  ]) {
    const value = parsed[field];
    if (value !== undefined && !isStringRecord(value)) return false;
  }
  return true;
}

export function parsePackageManifest(source: string): PackageManifest {
  const parsed: unknown = JSON.parse(source);
  if (!isPackageManifest(parsed)) {
    throw new Error('package.json must define valid identity, exports, and dependency records');
  }
  return parsed;
}

async function fileHash(path: string): Promise<string> {
  const bytes = await Bun.file(path).bytes();
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

function tarballFileName(manifest: Pick<PackageManifest, 'name' | 'version'>): string {
  return `${manifest.name.replace(/^@/, '').replaceAll('/', '-')}-${manifest.version}.tgz`;
}

export function assertSourceManifest(manifest: PackageManifest): void {
  const dependencies = manifest.dependencies ?? {};
  const dependencyMismatch =
    Object.keys(dependencies).length !== Object.keys(REQUIRED_DEPENDENCIES).length ||
    Object.entries(REQUIRED_DEPENDENCIES).some(([name, range]) => dependencies[name] !== range);
  if (dependencyMismatch) {
    throw new Error(
      `production dependency contract mismatch (expected exactly ${JSON.stringify(REQUIRED_DEPENDENCIES)}, got ${JSON.stringify(dependencies)})`,
    );
  }
  const peers = new Set(Object.keys(manifest.peerDependencies ?? {}));
  const missing = [...REQUIRED_PEERS].filter((peer) => !peers.has(peer));
  const unexpected = [...peers].filter((peer) => !REQUIRED_PEERS.has(peer));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `peer dependency contract mismatch (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'})`,
    );
  }
}

/**
 * Keep every runtime import external in generated server bundles, including
 * subpath imports — both host-supplied peers (`@lostgradient/cinder`,
 * `svelte`) and Chat-owned dependencies (`conversationalist`, `zod`). Neither
 * category should be inlined into the published dist; both resolve from
 * `node_modules` at install time.
 */
export function runtimeExternalSpecifiers(
  manifest: Pick<PackageManifest, 'peerDependencies' | 'dependencies'>,
): string[] {
  const names = [
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.dependencies ?? {}),
  ];
  return names.flatMap((name) => [name, `${name}/*`]);
}

function publishedExport(entry: string | ConditionalExport): string | ConditionalExport {
  if (typeof entry === 'string') return entry;
  const published: ConditionalExport = {};
  const publishedClientTarget = entry.default;
  if (entry.types !== undefined) published.types = entry.types;
  if (publishedClientTarget !== undefined) {
    if (entry.browser !== undefined) published.browser = publishedClientTarget;
    if (entry.node !== undefined) published.node = entry.node;
    if (entry.svelte !== undefined) published.svelte = publishedClientTarget;
    if (entry.import !== undefined) published.import = publishedClientTarget;
    published.default = publishedClientTarget;
  } else if (entry.node !== undefined) {
    published.node = entry.node;
  }
  return published;
}

export function buildPublishedManifest(source: PackageManifest): PackageManifest {
  const published: PackageManifest = {
    ...source,
    exports: Object.fromEntries(
      Object.entries(source.exports).map(([key, entry]) => [key, publishedExport(entry)]),
    ),
    files: [
      'dist',
      '!dist/**/*.test.*',
      '!dist/**/*.spec.*',
      '!dist/**/*.fixture.*',
      '!dist/**/*-fixture.*',
      '!dist/**/*-fixtures.*',
      '!dist/**/test/**',
      '!dist/**/*.map',
      'components.json',
      'README.md',
    ],
  };

  // `dependencies` is retained: it is how npm/bun install conversationalist
  // and zod for a host application without that host declaring them itself.
  delete published.devDependencies;
  delete published.optionalDependencies;
  delete published.scripts;

  const serialized = JSON.stringify(published);
  if (serialized.includes('workspace:')) throw new Error('published manifest contains workspace:');
  if (serialized.includes('./src/')) throw new Error('published exports contain source paths');
  return published;
}

async function copyIntoStaging(relativePath: string): Promise<void> {
  const source = join(PACKAGE_ROOT, relativePath);
  if (!existsSync(source)) return;
  const destination = join(STAGING_ROOT, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  if (statSync(source).isDirectory()) {
    await cp(source, destination, { recursive: true });
  } else {
    await cp(source, destination);
  }
}

async function stageFiles(manifest: PackageManifest): Promise<void> {
  await rm(STAGING_ROOT, { recursive: true, force: true });
  await mkdir(STAGING_ROOT, { recursive: true });

  for (const pattern of manifest.files ?? []) {
    if (pattern.startsWith('!')) continue;
    if (pattern.includes('*')) {
      for await (const relativePath of new Glob(pattern).scan({ cwd: PACKAGE_ROOT })) {
        await copyIntoStaging(relativePath);
      }
    } else {
      await copyIntoStaging(pattern);
    }
  }

  for (const pattern of (manifest.files ?? []).filter((entry) => entry.startsWith('!'))) {
    for await (const relativePath of new Glob(pattern.slice(1)).scan({ cwd: STAGING_ROOT })) {
      await rm(join(STAGING_ROOT, relativePath), { recursive: true, force: true });
    }
  }
}

export function exportTargets(entry: string | ConditionalExport): string[] {
  return typeof entry === 'string'
    ? [entry]
    : Object.values(entry).filter((value): value is string => value !== undefined);
}

function assertStagedExports(manifest: PackageManifest): void {
  for (const [subpath, entry] of Object.entries(manifest.exports)) {
    for (const target of exportTargets(entry)) {
      if (!target.startsWith('./')) continue;
      const path = join(STAGING_ROOT, target.slice(2));
      if (!existsSync(path))
        throw new Error(`${subpath} points at missing staged target ${target}`);
    }
  }
}

export type PackForPublishResult = {
  tarballPath: string;
  stagingDirectory: string;
};

export async function packForPublish(): Promise<PackForPublishResult> {
  const sourceManifestPath = join(PACKAGE_ROOT, 'package.json');
  const sourceHashBefore = await fileHash(sourceManifestPath);
  const source = parsePackageManifest(await Bun.file(sourceManifestPath).text());
  assertSourceManifest(source);

  if (!existsSync(join(PACKAGE_ROOT, 'dist', 'index.js'))) {
    throw new Error('dist is missing; run `bun run build` before `bun run pack:publish`');
  }

  const published = buildPublishedManifest(source);
  await stageFiles(published);
  await Bun.write(join(STAGING_ROOT, 'package.json'), `${JSON.stringify(published, null, 2)}\n`);
  assertStagedExports(published);

  const tarballPath = join(PACKAGE_ROOT, tarballFileName(source));
  await rm(tarballPath, { force: true });
  const result = Bun.spawnSync(['bun', 'pm', 'pack', '--destination', PACKAGE_ROOT], {
    cwd: STAGING_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error(`bun pm pack failed: ${result.stderr.toString()}`);
  if (!existsSync(tarballPath)) throw new Error(`expected tarball at ${tarballPath}`);

  const sourceHashAfter = await fileHash(sourceManifestPath);
  if (sourceHashBefore !== sourceHashAfter) {
    throw new Error('pack-for-publish mutated the source package.json');
  }

  return { tarballPath, stagingDirectory: STAGING_ROOT };
}

if (import.meta.main) {
  const { tarballPath } = await packForPublish();
  process.stdout.write(`pack-for-publish — emitted ${tarballPath}\n`);
}
