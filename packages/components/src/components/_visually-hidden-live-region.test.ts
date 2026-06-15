/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, waitFor, fireEvent } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VisuallyHiddenLiveRegion } = await import('./_visually-hidden-live-region.svelte');
const { default: SameMessageFixture } = await import(
  './_visually-hidden-live-region.same-message-fixture.svelte'
);

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

  test('announces a message into the region after the blank-then-set setTimeout(0)', async () => {
    const { container, rerender } = render(VisuallyHiddenLiveRegion, { props: { message: '' } });
    const region = () => container.querySelector('[role="status"]');
    expect(region()?.textContent?.trim()).toBe('');

    await rerender({ message: 'Copied to clipboard' });
    // setTimeout(0) fires after the current task; waitFor polls until the DOM update lands.
    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('Copied to clipboard');
    });
  });

  test('re-announces a repeated identical message (blanks then re-sets)', async () => {
    const { container, rerender } = render(VisuallyHiddenLiveRegion, {
      props: { message: 'Copied' },
    });
    const region = () => container.querySelector('[role="status"]');

    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('Copied');
    });

    // Set the same message again — must blank first, then re-set, so the AT
    // sees a genuine content change and re-announces.
    await rerender({ message: '' });
    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('');
    });

    await rerender({ message: 'Copied' });
    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('Copied');
    });
  });

  test('an empty message clears the region without scheduling a set', async () => {
    const { container, rerender } = render(VisuallyHiddenLiveRegion, {
      props: { message: 'Loading' },
    });
    const region = () => container.querySelector('[role="status"]');

    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('Loading');
    });

    await rerender({ message: '' });
    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('');
    });
  });

  test('rapid successive messages: only the last one lands (version counter guard)', async () => {
    // The version counter ensures a stale setTimeout(0) callback — from a message
    // that was immediately superseded by another — does not overwrite the newer
    // message. This is the load-bearing reason the counter exists.
    const { container, rerender } = render(VisuallyHiddenLiveRegion, {
      props: { message: '' },
    });
    const region = () => container.querySelector('[role="status"]');

    // Fire two changes without awaiting the setTimeout(0) between them.
    // The first message's deferred-set callback must bail because `version` advanced.
    await rerender({ message: 'First' });
    await rerender({ message: 'Second' });

    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('Second');
    });
    // Confirm the stale 'First' never briefly appeared.
    expect(region()?.textContent?.trim()).toBe('Second');
  });

  test('re-announces when the parent re-assigns the same $state string (announcementSequence bump)', async () => {
    // Regression for #400: a consumer (e.g. tag-input adding the same tag twice)
    // assigns the SAME announcement string to a `$state`. In Svelte 5 that is a
    // no-op, so without `announcementSequence` the effect never re-runs and the
    // region is never re-announced. `rerender({ message })` cannot reproduce this
    // (it drives the prop from outside) — only a real parent holding `$state` does,
    // hence the fixture.
    const { container } = render(SameMessageFixture);
    const region = () => container.querySelector('[role="status"]');
    const button = container.querySelector('button');
    expect(button).not.toBeNull();

    // First announcement lands after the blank-then-set setTimeout(0).
    await fireEvent.click(button as HTMLButtonElement);
    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('Copied.');
    });

    // Second click assigns the identical string 'Copied.' again. The sequence bump
    // re-runs the effect, which blanks the region first. This intermediate blank is
    // the load-bearing assertion: if the fix is reverted, the effect never runs and
    // the content stays 'Copied.' — this assertion then fails.
    await fireEvent.click(button as HTMLButtonElement);
    await tick();
    expect(region()?.textContent?.trim()).toBe('');

    // Then the deferred set re-announces the same text, so the AT sees a genuine
    // content change.
    await waitFor(() => {
      expect(region()?.textContent?.trim()).toBe('Copied.');
    });
  });
});
