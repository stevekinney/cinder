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

// This test file lives at packages/markdown/src/, so `import.meta.dirname` is
// that `src` directory and three levels up is the workspace root (the directory
// holding `package.json` + `bun.lock` + the `packages/` folder).
//
// The temp entry file MUST live somewhere inside the workspace tree so Bun's
// module resolution walks up to the workspace `node_modules` and the
// `@cinder/markdown` self-reference resolves — an entry placed in `os.tmpdir()`
// fails with `Could not resolve: "@cinder/markdown/..."`. But it must NOT live
// inside `packages/markdown` itself: see `bundleSnippet` for why.
const WORKSPACE_ROOT = join(import.meta.dirname, '..', '..', '..');

// Maximum number of Bun.build attempts per snippet. See `isTransientReadError`.
const MAX_BUILD_ATTEMPTS = 5;

/**
 * Pull every stringy field out of a thrown bundler error so the retry matcher
 * can see the real errno text.
 *
 * On a build failure `Bun.build` *throws* (it does not return
 * `success: false`), and the thrown value is an `AggregateError` whose own
 * `String(error)` is only `"AggregateError: Bundle failed"`. The actual
 * per-module diagnostic — e.g. `EISDIR reading file: ".../line-diff.ts"` —
 * lives one level down, on each entry of `error.errors`. We concatenate the
 * top-level string/message with every inner error's string/message and match
 * against that. (Matching `String(error)` alone, as the original guard did,
 * could never catch the read error — which is why the earlier retry was inert.)
 */
function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  const push = (value: unknown): void => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      parts.push(value);
      return;
    }
    if (value instanceof Error) {
      // `Error.prototype.toString()` yields "Name: message" — the form the
      // bundler uses for its per-module diagnostics (e.g. the EISDIR text).
      parts.push(value.toString());
    } else {
      const message = (value as { message?: unknown }).message;
      if (typeof message === 'string') parts.push(message);
    }
    const inner = (value as { errors?: unknown }).errors;
    if (Array.isArray(inner)) {
      for (const entry of inner) push(entry);
    }
  };
  push(error);
  return parts.join('\n');
}

/**
 * Detect the transient filesystem read errors Bun's bundler emits when a source
 * file in the module graph is touched concurrently by another process.
 *
 * Under CI the whole workspace runs `bun run --filter='*' test`, so the
 * `@cinder/diff` package's own `bun test` process reads
 * `packages/diff/src/line-diff.ts` at the same moment this test's `Bun.build`
 * resolves that file through the `@cinder/diff/line-diff` re-export. On Linux
 * (ext4/overlayfs) that cross-process read can momentarily surface as
 * `EISDIR`/`ENOTDIR` while reading a regular `.ts` file; the bundler reports it
 * as `EISDIR reading file: ".../line-diff.ts"` /
 * `Unexpected reading file: ".../line-diff.ts"`, and the underlying libuv form
 * is `EISDIR: illegal operation on a directory, read`. The file is never a
 * directory and a fresh read succeeds; it does not reproduce on macOS/APFS.
 *
 * This retry is a defence-in-depth backstop only — the primary fix is
 * structural (see `bundleSnippet`). It is deliberately narrow: it matches the
 * read-errno families, never a genuine resolution failure or a rendering-payload
 * leak, so a real regression still fails immediately.
 */
function isTransientReadError(message: string): boolean {
  return /(?:EISDIR|ENOTDIR|Unexpected)[^\n]*reading file|EISDIR|ENOTDIR/.test(message);
}

async function buildOnce(entry: string): Promise<string> {
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
}

async function bundleSnippet(snippet: string): Promise<string> {
  // Build from a temp dir at the WORKSPACE ROOT, never inside packages/markdown.
  //
  // Root cause of the Linux-only CI flake: when the entry lived inside
  // packages/markdown, several of these tests ran concurrently, each doing
  // `mkdtemp`/`rmSync` of a `.import-graph-*` dir inside the very package tree
  // that `Bun.build` scans while resolving `@cinder/markdown/*`. On Linux a
  // directory entry appearing or vanishing inside a tree the resolver is
  // walking can make it stat a path mid-deletion and report a spurious read
  // error, which propagates as the EISDIR/Unexpected failure on the deepest
  // leaf of the graph (`line-diff.ts`). Placing the temp dirs at the workspace
  // root — siblings of `packages/`, not children of it — removes that
  // interference entirely while keeping module resolution working.
  const dir = mkdtempSync(join(WORKSPACE_ROOT, '.import-graph-'));
  const entry = join(dir, 'entry.ts');
  writeFileSync(entry, snippet);
  try {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_BUILD_ATTEMPTS; attempt++) {
      try {
        return await buildOnce(entry);
      } catch (error) {
        lastError = error;
        // Inspect the AggregateError's inner errors, not just String(error):
        // the errno text lives there (see collectErrorText).
        if (attempt < MAX_BUILD_ATTEMPTS && isTransientReadError(collectErrorText(error))) {
          // Brief backoff so the concurrent reader's file-access window can
          // close before we retry, instead of re-hitting the race instantly.
          await Bun.sleep(25 * attempt);
          continue;
        }
        throw error;
      }
    }
    // Unreachable: the loop either returns or throws, but TypeScript needs a
    // terminal statement after the bounded retry.
    throw lastError;
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
