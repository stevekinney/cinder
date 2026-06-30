/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';

setupHappyDom();

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { default: InlineLoading } = await import('./inline-loading.svelte');

describe('InlineLoading', () => {
  afterEach(() => {
    cleanup();
  });

  test('defaults to inactive with no visible indicator content', () => {
    const { container } = render(InlineLoading);
    const root = container.querySelector('.cinder-inline-loading');
    expect(root?.getAttribute('data-cinder-status')).toBe('inactive');
    expect(container.querySelector('.cinder-inline-loading__indicator')).toBeNull();
    expect(container.querySelector('.cinder-inline-loading__label')).toBeNull();
  });

  test('active status renders spinner and default loading label', () => {
    const { container } = render(InlineLoading, { status: 'active' });
    const root = container.querySelector('.cinder-inline-loading');
    expect(root?.getAttribute('data-cinder-status')).toBe('active');
    expect(container.querySelector('.cinder-spinner')).not.toBeNull();
    expect(container.querySelector('.cinder-inline-loading__label')?.textContent?.trim()).toBe(
      'Loading',
    );
  });

  test('description overrides visible status label', () => {
    const { container } = render(InlineLoading, { status: 'active', description: 'Saving draft' });
    expect(container.querySelector('.cinder-inline-loading__label')?.textContent?.trim()).toBe(
      'Saving draft',
    );
  });

  test('finished status renders success icon and default success label', () => {
    const { container } = render(InlineLoading, { status: 'finished' });
    const root = container.querySelector('.cinder-inline-loading');
    expect(root?.getAttribute('data-cinder-status')).toBe('finished');
    expect(container.querySelector('.cinder-inline-loading__indicator svg')).not.toBeNull();
    expect(container.querySelector('.cinder-inline-loading__label')?.textContent?.trim()).toBe(
      'Success',
    );
  });

  test('error status renders error icon and default error label', () => {
    const { container } = render(InlineLoading, { status: 'error' });
    const root = container.querySelector('.cinder-inline-loading');
    expect(root?.getAttribute('data-cinder-status')).toBe('error');
    expect(container.querySelector('.cinder-inline-loading__indicator svg')).not.toBeNull();
    expect(container.querySelector('.cinder-inline-loading__label')?.textContent?.trim()).toBe(
      'Error',
    );
  });

  test('iconDescription feeds live announcements when description is absent', async () => {
    const { container } = render(InlineLoading, {
      status: 'finished',
      iconDescription: 'Saved successfully',
    });

    await waitFor(() => {
      const live = container.querySelector('[role="status"][aria-live="polite"]');
      expect(live?.textContent?.trim()).toBe('Success. Saved successfully');
    });
  });

  test('successDelay auto-resets finished back to inactive', async () => {
    const { container } = render(InlineLoading, { status: 'finished', successDelay: 50 });
    const root = container.querySelector('.cinder-inline-loading');

    expect(root?.getAttribute('data-cinder-status')).toBe('finished');

    await waitFor(() => {
      expect(root?.getAttribute('data-cinder-status')).toBe('inactive');
      expect(container.querySelector('.cinder-inline-loading__label')).toBeNull();
    });
  });

  test('non-positive successDelay immediately collapses finished to inactive', () => {
    const { container } = render(InlineLoading, { status: 'finished', successDelay: 0 });
    const root = container.querySelector('.cinder-inline-loading');
    expect(root?.getAttribute('data-cinder-status')).toBe('inactive');
  });

  test('forwards class and native attributes to the root element', () => {
    const { container } = render(InlineLoading, {
      status: 'active',
      class: 'custom-inline-loading',
      id: 'save-status',
      'data-testid': 'save-status',
    });
    const root = container.querySelector('.cinder-inline-loading');
    expect(root?.classList.contains('custom-inline-loading')).toBe(true);
    expect(root?.getAttribute('id')).toBe('save-status');
    expect(root?.getAttribute('data-testid')).toBe('save-status');
  });

  test('unmounting clears pending success timer', () => {
    const timers = trackTimers();
    try {
      const { unmount } = render(InlineLoading, { status: 'finished', successDelay: 10_000 });
      unmount();
      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });
});
