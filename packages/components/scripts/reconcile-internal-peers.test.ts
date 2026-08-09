import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  reconcileInternalPeers,
  type ReconcileInternalPeersOptions,
} from './reconcile-internal-peers.ts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function makeManifestFixture(options: {
  cinderManifest: unknown;
  markdownManifest?: unknown;
  chatManifest: unknown;
  editorManifest?: unknown;
}): Promise<ReconcileInternalPeersOptions> {
  const root = await mkdtemp(join(tmpdir(), 'reconcile-internal-peers-'));
  temporaryRoots.push(root);
  const cinderManifestPath = join(root, 'cinder-package.json');
  const markdownManifestPath = join(root, 'markdown-package.json');
  const chatManifestPath = join(root, 'chat-package.json');
  const editorManifestPath = join(root, 'editor-package.json');

  const serialize = (manifest: unknown): string =>
    typeof manifest === 'string' ? manifest : `${JSON.stringify(manifest, null, 2)}\n`;
  await Bun.write(cinderManifestPath, serialize(options.cinderManifest));
  await Bun.write(
    markdownManifestPath,
    serialize(options.markdownManifest ?? { name: '@lostgradient/markdown', version: '0.2.0' }),
  );
  await Bun.write(chatManifestPath, serialize(options.chatManifest));
  await Bun.write(
    editorManifestPath,
    serialize(options.editorManifest ?? validDependentManifest('@lostgradient/editor')),
  );

  return {
    dependencies: [
      { label: 'Cinder', manifestPath: cinderManifestPath },
      { label: 'Markdown', manifestPath: markdownManifestPath },
    ],
    dependents: [
      { label: 'Chat', manifestPath: chatManifestPath },
      { label: 'Editor', manifestPath: editorManifestPath },
    ],
  };
}

function validDependentManifest(
  name: '@lostgradient/chat' | '@lostgradient/editor',
  cinderPeerRange = '^0.18.0',
  markdownPeerRange = '^0.2.0',
): object {
  return {
    name,
    version: '0.3.0',
    peerDependencies: {
      '@lostgradient/cinder': cinderPeerRange,
      '@lostgradient/markdown': markdownPeerRange,
    },
  };
}

describe('reconcileInternalPeers', () => {
  test('wraps Changesets with dependent preparation and peer reconciliation', async () => {
    const workspaceManifest = (await Bun.file(
      join(import.meta.dir, '..', '..', '..', 'package.json'),
    ).json()) as { scripts?: Record<string, string> };
    const versionCommand = workspaceManifest.scripts?.['changeset:version'];

    expect(versionCommand).toBeDefined();
    if (versionCommand === undefined) return;

    const prepareIndex = versionCommand.indexOf('prepare-internal-peer-changesets.ts');
    const changesetsIndex = versionCommand.indexOf('changeset version');
    const reconcileIndex = versionCommand.indexOf('reconcile-internal-peers.ts');
    expect(prepareIndex).toBeGreaterThanOrEqual(0);
    expect(changesetsIndex).toBeGreaterThan(prepareIndex);
    expect(reconcileIndex).toBeGreaterThan(changesetsIndex);
  });

  test('does not write when every internal dependency version is already satisfied', async () => {
    const fixture = await makeManifestFixture({
      cinderManifest: { name: '@lostgradient/cinder', version: '0.18.0' },
      chatManifest: validDependentManifest('@lostgradient/chat'),
    });
    const chatManifestPath = fixture.dependents[0]!.manifestPath;
    const before = await Bun.file(chatManifestPath).text();

    const result = await reconcileInternalPeers(fixture);

    expect(result.updates).toEqual([]);
    expect(await Bun.file(chatManifestPath).text()).toBe(before);
  });

  test('rewrites stale Cinder and Markdown ranges for every dependent', async () => {
    const fixture = await makeManifestFixture({
      cinderManifest: { name: '@lostgradient/cinder', version: '0.22.0' },
      markdownManifest: { name: '@lostgradient/markdown', version: '0.3.0' },
      chatManifest: validDependentManifest('@lostgradient/chat', '^0.21.0', '^0.2.0'),
      editorManifest: validDependentManifest('@lostgradient/editor', '^0.21.0', '^0.2.0'),
    });

    const result = await reconcileInternalPeers(fixture);
    const rewrittenManifests = await Promise.all(
      fixture.dependents.map(
        async ({ manifestPath }) =>
          Bun.file(manifestPath).json() as Promise<{
            peerDependencies: Record<string, string>;
          }>,
      ),
    );

    expect(result.updates).toHaveLength(4);
    for (const manifest of rewrittenManifests) {
      expect(manifest.peerDependencies['@lostgradient/cinder']).toBe('^0.22.0');
      expect(manifest.peerDependencies['@lostgradient/markdown']).toBe('^0.3.0');
    }
  });

  test('reports malformed manifests clearly', async () => {
    const fixture = await makeManifestFixture({
      cinderManifest: '{ not valid json',
      chatManifest: validDependentManifest('@lostgradient/chat'),
    });

    await expect(reconcileInternalPeers(fixture)).rejects.toThrow(
      /The Cinder manifest .* is not valid JSON/,
    );
  });
});
