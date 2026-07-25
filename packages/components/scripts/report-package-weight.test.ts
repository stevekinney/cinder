import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

    test('ignores every non-components top-level dist directory (dist/server, root dist/index.js)', () => {
      // `dist/server` mirrors the ENTIRE component tree for SSR — it's an
      // aggregate, not a bounded feature surface, so it's excluded on
      // purpose rather than tracked against the same single-component
      // budget. Root `dist/index.js` is excluded the same way. Cinder no
      // longer vendors `@lostgradient/markdown`'s or `@lostgradient/editor`'s
      // dist trees at all (see docs/decisions/package-boundaries.md, Phase
      // 5) — it depends on markdown as an ordinary external dependency now.
      const sizes = new Map<string, number>();
      recordEntrypointSize(sizes, 'dist/server/index.js', 5_000_000, true);
      recordEntrypointSize(sizes, 'dist/index.js', 2_000_000, true);
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

  test('the cinder-mcp check script enables budget assertions', () => {
    const workspaceRoot = resolve(import.meta.dirname, '../../..');
    const manifest = JSON.parse(
      readFileSync(resolve(workspaceRoot, 'packages/mcp/package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const weightCheckScript = manifest.scripts['package:weight:check'];
    if (weightCheckScript === undefined)
      throw new Error('cinder-mcp package weight check is missing');

    expect(weightCheckScript.split(/\s+/)).toContain('--check');
  });

  test('cinder-mcp has an active weight budget and uses headless entrypoint grouping', async () => {
    // cinder-mcp ships no `dist/components/` directory (once built) —
    // recordEntrypointSize must therefore group it like Markdown (headless),
    // not like Cinder/Chat. Skip this specific check when dist doesn't exist
    // yet (a fresh checkout before the first build) rather than asserting a
    // false negative for the wrong reason.
    const workspaceRoot = resolve(import.meta.dirname, '../../..');
    const mcpDistDirectory = resolve(workspaceRoot, 'packages/mcp/dist');
    if (existsSync(mcpDistDirectory)) {
      expect(existsSync(join(mcpDistDirectory, 'components'))).toBe(false);
    }

    // Running the check script against a package with no configured budget
    // throws "no package weight budget is configured for <name>" before it
    // ever gets to packing — importing the module and invoking its CLI would
    // require a built tarball, so this instead pins the same source-of-truth
    // list the runtime check reads: report-package-weight.ts must declare a
    // budget for @lostgradient/cinder-mcp.
    const reportPackageWeightSource = await Bun.file(
      join(import.meta.dirname, 'report-package-weight.ts'),
    ).text();
    expect(reportPackageWeightSource).toMatch(/'@lostgradient\/cinder-mcp':\s*{/);
  });
});
