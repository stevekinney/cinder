/// <reference lib="dom" />
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

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
      props: { added: 4, removed: 0, modified: 0, variant: 'compact', zeroVisible: false },
    });

    const status = container.querySelector('[role="group"]');
    expect(status?.getAttribute('data-cinder-variant')).toBe('compact');
    expect(status?.textContent).toContain('4');
    expect(status?.textContent).not.toContain('0');
  });

  test('all-zero with zeroVisible renders the "No changes" fallback, not zero-value stats', () => {
    // zeroVisible is REQUIRED to reach the {:else} branch — showAdded/showRemoved/showModified
    // default to true unconditionally, so a plain all-zero render without zeroVisible still
    // renders the (zero-value) stat spans instead of the fallback.
    const { container } = render(DiffStatistics, {
      props: { added: 0, removed: 0, modified: 0, zeroVisible: false },
    });

    const fallback = container.querySelector('.cinder-diff-statistics__stat--none');
    expect(fallback?.textContent?.trim()).toBe('No changes');
    expect(container.querySelector('.cinder-diff-statistics__stat--added')).toBeNull();
    expect(container.querySelector('.cinder-diff-statistics__stat--removed')).toBeNull();
    expect(container.querySelector('.cinder-diff-statistics__stat--modified')).toBeNull();
  });

  test('a single added line uses the singular aria-label, not the plural', () => {
    const { container } = render(DiffStatistics, {
      props: { added: 1, removed: 0, modified: 0 },
    });

    const added = container.querySelector('.cinder-diff-statistics__stat--added');
    expect(added?.getAttribute('aria-label')).toBe('1 line added');
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
      /data-cinder-variant='compact'[\s\S]*?__stat--added[\s\S]*?background:\s*var\(--cinder-status-success-background\)[\s\S]*?color:\s*var\(--cinder-status-success-text\)/,
    );
    expect(css).toMatch(
      /data-cinder-variant='compact'[\s\S]*?__stat--removed[\s\S]*?background:\s*var\(--cinder-status-danger-background\)[\s\S]*?color:\s*var\(--cinder-status-danger-text\)/,
    );
    expect(css).toMatch(
      /data-cinder-variant='compact'[\s\S]*?__stat--modified[\s\S]*?background:\s*var\(--cinder-status-warning-background\)[\s\S]*?color:\s*var\(--cinder-status-warning-text\)/,
    );
  });

  test('warns once in dev when density="toolbar" is used without variant="compact"', async () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { rerender } = render(DiffStatistics, {
        props: { added: 1, removed: 0, modified: 0, density: 'toolbar' },
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain('density="toolbar"');

      // Latch: a re-render with the same invalid props does not warn again.
      await rerender({ added: 2, removed: 0, modified: 0, density: 'toolbar' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('does not warn when density="toolbar" is paired with variant="compact"', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(DiffStatistics, {
        props: { added: 1, removed: 0, modified: 0, variant: 'compact', density: 'toolbar' },
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('the warning latch is once-per-instance-lifetime, not once-per-distinct-violation', async () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { rerender } = render(DiffStatistics, {
        props: { added: 1, removed: 0, modified: 0, density: 'toolbar', variant: 'default' },
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Clear the violation: no new warning.
      await rerender({ added: 1, removed: 0, modified: 0, density: 'toolbar', variant: 'compact' });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Reintroduce the identical violation: still no second warning, proving the
      // latch is scoped to the component instance's lifetime rather than resetting
      // whenever the violation clears and reappears.
      await rerender({ added: 1, removed: 0, modified: 0, density: 'toolbar', variant: 'default' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
