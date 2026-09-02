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
const markdownManifest = JSON.parse(
  await Bun.file(join(workspaceRoot, 'packages', 'markdown', 'package.json')).text(),
) as PackageManifest;
const editorReadme = await Bun.file(join(packageRoot, 'README.md')).text();

describe('Editor package ownership boundary', () => {
  test('keeps component tests serial without isolating the Svelte preload plugin', () => {
    for (const scriptName of ['test', 'test:coverage']) {
      const script = editorManifest.scripts?.[scriptName];
      expect(script, `${scriptName} must be defined`).toBeDefined();
      expect(script).toContain('--max-concurrency=1');
      expect(script).not.toContain('--parallel');
    }
  });

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
    // `@lostgradient/cinder` and `@lostgradient/markdown` are both excluded
    // from this literal comparison, not just Cinder: both ranges move
    // across releases (Cinder moved on cinder#879's reconciliation, Markdown
    // on this repo's own `reconcile-internal-peers.ts`, which post-#1330
    // widened this range to `^0.3.0` on `changeset-release/main` the moment
    // this test's PR merged) and each has its own dynamic guard below
    // ("...covering the current ... version") that actually tracks the
    // released version instead of hardcoding one. A previous version of
    // this test hardcoded `@lostgradient/markdown: '^0.2.0'` here anyway,
    // which is exactly the kind of drift the dynamic guards exist to
    // prevent -- it went stale the first time this range moved, and failed
    // CI on the version-packages PR that moved it for a reason unrelated to
    // any actual regression.
    const remainingPeerDependencies = Object.fromEntries(
      Object.entries(editorManifest.peerDependencies ?? {}).filter(
        ([peer]) => peer !== '@lostgradient/cinder' && peer !== '@lostgradient/markdown',
      ),
    );
    expect(remainingPeerDependencies).toEqual({
      '@milkdown/ctx': '^7.17.3',
      '@milkdown/kit': '^7.17.3',
      '@milkdown/prose': '^7.17.3',
      'prosemirror-inputrules': '^1.5.1',
      'prosemirror-model': '^1.25.4',
      'prosemirror-state': '^1.4.4',
      'prosemirror-view': '^1.41.3',
      svelte: '>=5.56.0 <6',
    });
    // Still pins the peer *set* (that Markdown must be declared at all),
    // just not its exact range -- that's what the dynamic guard below
    // checks.
    expect(Object.keys(editorManifest.peerDependencies ?? {})).toContain('@lostgradient/markdown');
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

  test('keeps Editor’s Cinder peer range covering the current Cinder version', () => {
    const cinderPeerRange = editorManifest.peerDependencies?.['@lostgradient/cinder'];
    expect(
      cinderPeerRange,
      'Editor must declare @lostgradient/cinder as a peer dependency.',
    ).toBeDefined();
    if (typeof cinderPeerRange !== 'string') return;

    expect(cinderPeerRange).toMatch(/^\^\d+\.\d+\.\d+$/u);
    expect(
      Bun.semver.satisfies(cinderManifest.version, cinderPeerRange),
      'Editor’s Cinder peer range must cover the current Cinder version.',
    ).toBe(true);
  });

  // The Cinder peer above had a guard from the start; the Markdown peer did not,
  // and that asymmetry shipped a real bug: Markdown went 0.1.0 -> 0.2.0 while
  // Editor still declared `^0.1.0`, which under semver's 0.x rule resolves to
  // `>=0.1.0 <0.2.0` and excludes the Markdown released beside it. Nothing
  // caught it. This mirrors the Cinder test exactly so it cannot recur.
  test('keeps Editor’s Markdown peer range covering the current Markdown version', () => {
    const markdownPeerRange = editorManifest.peerDependencies?.['@lostgradient/markdown'];
    expect(
      markdownPeerRange,
      'Editor must declare @lostgradient/markdown as a peer dependency.',
    ).toBeDefined();
    if (typeof markdownPeerRange !== 'string') return;

    expect(markdownPeerRange).toMatch(/^\^\d+\.\d+\.\d+$/u);
    expect(
      Bun.semver.satisfies(markdownManifest.version, markdownPeerRange),
      'Editor’s Markdown peer range must cover the current Markdown version.',
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

  /**
   * CIN-459. A subpath that resolves to `src` under Bun but to `dist` under
   * Vite's `browser`/`svelte` conditions gives a workspace consumer two module
   * instances of the same file -- and identity-keyed state (a ProseMirror
   * `PluginKey`, an `instanceof`, a module-level registry) silently fails to
   * cross that boundary. #1425 hit it for real: `anchorPluginKey` imported from
   * `./anchor-decorations` (dist) could not read the plugin state installed by
   * `ReviewEditor` (src). That one subpath was fixed; its siblings carried the
   * same hazard, invisible until the next shared identity crossed it.
   *
   * The invariant: any export that points at `./src/` for Bun must resolve to
   * that same source under `browser` and `svelte` too. Entries without a `bun`
   * source condition (e.g. `./review-editor/styles`) are not part of the split
   * and are left alone.
   */
  test('every src-resolving export also resolves to src under browser and svelte', () => {
    const violations: string[] = [];
    for (const [subpath, entry] of Object.entries(editorManifest.exports)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const conditions = entry as Record<string, unknown>;
      const bun = conditions['bun'];
      if (typeof bun !== 'string' || !bun.startsWith('./src/')) continue;
      const keys = Object.keys(conditions);
      const problems: string[] = [];
      if (conditions['browser'] !== bun) problems.push(`browser=${String(conditions['browser'])}`);
      if (conditions['svelte'] !== bun) problems.push(`svelte=${String(conditions['svelte'])}`);
      // Conditional exports resolve to the FIRST matching key, so value equality is
      // not enough: `browser`/`svelte` sinking below `import`/`default` would hand
      // Vite the dist entry again while the values still matched. Pin the order.
      const firstDistKey = Math.min(
        ...['import', 'default'].map((k) => keys.indexOf(k)).filter((i) => i >= 0),
      );
      for (const sourceKey of ['bun', 'browser', 'svelte']) {
        const at = keys.indexOf(sourceKey);
        if (at === -1 || (Number.isFinite(firstDistKey) && at > firstDistKey)) {
          problems.push(`${sourceKey} must precede import/default`);
        }
      }
      if (problems.length > 0)
        violations.push(`${subpath} [${keys.join(', ')}]: ${problems.join('; ')}`);
    }
    expect(violations).toEqual([]);
  });

  test('rewrites a src-resolving utility export to packed dist files', () => {
    // The published artifact must stay dist-only even though the source manifest
    // now names `./src/` under `browser`/`svelte` for utility subpaths too.
    const published = buildPublishedManifest(editorManifest);
    expect(published.exports['./comments']).toEqual({
      types: './dist/comments/index.d.ts',
      browser: './dist/comments/index.js',
      svelte: './dist/comments/index.js',
      import: './dist/comments/index.js',
      default: './dist/comments/index.js',
    });
    expect(published.exports['.']).toEqual({
      types: './dist/index.d.ts',
      browser: './dist/index.js',
      svelte: './dist/index.js',
      import: './dist/index.js',
      default: './dist/index.js',
    });
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
      'svelte',
      'node',
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

    // `toMatchObject` above ignores key ORDER, which is the whole bug — so
    // assert it explicitly for the other two subpaths too.
    for (const subpath of ['./review-editor', './diff-viewer'] as const) {
      expect(exportKeys(published.exports[subpath])).toEqual([
        'types',
        'browser',
        'svelte',
        'node',
        'import',
        'default',
      ]);
    }
  });

  /**
   * cinder#1277: `./markdown-editor`, `./review-editor` and `./diff-viewer` all
   * listed `node` BEFORE `svelte`. Conditional exports resolve to the first
   * matching key and SvelteKit SSR activates both, so the server loaded the
   * precompiled `dist/server` bundle while the browser compiled the same
   * components from source. Two independent compilations of one page disagree
   * on hydration anchor comments, and ReviewEditor threw `hydration_mismatch`
   * on every load. cinder#1261 fixed exactly this for chat and cinder; editor
   * was missed because the assertion above pinned the broken order and the
   * other two subpaths were only checked order-insensitively.
   *
   * Stated as an invariant over EVERY conditional export rather than a list, so
   * a fourth subpath cannot be added wrong — in either manifest.
   */
  test('every conditional export offering both keys lists svelte before node', () => {
    const manifests = {
      source: editorManifest,
      published: buildPublishedManifest(editorManifest),
    };

    for (const [label, manifest] of Object.entries(manifests)) {
      for (const [subpath, entry] of Object.entries(manifest.exports ?? {})) {
        if (typeof entry !== 'object' || entry === null) continue;
        const keys = Object.keys(entry as Record<string, unknown>);
        if (!keys.includes('node') || !keys.includes('svelte')) continue;
        expect(
          keys.indexOf('svelte'),
          `${label} manifest: "${subpath}" must list svelte before node (SSR resolves the first match)`,
        ).toBeLessThan(keys.indexOf('node'));
      }
    }
  });
});
