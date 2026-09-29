/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

/**
 * Behavioural coverage for DiffViewer's Markdown annotation hooks (COR-514 /
 * DR-4), through the layers the composed `diff-viewer.svelte` shell is a thin
 * wrapper over -- see `diff-viewer.test.ts`'s file header for why the shell
 * itself cannot be mounted under happy-dom. `diff-viewer.annotation.test.ts`
 * covers the pure selection/numbering logic; this file covers `DiffLine` and
 * `DiffFrontMatter` rendering the annotation controls/snippets those
 * decisions feed, plus source-level assertions for the shell wiring those two
 * sub-components alone cannot exercise (stale-gates-creation, focusAnchor
 * mode-switching, ref/instance isolation). Full end-to-end interaction
 * (pointer, keyboard, real focus) is covered by the real-browser Playwright
 * spec in `scripts/browser-fixtures/tests/diff-viewer-annotation.playwright.ts`.
 */

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { computeLineDiff } = await import('@lostgradient/markdown');
const { default: DiffLine } = await import('./diff-line.svelte');
const { default: DiffFrontMatter } = await import('./diff-front-matter.svelte');

describe('DiffViewer: unchanged rows are commentable', () => {
  test('a same-type row renders an annotation control for a supplied target', async () => {
    let activated = 0;
    const { container } = render(DiffLine, {
      diff: { type: 'same', text: 'unchanged line' },
      viewMode: 'unified',
      annotationTargets: [
        {
          side: 'new',
          line: 5,
          id: 'control-new-5',
          label: 'Add comment on unchanged line 5',
          onactivate: () => {
            activated += 1;
          },
          onkeydown: () => {},
        },
      ],
    });

    const control = container.querySelector<HTMLButtonElement>('[data-cinder-annotation-control]');
    expect(control).not.toBeNull();
    expect(control?.getAttribute('data-cinder-side')).toBe('new');
    expect(control?.getAttribute('data-cinder-line')).toBe('5');

    await fireEvent.click(requiredInstance(control, HTMLButtonElement));
    expect(activated).toBe(1);
  });

  test('no annotation controls render when no targets are supplied (default behavior unchanged)', () => {
    const { container } = render(DiffLine, {
      diff: { type: 'same', text: 'unchanged line' },
      viewMode: 'unified',
    });
    expect(container.querySelectorAll('[data-cinder-annotation-control]')).toHaveLength(0);
  });
});

describe('DiffViewer: modified rows expose independent old/new targets', () => {
  test('unified mode renders one control on the removed row and a distinct one on the added row', () => {
    const { container } = render(DiffLine, {
      diff: {
        type: 'modified',
        oldText: 'before',
        newText: 'after',
        wordChanges: [],
      },
      viewMode: 'unified',
      annotationTargets: [
        {
          side: 'old',
          line: 2,
          id: 'control-old-2',
          label: 'Add comment on removed line 2',
          onactivate: () => {},
          onkeydown: () => {},
        },
        {
          side: 'new',
          line: 3,
          id: 'control-new-3',
          label: 'Add comment on added line 3',
          onactivate: () => {},
          onkeydown: () => {},
        },
      ],
    });

    const rows = Array.from(container.querySelectorAll('.diff-line'));
    expect(rows).toHaveLength(2);
    const [removedRow, addedRow] = rows;
    expect(removedRow?.querySelector('[data-cinder-annotation-control]')?.id).toBe('control-old-2');
    expect(addedRow?.querySelector('[data-cinder-annotation-control]')?.id).toBe('control-new-3');
    // Each row owns exactly its own side's control -- never the other's.
    expect(removedRow?.querySelectorAll('[data-cinder-annotation-control]')).toHaveLength(1);
    expect(addedRow?.querySelectorAll('[data-cinder-annotation-control]')).toHaveLength(1);
  });

  test('final mode renders only the new-side control; original mode renders only the old-side control', () => {
    const targets = [
      {
        side: 'old' as const,
        line: 2,
        id: 'control-old-2',
        label: 'Add comment on removed line 2',
        onactivate: () => {},
        onkeydown: () => {},
      },
      {
        side: 'new' as const,
        line: 3,
        id: 'control-new-3',
        label: 'Add comment on added line 3',
        onactivate: () => {},
        onkeydown: () => {},
      },
    ];
    const diff = {
      type: 'modified' as const,
      oldText: 'before',
      newText: 'after',
      wordChanges: [],
    };

    const final = render(DiffLine, { diff, viewMode: 'final', annotationTargets: targets });
    expect(final.container.querySelector('[data-cinder-annotation-control]')?.id).toBe(
      'control-new-3',
    );

    const original = render(DiffLine, { diff, viewMode: 'original', annotationTargets: targets });
    expect(original.container.querySelector('[data-cinder-annotation-control]')?.id).toBe(
      'control-old-2',
    );
  });
});

