/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: CopyButton } = await import('./copy-button.svelte');

type ClipboardLike = { writeText: (text: string) => Promise<void> };

let originalClipboard: ClipboardLike | undefined;

function mockClipboard(writes: string[] = []): ClipboardLike {
  const clipboard: ClipboardLike = {
    writeText: async (text: string) => {
      writes.push(text);
    },
  };
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
  return clipboard;
}

describe('CopyButton', () => {
  beforeEach(() => {
    originalClipboard = globalThis.navigator.clipboard as unknown as ClipboardLike | undefined;
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    } else {
      // Restore the absence of clipboard if it wasn't there before.
      // happy-dom may not provide one by default; deleting keeps tests clean.
      delete (globalThis.navigator as unknown as { clipboard?: ClipboardLike }).clipboard;
    }
  });

  test('renders a button with a default accessible label', () => {
    const { container } = render(CopyButton, { value: 'hello' });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Copy to clipboard');
  });

  test('default text content is "Copy"', () => {
    const { container } = render(CopyButton, { value: 'hello' });
    expect(container.querySelector('button')?.textContent?.trim()).toBe('Copy');
  });

  test('custom label overrides aria-label', () => {
    const { container } = render(CopyButton, { value: 'x', label: 'Copy snippet' });
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Copy snippet');
  });

  test('clicking the button writes value to the clipboard and flashes confirmation', async () => {
    const writes: string[] = [];
    mockClipboard(writes);

    const { container } = render(CopyButton, { value: 'payload' });
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);

    await waitFor(() => {
      expect(writes).toEqual(['payload']);
      expect(button.hasAttribute('data-cinder-copied')).toBe(true);
      expect(button.textContent?.trim()).toBe('Copied');
    });
  });

  test('iconOnly mode renders Copy icon in idle state', () => {
    const { container } = render(CopyButton, { value: 'hello', iconOnly: true });
    const button = container.querySelector('button');
    // The icon SVG is the only content; aria-label on the button carries the accessible name.
    expect(button?.querySelector('svg')).not.toBeNull();
    expect(button?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button?.getAttribute('aria-label')).toBe('Copy to clipboard');
    // No redundant sr-only label — aria-label is the single source of truth.
    expect(button?.querySelector('.sr-only')).toBeNull();
  });

  test('iconOnly mode swaps icon and aria-label after click', async () => {
    mockClipboard();
    const { container } = render(CopyButton, { value: 'hello', iconOnly: true });
    const button = container.querySelector('button') as HTMLButtonElement;
    const idleSvgPath = button.querySelector('svg path')?.getAttribute('d');

    await fireEvent.click(button);

    await waitFor(() => {
      // aria-label flips to "Copied" (announced via aria-live="polite").
      expect(button.getAttribute('aria-label')).toBe('Copied');
      expect(button.hasAttribute('data-cinder-copied')).toBe(true);
      // The rendered SVG changes from Copy to Check — verify the path data differs
      // so the icon swap actually happened, not just the aria-label.
      const copiedSvgPath = button.querySelector('svg path')?.getAttribute('d');
      expect(copiedSvgPath).toBeDefined();
      expect(copiedSvgPath).not.toBe(idleSvgPath);
    });
  });

  test('default mode (no children, no confirmation) shows "Copied" text after click', async () => {
    // Regression test for the bug Codex caught in plan-review:
    // when neither `children` nor `confirmation` snippets are provided,
    // the copied branch must fall through to the literal "Copied" text.
    mockClipboard();
    const { container } = render(CopyButton, { value: 'hello' });
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);
    await waitFor(() => {
      expect(button.textContent?.trim()).toBe('Copied');
    });
  });
});
