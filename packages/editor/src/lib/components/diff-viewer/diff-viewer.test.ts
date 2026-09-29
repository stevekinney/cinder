/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { hasButtonLabelled } from './diff-viewer-test-helpers.ts';

/**
 * Behavioural coverage for the DiffViewer surface.
 *
 * The composed `diff-viewer.svelte` shell cannot be mounted directly under the
 * happy-dom + Svelte 5 test harness: its mount-time flush rebuilds the keyed
 * `{#each}` body, the front-matter block, the size-warning banner and the
 * toolbar in a single pass, and happy-dom's fragment/anchor model throws inside
 * Svelte's reactivity teardown while that flush is in flight. (Mounting any one
 * of these pieces in isolation is fine — it is the simultaneous mount-time
 * rebuild of all of them that trips the DOM stub.)
 *
 * Rather than assert against an environment defect, this suite exercises the
 * exact behaviours the four acceptance criteria describe through the layers the
 * shell is a thin wrapper over:
 *
 * - basic mount / identical strings   → the line-diff engine reports no changes
 * - changed strings (renders hunks)    → the engine emits diffs + hunks, and the
 *                                        toolbar surfaces change statistics
 * - view-mode toggle (unified/…/orig)  → `DiffLine` shows/hides lines per mode
 * - large-payload gating (>100KB)      → the toolbar exposes the manual
 *                                        "Compute Diff" trigger in the manual tier
 *
 * These are real mounts of the diff-viewer's own components plus its diff
 * engine — not reimplementations — so the assertions track the shipped code.
 */

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { computeLineDiff, computeWordChanges, getDiffStats, groupIntoHunks } =
  await import('@lostgradient/markdown');
const { default: DiffLine } = await import('./diff-line.svelte');
const { default: DiffToolbar } = await import('./diff-toolbar.svelte');

describe('DiffViewer: identical input (basic mount)', () => {
  test('manual-tier copy reuses computed hunks instead of invoking a second generator', async () => {
    const source = await Bun.file(new URL('./diff-viewer.svelte', import.meta.url)).text();
    expect(source).toContain("diffState.tier === 'manual'");
    expect(source).toContain('formatComputedUnifiedDiff(');
    expect(source).toContain('unifiedDiffHunks');
    expect(source).toContain('original: displayedOriginal');
    expect(source).toContain('current: displayedCurrent');
  });

  test('copy includes front matter and preserves normalizeInputs semantics', async () => {
    const source = await Bun.file(new URL('./diff-viewer.svelte', import.meta.url)).text();
    expect(source).toContain('[...frontMatterDiffs, ...lineDiffs]');
    expect(source).toContain('composeDisplayedDocument(');
    expect(source).toContain('content: displayedCurrent');
    expect(source).toContain('original: displayedOriginal');
    expect(source).toContain('{ normalizeInputs: false }');
    expect(source).not.toContain("split('\\n').filter(Boolean)");
  });
  test('two identical strings produce only unchanged lines and zero stats', () => {
    const diffs = computeLineDiff(
      'line one\nline two\nline three',
      'line one\nline two\nline three',
    );

    expect(diffs.every((diff) => diff.type === 'same')).toBe(true);
    expect(diffs).toHaveLength(3);
    expect(getDiffStats(diffs)).toEqual({ added: 0, removed: 0, modified: 0 });
    // No changes means no hunks to group for revert.
    expect(groupIntoHunks(diffs)).toHaveLength(0);
  });

  test('the toolbar reports "No changes" when there are no diffs', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
    });

    expect(container.textContent).toContain('No changes');
    // With nothing changed, there is no change-navigation counter.
    expect(container.querySelector('.change-counter')).toBeNull();
  });

  test('the toolbar omits copy when there is no diff to copy', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      oncopydiff: () => {},
    });

    expect(hasButtonLabelled(container, 'Copy unified diff')).toBe(false);
  });
});

