/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VisuallyHiddenLiveRegion } = await import('./_visually-hidden-live-region.svelte');

/** Let queued microtasks (the blank-then-set) and a tick settle. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await tick();
}

describe('VisuallyHiddenLiveRegion', () => {
  test('renders a polite role=status region with aria-atomic by default', () => {
    const { container } = render(VisuallyHiddenLiveRegion, { props: {} });
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
    expect(region?.classList.contains('cinder-sr-only')).toBe(true);
  });

  test('priority="assertive" renders role=alert with aria-live=assertive', () => {
    const { container } = render(VisuallyHiddenLiveRegion, {
      props: { priority: 'assertive' },
    });
    const region = container.querySelector('[role="alert"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('assertive');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  test('announces a message into the region after the clear-then-set microtask', async () => {
    const { container, rerender } = render(VisuallyHiddenLiveRegion, { props: { message: '' } });
    const region = () => container.querySelector('[role="status"]');
    expect(region()?.textContent?.trim()).toBe('');

    await rerender({ message: 'Copied to clipboard' });
    await flushMicrotasks();
    expect(region()?.textContent?.trim()).toBe('Copied to clipboard');
  });

  test('re-announces a repeated identical message (blanks then re-sets)', async () => {
    const { container, rerender } = render(VisuallyHiddenLiveRegion, {
      props: { message: 'Copied' },
    });
    const region = () => container.querySelector('[role="status"]');
    await flushMicrotasks();
    expect(region()?.textContent?.trim()).toBe('Copied');

    // Force the same message through by blanking then re-setting; the component must
    // re-render it (an AT only announces on a content change).
    await rerender({ message: '' });
    await flushMicrotasks();
    expect(region()?.textContent?.trim()).toBe('');

    await rerender({ message: 'Copied' });
    await flushMicrotasks();
    expect(region()?.textContent?.trim()).toBe('Copied');
  });

  test('an empty message clears the region without scheduling a set', async () => {
    const { container, rerender } = render(VisuallyHiddenLiveRegion, {
      props: { message: 'Loading' },
    });
    const region = () => container.querySelector('[role="status"]');
    await flushMicrotasks();
    expect(region()?.textContent?.trim()).toBe('Loading');

    await rerender({ message: '' });
    await flushMicrotasks();
    expect(region()?.textContent?.trim()).toBe('');
  });
});
