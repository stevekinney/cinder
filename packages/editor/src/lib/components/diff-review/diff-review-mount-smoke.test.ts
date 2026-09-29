/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import type { DiffReviewTargetInput } from '../../diff-review-state/index.ts';
import { createDiffReviewState } from '../../diff-review-state/index.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: DiffReview } = await import('./diff-review.svelte');

describe('DiffReview component shell: mount smoke', () => {
  test('mounts with a single Markdown target and shows the file, comments, and toolbar regions', () => {
    const targets: DiffReviewTargetInput[] = [
      {
        targetId: 't1',
        kind: 'markdown',
        label: 'notes.md',
        original: 'line one\nline two',
        current: 'line one\nline TWO',
        normalizeInputs: false,
      },
    ];
    const created = createDiffReviewState(targets);
    if (!created.ok) throw new Error('fixture setup failed');

    const { container } = render(DiffReview, {
      targets,
      state: created.value,
      onStateChange: () => {},
    });
    expect(container.querySelector('[aria-label="File navigation"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Diff"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Review"]')).not.toBeNull();
    expect(container.textContent).toContain('notes.md');
  });
});
