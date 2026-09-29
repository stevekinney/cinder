/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, jest, test } from 'bun:test';
import { restoreNavigatorClipboard, setNavigatorClipboard } from './share-card-test-support.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: ShareCard } = await import('./share-card.svelte');
afterEach(() => {
  cleanup();
  if (jest.isFakeTimers()) jest.useRealTimers();
});

describe('ShareCard native share', () => {
  const originalShare = navigator.share;

  const originalCanShare = navigator.canShare;

  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    if (originalShare === undefined) Reflect.deleteProperty(navigator, 'share');
    else navigator.share = originalShare;
    if (originalCanShare === undefined) Reflect.deleteProperty(navigator, 'canShare');
    else navigator.canShare = originalCanShare;
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
    navigator.share = async () => {};
    const { container } = render(ShareCard, { value: 'https://example.com/x' });
    const shareButton = container.querySelector('[data-cinder-action="native-share"]');
    expect(shareButton).not.toBeNull();
    // The copy-link default is still present alongside it.
    expect(container.querySelector('[data-cinder-action="copy-link"]')).not.toBeNull();
  });

  test('renders a native share button and shares a URL value as url', async () => {
    let received: ShareData | undefined;
    navigator.share = async (data: ShareData) => {
      received = data;
    };
    const { getByRole } = render(ShareCard, { value: 'https://example.com/x' });
    await fireEvent.click(getByRole('button', { name: 'Share' }));
    expect(received?.url).toBe('https://example.com/x');
  });

  test('shares non-URL values as text, not url', async () => {
    let received: ShareData | undefined;
    navigator.share = async (data: ShareData) => {
      received = data;
    };
    const { getByRole } = render(ShareCard, { value: 'Just some text to share' });
    await fireEvent.click(getByRole('button', { name: 'Share' }));
    expect(received?.text).toBe('Just some text to share');
    expect(received?.url).toBeUndefined();
  });

  test('a cancelled share (AbortError) does not fall back to copy', async () => {
    navigator.share = async () => {
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
    navigator.share = async () => {
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
    navigator.share = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
    // Sync on the clipboard write ITSELF rather than polling for its effect. The
    // share -> fallback-copy chain awaits navigator.share and then the write, so the
    // copied state lands a few microtasks after the click. A fixed sleep papers over
    // that race; a bare `waitFor` resolves it but inherits Testing Library's 1000ms
    // deadline, so a chain that stalls holds CI for a second per occurrence. Resolving
    // a promise from inside the mock gives an exact signal with no threshold at all.
    const { promise: clipboardWriteCalled, resolve: signalWriteCalled } =
      Promise.withResolvers<void>();
    setNavigatorClipboard({
      writeText: async () => {
        signalWriteCalled();
      },
    });
    const { container } = render(ShareCard, { value: 'https://example.com/x' });
    const shareButton = container.querySelector('[data-cinder-action="native-share"]');
    await fireEvent.click(shareButton!);
    await clipboardWriteCalled;
    // One flush for handleCopy's state write after copyToClipboard resolves.
    await tick();
    //
    // The fallback copy succeeded — the share button must surface the copied
    // affordance visually (icon + `data-cinder-copied`), but its accessible
    // name stays STABLE at `action.label` ("Share"). It must NOT swap to
    // `copiedLabel`: the live region (asserted elsewhere) is the single
    // source of truth for the transient announcement, so the name changing
    // too would risk a redundant re-announcement and would also make
    // `getByRole(..., { name: 'Share' })` unable to find the button mid-copy.
    expect(shareButton?.getAttribute('data-cinder-copied')).toBe('');
    expect(shareButton?.getAttribute('aria-label')).toBe('Share');
  });
});
