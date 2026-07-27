import { expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLONE_DIRECTORY_PREFIX,
  describeInvalidRepositorySource,
  removeTemporaryCheckout,
  selectMostRecentlyPublishedVersion,
} from './cinder-downstream-snapshot.ts';

/**
 * Absolute path to the CLI under test. Resolving from `import.meta.url` rather than
 * the runner's working directory keeps every invocation identical no matter where
 * `bun test` was started from.
 */
const snapshotCliPath = fileURLToPath(new URL('./cinder-downstream-snapshot.ts', import.meta.url));

const STDERR_EXCERPT_LIMIT = 2000;

type SnapshotCliResult = { exitCode: number; stdout: string; stderr: string };

/**
 * Runs the snapshot CLI with the installed Bun executable and returns its exit code
 * and captured streams. stdout and stderr are drained concurrently with the exit
 * code so neither pipe can fill and stall the child.
 *
 * Pass `expectSuccess: false` to inspect a failing invocation instead of throwing.
 */
async function runSnapshotCli(
  args: string[],
  { expectSuccess = true }: { expectSuccess?: boolean } = {},
): Promise<SnapshotCliResult> {
  const child = Bun.spawn([process.execPath, snapshotCliPath, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  if (expectSuccess && exitCode !== 0) {
    throw new Error(
      `snapshot CLI exited ${exitCode} for arguments [${args.join(' ')}]\n` +
        `stderr: ${stderr.slice(0, STDERR_EXCERPT_LIMIT)}`,
    );
  }

  return { exitCode, stdout, stderr };
}

/** Creates a committed local Git repository usable as a `file://` remote in tests. */
async function createSourceRepository(
  prefix: string,
  files: Record<string, string>,
): Promise<{ root: string; remote: string; commit: string }> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  Bun.spawnSync(['git', '-C', root, 'init', '-b', 'main']);
  Bun.spawnSync(['git', '-C', root, 'config', 'user.email', 'test@example.com']);
  Bun.spawnSync(['git', '-C', root, 'config', 'user.name', 'Snapshot Test']);
  for (const [path, contents] of Object.entries(files)) {
    await Bun.write(join(root, path), contents);
  }
  Bun.spawnSync(['git', '-C', root, 'add', '-A']);
  Bun.spawnSync(['git', '-C', root, 'commit', '-m', 'initial']);
  const commit = Bun.spawnSync(['git', '-C', root, 'rev-parse', 'HEAD']).stdout.toString().trim();
  return { root, remote: `file://${root}`, commit };
}

/** Lists the snapshot tool's temporary clone directories currently in `tmpdir()`. */
async function listCloneDirectories(): Promise<string[]> {
  const entries = await readdir(tmpdir());
  return entries.filter((entry) => entry.startsWith(CLONE_DIRECTORY_PREFIX)).toSorted();
}

/**
 * Asserts a run left no temporary clone directory behind. Only directories absent
 * beforehand are treated as leaks, so a concurrent worktree running its own snapshot
 * cannot make this flake in either direction.
 */
async function expectNoNewCloneDirectories(before: string[]): Promise<void> {
  for (const directory of await listCloneDirectories()) {
    expect(before).toContain(directory);
  }
}

test('snapshot input is deterministic and sorted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-'));
  await Bun.write(join(root, 'z.txt'), 'z');
  await Bun.write(join(root, 'a.txt'), 'a');
  const request = join(root, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({ schemaVersion: 1, repositories: [{ name: 'repo', path: root }] }),
  );
  const first = await runSnapshotCli(['--request', request]);
  const second = await runSnapshotCli(['--request', request]);
  const normalize = (value: string) =>
    JSON.stringify({ ...JSON.parse(value), collectedAt: 'stable' });
  expect(normalize(first.stdout)).toBe(normalize(second.stdout));
});

test('help prints usage without requiring a request', async () => {
  const result = await runSnapshotCli(['--help']);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Usage:');
});

test('invalid options report exit code and stderr instead of a JSON parse error', async () => {
  const result = await runSnapshotCli(['--wat'], { expectSuccess: false });
  expect(result.exitCode).not.toBe(0);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Unknown option: --wat');

  const failure = await runSnapshotCli(['--wat']).catch((error: unknown) => error as Error);
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toContain(`exited ${result.exitCode}`);
  expect((failure as Error).message).toContain('Unknown option: --wat');
  expect((failure as Error).message).not.toContain('JSON Parse error');
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
  const result = await runSnapshotCli(['--request', request]);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout).errors[0].scope).toBe('repository:missing');
});

