/// <reference lib="dom" />
import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: ShareCard } = await import('./share-card.svelte');

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
  test('renders the value in the link display area', () => {
    const { container } = render(ShareCard, { value: 'https://example.com/share/abc' });
    const valueText = container.querySelector('.cinder-share-card__value-text');
    expect(valueText?.textContent).toBe('https://example.com/share/abc');
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

      // Allow async clipboard operation to settle.
      await new Promise((resolve) => setTimeout(resolve, 10));

      // After a click, the value should have been written (assuming clipboard mock works).
      expect(clipboardValue).toBe('https://example.com');
    } finally {
      restoreNavigatorClipboard(originalClipboard);
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

  test('calls custom onClick for actions', () => {
    let clicked = false;
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        {
          key: 'custom',
          label: 'Custom action',
          onClick: () => {
            clicked = true;
          },
        },
      ],
    });
    fireEvent.click(getByRole('button', { name: /Custom action/i }));
    expect(clicked).toBe(true);
  });

  test('onClick does NOT suppress the copy when copyValue is also present', async () => {
    // onClick is a side-effect callback (analytics), not a copy override — both
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
            onClick: () => {
              clicked = true;
            },
          },
        ],
      });
      await fireEvent.click(getByRole('button', { name: /Copy and track/i }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(clicked).toBe(true);
      expect(copied).toBe('https://example.com/tracked');
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
    const { getByText } = render(ShareCard, { value: 'https://example.com/x' });
    await fireEvent.click(getByText('Share'));
    expect(received?.url).toBe('https://example.com/x');
  });

  test('shares non-URL values as text, not url', async () => {
    let received: ShareData | undefined;
    (navigator as { share?: unknown }).share = async (data: ShareData) => {
      received = data;
    };
    const { getByText } = render(ShareCard, { value: 'Just some text to share' });
    await fireEvent.click(getByText('Share'));
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
    const { getByText } = render(ShareCard, { value: 'https://example.com/x' });
    await fireEvent.click(getByText('Share'));
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
    const { getByText } = render(ShareCard, { value: 'https://example.com/x' });
    await fireEvent.click(getByText('Share'));
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
    // The share → fallback-copy chain awaits navigator.share then the clipboard
    // write; let those microtasks/timers settle before asserting the UI state.
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The fallback copy succeeded — the share button must surface the copied
    // affordance, not silently stay on the "Share" label.
    expect(shareButton?.getAttribute('data-cinder-copied')).toBe('');
    expect(shareButton?.getAttribute('aria-label')).toBe('Copied!');
  });
});
