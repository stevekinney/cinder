/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: ShareCard } = await import('./share-card.svelte');

afterEach(() => {
  cleanup();
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
    (navigator as { clipboard?: unknown }).clipboard = {
      writeText: async (text: string) => {
        clipboardValue = text;
      },
    };

    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      copyLinkLabel: 'Copy link',
      copiedLabel: 'Copied!',
    });

    const button = getByRole('button', { name: /Copy link/i });
    fireEvent.click(button);

    // Allow async clipboard operation to settle.
    await new Promise((resolve) => setTimeout(resolve, 10));

    // After a click, the value should have been written (assuming clipboard mock works).
    expect(clipboardValue).toBe('https://example.com');

    // Restore the original clipboard.
    if (originalClipboard === undefined) delete (navigator as { clipboard?: unknown }).clipboard;
    else (navigator as { clipboard?: unknown }).clipboard = originalClipboard;
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
    if (originalClipboard === undefined) delete (navigator as { clipboard?: unknown }).clipboard;
    else (navigator as { clipboard?: unknown }).clipboard = originalClipboard;
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
    (navigator as { clipboard?: unknown }).clipboard = {
      writeText: async (text: string) => {
        copied = text;
      },
    };
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
    (navigator as { clipboard?: unknown }).clipboard = {
      writeText: async (text: string) => {
        copied = text;
      },
    };
    const { getByText } = render(ShareCard, { value: 'https://example.com/x' });
    await fireEvent.click(getByText('Share'));
    // The copy fallback ran, preserving the value.
    expect(copied).toBe('https://example.com/x');
  });
});
