/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: DiffStatistics } = await import('./diff-statistics.svelte');

afterEach(() => cleanup());

describe('DiffStatistics', () => {
  test('labels the total number of changed lines as a single figure', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 2, removed: 1, modified: 3 },
    });

    const figure = container.querySelector('[role="img"]');
    expect(figure?.getAttribute('aria-label')).toBe('6 lines changed');
    expect(figure?.textContent).toContain('added');
    expect(figure?.textContent).toContain('removed');
    expect(figure?.textContent).toContain('modified');
  });

  test('is a static labeled figure, not a live region', () => {
    // Regression: diff stats describe a fixed diff, so they must NOT use
    // role="status" / aria-live (which would announce on every re-render).
    const { container } = render(DiffStatistics, {
      props: { added: 2, removed: 1, modified: 3 },
    });

    const root = container.querySelector('.cinder-diff-statistics');
    expect(root?.getAttribute('role')).toBe('img');
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(root?.hasAttribute('aria-live')).toBe(false);
  });

  test('supports compact zero-hiding output', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 4, removed: 0, modified: 0, variant: 'compact', hideZero: true },
    });

    const status = container.querySelector('[role="img"]');
    expect(status?.getAttribute('data-cinder-variant')).toBe('compact');
    expect(status?.textContent).toContain('4');
    expect(status?.textContent).not.toContain('0');
  });

  test('density="toolbar" sets data-cinder-density="toolbar" on the root', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 1, removed: 0, modified: 0, variant: 'compact', density: 'toolbar' },
    });
    const status = container.querySelector('[role="img"]');
    expect(status?.getAttribute('data-cinder-density')).toBe('toolbar');
  });

  test('omitting density does not set data-cinder-density', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 1, removed: 0, modified: 0, variant: 'compact' },
    });
    const status = container.querySelector('[role="img"]');
    expect(status?.hasAttribute('data-cinder-density')).toBe(false);
  });

  test('compact status pills use matched foreground tokens', async () => {
    const css = await Bun.file(new URL('./diff-statistics.css', import.meta.url)).text();
    expect(css).toMatch(
      /data-cinder-variant='compact'[\s\S]*?__stat--added[\s\S]*?background:\s*var\(--cinder-color-success-bg\)[\s\S]*?color:\s*var\(--cinder-color-success-fg\)/,
    );
    expect(css).toMatch(
      /data-cinder-variant='compact'[\s\S]*?__stat--removed[\s\S]*?background:\s*var\(--cinder-color-danger-bg\)[\s\S]*?color:\s*var\(--cinder-color-danger-fg\)/,
    );
    expect(css).toMatch(
      /data-cinder-variant='compact'[\s\S]*?__stat--modified[\s\S]*?background:\s*var\(--cinder-color-warning-bg\)[\s\S]*?color:\s*var\(--cinder-color-warning-fg\)/,
    );
  });
});
