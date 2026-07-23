import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { packageTarballPath, recordEntrypointSize } from './report-package-weight.ts';

describe('package-weight artifact selection', () => {
  test('selects only the artifact matching the source manifest version', () => {
    expect(
      packageTarballPath('/workspace/packages/components', {
        name: '@lostgradient/cinder',
        version: '0.15.0',
      }),
    ).toBe('/workspace/packages/components/lostgradient-cinder-0.15.0.tgz');
  });

  test('derives the Chat artifact independently', () => {
    expect(
      packageTarballPath('/workspace/packages/chat', {
        name: '@lostgradient/chat',
        version: '0.1.0',
      }),
    ).toBe('/workspace/packages/chat/lostgradient-chat-0.1.0.tgz');
  });
});

describe('recordEntrypointSize', () => {
  describe('components-layout packages (Cinder, Chat)', () => {
    test('groups component files under dist/components/<name>', () => {
      const sizes = new Map<string, number>();
      recordEntrypointSize(sizes, 'dist/components/button/index.js', 100, true);
      recordEntrypointSize(sizes, 'dist/components/button/button.svelte.js', 50, true);
      recordEntrypointSize(sizes, 'dist/components/button/index.d.ts', 10, true);
      expect(Object.fromEntries(sizes)).toEqual({ 'dist/components/button': 160 });
    });

    test('groups experimental components under dist/components/experimental/<name>', () => {
      const sizes = new Map<string, number>();
      recordEntrypointSize(sizes, 'dist/components/experimental/data-grid/index.js', 200, true);
      recordEntrypointSize(sizes, 'dist/components/experimental/data-grid/index.d.ts', 20, true);
      expect(Object.fromEntries(sizes)).toEqual({
        'dist/components/experimental/data-grid': 220,
      });
    });

    test('ignores dist/components/<name> files with no further nesting', () => {
      const sizes = new Map<string, number>();
      // `dist/components/button` itself would be length 3 — not a real file
      // path, but guards against an off-by-one if the dist layout ever
      // changes to put a bare file directly under `components/`.
      recordEntrypointSize(sizes, 'dist/components/button.js', 100, true);
      expect(sizes.size).toBe(0);
    });

    test('ignores every non-components top-level dist directory (dist/server, root dist/index.js, vendored upstream trees)', () => {
      // `dist/server` mirrors the ENTIRE component tree for SSR — it's an
      // aggregate, not a bounded feature surface, so it's excluded on
      // purpose rather than tracked against the same single-component
      // budget. The vendored `dist/markdown/**`/`dist/editor/**` trees
      // (Cinder re-exporting its upstream packages) and root `dist/index.js`
      // are excluded the same way.
      const sizes = new Map<string, number>();
      recordEntrypointSize(sizes, 'dist/server/index.js', 5_000_000, true);
      recordEntrypointSize(sizes, 'dist/index.js', 2_000_000, true);
      recordEntrypointSize(sizes, 'dist/markdown/rendering/index.js', 300_000, true);
      recordEntrypointSize(sizes, 'dist/editor/editor/index.js', 300_000, true);
      expect(sizes.size).toBe(0);
    });
  });

  describe('non-components (headless) packages, e.g. Markdown', () => {
    test('groups files by top-level dist subdirectory', () => {
      // This is the regression this test file guards against: markdown has
      // no dist/components/** at all, so every file used to be silently
      // ignored and the largestEntrypointBytes budget was a no-op for the
      // whole package. Mirrors markdown's real dist/ layout
      // (dist/pipeline/**, dist/diff/**, dist/rendering/**, ...).
      const sizes = new Map<string, number>();
      recordEntrypointSize(sizes, 'dist/pipeline/index.js', 100, false);
      recordEntrypointSize(sizes, 'dist/pipeline/ast.js', 50, false);
      recordEntrypointSize(sizes, 'dist/diff/index.js', 30, false);
      recordEntrypointSize(sizes, 'dist/diff/line-diff.js', 70, false);
      recordEntrypointSize(sizes, 'dist/rendering/highlighter.js', 40, false);
      expect(Object.fromEntries(sizes)).toEqual({
        'dist/pipeline': 150,
        'dist/diff': 100,
        'dist/rendering': 40,
      });
    });

    test('rolls up root-level dist/<file> entries (the "." export) into a single "dist" entrypoint', () => {
      const sizes = new Map<string, number>();
      recordEntrypointSize(sizes, 'dist/index.js', 300, false);
      recordEntrypointSize(sizes, 'dist/index.d.ts', 40, false);
      recordEntrypointSize(sizes, 'dist/index.js.map', 60, false);
      expect(Object.fromEntries(sizes)).toEqual({ dist: 400 });
    });
  });

  test('ignores files outside dist/ entirely, regardless of layout', () => {
    const sizes = new Map<string, number>();
    recordEntrypointSize(sizes, 'README.md', 100, true);
    recordEntrypointSize(sizes, 'package.json', 100, false);
    expect(sizes.size).toBe(0);
  });
});

describe('package-weight budget gates', () => {
  test('the Chat check script enables budget assertions', () => {
    const workspaceRoot = resolve(import.meta.dirname, '../../..');
    const manifest = JSON.parse(
      readFileSync(resolve(workspaceRoot, 'packages/chat/package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const weightCheckScript = manifest.scripts['package:weight:check'];
    if (weightCheckScript === undefined) throw new Error('Chat package weight check is missing');

    expect(weightCheckScript.split(/\s+/)).toContain('--check');
  });
});

describe('upstream vendoring stays scoped to editor headless surface', () => {
  // `build.ts` vendors ALL of @lostgradient/editor's dist/** into both
  // `dist/editor/` and `dist/server/editor/` (copyUpstreamDistInto), because
  // cinder re-exports editor's headless anchor/comment/session/export/
  // ProseMirror runtime at `./commentary/*` and `./editor/*`. Editor's
  // compiled markdown-editor/review-editor/diff-viewer Svelte components are
  // NOT part of that re-exported surface (suppressed to `null` in
  // CINDER_KEY_OVERRIDES — see lib/derive-upstream-reexports.ts) and must
  // never reach cinder's dist, let alone its published tarball: they are
  // pure bloat that grows as editor's component surface grows, with no
  // exports-map entry pointing at them to catch the leak structurally.
  // Requires a prior `bun run build` (dist/ is absent in the scoped
  // unit-test-only CI job); skipped rather than failing so that job stays
  // green — the full `bun run validate` chain always builds first.
  const distributionRoot = resolve(import.meta.dirname, '..', 'dist');

  test.skipIf(!existsSync(distributionRoot))(
    'dist/ contains no vendored editor component bundles',
    async () => {
      const offenders: string[] = [];
      const glob = new Glob('editor/**/components/**');
      for await (const relativePath of glob.scan({ cwd: distributionRoot })) {
        offenders.push(relativePath);
      }
      expect(offenders).toEqual([]);
    },
  );
});
