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
const editorManifest = JSON.parse(
  await Bun.file(join(packageRoot, 'package.json')).text(),
) as PackageManifest;
const cinderManifest = JSON.parse(
  await Bun.file(join(workspaceRoot, 'packages', 'components', 'package.json')).text(),
) as PackageManifest;
const editorReadme = await Bun.file(join(packageRoot, 'README.md')).text();
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

describe('Editor package ownership boundary', () => {
  test('keeps Editor component exports out of Cinder', () => {
    expect(
      Object.keys(cinderManifest.exports).filter(
        (subpath) =>
          subpath === './markdown-editor' ||
          subpath.startsWith('./markdown-editor/') ||
          subpath === './review-editor' ||
          subpath.startsWith('./review-editor/') ||
          subpath === './diff-viewer' ||
          subpath.startsWith('./diff-viewer/'),
      ),
    ).toEqual([]);
  });

  test('owns only vendored-utility dependencies — every framework-level runtime need is a peer', () => {
    expect(() => assertSourceManifest(editorManifest)).not.toThrow();
    // `@floating-ui/dom` and `esm-env` back the vendored `_internal`/
    // `utilities` helpers copied in from Cinder (anchored-overlay
    // positioning, dev-only warnings) — not singletons, so Editor owns them
    // as regular dependencies, matching Cinder's own treatment of the same
    // two packages, rather than asking every host to install them.
    expect(editorManifest.dependencies).toEqual({
      '@floating-ui/dom': '1.7.6',
      'esm-env': '^1.2.0',
    });
    const remainingPeerDependencies = Object.fromEntries(
      Object.entries(editorManifest.peerDependencies ?? {}).filter(
        ([peer]) => peer !== '@lostgradient/cinder',
      ),
    );
    expect(remainingPeerDependencies).toEqual({
      '@lostgradient/markdown': '^0.1.0',
      '@milkdown/ctx': '^7.17.3',
      '@milkdown/kit': '^7.17.3',
      '@milkdown/prose': '^7.17.3',
      'prosemirror-inputrules': '^1.5.1',
      'prosemirror-model': '^1.25.4',
      'prosemirror-state': '^1.4.4',
      'prosemirror-view': '^1.41.3',
      svelte: '>=5.56.0 <6',
    });
    expect(runtimeExternalSpecifiers(editorManifest)).toEqual([
      '@lostgradient/cinder',
      '@lostgradient/cinder/*',
      '@lostgradient/markdown',
      '@lostgradient/markdown/*',
      '@milkdown/ctx',
      '@milkdown/ctx/*',
      '@milkdown/kit',
      '@milkdown/kit/*',
      '@milkdown/prose',
      '@milkdown/prose/*',
      'prosemirror-inputrules',
      'prosemirror-inputrules/*',
      'prosemirror-model',
      'prosemirror-model/*',
      'prosemirror-state',
      'prosemirror-state/*',
      'prosemirror-view',
      'prosemirror-view/*',
      'svelte',
      'svelte/*',
      '@floating-ui/dom',
      '@floating-ui/dom/*',
      'esm-env',
      'esm-env/*',
    ]);
  });

  test('keeps Editor’s Cinder peer range covering the current Cinder version', async () => {
    const cinderPeerRange = editorManifest.peerDependencies?.['@lostgradient/cinder'];
    expect(
      cinderPeerRange,
      'Editor must declare @lostgradient/cinder as a peer dependency.',
    ).toBeDefined();
    if (typeof cinderPeerRange !== 'string') return;

    expect(cinderPeerRange).toMatch(/^\^\d+\.\d+\.\d+$/u);
    const peerCoversCurrentCinder = Bun.semver.satisfies(cinderManifest.version, cinderPeerRange);
    const pendingCoordinatedMinorRelease =
      (await pendingChangesetBump(cinderManifest.name)) === 'minor' &&
      (await pendingChangesetBump(editorManifest.name)) === 'minor' &&
      cinderPeerRange === nextMinorPeerRange(cinderManifest.version);

    expect(
      peerCoversCurrentCinder || pendingCoordinatedMinorRelease,
      'Editor’s Cinder peer range must either cover the current Cinder version, or point at the next Cinder minor while a coordinated Cinder+Editor minor changeset is pending.',
    ).toBe(true);
  });

  test('documents every required peer in the install command', () => {
    const cinderPeerMetadata = (cinderManifest['peerDependenciesMeta'] ?? {}) as Record<
      string,
      { optional?: boolean }
    >;
    const requiredCinderPeers = Object.keys(cinderManifest.peerDependencies ?? {}).filter(
      (peer) => cinderPeerMetadata[peer]?.optional !== true,
    );
    const expectedPackages = [
      ...new Set([
        editorManifest.name,
        ...Object.keys(editorManifest.peerDependencies ?? {}),
        ...requiredCinderPeers,
      ]),
    ].toSorted();
    const documentedPackages =
      editorReadme.match(/^bun add (?<packages>.+)$/m)?.groups?.['packages']?.split(/\s+/) ?? [];

    expect(documentedPackages).toEqual(expectedPackages);
  });

  test('stages a dist-only publish manifest without workspace or source targets', () => {
    const published = buildPublishedManifest(editorManifest);
    const serialized = JSON.stringify(published);

    expect(published.dependencies).toEqual(editorManifest.dependencies);
    expect(published.devDependencies).toBeUndefined();
    expect(published.scripts).toBeUndefined();
    expect(serialized).not.toContain('workspace:');
    expect(serialized).not.toContain('./src/');
    expect(published.peerDependencies).toEqual(editorManifest.peerDependencies);
  });

  test('rewrites browser-aware Editor exports to packed dist files', () => {
    const published = buildPublishedManifest(editorManifest);
    const exportKeys = (entry: unknown): string[] => {
      expect(entry).toBeDefined();
      expect(entry).not.toBeNull();
      expect(typeof entry).toBe('object');
      return Object.keys(entry as Record<string, unknown>);
    };

    expect(published.exports['./markdown-editor']).toMatchObject({
      types: './dist/components/markdown-editor/index.d.ts',
      browser: './dist/components/markdown-editor/index.js',
      node: './dist/server/components/markdown-editor/index.js',
      svelte: './dist/components/markdown-editor/index.js',
      import: './dist/components/markdown-editor/index.js',
      default: './dist/components/markdown-editor/index.js',
    });
    expect(exportKeys(published.exports['./markdown-editor'])).toEqual([
      'types',
      'browser',
      'node',
      'svelte',
      'import',
      'default',
    ]);
    expect(published.exports['./review-editor']).toMatchObject({
      types: './dist/components/review-editor/index.d.ts',
      browser: './dist/components/review-editor/index.js',
      node: './dist/server/components/review-editor/index.js',
      svelte: './dist/components/review-editor/index.js',
      import: './dist/components/review-editor/index.js',
      default: './dist/components/review-editor/index.js',
    });
    expect(published.exports['./diff-viewer']).toMatchObject({
      types: './dist/components/diff-viewer/index.d.ts',
      browser: './dist/components/diff-viewer/index.js',
      node: './dist/server/components/diff-viewer/index.js',
      svelte: './dist/components/diff-viewer/index.js',
      import: './dist/components/diff-viewer/index.js',
      default: './dist/components/diff-viewer/index.js',
    });
  });
});
