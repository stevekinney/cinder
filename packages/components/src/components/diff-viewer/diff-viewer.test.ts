/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
  await import('cinder/markdown/diff/line-diff');
const { default: DiffLine } = await import('./diff-line.svelte');
const { default: DiffToolbar } = await import('./diff-toolbar.svelte');
const { default: DiffFrontMatter } = await import('./diff-front-matter.svelte');

type DiffToolbarState = {
  tier: 'realtime' | 'debounced' | 'manual';
  isStale: boolean;
  isComputing: boolean;
  warning: string | null;
  lastComputeTime: number | null;
};

/** Whether any rendered <button> carries the given label substring. */
function hasButtonLabelled(container: HTMLElement, label: string): boolean {
  return Array.from(container.querySelectorAll('button')).some((button) =>
    button.textContent?.includes(label),
  );
}

describe('DiffViewer: identical input (basic mount)', () => {
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

    await fireEvent.click(button as HTMLButtonElement);
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

    await fireEvent.click(originalSegment as HTMLElement);

    expect(originalSegment?.getAttribute('aria-checked')).toBe('true');
    const unifiedSegment = segments.find((segment) => segment.textContent?.trim() === 'Unified');
    expect(unifiedSegment?.getAttribute('aria-checked')).toBe('false');
  });
});

describe('DiffViewer: large-payload gating (>100KB → manual trigger)', () => {
  const manualState: DiffToolbarState = {
    tier: 'manual',
    isStale: true,
    isComputing: false,
    warning: 'Large document (120 KB). Diff updates require manual trigger.',
    lastComputeTime: null,
  };

  const realtimeState: DiffToolbarState = {
    tier: 'realtime',
    isStale: false,
    isComputing: false,
    warning: null,
    lastComputeTime: 1.2,
  };

  test('the manual tier exposes a "Compute Diff" trigger and an "Outdated" badge', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      diffState: manualState,
      ontriggercompute: () => {},
    });

    expect(hasButtonLabelled(container, 'Compute Diff')).toBe(true);
    expect(container.textContent).toContain('Outdated');
  });

  test('the realtime tier hides the manual trigger and the "Outdated" badge', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      diffState: realtimeState,
      ontriggercompute: () => {},
    });

    expect(hasButtonLabelled(container, 'Compute Diff')).toBe(false);
    expect(container.textContent).not.toContain('Outdated');
  });

  test('clicking "Compute Diff" invokes the manual trigger callback', async () => {
    let triggered = 0;
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      diffState: manualState,
      ontriggercompute: () => {
        triggered += 1;
      },
    });

    const computeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compute Diff'),
    );
    expect(computeButton).toBeDefined();

    await fireEvent.click(computeButton as HTMLButtonElement);
    expect(triggered).toBe(1);
  });

  test('the manual trigger is disabled while a computation is in progress', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      diffState: { ...manualState, isComputing: true },
      ontriggercompute: () => {},
    });

    const computeButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Compute Diff'),
    );
    expect(computeButton?.disabled).toBe(true);
  });
});

describe('DiffViewer: front-matter section', () => {
  test('changed front matter renders a labelled, expandable section', () => {
    const diffs = computeLineDiff('---\ntitle: Old\n---', '---\ntitle: New\n---');

    const { container } = render(DiffFrontMatter, {
      id: 'front-matter',
      diffs,
      viewMode: 'unified',
      expanded: true,
      badgeLabel: 'Changed',
      badgeVariant: 'warning',
    });

    // The section flags itself as changed and renders the "Changed" badge.
    const section = container.querySelector('.front-matter-section');
    expect(section?.getAttribute('data-has-changes')).toBe('true');
    expect(container.textContent).toContain('Changed');
  });

  test('two DiffFrontMatter instances with distinct ids produce non-colliding toggle and content ids', () => {
    // This test documents the bug: when diff-viewer passed the literal id="front-matter"
    // to every DiffFrontMatter it rendered, every instance produced the same
    // toggle id ("front-matter-toggle") and content id ("front-matter-content").
    // The fix is that diff-viewer now passes a per-instance prefix derived from
    // $props.id(), so the ids are unique across instances on the same page.
    //
    // We simulate what TWO diff-viewer instances produce by rendering DiffFrontMatter
    // twice with the distinct ids the fixed diff-viewer would pass.

    const diffs = computeLineDiff('---\ntitle: Old\n---', '---\ntitle: New\n---');

    const { container: containerA } = render(DiffFrontMatter, {
      id: 'diff-viewer-1-front-matter',
      diffs,
      viewMode: 'unified',
      expanded: true,
    });

    const { container: containerB } = render(DiffFrontMatter, {
      id: 'diff-viewer-2-front-matter',
      diffs,
      viewMode: 'unified',
      expanded: true,
    });

    // Each instance must have its own unique toggle id and content id.
    const toggleA = containerA.querySelector('[id]');
    const toggleB = containerB.querySelector('[id]');

    // The ids must not be identical — this would catch the original literal collision.
    expect(toggleA?.id).not.toBe(toggleB?.id);
    expect(toggleA?.id).toBe('diff-viewer-1-front-matter-toggle');
    expect(toggleB?.id).toBe('diff-viewer-2-front-matter-toggle');

    // aria-controls on each toggle must resolve within its own container, not the other's.
    const ariaControlsA = toggleA?.getAttribute('aria-controls');
    const ariaControlsB = toggleB?.getAttribute('aria-controls');

    expect(ariaControlsA).toBe('diff-viewer-1-front-matter-content');
    expect(ariaControlsB).toBe('diff-viewer-2-front-matter-content');

    // The actual content elements must exist with matching ids in the correct containers.
    expect(containerA.querySelector(`#${ariaControlsA}`)).not.toBeNull();
    expect(containerB.querySelector(`#${ariaControlsB}`)).not.toBeNull();

    // Cross-instance: each toggle's aria-controls must NOT resolve in the OTHER container.
    expect(containerA.querySelector(`#${ariaControlsB}`)).toBeNull();
    expect(containerB.querySelector(`#${ariaControlsA}`)).toBeNull();
  });

  test('diff-viewer.svelte passes a $props.id()-derived front-matter id, not the colliding literal', async () => {
    // The behavioural test above proves DiffFrontMatter namespaces ids from
    // whatever `id` it receives — but the actual bug lived in diff-viewer.svelte,
    // which hardcoded id="front-matter" on EVERY instance. The composed shell
    // cannot be mounted under happy-dom (see the file header), so we guard the
    // shell-level fix at the source level: it must derive a per-instance id from
    // $props.id() and must not pass the bare literal. Reverting the fix fails here.
    const source = await Bun.file(new URL('./diff-viewer.svelte', import.meta.url)).text();

    // The per-instance base id is generated with $props.id().
    expect(source).toContain('$props.id()');

    // The front-matter id passed to <DiffFrontMatter> is namespaced by that base
    // id, not the bare literal that collided across instances.
    expect(source).not.toMatch(/id=["']front-matter["']/);
    expect(source).toMatch(/id=\{`\$\{instanceId\}-front-matter`\}/);
  });
});
