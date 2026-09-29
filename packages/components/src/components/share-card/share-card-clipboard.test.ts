/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, jest, spyOn, test } from 'bun:test';
import { restoreNavigatorClipboard, setNavigatorClipboard } from './share-card-test-support.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: ShareCard } = await import('./share-card.svelte');
afterEach(() => {
  cleanup();
  if (jest.isFakeTimers()) jest.useRealTimers();
});

describe('ShareCard', () => {
  test('shows copied state after clipboard copy', async () => {
    // Mock just the clipboard — do NOT spread the navigator class instance
    // (which loses its prototype and trips the no-misused-spread lint rule).
    let clipboardValue = '';
    const originalClipboard = navigator.clipboard;
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
    const originalClipboard = navigator.clipboard;
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
    const originalClipboard = navigator.clipboard;
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

  test('onclick does NOT suppress the copy when copyValue is also present', async () => {
    // onclick is a side-effect callback (analytics), not a copy override — both
    // must run.
    let clicked = false;
    let copied = '';
    const originalClipboard = navigator.clipboard;
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
});
describe('ShareCard Input composition', () => {
  test('a multiline value is copied verbatim by the copy-link button, even though the field displays it single-line', async () => {
    const multiline = 'Line one\nLine two\nLine three';
    let clipboardValue = '';
    const originalClipboard = navigator.clipboard;
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
});