describe('DiffViewer: stale diff disables line-comment creation', () => {
  test('a disabled target renders a disabled control with a visible explanation', () => {
    const { container, getByText } = render(DiffLine, {
      diff: { type: 'added', text: 'new line' },
      viewMode: 'unified',
      annotationTargets: [
        {
          side: 'new',
          line: 1,
          id: 'control-new-1',
          label: 'Add comment on added line 1',
          disabled: true,
          disabledReason: 'The diff is outdated. Recompute it to add a new comment.',
          onactivate: () => {},
          onkeydown: () => {},
        },
      ],
    });

    const control = container.querySelector<HTMLButtonElement>('[data-cinder-annotation-control]');
    expect(control?.disabled).toBe(true);
    expect(getByText('The diff is outdated. Recompute it to add a new comment.')).toBeTruthy();
  });

  test('a saved comment rendered through lineAnnotation stays visible next to a disabled control', () => {
    const { getByTestId } = render(DiffLine, {
      diff: { type: 'added', text: 'new line' },
      viewMode: 'unified',
      annotationTargets: [
        {
          side: 'new',
          line: 1,
          id: 'control-new-1',
          label: 'Add comment on added line 1',
          disabled: true,
          disabledReason: 'The diff is outdated. Recompute it to add a new comment.',
          onactivate: () => {},
          onkeydown: () => {},
        },
      ],
      // A saved comment marker the host renders regardless of whether new
      // comments can currently be created -- staleness gates creation only.
      lineAnnotation: createRawSnippet<[{ side: string; line: number }]>((context) => ({
        render: () =>
          `<span data-testid="saved-comment">Saved comment on ${context().side}:${context().line}</span>`,
        setup: () => {},
      })),
    });

    expect(getByTestId('saved-comment').textContent).toBe('Saved comment on new:1');
  });
});

describe('DiffViewer: lineAnnotation snippet', () => {
  test('renders once for a supplied target, receiving its side and line', () => {
    const { getByTestId } = render(DiffLine, {
      diff: { type: 'removed', text: 'gone' },
      viewMode: 'unified',
      annotationTargets: [
        {
          side: 'old',
          line: 4,
          id: 'control-old-4',
          label: 'Add comment on removed line 4',
          onactivate: () => {},
          onkeydown: () => {},
        },
      ],
      lineAnnotation: createRawSnippet<[{ side: string; line: number }]>((context) => ({
        render: () =>
          `<span data-testid="line-annotation">${context().side}:${context().line}</span>`,
        setup: () => {},
      })),
    });

    expect(getByTestId('line-annotation').textContent).toBe('old:4');
  });

  test('does not render when no annotation targets are supplied', () => {
    const { queryByTestId } = render(DiffLine, {
      diff: { type: 'same', text: 'unchanged' },
      viewMode: 'unified',
      lineAnnotation: createRawSnippet<[{ side: string; line: number }]>((context) => ({
        render: () => `<span data-testid="line-annotation">${context().side}</span>`,
        setup: () => {},
      })),
    });

    expect(queryByTestId('line-annotation')).toBeNull();
  });
});

describe('DiffViewer: front matter field context', () => {
  function fieldsSnippet() {
    return createRawSnippet<[{ changedFields: string[] }]>((context) => ({
      render: () =>
        `<span data-testid="file-annotation">${context().changedFields.join(',')}</span>`,
      setup: () => {},
    }));
  }

  test('the fileAnnotation snippet receives the changed field names', () => {
    const diffs = computeLineDiff(
      '---\ntitle: Old\nstatus: draft\n---',
      '---\ntitle: New\nstatus: draft\n---',
    );

    const { getByTestId } = render(DiffFrontMatter, {
      id: 'front-matter',
      diffs,
      viewMode: 'unified',
      expanded: true,
      fileAnnotation: fieldsSnippet(),
    });

    expect(getByTestId('file-annotation').textContent).toBe('title');
  });

  test('front matter with no changes still offers the file-annotation hook, with no changed fields', () => {
    const diffs = computeLineDiff('---\ntitle: Same\n---', '---\ntitle: Same\n---');

    const { getByTestId } = render(DiffFrontMatter, {
      id: 'front-matter',
      diffs,
      viewMode: 'unified',
      expanded: true,
      fileAnnotation: fieldsSnippet(),
    });

    expect(getByTestId('file-annotation').textContent).toBe('');
  });
});

describe('DiffViewer: shell wiring (source-level, see file header)', () => {
  test('the shell forwards annotation props to DiffLine and DiffFrontMatter, and gates creation on staleness', async () => {
    const source = await Bun.file(new URL('./diff-viewer.svelte', import.meta.url)).text();

    // The shell computes per-row line numbers/targets via the pure annotation module.
    expect(source).toContain("from './diff-viewer.annotation.ts'");
    // Front matter offsets participate in numbering.
    expect(source).toContain('numberDiffViewerRows');
    // Stale diffs disable creation, not the lineAnnotation/fileAnnotation display.
    expect(source).toContain('diffState.isStale');
    // focusAnchor is exposed on the bindable ref.
    expect(source).toContain('focusAnchor');
  });
});
