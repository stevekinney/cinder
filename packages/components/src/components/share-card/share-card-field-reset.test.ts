/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, jest, spyOn, test } from 'bun:test';
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');

const { default: ShareCard } = await import('./share-card.svelte');
afterEach(() => {
  cleanup();
  if (jest.isFakeTimers()) jest.useRealTimers();
});

describe('ShareCard Input composition', () => {
  test('the multiline warning fires once per distinct value, not per re-render', async () => {
    // `utilities/dev-warn.ts` cautions against effects kept alive purely to log. This
    // one has to stay reactive (the prop can change after mount), so it is instead
    // edge-triggered: re-rendering with the SAME multi-line value must stay silent, and
    // only a genuinely new multi-line value warns again.
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { rerender } = render(ShareCard, { value: 'Line one\nLine two' });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      await rerender({ value: 'Line one\nLine two' });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      await rerender({ value: 'Different\nvalue' });
      expect(warnSpy).toHaveBeenCalledTimes(2);

      // A single-line value clears the latch, so returning to the first multi-line
      // value is a new edge and warns again rather than being swallowed.
      await rerender({ value: 'https://example.com/single-line' });
      expect(warnSpy).toHaveBeenCalledTimes(2);
      await rerender({ value: 'Line one\nLine two' });
      expect(warnSpy).toHaveBeenCalledTimes(3);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('a multiline value logs a dev-only warning', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(ShareCard, { value: 'Line one\nLine two' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0]?.[0];
      if (typeof message !== 'string') throw new Error('Expected warning text');
      expect(message).toContain('[cinder/ShareCard]');
      expect(message).toContain('line break');
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('a single-line value does not log the multiline warning', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(ShareCard, { value: 'https://example.com' });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("the value field survives an ambient form's native reset", async () => {
    // Mount DIRECTLY inside a real `<form>` (not reparented afterward) — the
    // `valueFieldAttachment` looks up `element.closest('form')` at mount
    // time, so the field must already be inside its final form ancestor for
    // this to reproduce the real-world case share-card.svelte's comment
    // describes (a "Reset filters" button elsewhere on the page).
    const form = document.createElement('form');
    document.body.appendChild(form);
    const { rerender } = render(ShareCard, {
      target: form,
      props: { value: 'https://example.com/first' },
    });

    // Change the prop AFTER mount, mirroring a real reuse of the same
    // ShareCard instance for a different link — the DOM's mount-time
    // `defaultValue` (what a native reset would otherwise revert to) now
    // differs from the current, true `value`.
    await rerender({ value: 'https://example.com/second' });
    const valueField = form.querySelector<HTMLInputElement>('.cinder-share-card__value')!;
    expect(valueField.value).toBe('https://example.com/second');

    form.reset();

    // Restoration is deferred by one microtask, deliberately: the `reset` event fires
    // BEFORE the controls are cleared — clearing them IS its default action — so a
    // synchronous re-assert inside the listener would simply be overwritten. Await the
    // microtask before asserting rather than testing the pre-reset value by accident.
    await Promise.resolve();

    // The field is a read-only DISPLAY, not editable form state — the
    // ambient form's reset must not revert it to whatever was rendered at
    // mount (`valueFieldAttachment`'s `reset` listener re-asserts the
    // current `value` prop).
    expect(valueField.value).toBe('https://example.com/second');

    form.remove();
  });
});
