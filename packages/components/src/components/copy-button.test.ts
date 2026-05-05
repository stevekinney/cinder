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

  test('custom label sets the idle aria-label', () => {
    const { container } = render(CopyButton, { value: 'x', label: 'Copy snippet' });
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Copy snippet');
  });

  test('aria-label flips to copiedLabel after click even when label is set', async () => {
    // Regression test for the bug Cursor Bugbot caught: when a consumer passes
    // a static `label`, the `aria-label` short-circuited and never changed to
    // "Copied". Combined with iconOnly (icons are aria-hidden), screen readers
    // received no feedback when copy succeeded. The fix: aria-label flips on
    // copied state regardless of whether label is set.
    mockClipboard();
    const { container } = render(CopyButton, {
      value: 'x',
      label: 'Copy code',
      copiedLabel: 'Code copied',
      iconOnly: true,
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Copy code');
    await fireEvent.click(button);
    await waitFor(() => {
      expect(button.getAttribute('aria-label')).toBe('Code copied');
    });
  });

  test('aria-label flips to default "Copied" when no copiedLabel provided', async () => {
    mockClipboard();
    const { container } = render(CopyButton, { value: 'x', label: 'Copy code' });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Copy code');
    await fireEvent.click(button);
    await waitFor(() => {
      expect(button.getAttribute('aria-label')).toBe('Copied');
    });
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
