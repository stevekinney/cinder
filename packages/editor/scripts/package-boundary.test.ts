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

  test('owns no regular runtime dependencies — every runtime need is a peer', () => {
    expect(() => assertSourceManifest(editorManifest)).not.toThrow();
    expect(editorManifest.dependencies).toEqual({});
    // The Cinder floor is ^0.17.0 for the same reason Chat's is: every 0.16
    // release still declares `lucide-svelte` as a peer, and this package's
    // moved components resolve their icons through Cinder's `./icons` seam
    // instead of installing their own copy.
    expect(editorManifest.peerDependencies).toEqual({
      '@lostgradient/cinder': '^0.17.0',
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
    ]);
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

    expect(published.dependencies).toEqual({});
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
