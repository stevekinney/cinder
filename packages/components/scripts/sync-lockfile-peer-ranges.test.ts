import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { syncLockfilePeerRanges } from './sync-lockfile-peer-ranges.ts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const staleLockfile = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
    },
    "packages/chat": {
      "name": "@lostgradient/chat",
      "version": "0.16.0",
      "dependencies": {
        "@lostgradient/cinder": "workspace:*",
      },
      "peerDependencies": {
        "@lostgradient/cinder": "^0.26.0",
        "svelte": ">=5.56.0 <6",
      },
    },
    "packages/components": {
      "name": "@lostgradient/cinder",
      "version": "0.27.0",
    },
  },
  "packages": {
    "@lostgradient/cinder": ["@lostgradient/cinder@workspace:packages/components"],
  }
}
`;

async function makeWorkspace(chatPeers: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sync-lockfile-peer-ranges-'));
  temporaryRoots.push(root);
  await mkdir(join(root, 'packages', 'chat'), { recursive: true });
  await mkdir(join(root, 'packages', 'components'), { recursive: true });
  await Bun.write(join(root, 'bun.lock'), staleLockfile);
  await Bun.write(
    join(root, 'packages', 'chat', 'package.json'),
    JSON.stringify({
      name: '@lostgradient/chat',
      version: '0.16.0',
      dependencies: { '@lostgradient/cinder': 'workspace:*' },
      peerDependencies: chatPeers,
    }),
  );
  await Bun.write(
    join(root, 'packages', 'components', 'package.json'),
    JSON.stringify({ name: '@lostgradient/cinder', version: '0.27.0' }),
  );
  return root;
}

describe('syncLockfilePeerRanges', () => {
  test('writes a widened manifest peer range into its workspace peerDependencies block only', async () => {
    const root = await makeWorkspace({
      '@lostgradient/cinder': '^0.27.0',
      svelte: '>=5.56.0 <6',
    });

    const result = await syncLockfilePeerRanges(root);

    expect(result.updates).toEqual([
      {
        workspace: 'packages/chat',
        dependencyName: '@lostgradient/cinder',
        previousRange: '^0.26.0',
        nextRange: '^0.27.0',
      },
    ]);
    const lockfile = await Bun.file(join(root, 'bun.lock')).text();
    expect(lockfile).toBe(
      staleLockfile.replace(
        '"@lostgradient/cinder": "^0.26.0",',
        '"@lostgradient/cinder": "^0.27.0",',
      ),
    );
    // The same name under `dependencies` is untouched.
    expect(lockfile).toContain('"@lostgradient/cinder": "workspace:*",');
  });

  test('leaves the lockfile byte-identical when every peer range already matches', async () => {
    const root = await makeWorkspace({
      '@lostgradient/cinder': '^0.26.0',
      svelte: '>=5.56.0 <6',
    });

    const result = await syncLockfilePeerRanges(root);

    expect(result.updates).toEqual([]);
    expect(await Bun.file(join(root, 'bun.lock')).text()).toBe(staleLockfile);
  });

  test('writes a range containing replacement-pattern characters literally', async () => {
    const root = await makeWorkspace({
      '@lostgradient/cinder': "^0.27.0 || $& $'",
      svelte: '>=5.56.0 <6',
    });

    await syncLockfilePeerRanges(root);

    expect(await Bun.file(join(root, 'bun.lock')).text()).toContain(
      `"@lostgradient/cinder": ${JSON.stringify("^0.27.0 || $& $'")},`,
    );
  });

  test('matches a workspace by its full path, not a prefix of another', async () => {
    const root = await makeWorkspace({
      '@lostgradient/cinder': '^0.27.0',
      svelte: '>=5.56.0 <6',
    });
    const lockfile = staleLockfile.replace(
      '    "packages/chat": {',
      '    "packages/chat-extra": {\n      "name": "chat-extra",\n      "peerDependencies": {\n        "@lostgradient/cinder": "^0.1.0",\n      },\n    },\n    "packages/chat": {',
    );
    await Bun.write(join(root, 'bun.lock'), lockfile);
    await mkdir(join(root, 'packages', 'chat-extra'), { recursive: true });
    await Bun.write(
      join(root, 'packages', 'chat-extra', 'package.json'),
      JSON.stringify({
        name: 'chat-extra',
        peerDependencies: { '@lostgradient/cinder': '^0.1.0' },
      }),
    );

    const result = await syncLockfilePeerRanges(root);

    expect(result.updates.map((update) => update.workspace)).toEqual(['packages/chat']);
    expect(await Bun.file(join(root, 'bun.lock')).text()).toContain(
      '"packages/chat-extra": {\n      "name": "chat-extra",\n      "peerDependencies": {\n        "@lostgradient/cinder": "^0.1.0",',
    );
  });

  test('refuses a workspace whose manifest has peers but whose lockfile entry has none', async () => {
    const root = await makeWorkspace({ '@lostgradient/cinder': '^0.27.0' });
    await Bun.write(
      join(root, 'packages', 'components', 'package.json'),
      JSON.stringify({ name: '@lostgradient/cinder', peerDependencies: { svelte: '^5' } }),
    );

    await expect(syncLockfilePeerRanges(root)).rejects.toThrow(
      'packages/components has no peerDependencies in bun.lock',
    );
    expect(await Bun.file(join(root, 'bun.lock')).text()).toBe(staleLockfile);
  });

  test('refuses a manifest peer the lockfile workspace block does not list', async () => {
    const root = await makeWorkspace({
      '@lostgradient/cinder': '^0.27.0',
      '@lostgradient/markdown': '^0.6.0',
      svelte: '>=5.56.0 <6',
    });

    await expect(syncLockfilePeerRanges(root)).rejects.toThrow(
      'packages/chat lists no "@lostgradient/markdown" peer in bun.lock',
    );
    expect(await Bun.file(join(root, 'bun.lock')).text()).toBe(staleLockfile);
  });
});
