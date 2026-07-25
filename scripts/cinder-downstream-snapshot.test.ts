import { expect, test } from 'bun:test';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('snapshot input is deterministic and sorted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-'));
  await Bun.write(join(root, 'z.txt'), 'z');
  await Bun.write(join(root, 'a.txt'), 'a');
  const request = join(root, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({ schemaVersion: 1, repositories: [{ name: 'repo', path: root }] }),
  );
  const first = Bun.spawnSync([
    'bun',
    'run',
    'scripts/cinder-downstream-snapshot.ts',
    '--request',
    request,
  ]).stdout.toString();
  const second = Bun.spawnSync([
    'bun',
    'run',
    'scripts/cinder-downstream-snapshot.ts',
    '--request',
    request,
  ]).stdout.toString();
  const normalize = (value: string) =>
    JSON.stringify({ ...JSON.parse(value), collectedAt: 'stable' });
  expect(normalize(first)).toBe(normalize(second));
});

test('help prints usage without requiring a request', () => {
  const result = Bun.spawnSync(['bun', 'run', 'scripts/cinder-downstream-snapshot.ts', '--help']);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('Usage:');
});

test('partial repository failures stay in the snapshot', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-error-'));
  const request = join(root, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'missing', path: join(root, 'missing') }],
    }),
  );
  const result = Bun.spawnSync([
    'bun',
    'run',
    'scripts/cinder-downstream-snapshot.ts',
    '--request',
    request,
  ]);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString()).errors[0].scope).toBe('repository:missing');
});

test('hashes binary bytes and rejects malformed options', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-bytes-'));
  await Bun.write(join(root, 'binary.bin'), new Uint8Array([0, 255, 128]));
  const request = join(root, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({ schemaVersion: 1, repositories: [{ name: 'repo', path: root }] }),
  );
  const result = Bun.spawnSync([
    'bun',
    'run',
    'scripts/cinder-downstream-snapshot.ts',
    '--request',
    request,
  ]);
  const file = JSON.parse(result.stdout.toString()).repositories[0].files.find(
    (entry: { path: string }) => entry.path === 'binary.bin',
  );
  expect(file.bytes).toBe(3);
  expect(
    Bun.spawnSync(['bun', 'run', 'scripts/cinder-downstream-snapshot.ts', '--wat']).exitCode,
  ).not.toBe(0);
});

test('keeps scans inside the repository and excludes Git internals', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'cinder-snapshot-boundary-'));
  const root = join(parent, 'repository');
  await mkdir(join(root, '.git'), { recursive: true });
  await mkdir(join(root, 'nested', '.git'), { recursive: true });
  await Bun.write(join(root, 'inside.txt'), 'cinder inside');
  await Bun.write(join(root, '.git', 'index'), 'cinder git internals');
  await Bun.write(join(root, 'nested', '.git', 'HEAD'), 'ref: refs/heads/main');
  await Bun.write(join(root, 'nested', 'tracked.txt'), 'cinder nested checkout');
  await Bun.write(join(parent, 'outside.txt'), 'cinder outside');

  const defaultRequest = join(parent, 'default-request.json');
  await Bun.write(
    defaultRequest,
    JSON.stringify({ schemaVersion: 1, repositories: [{ name: 'repo', path: root }] }),
  );
  const defaultSnapshot = JSON.parse(
    Bun.spawnSync([
      'bun',
      'run',
      'scripts/cinder-downstream-snapshot.ts',
      '--request',
      defaultRequest,
    ]).stdout.toString(),
  );
  expect(defaultSnapshot.repositories[0].files.map((file: { path: string }) => file.path)).toEqual([
    'inside.txt',
  ]);

  const escapingRequest = join(parent, 'escaping-request.json');
  await Bun.write(
    escapingRequest,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'repo', path: root, globs: ['../outside.txt'] }],
    }),
  );
  const escapingSnapshot = JSON.parse(
    Bun.spawnSync([
      'bun',
      'run',
      'scripts/cinder-downstream-snapshot.ts',
      '--request',
      escapingRequest,
    ]).stdout.toString(),
  );
  expect(escapingSnapshot.repositories).toEqual([]);
  expect(escapingSnapshot.errors[0].message).toContain('escapes repository root');
});

