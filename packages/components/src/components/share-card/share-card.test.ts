/// <reference lib="dom" />
import { afterEach, describe, expect, jest, spyOn, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { createRawSnippet, tick } = await import('svelte');
const { default: ShareCard } = await import('./share-card.svelte');

function markupSnippet(markup: string) {
  return createRawSnippet(() => ({
    render: () => markup,
  }));
}

type ClipboardLike = { writeText: (text: string) => Promise<void> };

function setNavigatorClipboard(clipboard: ClipboardLike): void {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
}

function restoreNavigatorClipboard(originalClipboard: unknown): void {
  if (originalClipboard === undefined) {
    delete (globalThis.navigator as unknown as { clipboard?: ClipboardLike }).clipboard;
    return;
  }
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
}

afterEach(() => {
  cleanup();
  if (jest.isFakeTimers()) {
    jest.useRealTimers();
  }
});

describe('ShareCard', () => {
  test('renders the value in a focusable, read-only field', () => {
    const { container } = render(ShareCard, { value: 'https://example.com/share/abc' });
    const valueField = container.querySelector<HTMLInputElement>('.cinder-share-card__value');
    expect(valueField).not.toBeNull();
    expect(valueField?.tagName).toBe('INPUT');
    expect(valueField?.value).toBe('https://example.com/share/abc');
    expect(valueField?.readOnly).toBe(true);
    // Keyboard reachability: no explicit `tabindex` removes it from the Tab
    // order, and it is not disabled — a bare `<input>` is natively focusable.
    // (happy-dom's `tabIndex` IDL property defaults to -1 for elements with no
    // explicit attribute, unlike real browsers, so assert on the attribute and
    // `disabled` state directly rather than the IDL property.)
    expect(valueField?.getAttribute('tabindex')).toBeNull();
    expect(valueField?.disabled).toBe(false);
  });

  test('selects the full value when the field receives focus', () => {
    const { container } = render(ShareCard, { value: 'https://example.com/share/abc' });
    const valueField = container.querySelector<HTMLInputElement>('.cinder-share-card__value')!;
    valueField.focus();
    expect(document.activeElement).toBe(valueField);
    expect(valueField.selectionStart).toBe(0);
    expect(valueField.selectionEnd).toBe(valueField.value.length);
  });

  test('renders title when provided', () => {
    const { container } = render(ShareCard, {
      value: 'https://example.com',
      title: 'My shared report',
    });
    expect(container.querySelector('.cinder-share-card__title')?.textContent).toBe(
      'My shared report',
    );
  });

  test('renders description when provided', () => {
    const { container } = render(ShareCard, {
      value: 'https://example.com',
      description: 'Share this report with your team',
    });
    expect(container.querySelector('.cinder-share-card__description')?.textContent).toBe(
      'Share this report with your team',
    );
  });

  test('renders the share actions group with aria-label', () => {
    const { container } = render(ShareCard, { value: 'https://example.com' });
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('Share actions');
  });

  test('renders default copy link button', () => {
    const { getByRole } = render(ShareCard, { value: 'https://example.com' });
    const button = getByRole('button', { name: /Copy link/i });
    expect(button).not.toBeNull();
  });

  test('renders custom copyLinkLabel', () => {
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      copyLinkLabel: 'Copy URL',
    });
    expect(getByRole('button', { name: /Copy URL/i })).not.toBeNull();
  });

  test('shows copied state after clipboard copy', async () => {
    // Mock just the clipboard — do NOT spread the navigator class instance
    // (which loses its prototype and trips the no-misused-spread lint rule).
    let clipboardValue = '';
    const originalClipboard = (navigator as { clipboard?: unknown }).clipboard;
    setNavigatorClipboard({
      writeText: async (text: string) => {
        clipboardValue = text;
      },
    });

    try {
      const { getByRole } = render(ShareCard, {
        value: 'https://example.com',
        copyLinkLabel: 'Copy link',
        copiedLabel: 'Copied!',
      });

      const button = getByRole('button', { name: /Copy link/i });
      await fireEvent.click(button);

      // Wait on the condition, not on the clock. A fixed sleep is both slower than it
      // needs to be and unreliable under load — and check:timeout-increases rejects
      // wait thresholds outright, because they hide the race rather than resolve it.
      await waitFor(() => {
        expect(clipboardValue).toBe('https://example.com');
      });
    } finally {
      restoreNavigatorClipboard(originalClipboard);
    }
  });

  test('announces "Copy failed" and leaves no copied attribute when the clipboard write rejects', async () => {
    // happy-dom does not implement document.execCommand, so the legacyCopy
    // fallback inside copyToClipboard throws, is caught, and returns false —
    // a rejecting writeText mock reliably reaches handleCopy's failure branch.
    const originalClipboard = (navigator as { clipboard?: unknown }).clipboard;
    setNavigatorClipboard({
      writeText: async () => {
        throw new Error('denied');
      },
    });
    jest.useFakeTimers();

    try {
      const { container, getByRole } = render(ShareCard, {
        value: 'https://example.com',
        copyLinkLabel: 'Copy link',
        copiedLabel: 'Copied!',
      });

      const button = getByRole('button', { name: /Copy link/i });
      await fireEvent.click(button);
      // Let the rejected clipboard write and the sync legacyCopy fallback
      // resolve, then advance the live region's setTimeout(0) blank-then-set
      // dance deterministically instead of sleeping on the real clock.
      await tick();
      jest.advanceTimersByTime(0);
      await tick();

      const liveRegion = container.querySelector('.cinder-sr-only');
      expect(liveRegion?.textContent).toBe('Copy failed');
      expect(button.getAttribute('data-cinder-copied')).toBeNull();
    } finally {
      restoreNavigatorClipboard(originalClipboard);
      jest.useRealTimers();
    }
  });

  test('an identical success re-announces after the confirmation window resets through blank', async () => {
    // The live region (VisuallyHiddenLiveRegion) only re-announces when its
    // `message` prop TRANSITIONS. share-card uses a single write per announce and
    // auto-clears to '' after `confirmDuration`, so the next identical copy
    // transitions '' → "Copied!" and re-announces. This matches the canonical
    // copy-button / media-controls contract (within-window identical re-announce
    // is not provided by any consumer and belongs in the live region if ever
    // wanted). A bespoke synchronous blank-then-set would be a no-op that
    // silently defeats the region's own re-announce mechanism.
    const originalClipboard = (navigator as { clipboard?: unknown }).clipboard;
    setNavigatorClipboard({
      writeText: async () => {},
    });
    jest.useFakeTimers();

    try {
      const { container, getByRole } = render(ShareCard, {
        value: 'https://example.com',
        copyLinkLabel: 'Copy link',
        copiedLabel: 'Copied!',
        // Shorter than the production default, but still longer than the
        // Testing Library polling interval so the transient copied state is
        // observable under full-suite load.
        confirmDuration: 250,
      });
      const liveRegion = container.querySelector('.cinder-sr-only');
      const button = getByRole('button', { name: /Copy link/i });

      await fireEvent.click(button);
      await tick();
      jest.advanceTimersByTime(0);
      await tick();
      expect(liveRegion?.textContent).toBe('Copied!');

      // Let the confirmation window elapse: the message auto-clears to ''.
      jest.advanceTimersByTime(250);
      await tick();
      expect(liveRegion?.textContent).toBe('');

      // A second identical copy now transitions '' → "Copied!" and re-announces.
      await fireEvent.click(button);
      await tick();
      jest.advanceTimersByTime(0);
      await tick();
      expect(liveRegion?.textContent).toBe('Copied!');
    } finally {
      restoreNavigatorClipboard(originalClipboard);
      jest.useRealTimers();
    }
  });

  test('renders custom actions', () => {
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        { key: 'copy-text', label: 'Copy text', copyValue: 'My text' },
        { key: 'copy-link', label: 'Copy link', copyValue: 'https://example.com' },
      ],
    });
    expect(getByRole('button', { name: /Copy text/i })).not.toBeNull();
    expect(getByRole('button', { name: /Copy link/i })).not.toBeNull();
  });

  test('calls custom onclick for actions', () => {
    let clicked = false;
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        {
          key: 'custom',
          label: 'Custom action',
          onclick: () => {
            clicked = true;
          },
        },
      ],
    });
    fireEvent.click(getByRole('button', { name: /Custom action/i }));
    expect(clicked).toBe(true);
  });

  test('onclick does NOT suppress the copy when copyValue is also present', async () => {
    // onclick is a side-effect callback (analytics), not a copy override — both
    // must run.
    let clicked = false;
    let copied = '';
    const originalClipboard = (navigator as { clipboard?: unknown }).clipboard;
    setNavigatorClipboard({
      writeText: async (text: string) => {
        copied = text;
      },
    });
    try {
      const { getByRole } = render(ShareCard, {
        value: 'https://example.com',
        actions: [
          {
            key: 'copy-and-track',
            label: 'Copy and track',
            copyValue: 'https://example.com/tracked',
            onclick: () => {
              clicked = true;
            },
          },
        ],
      });
      await fireEvent.click(getByRole('button', { name: /Copy and track/i }));
      // Wait on the condition, not the clock — check:timeout-increases rejects fixed
      // wait thresholds, and polling the assertion is both faster and deterministic.
      await waitFor(() => {
        expect(clicked).toBe(true);
        expect(copied).toBe('https://example.com/tracked');
      });
    } finally {
      restoreNavigatorClipboard(originalClipboard);
    }
  });

  test('applies custom class', () => {
    const { container } = render(ShareCard, {
      value: 'https://example.com',
      class: 'my-share-card',
    });
    const root = container.querySelector('.cinder-share-card');
    expect(root?.classList.contains('my-share-card')).toBe(true);
  });

  test('renders without title or description when omitted', () => {
    const { container } = render(ShareCard, { value: 'https://example.com' });
    expect(container.querySelector('.cinder-share-card__meta')).toBeNull();
  });

  test('does not render native share button when navigator.share is absent', () => {
    // happy-dom doesn't implement navigator.share — this tests the fallback.
    const { container } = render(ShareCard, { value: 'https://example.com' });
    const actions = container.querySelectorAll('.cinder-share-card__action');
    // Only the copy-link button should be rendered by default when no native share.
    expect(actions.length).toBeGreaterThanOrEqual(1);
  });

  test('value region is labelled "Link to share" for a URL', () => {
    const { container } = render(ShareCard, { value: 'https://example.com/x' });
    expect(container.querySelector('.cinder-share-card__value')?.getAttribute('aria-label')).toBe(
      'Link to share',
    );
  });

  test('value region is labelled "Text to share" for non-URL text', () => {
    const { container } = render(ShareCard, { value: 'Just some text' });
    expect(container.querySelector('.cinder-share-card__value')?.getAttribute('aria-label')).toBe(
      'Text to share',
    );
  });

  test('the copy-link button is icon-only: aria-label carries the name, no visible label text', () => {
    const { container, getByRole } = render(ShareCard, {
      value: 'https://example.com',
      copyLinkLabel: 'Copy link',
    });
    const button = getByRole('button', { name: 'Copy link' });
    expect(button.getAttribute('aria-label')).toBe('Copy link');
    // No visible "Copy link" text node in the button — only the decorative,
    // aria-hidden icon.
    expect(button.textContent?.trim()).toBe('');
    expect(
      container.querySelector('.cinder-share-card__action-icon[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  test('a labelSnippet action still renders its rich visible content', () => {
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        {
          key: 'copy-link',
          label: 'Copy link',
          copyValue: 'https://example.com',
          labelSnippet: markupSnippet('<strong>Custom copy label</strong>'),
        },
      ],
    });
    const button = getByRole('button', { name: 'Copy link' });
    expect(button.textContent?.trim()).toBe('Custom copy label');
  });
});

