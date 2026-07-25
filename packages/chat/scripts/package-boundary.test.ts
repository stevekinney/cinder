import parseChangeset from '@changesets/parse';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import {
  assertSourceManifest,
  buildPublishedManifest,
  runtimeExternalSpecifiers,
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
const changesetDirectory = join(workspaceRoot, '.changeset');
const changesetBumpRank = {
  patch: 1,
  minor: 2,
  major: 3,
} as const;

type ChangesetBump = keyof typeof changesetBumpRank;

function isChangesetBump(type: string): type is ChangesetBump {
  return type === 'patch' || type === 'minor' || type === 'major';
}

async function pendingChangesetBump(packageName: string): Promise<ChangesetBump | null> {
  const glob = new Glob('*.md');
  let strongestBump: ChangesetBump | null = null;

  for await (const entry of glob.scan({ cwd: changesetDirectory })) {
    if (entry === 'README.md') continue;
    const source = await Bun.file(join(changesetDirectory, entry)).text();
    const { releases } = parseChangeset(source);
    for (const release of releases) {
      if (release.name !== packageName || !isChangesetBump(release.type)) continue;
      if (
        strongestBump === null ||
        changesetBumpRank[release.type] > changesetBumpRank[strongestBump]
      ) {
        strongestBump = release.type;
      }
    }
  }

  return strongestBump;
}

function nextMinorPeerRange(version: string): string {
  const [major, minor] = version.split('.').map((part) => Number.parseInt(part, 10));
  if (major === undefined || minor === undefined || Number.isNaN(major) || Number.isNaN(minor)) {
    throw new Error(`Unparseable Cinder version: ${JSON.stringify(version)}`);
  }

  return `^${major}.${minor + 1}.0`;
}

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

  test('keeps host-supplied runtime singletons peer-only and owns its conversation-model dependencies', () => {
    expect(() => assertSourceManifest(chatManifest)).not.toThrow();
    expect(chatManifest.dependencies).toEqual({
      conversationalist: '^0.5.0',
      zod: '4.4.1',
    });
    // The Cinder floor tracks the Cinder minor released alongside Chat —
    // caret on 0.x pins the minor, so each Cinder minor bump MUST widen this
    // range or `validate-consumers` hard-fails the release (see the 0.18.0
    // release failure and #879, which asks the version-packages flow to
    // reconcile this automatically). The floor stays >=0.17 for the original
    // reason: every 0.16 release still had `lucide-svelte` as a peer, so a
    // consumer resolved its own Lucide against Cinder's prebuilt SSR bundle
    // and hit a hydration_mismatch, while Chat's README says Lucide is not
    // needed at all.
    const remainingPeerDependencies = Object.fromEntries(
      Object.entries(chatManifest.peerDependencies ?? {}).filter(
        ([peer]) => peer !== '@lostgradient/cinder',
      ),
    );
    expect(remainingPeerDependencies).toEqual({
      '@lostgradient/markdown': '^0.1.0',
      svelte: '>=5.56.0 <6',
    });
    expect(runtimeExternalSpecifiers(chatManifest)).toEqual([
      '@lostgradient/cinder',
      '@lostgradient/cinder/*',
      '@lostgradient/markdown',
      '@lostgradient/markdown/*',
      'svelte',
      'svelte/*',
      'conversationalist',
      'conversationalist/*',
      'zod',
      'zod/*',
    ]);
  });

  test('keeps Chat’s Cinder peer range covering the current Cinder version', async () => {
    const cinderPeerRange = chatManifest.peerDependencies?.['@lostgradient/cinder'];
    expect(
      cinderPeerRange,
      'Chat must declare @lostgradient/cinder as a peer dependency.',
    ).toBeDefined();
    if (typeof cinderPeerRange !== 'string') return;

    expect(cinderPeerRange).toMatch(/^\^\d+\.\d+\.\d+$/u);
    const peerCoversCurrentCinder = Bun.semver.satisfies(cinderManifest.version, cinderPeerRange);
    const pendingCoordinatedMinorRelease =
      (await pendingChangesetBump(cinderManifest.name)) === 'minor' &&
      (await pendingChangesetBump(chatManifest.name)) === 'minor' &&
      cinderPeerRange === nextMinorPeerRange(cinderManifest.version);

    expect(
      peerCoversCurrentCinder || pendingCoordinatedMinorRelease,
      'Chat’s Cinder peer range must either cover the current Cinder version, or point at the next Cinder minor while a coordinated Cinder+Chat minor changeset is pending.',
    ).toBe(true);
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

    expect(published.dependencies).toEqual(chatManifest.dependencies);
    expect(published.devDependencies).toBeUndefined();
    expect(published.scripts).toBeUndefined();
    expect(serialized).not.toContain('workspace:');
    expect(serialized).not.toContain('./src/');
    expect(published.peerDependencies).toEqual(chatManifest.peerDependencies);
  });

  test('rewrites browser-aware Chat exports to packed dist files', () => {
    const published = buildPublishedManifest(chatManifest);
    const exportKeys = (entry: unknown): string[] => {
      expect(entry).toBeDefined();
      expect(entry).not.toBeNull();
      expect(typeof entry).toBe('object');
      return Object.keys(entry as Record<string, unknown>);
    };

    expect(published.exports['.']).toMatchObject({
      types: './dist/index.d.ts',
      browser: './dist/index.js',
      node: './dist/server/index.js',
      svelte: './dist/index.js',
      import: './dist/index.js',
      default: './dist/index.js',
    });
    expect(exportKeys(published.exports['.'])).toEqual([
      'types',
      'browser',
      'node',
      'svelte',
      'import',
      'default',
    ]);
    expect(published.exports['./composer-popover']).toMatchObject({
      types: './dist/components/chat-composer-popover/index.d.ts',
      browser: './dist/components/chat-composer-popover/index.js',
      node: './dist/server/components/chat-composer-popover/index.js',
      svelte: './dist/components/chat-composer-popover/index.js',
      import: './dist/components/chat-composer-popover/index.js',
      default: './dist/components/chat-composer-popover/index.js',
    });
    expect(exportKeys(published.exports['./composer-popover'])).toEqual([
      'types',
      'browser',
      'node',
      'svelte',
      'import',
      'default',
    ]);
  });

  test('keeps coverage in one process so repeated Svelte modules merge deterministically', () => {
    expect(chatManifest.scripts?.['test:coverage']).toContain('--coverage-reporter=lcov');
    expect(chatManifest.scripts?.['test:coverage']).not.toContain('--parallel');
  });
});
