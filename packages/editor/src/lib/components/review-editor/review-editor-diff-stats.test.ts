/**
 * Tests for the ReviewEditor toolbar's diff-stats computation (cinder#1307).
 *
 * `computeReviewEditorDiffStats` is exercised directly here rather than through
 * a mounted `ReviewEditor`: the component is too heavy to mount in happy-dom
 * (Milkdown + ProseMirror internals fail in non-browser DOMs — see
 * `review-editor.snapshot-mode.test.ts`), but this computation only touches
 * its two string arguments and needs no DOM at all.
 *
 * A source pin below covers the half this file's behavioral test cannot: that
 * `review-editor-impl.svelte` actually calls this function for `diffStats`
 * rather than reintroducing a direct `normalize()` call that would make the
 * bug come back invisibly to this test file.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
// Imported with the SAME specifier extension (`.js`) `review-editor-diff-stats.ts` itself uses to
// import `normalizeDocument` — confirmed by a standalone check that both specifiers resolve to
// the identical module instance (`viaJsImport.normalizeDocument === viaTsImport.normalizeDocument`
// via `toBe`), but matching the production import's own specifier removes any doubt for a reader,
// and matches this package's own convention for spying on a sibling module's export (see
// `editor/attach.test.ts`'s `import * as editorRuntime from './editor.js'`).
import * as normalizeDocumentModule from '../../export/normalize-document.js';
import { computeReviewEditorDiffStats } from './review-editor-diff-stats.ts';

describe('computeReviewEditorDiffStats', () => {
  test('counts a one-line front-matter value edit as one modified line, not two', () => {
    // cinder#1307's exact repro: normalize() has no front-matter step, so handed
    // the whole document it re-reads the `---` fences as a thematic break plus a
    // setext heading and re-emits the closing underline at the new content
    // width. Shortening `owner: jane` to `owner: bob` changes nothing about the
    // dash count, but normalize() shortens BOTH the value line and (because it
    // no longer thinks it is a fence) the underline it invents beneath it — one
    // real edit surfacing as two modified lines.
    const original = '---\ntitle: Release Plan\nowner: jane\n---\n\n# Release Plan\n\nShip it.\n';
    const current = '---\ntitle: Release Plan\nowner: bob\n---\n\n# Release Plan\n\nShip it.\n';

    expect(computeReviewEditorDiffStats(original, current)).toEqual({
      added: 0,
      removed: 0,
      modified: 1,
    });
  });

  test('agrees with generateUnifiedDiff on the same front-matter edit', () => {
    // generateUnifiedDiff already got the cinder#1285 fix. Both counts should
    // describe the same edit the same way: one line changed (getDiffStats
    // counts a paired -/+ as one "modified" line; generateUnifiedDiff reports
    // it as one addition and one deletion).
    const original = '---\ntitle: Release Plan\nowner: jane\n---\n\nShip it.\n';
    const current = '---\ntitle: Release Plan\nowner: bob\n---\n\nShip it.\n';

    expect(computeReviewEditorDiffStats(original, current)).toEqual({
      added: 0,
      removed: 0,
      modified: 1,
    });
  });

  test('still normalizes the body underneath front matter', () => {
    // A list-marker-only change is exactly what normalization exists to
    // swallow; front-matter handling must not cost us that.
    const original = '---\ntitle: Plan\n---\n\n- one\n- two\n';
    const starred = '---\ntitle: Plan\n---\n\n* one\n* two\n';

    expect(computeReviewEditorDiffStats(original, starred)).toEqual({
      added: 0,
      removed: 0,
      modified: 0,
    });
  });

  test('reports no changes for identical documents with front matter', () => {
    const document = '---\ntitle: Plan\nowner: jane\n---\n\nBody text.\n';

    expect(computeReviewEditorDiffStats(document, document)).toEqual({
      added: 0,
      removed: 0,
      modified: 0,
    });
  });

  test('returns zeroed stats when there is no original (new document)', () => {
    expect(computeReviewEditorDiffStats('', 'New content')).toEqual({
      added: 0,
      removed: 0,
      modified: 0,
    });
  });
});

describe('computeReviewEditorDiffStats normalization cost (cinder#1336)', () => {
  // review-editor-impl.svelte's toolbar badge recomputes this on every settled
  // edit while `original` — the review session's fixed baseline — never
  // changes. cinder#1336 measured that re-normalizing `original` from scratch
  // on every call, alongside `current`, accounted for >99% of a ~30ms-median
  // recompute on a realistic document: the two normalizeDocument calls were
  // "essentially identical in cost," and one of them (original's) was pure
  // waste once original stopped moving.
  //
  // This spies on the real normalizeDocument (call-through preserved, so the
  // returned stats stay correct — see the assertion below) rather than timing
  // wall-clock cost, per this repo's own stance against timing-threshold
  // assertions: a call-count assertion is deterministic and can't flake the
  // way a duration budget can.
  //
  // `mock.restore()` runs after every test in this describe block, not just
  // the one that creates the spy: restoring only at the end of that test's
  // own body would leak the spy into every subsequent test if an assertion
  // above it throws first (review finding on the initial version of this
  // file, which restored manually and only reached that call on the happy
  // path).
  afterEach(() => {
    mock.restore();
  });

  test('does not re-normalize an unchanged original across repeated calls', () => {
    // Unique per test run (not just per test in this file): the cache this
    // pins is module-global and never cleared, so a fixed literal here would
    // make `callsAfterFirst` depend on process history — cold under a single
    // run, warm (and wrong) under `--rerun-each` or if an earlier test in
    // this file happens to reuse the same string. A nonce keeps this test's
    // `original` guaranteed cache-cold regardless of what ran before it.
    const nonce = `${Date.now()}-${Math.random()}`;
    const original = `# Title ${nonce}\n\nOne paragraph.\n\nAnother paragraph.\n`;
    const normalizeSpy = spyOn(normalizeDocumentModule, 'normalizeDocument');

    const first = computeReviewEditorDiffStats(original, `${original}Edit one.\n`);
    const callsAfterFirst = normalizeSpy.mock.calls.length;
    // The very first call for a given `original` must still normalize it —
    // there's nothing to reuse yet.
    expect(callsAfterFirst).toBe(2); // original once, current once

    const second = computeReviewEditorDiffStats(original, `${original}Edit two.\n`);
    const callsAfterSecond = normalizeSpy.mock.calls.length;
    // A second call with the SAME original and a DIFFERENT current must only
    // normalize current. Without the fix, this call count matches the first
    // call's exactly (original gets re-normalized every time); with the fix,
    // it grows by exactly one (current only).
    expect(callsAfterSecond - callsAfterFirst).toBe(1);

    // Reusing the cached normalized original must not change the result:
    // this is a performance fix, not a behavior change.
    expect(first).toEqual({ added: 1, removed: 0, modified: 0 });
    expect(second).toEqual({ added: 1, removed: 0, modified: 0 });
  });

  test('still produces correct results when original changes between calls', () => {
    // A cache keyed on the wrong thing (or a single slot that goes stale)
    // would be invisible in the call-count assertion above if it also
    // silently returned wrong stats. Interleave two different originals —
    // as two concurrent ReviewEditor instances on the same page would — and
    // confirm each is diffed against ITS OWN original, not a leftover cached
    // one from the other instance.
    const originalA = '# Doc A\n\nOriginal A body.\n';
    const originalB = '# Doc B\n\nOriginal B body.\n';

    const statsA1 = computeReviewEditorDiffStats(originalA, '# Doc A\n\nEdited A body.\n');
    const statsB1 = computeReviewEditorDiffStats(originalB, '# Doc B\n\nEdited B body.\n');
    // Re-visit A after B interleaved — this must still diff against
    // originalA, not originalB.
    const statsA2 = computeReviewEditorDiffStats(originalA, '# Doc A\n\nEdited A again.\n');

    expect(statsA1).toEqual({ added: 0, removed: 0, modified: 1 });
    expect(statsB1).toEqual({ added: 0, removed: 0, modified: 1 });
    expect(statsA2).toEqual({ added: 0, removed: 0, modified: 1 });
  });

  test('recomputes correctly once an original ages out of the bounded cache', () => {
    // The cache is intentionally bounded (a page can hold more than one
    // ReviewEditor, but not an unbounded number forever) and evicts the
    // least-recently-used entry once over capacity. That eviction path has
    // no other coverage: push enough distinct originals through to guarantee
    // the first one has been evicted by the time it's revisited, and confirm
    // the eviction recomputes correctly rather than corrupting anything (a
    // stale-cache bug here would still return SOME normalized string, so
    // this checks the returned stats are right, not just that nothing
    // throws).
    const nonce = `${Date.now()}-${Math.random()}`;
    const originals = Array.from(
      { length: 20 },
      (_, i) => `# Doc ${nonce}-${i}\n\nOriginal body ${i}.\n`,
    );
    const [firstOriginal] = originals;
    if (firstOriginal === undefined) throw new Error('expected at least one generated original');

    for (const [i, original] of originals.entries()) {
      const stats = computeReviewEditorDiffStats(
        original,
        `# Doc ${nonce}-${i}\n\nEdited body ${i}.\n`,
      );
      expect(stats).toEqual({ added: 0, removed: 0, modified: 1 });
    }

    // firstOriginal is long since evicted (20 distinct originals pushed
    // through a cache far smaller than that) — revisiting it must still
    // diff correctly against ITS OWN original, not throw, and not return a
    // stale/wrong result from whatever now occupies that cache slot.
    const revisited = computeReviewEditorDiffStats(
      firstOriginal,
      `# Doc ${nonce}-0\n\nRevisited edit.\n`,
    );
    expect(revisited).toEqual({ added: 0, removed: 0, modified: 1 });
  });
});

describe('review-editor-impl.svelte wiring (cinder#1307)', () => {
  const implementationSource = Bun.file(
    new URL('./review-editor-impl.svelte', import.meta.url).pathname,
  ).text();

  test('diffStats is computed through computeReviewEditorDiffStats, not a direct normalize() call', async () => {
    const source = await implementationSource;

    // The component cannot be mounted in this package's test harness (Milkdown
    // needs a real browser DOM), so the behavioral test above cannot see
    // review-editor-impl.svelte at all. This pin closes that gap: if the
    // component reverted to computing diffStats with its own `normalize()`
    // call, the front-matter bug would come back with every test in this file
    // still green.
    expect(source).toMatch(
      /const diffStats = \$derived\.by\(\s*\(\)\s*=>\s*computeReviewEditorDiffStats\(/,
    );
    expect(source).toContain(
      "import { computeReviewEditorDiffStats } from './review-editor-diff-stats.ts';",
    );

    // Guard against a regression that keeps the import but adds back an
    // inline normalize()-based computation elsewhere in the diffStats block.
    const diffStatsBlock = source.slice(
      source.indexOf('const diffStats = $derived.by'),
      source.indexOf('const diffStats = $derived.by') + 200,
    );
    expect(diffStatsBlock).not.toMatch(/normalize\(/);
  });
});
