/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { copyToClipboard } from './clipboard.ts';

setupHappyDom();

type ClipboardLike = {
  writeText: (text: string) => Promise<void>;
};

let originalClipboard: ClipboardLike | undefined;
let originalExecCommand: typeof document.execCommand | undefined;

beforeEach(() => {
  document.body.replaceChildren();
  originalClipboard = globalThis.navigator.clipboard as ClipboardLike | undefined;
  originalExecCommand = document.execCommand;
});

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  } else {
    delete (globalThis.navigator as unknown as { clipboard?: ClipboardLike }).clipboard;
  }

  if (originalExecCommand) {
    document.execCommand = originalExecCommand;
  } else {
    delete (document as unknown as { execCommand?: typeof document.execCommand }).execCommand;
  }

  document.body.replaceChildren();
});

describe('copyToClipboard', () => {
  test('marks the legacy fallback textarea as hidden from assistive technology', async () => {
    const appendedTextareas: HTMLTextAreaElement[] = [];
    const appendChild = document.body.appendChild.bind(document.body);

    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mock(async () => Promise.reject(new Error('denied'))) },
    });

    document.body.appendChild = ((node: Node) => {
      if (node instanceof HTMLTextAreaElement) appendedTextareas.push(node);
      return appendChild(node);
    }) as typeof document.body.appendChild;

    document.execCommand = mock(() => true) as typeof document.execCommand;

    expect(await copyToClipboard('secret-token')).toBe(true);
    expect(appendedTextareas).toHaveLength(1);
    expect(appendedTextareas[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(appendedTextareas[0]?.getAttribute('tabindex')).toBe('-1');
  });
});