test('requires the requested branch and commit to match checkout HEAD', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-revision-'));
  Bun.spawnSync(['git', '-C', root, 'init', '-b', 'main']);
  Bun.spawnSync(['git', '-C', root, 'config', 'user.email', 'test@example.com']);
  Bun.spawnSync(['git', '-C', root, 'config', 'user.name', 'Snapshot Test']);
  await Bun.write(join(root, 'tracked.txt'), 'main');
  Bun.spawnSync(['git', '-C', root, 'add', 'tracked.txt']);
  Bun.spawnSync(['git', '-C', root, 'commit', '-m', 'main']);
  const mainCommit = Bun.spawnSync(['git', '-C', root, 'rev-parse', 'HEAD'])
    .stdout.toString()
    .trim();
  Bun.spawnSync(['git', '-C', root, 'switch', '-c', 'topic']);
  await Bun.write(join(root, 'tracked.txt'), 'topic');
  Bun.spawnSync(['git', '-C', root, 'commit', '-am', 'topic']);

  const request = join(root, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'repo', path: root, branch: 'main', commit: mainCommit }],
    }),
  );
  const snapshot = JSON.parse(
    Bun.spawnSync([
      'bun',
      'run',
      'scripts/cinder-downstream-snapshot.ts',
      '--request',
      request,
    ]).stdout.toString(),
  );
  expect(snapshot.repositories).toEqual([]);
  expect(snapshot.errors[0].message).toContain('does not match checkout HEAD');
});

test('matches evidence case-insensitively without decoding unrelated binary files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-evidence-'));
  await Bun.write(
    join(root, 'source.ts'),
    'const CINDER_API_URL = "example";\nCINDER_API_TOKEN=super-secret\n',
  );
  await Bun.write(join(root, 'binary.bin'), new Uint8Array([0, 255, 128]));
  const request = join(root, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        {
          name: 'repo',
          path: root,
          evidence: { missing: ['**/*.missing'], source: ['**/*.ts'] },
        },
      ],
    }),
  );
  const snapshot = JSON.parse(
    Bun.spawnSync([
      'bun',
      'run',
      'scripts/cinder-downstream-snapshot.ts',
      '--request',
      request,
    ]).stdout.toString(),
  );
  expect(snapshot.repositories[0].evidence.source).toEqual([
    { path: 'source.ts', line: 1, text: 'const CINDER_API_URL = "example";' },
    { path: 'source.ts', line: 2, text: 'CINDER_API_TOKEN=[REDACTED]' },
  ]);
  expect(snapshot.repositories[0].evidence.missing).toEqual([]);
  expect(
    snapshot.repositories[0].files.find((file: { path: string }) => file.path === 'binary.bin')
      .bytes,
  ).toBe(3);
});

test('records Git links without scanning nested checkout contents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-gitlink-'));
  Bun.spawnSync(['git', '-C', root, 'init', '-b', 'main']);
  Bun.spawnSync(['git', '-C', root, 'config', 'user.email', 'test@example.com']);
  Bun.spawnSync(['git', '-C', root, 'config', 'user.name', 'Snapshot Test']);
  await Bun.write(join(root, 'tracked.txt'), 'outer');
  Bun.spawnSync(['git', '-C', root, 'add', 'tracked.txt']);
  Bun.spawnSync(['git', '-C', root, 'commit', '-m', 'outer']);
  const gitlinkCommit = Bun.spawnSync(['git', '-C', root, 'rev-parse', 'HEAD'])
    .stdout.toString()
    .trim();
  Bun.spawnSync([
    'git',
    '-C',
    root,
    'update-index',
    '--add',
    '--cacheinfo',
    `160000,${gitlinkCommit},vendor/nested`,
  ]);
  await mkdir(join(root, 'vendor', 'nested', '.git'), { recursive: true });
  await Bun.write(join(root, 'vendor', 'nested', 'private.txt'), 'cinder private nested file');

  const request = join(root, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({ schemaVersion: 1, repositories: [{ name: 'repo', path: root }] }),
  );
  const snapshot = JSON.parse(
    Bun.spawnSync([
      'bun',
      'run',
      'scripts/cinder-downstream-snapshot.ts',
      '--request',
      request,
    ]).stdout.toString(),
  );
  expect(
    snapshot.repositories[0].files.find((file: { path: string }) => file.path === 'vendor/nested'),
  ).toEqual({ path: 'vendor/nested', gitlink: gitlinkCommit });
  expect(
    snapshot.repositories[0].files.some((file: { path: string }) =>
      file.path.startsWith('vendor/nested/'),
    ),
  ).toBe(false);
});

test('bounds npm registry metadata requests', async () => {
  const source = await Bun.file(new URL('./cinder-downstream-snapshot.ts', import.meta.url)).text();
  expect(source).toContain('signal: AbortSignal.timeout(NPM_METADATA_TIMEOUT_MS)');
});
