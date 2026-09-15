import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

export type ArtifactTreeEntry = {
  path: string;
  type: 'file' | 'directory';
  mode: number;
  bytes?: number;
  sha256?: string;
};

export type ArtifactTreeManifest = {
  schemaVersion: 1;
  sourceSha?: string;
  artifactDigest?: string;
  entries: ArtifactTreeEntry[];
};

async function entriesUnder(root: string, current = root): Promise<ArtifactTreeEntry[]> {
  const result: ArtifactTreeEntry[] = [];
  const children = await readdir(current, { withFileTypes: true });
  for (const item of children.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const path = join(current, item.name);
    const relativePath = relative(root, path).split(sep).join('/');
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink())
      throw new Error(`[static-playground] archive tree cannot contain symlink: ${relativePath}`);
    if (metadata.isDirectory()) {
      result.push({
        path: relativePath,
        type: 'directory',
        mode: metadata.mode & 0o7777,
      });
      result.push(...(await entriesUnder(root, path)));
      continue;
    }
    if (!metadata.isFile())
      throw new Error(
        `[static-playground] archive tree contains unsupported entry: ${relativePath}`,
      );
    const bytes = await readFile(path);
    result.push({
      path: relativePath,
      type: 'file',
      mode: metadata.mode & 0o7777,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return result;
}

export async function createArtifactTreeManifest(root: string): Promise<ArtifactTreeManifest> {
  const resolved = resolve(root);
  const report = await Bun.file(join(resolved, 'static-playground-report.json'))
    .json()
    .catch(() => undefined);
  const identity =
    report && typeof report === 'object' && report !== null
      ? {
          ...(typeof report['sourceSha'] === 'string' ? { sourceSha: report['sourceSha'] } : {}),
          ...(typeof report['artifactDigest'] === 'string'
            ? { artifactDigest: report['artifactDigest'] }
            : {}),
        }
      : {};
  return { schemaVersion: 1, ...identity, entries: await entriesUnder(resolved) };
}

export async function verifyArtifactTree(root: string, value: unknown, prefix = ''): Promise<void> {
  if (!isArtifactTreeManifest(value))
    throw new Error('[static-playground] artifact tree manifest is invalid');
  const expected = value;
  if (
    prefix &&
    !expected.entries.some((entry) => entry.path === prefix && entry.type === 'directory')
  )
    throw new Error('[static-playground] artifact tree prefix is not a producer directory');
  const actual = await createArtifactTreeManifest(root);
  actual.entries = actual.entries.filter((entry) => entry.path !== 'artifact-tree-manifest.json');
  const normalizedExpected = prefix
    ? {
        schemaVersion: 1 as const,
        entries: expected.entries
          .filter((entry) => entry.path.startsWith(`${prefix}/`))
          .map((entry) => ({ ...entry, path: entry.path.slice(prefix.length + 1) })),
      }
    : expected;
  if (JSON.stringify(actual) !== JSON.stringify(normalizedExpected))
    throw new Error('[static-playground] extracted artifact tree identity does not match producer');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArtifactTreeEntry(value: unknown): value is ArtifactTreeEntry {
  if (
    !isRecord(value) ||
    typeof value['path'] !== 'string' ||
    value['path'].length === 0 ||
    typeof value['mode'] !== 'number' ||
    !Number.isInteger(value['mode']) ||
    value['mode'] < 0 ||
    value['mode'] > 0o7777
  )
    return false;
  if (value['type'] === 'directory')
    return value['bytes'] === undefined && value['sha256'] === undefined;
  return (
    value['type'] === 'file' &&
    typeof value['bytes'] === 'number' &&
    Number.isSafeInteger(value['bytes']) &&
    value['bytes'] >= 0 &&
    typeof value['sha256'] === 'string' &&
    /^[a-f0-9]{64}$/.test(value['sha256'])
  );
}

function isArtifactTreeManifest(value: unknown): value is ArtifactTreeManifest {
  return (
    isRecord(value) &&
    value['schemaVersion'] === 1 &&
    Array.isArray(value['entries']) &&
    value['entries'].every(isArtifactTreeEntry) &&
    (value['sourceSha'] === undefined ||
      (typeof value['sourceSha'] === 'string' && /^[a-f0-9]{40}$/.test(value['sourceSha']))) &&
    (value['artifactDigest'] === undefined ||
      (typeof value['artifactDigest'] === 'string' &&
        /^[a-f0-9]{64}$/.test(value['artifactDigest'])))
  );
}

async function main(): Promise<void> {
  const { values, tokens } = parseArgs({
    args: process.argv.slice(2),
    strict: true,
    allowPositionals: false,
    tokens: true,
    options: {
      root: { type: 'string' },
      manifest: { type: 'string' },
      prefix: { type: 'string' },
      write: { type: 'boolean' },
      verify: { type: 'boolean' },
    },
  });
  const flags = tokens.filter((token) => token.kind === 'option');
  if (new Set(flags.map((token) => token.name)).size !== flags.length)
    throw new Error('[static-playground] duplicate artifact tree flag');
  const { root, manifest: manifestPath, prefix = '' } = values;
  if (
    !root ||
    !manifestPath ||
    Boolean(values.write) === Boolean(values.verify) ||
    (values.write && values.prefix !== undefined)
  )
    throw new Error(
      'usage: playground-artifact-tree.ts --write|--verify --root <root> --manifest <path> [--prefix <directory>]',
    );
  if (values.write) {
    await Bun.write(
      manifestPath,
      `${JSON.stringify(await createArtifactTreeManifest(root), null, 2)}\n`,
    );
    return;
  }
  await verifyArtifactTree(root, await Bun.file(manifestPath).json(), prefix);
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