test('hashes binary bytes and rejects malformed options', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-bytes-'));
  await Bun.write(join(root, 'binary.bin'), new Uint8Array([0, 255, 128]));
  const request = join(root, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({ schemaVersion: 1, repositories: [{ name: 'repo', path: root }] }),
  );
  const result = await runSnapshotCli(['--request', request]);
  const file = JSON.parse(result.stdout).repositories[0].files.find(
    (entry: { path: string }) => entry.path === 'binary.bin',
  );
  expect(file.bytes).toBe(3);
  const malformed = await runSnapshotCli(['--wat'], { expectSuccess: false });
  expect(malformed.exitCode).not.toBe(0);
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
  const defaultResult = await runSnapshotCli(['--request', defaultRequest]);
  const defaultSnapshot = JSON.parse(defaultResult.stdout);
  expect(defaultSnapshot.repositories[0].files.map((file: { path: string }) => file.path)).toEqual([
    'inside.txt',
  ]);

  const narrowedRequest = join(parent, 'narrowed-request.json');
  await Bun.write(
    narrowedRequest,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'repo', path: root, globs: ['nested/**/*.txt'] }],
    }),
  );
  const narrowedResult = await runSnapshotCli(['--request', narrowedRequest]);
  const narrowedSnapshot = JSON.parse(narrowedResult.stdout);
  expect(narrowedSnapshot.repositories[0].files).toEqual([]);

  const escapingRequest = join(parent, 'escaping-request.json');
  await Bun.write(
    escapingRequest,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'repo', path: root, globs: ['../outside.txt'] }],
    }),
  );
  const escapingResult = await runSnapshotCli(['--request', escapingRequest]);
  const escapingSnapshot = JSON.parse(escapingResult.stdout);
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
  const result = await runSnapshotCli(['--request', request]);
  const snapshot = JSON.parse(result.stdout);
  expect(snapshot.repositories).toEqual([]);
  expect(snapshot.errors[0].message).toContain('does not match checkout HEAD');
});

test('matches evidence case-insensitively without decoding unrelated binary files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-evidence-'));
  await Bun.write(
    join(root, 'source.ts'),
    'const CINDER_API_URL = "example";\nCINDER_API_TOKEN=super-secret\nCINDER_AUTHORIZATION=Bearer top-secret\n',
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
  const result = await runSnapshotCli(['--request', request]);
  const snapshot = JSON.parse(result.stdout);
  expect(snapshot.repositories[0].evidence.source).toEqual([
    { path: 'source.ts', line: 1, text: 'const CINDER_API_URL = "example";' },
    { path: 'source.ts', line: 2, text: 'CINDER_API_TOKEN=[REDACTED]' },
    { path: 'source.ts', line: 3, text: 'CINDER_AUTHORIZATION=[REDACTED]' },
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
  const result = await runSnapshotCli(['--request', request]);
  const snapshot = JSON.parse(result.stdout);
  expect(
    snapshot.repositories[0].files.find((file: { path: string }) => file.path === 'vendor/nested'),
  ).toEqual({ path: 'vendor/nested', gitlink: gitlinkCommit });
  expect(
    snapshot.repositories[0].files.some((file: { path: string }) =>
      file.path.startsWith('vendor/nested/'),
    ),
  ).toBe(false);

  const scopedRequest = join(root, 'scoped-request.json');
  await Bun.write(
    scopedRequest,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'repo', path: root, globs: ['tracked.txt'] }],
    }),
  );
  const scopedResult = await runSnapshotCli(['--request', scopedRequest]);
  const scopedSnapshot = JSON.parse(scopedResult.stdout);
  expect(
    scopedSnapshot.repositories[0].files.some(
      (file: { path: string }) => file.path === 'vendor/nested',
    ),
  ).toBe(false);
});

test('bounds npm registry metadata requests', async () => {
  const source = await Bun.file(new URL('./cinder-downstream-snapshot.ts', import.meta.url)).text();
  expect(source).toContain('signal: AbortSignal.timeout(NPM_METADATA_TIMEOUT_MS)');
});

