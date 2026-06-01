/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: DiffStatistics } = await import('./diff-statistics.svelte');

afterEach(() => cleanup());

describe('DiffStatistics', () => {
  test('labels the changed-line total on a group that keeps its breakdown readable', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 2, removed: 1, modified: 3 },
    });

    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('6 lines changed');
    // role="group" (unlike role="img") keeps the visible breakdown exposed to AT.
    expect(group?.textContent).toContain('added');
    expect(group?.textContent).toContain('removed');
    expect(group?.textContent).toContain('modified');
  });

  test('is a static labeled group, not a live region and not an opaque image', () => {
    // Regression: diff stats describe a fixed diff, so they must NOT use
    // role="status"/aria-live (announces on every re-render) — and NOT role="img"
    // either, which would hide the added/removed/modified breakdown from AT.
    const { container } = render(DiffStatistics, {
      props: { added: 2, removed: 1, modified: 3 },
    });

    const root = container.querySelector('.cinder-diff-statistics');
    expect(root?.getAttribute('role')).toBe('group');
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(root?.hasAttribute('aria-live')).toBe(false);
  });

  test('supports compact zero-hiding output', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 4, removed: 0, modified: 0, variant: 'compact', hideZero: true },
    });

    const status = container.querySelector('[role="group"]');
    expect(status?.getAttribute('data-cinder-variant')).toBe('compact');
    expect(status?.textContent).toContain('4');
    expect(status?.textContent).not.toContain('0');
  });

  test('density="toolbar" sets data-cinder-density="toolbar" on the root', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 1, removed: 0, modified: 0, variant: 'compact', density: 'toolbar' },
    });
    const status = container.querySelector('[role="group"]');
    expect(status?.getAttribute('data-cinder-density')).toBe('toolbar');
  });

  test('omitting density does not set data-cinder-density', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 1, removed: 0, modified: 0, variant: 'compact' },
    });
    const status = container.querySelector('[role="group"]');
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
