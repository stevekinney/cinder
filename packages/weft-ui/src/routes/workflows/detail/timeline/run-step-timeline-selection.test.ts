import { describe, expect, test } from 'bun:test';

import { applyRunStepTimelineDivergenceHighlight } from './run-step-timeline-selection.ts';

/** Builds a minimal DOM tree shaped like Cinder's `RunStepTimeline` render output. */
function buildTimelineDom(stepPaths: readonly string[]): HTMLElement {
  const container = document.createElement('div');
  const list = document.createElement('ol');
  for (const path of stepPaths) {
    const item = document.createElement('li');
    item.className = 'cinder-run-step-timeline__item';
    item.setAttribute('data-cinder-path', path);
    const label = document.createElement('span');
    label.className = 'cinder-run-step-timeline__label';
    label.textContent = path;
    item.append(label);
    list.append(item);
  }
  container.append(list);
  return container;
}

describe('applyRunStepTimelineDivergenceHighlight', () => {
  test('marks every row whose step id is in the diverged set', () => {
    const container = buildTimelineDom(['step-1', 'step-2', 'step-3']);
    applyRunStepTimelineDivergenceHighlight(container, new Set(['step-2', 'step-3']));

    expect(
      container
        .querySelector('[data-cinder-path="step-1"]')
        ?.hasAttribute('data-weft-timeline-diverged'),
    ).toBe(false);
    expect(
      container
        .querySelector('[data-cinder-path="step-2"]')
        ?.hasAttribute('data-weft-timeline-diverged'),
    ).toBe(true);
    expect(
      container
        .querySelector('[data-cinder-path="step-3"]')
        ?.hasAttribute('data-weft-timeline-diverged'),
    ).toBe(true);
  });

  test('re-applying with a smaller set clears rows no longer diverged, rather than stacking', () => {
    const container = buildTimelineDom(['step-1', 'step-2']);
    applyRunStepTimelineDivergenceHighlight(container, new Set(['step-1', 'step-2']));
    applyRunStepTimelineDivergenceHighlight(container, new Set(['step-2']));

    expect(container.querySelectorAll('[data-weft-timeline-diverged]')).toHaveLength(1);
    expect(
      container
        .querySelector('[data-cinder-path="step-1"]')
        ?.hasAttribute('data-weft-timeline-diverged'),
    ).toBe(false);
    expect(
      container
        .querySelector('[data-cinder-path="step-2"]')
        ?.hasAttribute('data-weft-timeline-diverged'),
    ).toBe(true);
  });

  test('a path outside the top-level step-<n> shape (e.g. a nested/lane path) is never marked, even if requested', () => {
    const container = buildTimelineDom(['%branch/race', 'step-1']);
    applyRunStepTimelineDivergenceHighlight(container, new Set(['%branch/race', 'step-1']));

    expect(
      container
        .querySelector('[data-cinder-path="%branch/race"]')
        ?.hasAttribute('data-weft-timeline-diverged'),
    ).toBe(false);
    expect(
      container
        .querySelector('[data-cinder-path="step-1"]')
        ?.hasAttribute('data-weft-timeline-diverged'),
    ).toBe(true);
  });
});
