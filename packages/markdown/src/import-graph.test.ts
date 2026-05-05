/**
 * Import-graph leanness guard.
 *
 * The bundle-bloat regression we just fixed (rendering pipeline pulled in
 * by every consumer of @cinder/markdown) is the kind of thing that's
 * easy to re-introduce — one accidental `export *` or a barrel import
 * across subpaths and the rendering stack creeps back into diff-only
 * consumers.
 *
 * This test bundles each subpath in isolation via Bun.build and
 * asserts the resulting bundle text does NOT contain any of the heavy
 * rendering-only modules. It does NOT enforce a "no unified" rule on
 * the pipeline barrels — the parser/serializer legitimately depend on
 * unified/remark-parse/remark-stringify, and forcing those out would
 * defeat the purpose of the aggregate.
 *
 * Categories:
 *
 * A. **Narrow / leaf subpaths** — must contain none of the rendering
 *    payload (shiki, katex, rehype-katex). The diff/line-diff path is
 *    the canonical "tiny consumer" — nothing in there should drag the
 *    rendering graph.
 *
 * B. **Aggregate barrels** — must contain none of the rendering payload
 *    even though they may legitimately contain unified for the parser.
 *
 * C. **Bare root** — currently re-exports `diff` and `pipeline` only.
 *    Must contain none of the rendering payload regardless of which
 *    namespace a consumer reaches into.
 */

import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Markers that the rendering bundle MUST contain. The sanity check below
// asserts every marker is present in the rendering bundle; the leanness
// tests assert none are present in lean bundles. Markers must be strings
// that survive bundling — module-specifier paths (e.g. `shiki/core`) get
// inlined and don't appear as literals, but identifier names from the
// modules' source DO appear because Bun emits the module bodies inline.
//
// `scopeName` is a TextMate grammar property used heavily by shiki's
// language registrations; `katex` appears in CSS class generation
// throughout the KaTeX library body. Both are stable across versions.
// `@shikijs` and `shiki` are present in passthrough strings the libraries
// reference internally (worker comm, error messages, etc.).
const RENDERING_MARKERS = ['scopeName', 'katex', '@shikijs', 'shiki'] as const;

// Resolve the markdown package root from this test file's location:
// __tests__ live under packages/markdown/src/, so two levels up is the
// package root. The temp entry file goes inside the package so Bun's
// module resolution finds the workspace's node_modules and the
// `@cinder/markdown` self-reference resolves.
const PACKAGE_ROOT = join(import.meta.dirname, '..');

async function bundleSnippet(snippet: string): Promise<string> {
  const dir = mkdtempSync(join(PACKAGE_ROOT, '.import-graph-'));
  const entry = join(dir, 'entry.ts');
  writeFileSync(entry, snippet);
  try {
    const result = await Bun.build({
      entrypoints: [entry],
      target: 'browser',
      format: 'esm',
      conditions: ['bun'],
    });
    if (!result.success) {
      throw new Error(`Build failed:\n${result.logs.map(String).join('\n')}`);
    }
    const output = result.outputs[0];
    if (!output) throw new Error('Build produced no output');
    return await output.text();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertNoRenderingPayload(bundle: string, label: string): void {
  for (const marker of RENDERING_MARKERS) {
    if (bundle.includes(marker)) {
      throw new Error(
        `${label}: rendering payload "${marker}" leaked into the bundle. ` +
          `Importing this subpath should not drag the rendering pipeline. ` +
          `Check whether a recent change added an "export *" or a deep import ` +
          `that crosses from a non-rendering module into rendering.`,
      );
    }
  }
}

describe('import-graph leanness', () => {
  describe('narrow subpaths (no rendering)', () => {
    it('@cinder/markdown/diff/line-diff does not pull in shiki/katex/rehype-katex', async () => {
      const bundle = await bundleSnippet(
        `import * as m from '@cinder/markdown/diff/line-diff';\nglobalThis.__leanGuard__ = m;\n`,
      );
      assertNoRenderingPayload(bundle, '@cinder/markdown/diff/line-diff');
      // Not also asserting "no unified" — line-diff is pure
      // string-level diff via diff-match-patch; if a regression adds
      // unified here it'd be caught implicitly by entry-bundle size
      // budgets in the playground.
    }, 30_000);
  });

  describe('aggregate barrels (no rendering; unified allowed)', () => {
    it('@cinder/markdown/pipeline does not pull in shiki/katex/rehype-katex', async () => {
      const bundle = await bundleSnippet(
        `import * as m from '@cinder/markdown/pipeline';\nglobalThis.__leanGuard__ = m;\n`,
      );
      assertNoRenderingPayload(bundle, '@cinder/markdown/pipeline');
    }, 30_000);

    it('@cinder/markdown/diff does not pull in shiki/katex/rehype-katex', async () => {
      const bundle = await bundleSnippet(
        `import * as m from '@cinder/markdown/diff';\nglobalThis.__leanGuard__ = m;\n`,
      );
      assertNoRenderingPayload(bundle, '@cinder/markdown/diff');
    }, 30_000);
  });

  describe('bare root (no rendering reachable)', () => {
    it('@cinder/markdown root via diff namespace does not pull rendering', async () => {
      const bundle = await bundleSnippet(
        `import { diff } from '@cinder/markdown';\nglobalThis.__leanGuard__ = diff;\n`,
      );
      assertNoRenderingPayload(bundle, '@cinder/markdown (diff usage)');
    }, 30_000);

    it('@cinder/markdown root via pipeline namespace does not pull rendering', async () => {
      const bundle = await bundleSnippet(
        `import { pipeline } from '@cinder/markdown';\nglobalThis.__leanGuard__ = pipeline;\n`,
      );
      assertNoRenderingPayload(bundle, '@cinder/markdown (pipeline usage)');
    }, 30_000);
  });

  describe('rendering subpath does pull in shiki/katex (sanity check)', () => {
    // Inverse assertion: importing the rendering namespace MUST contain
    // EVERY rendering marker. We require all-present rather than
    // any-present because a subset would let the leanness tests pass
    // vacuously: if a future bundler change inlines `shiki/core` so the
    // string no longer appears literally in bundle text, the leanness
    // tests would also stop seeing it for the lean subpaths — they'd
    // pass for the wrong reason. Requiring `=== RENDERING_MARKERS.length`
    // here forces the test suite to fail loudly if a marker becomes
    // undetectable, prompting an update to the marker list.
    it('@cinder/markdown/rendering contains every rendering marker', async () => {
      const bundle = await bundleSnippet(
        `import * as m from '@cinder/markdown/rendering';\nglobalThis.__leanGuard__ = m;\n`,
      );
      const missing = RENDERING_MARKERS.filter((marker) => !bundle.includes(marker));
      if (missing.length > 0) {
        throw new Error(
          `Sanity check failed: rendering bundle is missing markers ${missing.join(', ')}. ` +
            `The marker list in import-graph.test.ts (RENDERING_MARKERS) is stale relative ` +
            `to the actual bundle output — likely because of a shiki/katex/bundler version ` +
            `change. Update RENDERING_MARKERS to use strings that still appear literally ` +
            `in the rendering bundle, otherwise the leanness tests above can pass vacuously.`,
        );
      }
      expect(missing.length).toBe(0);
    }, 30_000);
  });
});