test('published package resolution selects the most recently published version', () => {
  expect(
    selectMostRecentlyPublishedVersion({
      versions: { '1.0.0': {}, '1.1.0-beta.1': {}, '1.0.1': {} },
      time: {
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-03-01T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-02-01T00:00:00.000Z',
        '1.1.0-beta.1': '2026-03-01T00:00:00.000Z',
      },
    }),
  ).toBe('1.1.0-beta.1');
});

test('a repository request declares exactly one of a local path or a remote ref', () => {
  expect(describeInvalidRepositorySource({ name: 'local', path: '/tmp/checkout' })).toBeNull();
  expect(
    describeInvalidRepositorySource({ name: 'local', path: '/tmp/checkout', branch: 'main' }),
  ).toBeNull();
  expect(
    describeInvalidRepositorySource({ name: 'remote', remote: 'file:///tmp/origin', ref: 'main' }),
  ).toBeNull();

  expect(
    describeInvalidRepositorySource({
      name: 'both',
      path: '/tmp/checkout',
      remote: 'file:///tmp/origin',
      ref: 'main',
    }),
  ).toBe('declares both path and remote; declare exactly one');
  expect(describeInvalidRepositorySource({ name: 'neither' })).toBe(
    'declares neither path nor remote; declare exactly one',
  );
  expect(
    describeInvalidRepositorySource({ name: 'bare-remote', remote: 'file:///tmp/origin' }),
  ).toBe('declares remote without ref');
  expect(describeInvalidRepositorySource({ name: 'bare-ref', ref: 'main' })).toBe(
    'declares ref without remote',
  );
});

test('a remote request rejects local-only pins and credential-bearing remotes', () => {
  const remote = 'https://github.com/stevekinney/tribunal.git';
  expect(describeInvalidRepositorySource({ name: 'remote', remote, ref: 'main' })).toBeNull();

  expect(
    describeInvalidRepositorySource({ name: 'remote', remote, ref: 'main', branch: 'main' }),
  ).toBe('declares remote with branch; a remote source is pinned by ref');
  expect(
    describeInvalidRepositorySource({ name: 'remote', remote, ref: 'main', commit: 'abc1234' }),
  ).toBe('declares remote with commit; a remote source is pinned by ref');

  for (const credentialed of [
    'https://user:token@github.com/stevekinney/tribunal.git',
    'https://token@github.com/stevekinney/tribunal.git',
    'http://user:token@example.com/repository.git',
  ]) {
    expect(
      describeInvalidRepositorySource({ name: 'remote', remote: credentialed, ref: 'main' }),
    ).toBe('declares a remote with embedded credentials; use a credential helper instead');
  }

  // An SSH remote's user name is not a secret, and `file://` remotes carry no userinfo.
  expect(
    describeInvalidRepositorySource({
      name: 'ssh',
      remote: 'git@github.com:stevekinney/tribunal.git',
      ref: 'main',
    }),
  ).toBeNull();
  expect(
    describeInvalidRepositorySource({ name: 'file', remote: 'file:///tmp/origin', ref: 'main' }),
  ).toBeNull();
});

test('every invalid repository source combination is rejected before any collection', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'cinder-snapshot-invalid-'));
  const invalidRepositories = [
    { name: 'both', path: workspace, remote: 'file:///tmp/origin', ref: 'main' },
    { name: 'neither' },
    { name: 'bare-remote', remote: 'file:///tmp/origin' },
    { name: 'bare-ref', ref: 'main' },
  ];

  for (const repository of invalidRepositories) {
    const request = join(workspace, `${repository.name}-request.json`);
    await Bun.write(request, JSON.stringify({ schemaVersion: 1, repositories: [repository] }));
    const result = await runSnapshotCli(['--request', request], { expectSuccess: false });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('invalid repository sources');
    expect(result.stderr).toContain(repository.name);
    expect(result.stdout).toBe('');
  }
});