// ---------------------------------------------------------------------------
// Input-composition regressions (invalid nesting, multiline values, form
// reset, and the labelSnippet layout escape hatch)
// ---------------------------------------------------------------------------

describe('ShareCard Input composition', () => {
  test('the icon-only actions render inside a <span>, not a <div>, so the trailing addon nesting stays valid', () => {
    // `Input`'s `trailing` addon wraps whatever it's given in
    // `<span class="cinder-input-group__trailing">`. A `<span>` is phrasing
    // content and cannot legally contain a `<div>` (flow content) — browsers
    // parse a `<div>` there back out to a sibling, breaking the layout. Guard
    // the element type directly.
    const { container } = render(ShareCard, { value: 'https://example.com' });
    const trailing = container.querySelector('.cinder-input-group__trailing');
    expect(trailing).not.toBeNull();
    const actions = trailing?.querySelector('.cinder-share-card__actions');
    expect(actions?.tagName).toBe('SPAN');
    expect(trailing?.querySelector('div')).toBeNull();
  });

  test('a multiline value is copied verbatim by the copy-link button, even though the field displays it single-line', async () => {
    const multiline = 'Line one\nLine two\nLine three';
    let clipboardValue = '';
    const originalClipboard = (navigator as { clipboard?: unknown }).clipboard;
    setNavigatorClipboard({
      writeText: async (text: string) => {
        clipboardValue = text;
      },
    });
    // Silence the (expected, already covered by its own test) dev warning
    // for a multiline `value` so this test's output stays focused.
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { getByRole } = render(ShareCard, {
        value: multiline,
        copyLinkLabel: 'Copy link',
      });
      await fireEvent.click(getByRole('button', { name: 'Copy link' }));
      // The copy action reads `value`/`copyValue` from component state, never
      // from the (single-line, newline-sanitizing) DOM input — so it is
      // never lossy, regardless of what the field visually displays.
      await waitFor(() => {
        expect(clipboardValue).toBe(multiline);
      });
    } finally {
      restoreNavigatorClipboard(originalClipboard);
      warnSpy.mockRestore();
    }
  });

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

    valueField.dispatchEvent(copyEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith('text/plain', multiline);
    warnSpy.mockRestore();
  });

  test('a multiline value logs a dev-only warning', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(ShareCard, { value: 'Line one\nLine two' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = (warnSpy.mock.calls[0] as string[])[0];
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

    // The field is a read-only DISPLAY, not editable form state — the
    // ambient form's reset must not revert it to whatever was rendered at
    // mount (`valueFieldAttachment`'s `reset` listener re-asserts the
    // current `value` prop).
    expect(valueField.value).toBe('https://example.com/second');

    form.remove();
  });

  test('actions with a labelSnippet render OUTSIDE the value field, not inside its constrained trailing slot', () => {
    const { container } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        {
          key: 'copy-link',
          label: 'Copy link',
          copyValue: 'https://example.com',
          labelSnippet: markupSnippet('<strong>Custom copy label</strong>'),
        },
      ],
    });
    const actions = container.querySelector('.cinder-share-card__actions');
    expect(actions).not.toBeNull();
    // No `.cinder-input-group` addon wrapper at all in this path — the field
    // renders with no `trailing`, so `Input` renders a bare `<input>` with no
    // group wrapper, and the actions render as a direct sibling of the field
    // (inside `.cinder-share-card` itself) instead of being squeezed into a
    // slot that caps at `max-inline-size: 40%`.
    expect(container.querySelector('.cinder-input-group')).toBeNull();
    expect(actions?.parentElement).toBe(container.querySelector<HTMLElement>('.cinder-share-card'));
  });

  test('icon-only actions (no labelSnippet) still render inside the value field trailing addon', () => {
    const { container } = render(ShareCard, { value: 'https://example.com' });
    const inputGroup = container.querySelector('.cinder-input-group');
    const actions = container.querySelector('.cinder-share-card__actions');
    expect(actions).not.toBeNull();
    expect(inputGroup?.contains(actions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Native share + clipboard behavior (the high-risk paths)
// ---------------------------------------------------------------------------

describe('ShareCard native share', () => {
  const originalShare = (navigator as Navigator & { share?: unknown }).share;
  const originalCanShare = (navigator as Navigator & { canShare?: unknown }).canShare;
  const originalClipboard = (navigator as Navigator & { clipboard?: unknown }).clipboard;

  afterEach(() => {
    if (originalShare === undefined) delete (navigator as { share?: unknown }).share;
    else (navigator as { share?: unknown }).share = originalShare;
    if (originalCanShare === undefined) delete (navigator as { canShare?: unknown }).canShare;
    else (navigator as { canShare?: unknown }).canShare = originalCanShare;
    restoreNavigatorClipboard(originalClipboard);
  });

  test('renders the default native-share button after client mount when navigator.share exists', () => {
    // Regression guard for the template restructure. `canNativeShare` is gated on
    // the post-hydration `hydrated` $effect (false on first render, flips true once
    // the effect fires — synchronously in this happy-dom harness). The default
    // native-share button is rendered by a standalone `{#if !actions &&
    // canNativeShare}`, NOT by pushing into the reactive `resolvedActions` array.
    //
    // Falsification (verified during development): reverting to the array-push
    // approach — where the native-share action is appended to `resolvedActions`
    // once `canNativeShare` flips — makes this assertion FAIL. The keyed `{#each}`
    // does not pick up the post-mount array growth, so the button never appears.
    // This test therefore guards the standalone-`{#if}` structure, not just that
    // the button eventually renders.
    (navigator as { share?: unknown }).share = async () => {};
    const { container } = render(ShareCard, { value: 'https://example.com/x' });
    const shareButton = container.querySelector('[data-cinder-action="native-share"]');
    expect(shareButton).not.toBeNull();
    // The copy-link default is still present alongside it.
    expect(container.querySelector('[data-cinder-action="copy-link"]')).not.toBeNull();
  });

  test('renders a native share button and shares a URL value as url', async () => {
    let received: ShareData | undefined;
    (navigator as { share?: unknown }).share = async (data: ShareData) => {
      received = data;
    };
    const { getByRole } = render(ShareCard, { value: 'https://example.com/x' });
    await fireEvent.click(getByRole('button', { name: 'Share' }));
    expect(received?.url).toBe('https://example.com/x');
  });

  test('shares non-URL values as text, not url', async () => {
    let received: ShareData | undefined;
    (navigator as { share?: unknown }).share = async (data: ShareData) => {
      received = data;
    };
    const { getByRole } = render(ShareCard, { value: 'Just some text to share' });
    await fireEvent.click(getByRole('button', { name: 'Share' }));
    expect(received?.text).toBe('Just some text to share');
    expect(received?.url).toBeUndefined();
  });

  test('a cancelled share (AbortError) does not fall back to copy', async () => {
    (navigator as { share?: unknown }).share = async () => {
      throw new DOMException('cancelled', 'AbortError');
    };
    let copied = '';
    setNavigatorClipboard({
      writeText: async (text: string) => {
        copied = text;
      },
    });
    const { getByRole } = render(ShareCard, { value: 'https://example.com/x' });
    await fireEvent.click(getByRole('button', { name: 'Share' }));
    // Abort is a user cancel — it must NOT trigger the copy fallback.
    expect(copied).toBe('');
  });

  test('a non-Abort share rejection falls back to copy', async () => {
    (navigator as { share?: unknown }).share = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
    let copied = '';
    setNavigatorClipboard({
      writeText: async (text: string) => {
        copied = text;
      },
    });
    const { getByRole } = render(ShareCard, { value: 'https://example.com/x' });
    await fireEvent.click(getByRole('button', { name: 'Share' }));
    // The copy fallback ran, preserving the value.
    expect(copied).toBe('https://example.com/x');
  });

  test('the share button reflects the copied state after a fallback copy', async () => {
    (navigator as { share?: unknown }).share = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
    setNavigatorClipboard({
      writeText: async () => {},
    });
    const { container } = render(ShareCard, { value: 'https://example.com/x' });
    const shareButton = container.querySelector('[data-cinder-action="native-share"]');
    await fireEvent.click(shareButton!);
    // The share -> fallback-copy chain awaits navigator.share and then the clipboard
    // write, so the copied state lands a couple of microtasks later. Poll for it
    // rather than sleeping a fixed interval: check:timeout-increases rejects wait
    // thresholds because they paper over the race instead of resolving it.
    //
    // The fallback copy succeeded — the share button must surface the copied
    // affordance visually (icon + `data-cinder-copied`), but its accessible
    // name stays STABLE at `action.label` ("Share"). It must NOT swap to
    // `copiedLabel`: the live region (asserted elsewhere) is the single
    // source of truth for the transient announcement, so the name changing
    // too would risk a redundant re-announcement and would also make
    // `getByRole(..., { name: 'Share' })` unable to find the button mid-copy.
    await waitFor(() => {
      expect(shareButton?.getAttribute('data-cinder-copied')).toBe('');
    });
    expect(shareButton?.getAttribute('aria-label')).toBe('Share');
  });
});
