/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { computeLineDiff } = await import('@lostgradient/markdown');
const { default: DiffFrontMatter } = await import('./diff-front-matter.svelte');

describe('DiffViewer: front-matter section', () => {
  test('changed front matter renders a labelled, expandable section', () => {
    const diffs = computeLineDiff('---\ntitle: Old\n---', '---\ntitle: New\n---');

    const { container, getByRole } = render(DiffFrontMatter, {
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

    const changedRows = Array.from(container.querySelectorAll('.diff-line-modified'));
    const removedRow = changedRows[0];
    const addedRow = changedRows[1];
    if (!(removedRow instanceof HTMLElement) || !(addedRow instanceof HTMLElement)) {
      throw new Error('Expected changed front-matter rows to render as elements.');
    }
    expect(changedRows).toHaveLength(2);
    expect(removedRow.querySelector('.diff-gutter')?.textContent).toBe('-');
    expect(getByRole('group', { name: 'Removed line: title: Old' })).toBe(removedRow);
    expect(addedRow.querySelector('.diff-gutter')?.textContent).toBe('+');
    expect(getByRole('group', { name: 'Added line: title: New' })).toBe(addedRow);
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
