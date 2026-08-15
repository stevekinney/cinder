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
import { describe, expect, test } from 'bun:test';
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
