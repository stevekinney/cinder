/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: DiffStatistics } = await import('./diff-statistics.svelte');

afterEach(() => cleanup());

describe('DiffStatistics', () => {
  test('announces the total number of changed lines', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 2, removed: 1, modified: 3 },
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-label')).toBe('6 lines changed');
    expect(status?.textContent).toContain('added');
    expect(status?.textContent).toContain('removed');
    expect(status?.textContent).toContain('modified');
  });

  test('supports compact zero-hiding output', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 4, removed: 0, modified: 0, variant: 'compact', hideZero: true },
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute('data-cinder-variant')).toBe('compact');
    expect(status?.textContent).toContain('4');
    expect(status?.textContent).not.toContain('0');
  });

  test('density="toolbar" sets data-cinder-density="toolbar" on the root', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 1, removed: 0, modified: 0, variant: 'compact', density: 'toolbar' },
    });
    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute('data-cinder-density')).toBe('toolbar');
  });

  test('omitting density does not set data-cinder-density', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 1, removed: 0, modified: 0, variant: 'compact' },
    });
    const status = container.querySelector('[role="status"]');
    expect(status?.hasAttribute('data-cinder-density')).toBe(false);
  });
});
