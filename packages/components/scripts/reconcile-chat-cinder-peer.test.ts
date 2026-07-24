import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  reconcileChatCinderPeer,
  type ReconcileChatCinderPeerOptions,
} from './reconcile-chat-cinder-peer.ts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function makeManifestFixture(options: {
  cinderManifest: unknown;
  chatManifest: unknown;
}): Promise<ReconcileChatCinderPeerOptions> {
  const root = await mkdtemp(join(tmpdir(), 'reconcile-chat-cinder-peer-'));
  temporaryRoots.push(root);
  const cinderManifestPath = join(root, 'cinder-package.json');
  const chatManifestPath = join(root, 'chat-package.json');

  const serialize = (manifest: unknown): string =>
    typeof manifest === 'string' ? manifest : `${JSON.stringify(manifest, null, 2)}\n`;
  await Bun.write(cinderManifestPath, serialize(options.cinderManifest));
  await Bun.write(chatManifestPath, serialize(options.chatManifest));

  return { cinderManifestPath, chatManifestPath };
}

function validChatManifest(peerRange: string): object {
  return {
    name: '@lostgradient/chat',
    version: '0.3.0',
    peerDependencies: { '@lostgradient/cinder': peerRange },
  };
}

describe('reconcileChatCinderPeer', () => {
  test('does not write when the current Cinder version is already satisfied', async () => {
    const fixture = await makeManifestFixture({
      cinderManifest: { name: '@lostgradient/cinder', version: '0.18.0' },
      chatManifest: validChatManifest('^0.18.0'),
    });
    const before = await Bun.file(fixture.chatManifestPath).text();

    const result = await reconcileChatCinderPeer(fixture);

    expect(result.changed).toBe(false);
    expect(await Bun.file(fixture.chatManifestPath).text()).toBe(before);
  });

  test('rewrites an escaped range to the current Cinder caret range', async () => {
    const fixture = await makeManifestFixture({
      cinderManifest: { name: '@lostgradient/cinder', version: '0.18.0' },
      chatManifest: validChatManifest('^0.17.0'),
    });

    const result = await reconcileChatCinderPeer(fixture);
    const rewritten = JSON.parse(await Bun.file(fixture.chatManifestPath).text()) as {
      peerDependencies: Record<string, string>;
    };

    expect(result).toMatchObject({
      changed: true,
      previousRange: '^0.17.0',
      nextRange: '^0.18.0',
      chatVersion: '0.3.1',
    });
    expect(rewritten.peerDependencies['@lostgradient/cinder']).toBe('^0.18.0');
  });

  test('reports malformed manifests clearly', async () => {
    const fixture = await makeManifestFixture({
      cinderManifest: '{ not valid json',
      chatManifest: validChatManifest('^0.17.0'),
    });

    await expect(reconcileChatCinderPeer(fixture)).rejects.toThrow(
      /The Cinder manifest .* is not valid JSON/,
    );
  });
});
