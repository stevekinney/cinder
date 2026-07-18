import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import {
  assertSourceManifest,
  buildPublishedManifest,
  peerExternalSpecifiers,
  type PackageManifest,
} from './pack-for-publish.ts';

const packageRoot = join(import.meta.dir, '..');
const workspaceRoot = join(packageRoot, '..', '..');
const chatManifest = JSON.parse(
  await Bun.file(join(packageRoot, 'package.json')).text(),
) as PackageManifest;
const cinderManifest = JSON.parse(
  await Bun.file(join(workspaceRoot, 'packages', 'components', 'package.json')).text(),
) as PackageManifest;
const chatReadme = await Bun.file(join(packageRoot, 'README.md')).text();

const dependencyFields = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;

describe('Chat package ownership boundary', () => {
  test('keeps Chat exports and Conversationalist out of Cinder', () => {
    expect(
      Object.keys(cinderManifest.exports).filter(
        (subpath) =>
          subpath === './chat' || subpath.startsWith('./chat/') || subpath.startsWith('./chat-'),
      ),
    ).toEqual([]);

    for (const field of dependencyFields) {
      expect(cinderManifest[field]?.['conversationalist']).toBeUndefined();
    }
  });

  test('keeps every Chat runtime integration peer-only', () => {
    expect(() => assertSourceManifest(chatManifest)).not.toThrow();
    expect(chatManifest.dependencies).toEqual({});
    expect(chatManifest.peerDependencies).toEqual({
      '@lostgradient/cinder': '^0.16.0',
      conversationalist: '^0.2.1',
      svelte: '>=5.56.0 <6',
      zod: '4.4.1',
    });
    expect(peerExternalSpecifiers(chatManifest)).toEqual([
      '@lostgradient/cinder',
      '@lostgradient/cinder/*',
      'conversationalist',
      'conversationalist/*',
      'svelte',
      'svelte/*',
      'zod',
      'zod/*',
    ]);
  });

  test("documents Chat and Cinder's required peers in the install command", () => {
    const cinderPeerMetadata = (cinderManifest['peerDependenciesMeta'] ?? {}) as Record<
      string,
      { optional?: boolean }
    >;
    const requiredCinderPeers = Object.keys(cinderManifest.peerDependencies ?? {}).filter(
      (peer) => cinderPeerMetadata[peer]?.optional !== true,
    );
    const expectedPackages = [
      ...new Set([
        chatManifest.name,
        ...Object.keys(chatManifest.peerDependencies ?? {}),
        ...requiredCinderPeers,
      ]),
    ].toSorted();
    const documentedPackages =
      chatReadme.match(/^bun add (?<packages>.+)$/m)?.groups?.['packages']?.split(/\s+/) ?? [];

    expect(documentedPackages).toEqual(expectedPackages);
  });

  test("exposes Chat icons through Cinder's public peer seam", () => {
    expect(cinderManifest.exports['./icons']).toEqual({
      types: './dist/components/icons/index.d.ts',
      browser: './src/components/icons/index.ts',
      node: './dist/server/components/icons/index.js',
      svelte: './src/components/icons/index.ts',
      import: './src/components/icons/index.ts',
      default: './dist/components/icons/index.js',
    });
  });

  test('stages a dist-only publish manifest without workspace or source targets', () => {
    const published = buildPublishedManifest(chatManifest);
    const serialized = JSON.stringify(published);

    expect(published.dependencies).toBeUndefined();
    expect(published.devDependencies).toBeUndefined();
    expect(published.scripts).toBeUndefined();
    expect(serialized).not.toContain('workspace:');
    expect(serialized).not.toContain('./src/');
    expect(published.peerDependencies).toEqual(chatManifest.peerDependencies);
  });
});