test('a remote request clones the requested ref and records its exact commit', async () => {
  const source = await createSourceRepository('cinder-snapshot-remote-source-', {
    'package.json': '{ "dependencies": { "@lostgradient/cinder": "^0.1.0" } }',
    'app.ts': "import { Button } from '@lostgradient/cinder';\n",
  });
  const workspace = await mkdtemp(join(tmpdir(), 'cinder-snapshot-remote-'));
  const request = join(workspace, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        {
          name: 'downstream',
          remote: source.remote,
          ref: 'main',
          evidence: { manifests: ['**/package.json'], source: ['**/*.ts'] },
        },
      ],
    }),
  );
  const cloneDirectoriesBefore = await listCloneDirectories();

  const result = await runSnapshotCli(['--request', request]);
  const snapshot = JSON.parse(result.stdout);
  expect(snapshot.errors).toEqual([]);

  const repository = snapshot.repositories[0];
  expect(repository.name).toBe('downstream');
  expect(repository.remote).toBe(source.remote);
  expect(repository.ref).toBe('main');
  expect(repository.commit).toBe(source.commit);
  expect(repository.commit).toMatch(/^[0-9a-f]{40}$/u);

  expect(repository.files.map((file: { path: string }) => file.path)).toEqual([
    'app.ts',
    'package.json',
  ]);
  expect(repository.evidence.source).toEqual([
    { path: 'app.ts', line: 1, text: "import { Button } from '@lostgradient/cinder';" },
  ]);
  expect(repository.evidence.manifests[0].path).toBe('package.json');
  expect(repository.files.some((file: { path: string }) => file.path.startsWith('.git'))).toBe(
    false,
  );

  await expectNoNewCloneDirectories(cloneDirectoriesBefore);
});

test('replaying a remote request against the same commit is byte-identical', async () => {
  const source = await createSourceRepository('cinder-snapshot-replay-', {
    'package.json': '{ "dependencies": { "@lostgradient/cinder": "^0.1.0" } }',
    'app.svelte': "<script>import { Button } from '@lostgradient/cinder';</script>\n",
    'notes.md': 'We depend on Cinder tokens.\n',
  });
  const workspace = await mkdtemp(join(tmpdir(), 'cinder-snapshot-replay-request-'));
  const request = join(workspace, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        {
          name: 'downstream',
          remote: source.remote,
          ref: 'main',
          evidence: {
            manifests: ['**/package.json'],
            source: ['**/*.svelte'],
            documentation: ['**/*.md'],
          },
        },
      ],
    }),
  );

  const first = await runSnapshotCli(['--request', request]);
  const second = await runSnapshotCli(['--request', request]);
  const normalize = (value: string) =>
    JSON.stringify({ ...JSON.parse(value), collectedAt: 'stable' });

  expect(normalize(first.stdout)).toBe(normalize(second.stdout));
  expect(JSON.parse(first.stdout).repositories[0].commit).toBe(source.commit);
});

test('remote repositories stay sorted by name regardless of request order', async () => {
  const zulu = await createSourceRepository('cinder-snapshot-zulu-', {
    'readme.md': 'cinder zulu',
  });
  const alpha = await createSourceRepository('cinder-snapshot-alpha-', {
    'readme.md': 'cinder alpha',
  });
  const workspace = await mkdtemp(join(tmpdir(), 'cinder-snapshot-order-'));
  const request = join(workspace, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        { name: 'zulu', remote: zulu.remote, ref: 'main' },
        { name: 'alpha', remote: alpha.remote, ref: 'main' },
      ],
    }),
  );

  const result = await runSnapshotCli(['--request', request]);
  const snapshot = JSON.parse(result.stdout);
  expect(snapshot.errors).toEqual([]);
  expect(snapshot.repositories.map((entry: { name: string }) => entry.name)).toEqual([
    'alpha',
    'zulu',
  ]);
  expect(snapshot.repositories[0].commit).toBe(alpha.commit);
  expect(snapshot.repositories[1].commit).toBe(zulu.commit);
});

test('clone failures land in errors and still remove the temporary checkout', async () => {
  const source = await createSourceRepository('cinder-snapshot-badref-source-', {
    'readme.md': 'cinder',
  });
  const workspace = await mkdtemp(join(tmpdir(), 'cinder-snapshot-badref-'));
  const request = join(workspace, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'downstream', remote: source.remote, ref: 'refs/heads/absent' }],
    }),
  );
  const cloneDirectoriesBefore = await listCloneDirectories();

  const result = await runSnapshotCli(['--request', request]);
  expect(result.exitCode).toBe(0);
  const snapshot = JSON.parse(result.stdout);
  expect(snapshot.repositories).toEqual([]);
  expect(snapshot.errors).toHaveLength(1);
  expect(snapshot.errors[0].scope).toBe('repository:downstream');
  expect(snapshot.errors[0].message).toContain('cloning refs/heads/absent');

  await expectNoNewCloneDirectories(cloneDirectoriesBefore);
});