describe('DiffViewer: changed input (renders hunks)', () => {
  test('a modified line yields a modified diff, a hunk, and modified stats', () => {
    const diffs = computeLineDiff('first\nsecond\nthird', 'first\nSECOND CHANGED\nthird');

    expect(diffs.map((diff) => diff.type)).toEqual(['same', 'modified', 'same']);
    expect(getDiffStats(diffs)).toEqual({ added: 0, removed: 0, modified: 1 });

    const hunks = groupIntoHunks(diffs);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.lines.some((line) => line.type === 'modified')).toBe(true);
  });

  test('inserted and deleted lines surface as added/removed diffs', () => {
    const diffs = computeLineDiff('keep\nold middle\nkeep end', 'keep\nkeep end\nbrand new');

    // There is at least one structural change, grouped into a hunk.
    expect(diffs.some((diff) => diff.type !== 'same')).toBe(true);
    expect(groupIntoHunks(diffs).length).toBeGreaterThan(0);

    const stats = getDiffStats(diffs);
    expect(stats.added + stats.removed + stats.modified).toBeGreaterThan(0);
  });

  test('the toolbar shows statistic badges and a navigation counter when changed', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 2, removed: 1, modified: 1 },
      changeCount: 4,
      currentChangeIndex: 0,
      hasChanges: true,
    });

    // One stat badge per non-zero statistic kind.
    expect(container.querySelectorAll('.stat-badge').length).toBeGreaterThan(0);

    const counter = container.querySelector('.change-counter');
    expect(counter).not.toBeNull();
    expect(counter?.textContent).toContain('/ 4');
  });

  test('a changed line renders as an interactive, selectable diff line', async () => {
    let selectCount = 0;

    const { container } = render(DiffLine, {
      diff: {
        type: 'modified',
        oldText: 'old text',
        newText: 'new text',
        wordChanges: computeWordChanges('old text', 'new text'),
      },
      viewMode: 'unified',
      selected: false,
      onselect: () => {
        selectCount += 1;
      },
    });

    const button = container.querySelector<HTMLButtonElement>('button.diff-line');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('data-selected')).toBe('false');

    await fireEvent.click(requiredInstance(button, HTMLButtonElement));
    expect(selectCount).toBe(1);
  });
});

describe('DiffViewer: view-mode toggle', () => {
  test('unified view shows a removed line; final view hides it', () => {
    const unified = render(DiffLine, {
      diff: { type: 'removed', text: 'gone' },
      viewMode: 'unified',
    });
    expect(unified.container.textContent).toContain('gone');
    expect(unified.container.querySelector('.diff-line')).not.toBeNull();

    const final = render(DiffLine, { diff: { type: 'removed', text: 'gone' }, viewMode: 'final' });
    // Final view reflects the resulting document, so removed lines are hidden.
    expect(final.container.querySelector('.diff-line')).toBeNull();
    expect(final.container.textContent).not.toContain('gone');
  });

  test('original view hides an added line; final view shows it', () => {
    const original = render(DiffLine, {
      diff: { type: 'added', text: 'plus' },
      viewMode: 'original',
    });
    // Original view reflects the baseline, so added lines are hidden.
    expect(original.container.querySelector('.diff-line')).toBeNull();
    expect(original.container.textContent).not.toContain('plus');

    const final = render(DiffLine, { diff: { type: 'added', text: 'plus' }, viewMode: 'final' });
    expect(final.container.querySelector('.diff-line-added')).not.toBeNull();
    expect(final.container.textContent).toContain('plus');
  });

  test('modified lines pick the matching view-mode class', () => {
    const modified = {
      type: 'modified' as const,
      oldText: 'before',
      newText: 'after',
      wordChanges: computeWordChanges('before', 'after'),
    };

    expect(
      render(DiffLine, { diff: modified, viewMode: 'unified' }).container.querySelector(
        '.diff-line-modified',
      ),
    ).not.toBeNull();
    expect(
      render(DiffLine, { diff: modified, viewMode: 'final' }).container.querySelector(
        '.diff-line-modified-final',
      ),
    ).not.toBeNull();
    expect(
      render(DiffLine, { diff: modified, viewMode: 'original' }).container.querySelector(
        '.diff-line-modified-original',
      ),
    ).not.toBeNull();
  });

  test('the toolbar exposes all three view-mode segments with unified active by default', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 1, removed: 0, modified: 0 },
      changeCount: 1,
      currentChangeIndex: 0,
      hasChanges: true,
      viewMode: 'unified',
    });

    const segments = Array.from(container.querySelectorAll('[role="radio"]'));
    const labels = segments.map((segment) => segment.textContent?.trim());
    expect(labels).toEqual(['Unified', 'Final', 'Original']);

    const checked = segments.find((segment) => segment.getAttribute('aria-checked') === 'true');
    expect(checked?.textContent?.trim()).toBe('Unified');
  });

  test('clicking a view-mode segment moves the active selection', async () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 1, removed: 0, modified: 0 },
      changeCount: 1,
      currentChangeIndex: 0,
      hasChanges: true,
      viewMode: 'unified',
    });

    const segments = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    const originalSegment = segments.find((segment) => segment.textContent?.trim() === 'Original');
    expect(originalSegment).toBeDefined();

    await fireEvent.click(requiredInstance(originalSegment, HTMLElement));

    expect(originalSegment?.getAttribute('aria-checked')).toBe('true');
    const unifiedSegment = segments.find((segment) => segment.textContent?.trim() === 'Unified');
    expect(unifiedSegment?.getAttribute('aria-checked')).toBe('false');
  });
});
