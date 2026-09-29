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
  test('selecting the field and copying (native `copy` event) also sends the exact, unmodified multiline value', () => {
    const multiline = 'Line one\nLine two\nLine three';
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(ShareCard, { value: multiline });
    const valueField = container.querySelector<HTMLInputElement>('.cinder-share-card__value')!;

    // happy-dom's `ClipboardEvent` does not populate a real `clipboardData`
    // for a synthetic dispatch (browsers only do that for a trusted, native
    // copy). Stub one so the assertion targets share-card's own handler
    // (`handleFieldCopy`) rather than the browser's clipboard plumbing.
    const setData = jest.fn();
    const preventDefault = jest.fn();
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(copyEvent, 'clipboardData', {
      configurable: true,
      value: { setData },
    });
    Object.defineProperty(copyEvent, 'preventDefault', {
      configurable: true,
      value: preventDefault,
    });

    // Select the whole field. The handler stands in for the native copy only on a
    // full selection -- see the partial-selection test below -- so this has to be
    // explicit rather than relying on whatever the default selection happens to be.
    valueField.setSelectionRange(0, valueField.value.length);

    valueField.dispatchEvent(copyEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith('text/plain', multiline);
    warnSpy.mockRestore();
  });

  test('copying a PARTIAL selection leaves the native copy alone', () => {
    // The handler exists because a single-line <input> renders a multi-line value with
    // its breaks collapsed, so copying the displayed text would lose them. That covers
    // a select-all. It must NOT cover a user who highlighted one path segment: quietly
    // substituting the entire value there is a surprise, and the handler is attached
    // for single-line values too, where it has nothing to fix in the first place.
    const { container } = render(ShareCard, { value: 'https://example.com/a/b/c' });
    const valueField = container.querySelector<HTMLInputElement>('.cinder-share-card__value')!;

    const setData = jest.fn();
    const preventDefault = jest.fn();
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(copyEvent, 'clipboardData', { configurable: true, value: { setData } });
    Object.defineProperty(copyEvent, 'preventDefault', {
      configurable: true,
      value: preventDefault,
    });

    // Highlight just "example.com".
    valueField.setSelectionRange(8, 19);
    valueField.dispatchEvent(copyEvent);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
  });

  test('a copy event with no clipboardData does not cancel the native copy', () => {
    // Preventing default without writing a replacement would leave the clipboard
    // untouched -- strictly worse than the collapsed line breaks the handler exists to
    // avoid.
    const { container } = render(ShareCard, { value: 'https://example.com/a' });
    const valueField = container.querySelector<HTMLInputElement>('.cinder-share-card__value')!;

    const preventDefault = jest.fn();
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(copyEvent, 'clipboardData', { configurable: true, value: null });
    Object.defineProperty(copyEvent, 'preventDefault', {
      configurable: true,
      value: preventDefault,
    });

    valueField.setSelectionRange(0, valueField.value.length);
    valueField.dispatchEvent(copyEvent);

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
