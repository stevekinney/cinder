/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { copyToClipboard } from './clipboard.ts';

setupHappyDom();

type ClipboardLike = { writeText: (text: string) => Promise<void> };
let originalClipboard: ClipboardLike | undefined;
let originalExecCommand: typeof document.execCommand | undefined;

beforeEach(() => {
  originalClipboard = navigator.clipboard as ClipboardLike | undefined;
  originalExecCommand = document.execCommand;
});

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
  } else {
    delete (navigator as unknown as { clipboard?: ClipboardLike }).clipboard;
  }
  if (originalExecCommand) document.execCommand = originalExecCommand;
  else delete (document as unknown as { execCommand?: typeof document.execCommand }).execCommand;
  document.body.replaceChildren();
});

describe('copyToClipboard', () => {
  test('uses the asynchronous Clipboard API when it succeeds', async () => {
    const writeText = mock(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    expect(await copyToClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  test('falls back to a hidden textarea when Clipboard API rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mock(async () => Promise.reject(new Error('denied'))) },
    });
    document.execCommand = mock(() => true) as typeof document.execCommand;

    expect(await copyToClipboard('fallback')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  test('returns false when the legacy copy command throws', async () => {
    delete (navigator as unknown as { clipboard?: ClipboardLike }).clipboard;
    document.execCommand = mock(() => {
      throw new Error('copy unavailable');
    }) as typeof document.execCommand;
    expect(await copyToClipboard('nope')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