test('collecting a remote repository never mutates the source repository', async () => {
  const source = await createSourceRepository('cinder-snapshot-immutable-', {
    'package.json': '{ "name": "downstream" }',
    'app.ts': "import '@lostgradient/cinder/styles';\n",
  });
  const describeSource = () => ({
    head: Bun.spawnSync(['git', '-C', source.root, 'rev-parse', 'HEAD']).stdout.toString().trim(),
    status: Bun.spawnSync(['git', '-C', source.root, 'status', '--porcelain'])
      .stdout.toString()
      .trim(),
    index: Bun.spawnSync(['git', '-C', source.root, 'ls-files', '--stage']).stdout.toString(),
    reflog: Bun.spawnSync(['git', '-C', source.root, 'reflog', '--format=%H %gs'])
      .stdout.toString()
      .trim(),
  });
  const before = describeSource();

  const workspace = await mkdtemp(join(tmpdir(), 'cinder-snapshot-immutable-request-'));
  const request = join(workspace, 'request.json');
  await Bun.write(
    request,
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'downstream', remote: source.remote, ref: 'main' }],
    }),
  );

  const result = await runSnapshotCli(['--request', request]);
  const snapshot = JSON.parse(result.stdout);
  expect(snapshot.errors).toEqual([]);
  expect(snapshot.repositories[0].commit).toBe(source.commit);
  expect(describeSource()).toEqual(before);
});

test('an unremovable temporary checkout is reported instead of aborting the run', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'cinder-snapshot-cleanup-'));
  const checkout = join(parent, 'checkout');
  await mkdir(checkout, { recursive: true });
  await Bun.write(join(checkout, 'tracked.txt'), 'cinder');

  expect(await removeTemporaryCheckout(checkout, 'downstream')).toBeNull();

  const blocked = join(parent, 'blocked');
  await mkdir(blocked, { recursive: true });
  await Bun.write(join(blocked, 'tracked.txt'), 'cinder');
  // Without write permission on the parent, the child entry cannot be unlinked.
  await chmod(parent, 0o500);
  try {
    const cleanupError = await removeTemporaryCheckout(blocked, 'downstream');
    expect(cleanupError?.scope).toBe('repository:downstream');
    expect(cleanupError?.message).toContain('removing the temporary checkout');
    expect(cleanupError?.message).toContain(blocked);
  } finally {
    await chmod(parent, 0o700);
  }
});

test('the canonical audit request only uses remote sources on live default branches', async () => {
  const auditRequest = await Bun.file(
    new URL('./cinder-downstream-audit-request.json', import.meta.url),
  ).json();
  expect(auditRequest.schemaVersion).toBe(1);
  expect(auditRequest.repositories).toHaveLength(6);
  expect(auditRequest.repositories.map((entry: { name: string }) => entry.name)).toEqual(
    auditRequest.repositories.map((entry: { name: string }) => entry.name).toSorted(),
  );

  for (const repository of auditRequest.repositories) {
    expect(describeInvalidRepositorySource(repository)).toBeNull();
    expect(repository.path).toBeUndefined();
    expect(repository.remote).toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/u);
    expect(repository.branch).toBeUndefined();
    expect(repository.commit).toBeUndefined();
    expect(repository.globs.length).toBeGreaterThan(0);
    expect(Object.keys(repository.evidence).toSorted()).toEqual([
      'documentation',
      'manifests',
      'source',
      'styles',
    ]);
  }

  expect(auditRequest.packages.map((entry: { name: string }) => entry.name)).toEqual([
    '@lostgradient/chat',
    '@lostgradient/cinder',
  ]);
});

test('workspace script tests are wired into documented and required CI gates', async () => {
  const packageJson = await Bun.file(new URL('../package.json', import.meta.url)).json();
  const unitWorkflow = await Bun.file(
    new URL('../.github/workflows/unit-tests.yaml', import.meta.url),
  ).text();
  const mainWorkflow = await Bun.file(
    new URL('../.github/workflows/main-green.yaml', import.meta.url),
  ).text();
  expect(packageJson.scripts['test:workspace-scripts']).toContain(
    'scripts/cinder-downstream-snapshot.test.ts',
  );
  expect(packageJson.scripts.test).toContain('bun run test:workspace-scripts');
  expect(unitWorkflow).toContain('bun run test:workspace-scripts');
  expect(mainWorkflow).toContain('bun run test:workspace-scripts');
});
