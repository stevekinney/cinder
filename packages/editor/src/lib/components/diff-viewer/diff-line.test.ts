import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: DiffLine } = await import('./diff-line.svelte');

describe('DiffLine CSS contract', () => {
  test('modified gutter rules use the info foreground token', async () => {
    const source = await Bun.file(new URL('./diff-line.svelte', import.meta.url)).text();
    const modifiedGutterBlocks =
      source.match(/\.diff-line-modified(?:-final|-original)? \.diff-gutter\s*\{[^}]*\}/g) ?? [];

    expect(modifiedGutterBlocks.length).toBe(3);
    for (const block of modifiedGutterBlocks) {
      expect(block).toContain('color: var(--cinder-status-info-text)');
      expect(block).not.toContain('color: var(--cinder-status-info-background)');
    }
  });

  test('modified unified lines render paired removed and added rows', () => {
    const { container, getByRole } = render(DiffLine, {
      diff: {
        type: 'modified',
        oldText: 'old value',
        newText: 'new value',
        wordChanges: [
          { type: 'removed', text: 'old' },
          { type: 'added', text: 'new' },
          { type: 'same', text: ' value' },
        ],
      },
      viewMode: 'unified',
    });

    const rows = Array.from(container.querySelectorAll('.diff-line'));
    const removedRow = rows[0];
    const addedRow = rows[1];
    if (!(removedRow instanceof HTMLElement) || !(addedRow instanceof HTMLElement)) {
      throw new Error('Expected modified unified rows to render as elements.');
    }
    expect(rows).toHaveLength(2);
    expect(removedRow.classList.contains('diff-line-removed')).toBe(true);
    expect(addedRow.classList.contains('diff-line-added')).toBe(true);
    expect(removedRow.querySelector('.diff-gutter')?.textContent).toBe('-');
    expect(addedRow.querySelector('.diff-gutter')?.textContent).toBe('+');
    expect(removedRow.textContent).toContain('old value');
    expect(addedRow.textContent).toContain('new value');
    expect(getByRole('group', { name: 'Removed line: old value' })).toBe(removedRow);
    expect(getByRole('group', { name: 'Added line: new value' })).toBe(addedRow);
    expect(container.innerHTML).not.toContain('word-');
  });

  test('side modes keep non-color gutter symbols for changed rows', () => {
    const modifiedFinal = render(DiffLine, {
      diff: {
        type: 'modified',
        oldText: 'old value',
        newText: 'new value',
        wordChanges: [],
      },
      viewMode: 'final',
    });
    expect(modifiedFinal.container.querySelector('.diff-gutter')?.textContent).toBe('+');
    const modifiedFinalRow = modifiedFinal.container.querySelector('.diff-line');
    if (!(modifiedFinalRow instanceof HTMLElement)) {
      throw new Error('Expected modified final row to render as an element.');
    }
    expect(modifiedFinal.getByRole('group', { name: 'Modified line: new value' })).toBe(
      modifiedFinalRow,
    );

    const modifiedOriginal = render(DiffLine, {
      diff: {
        type: 'modified',
        oldText: 'old value',
        newText: 'new value',
        wordChanges: [],
      },
      viewMode: 'original',
    });
    expect(modifiedOriginal.container.querySelector('.diff-gutter')?.textContent).toBe('-');
    const modifiedOriginalRow = modifiedOriginal.container.querySelector('.diff-line');
    if (!(modifiedOriginalRow instanceof HTMLElement)) {
      throw new Error('Expected modified original row to render as an element.');
    }
    expect(modifiedOriginal.getByRole('group', { name: 'Modified line: old value' })).toBe(
      modifiedOriginalRow,
    );

    const removedOriginal = render(DiffLine, {
      diff: {
        type: 'removed',
        text: 'removed value',
      },
      viewMode: 'original',
    });
    expect(removedOriginal.container.querySelector('.diff-gutter')?.textContent).toBe('-');
    const removedOriginalRow = removedOriginal.container.querySelector('.diff-line');
    if (!(removedOriginalRow instanceof HTMLElement)) {
      throw new Error('Expected removed original row to render as an element.');
    }
    expect(removedOriginal.getByRole('group', { name: 'Removed line: removed value' })).toBe(
      removedOriginalRow,
    );
  });
});
