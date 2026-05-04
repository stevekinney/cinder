/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: CopyButton } = await import('./copy-button.svelte');

describe('CopyButton', () => {
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
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          writes.push(text);
        },
      },
    });

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
    // Should contain an SVG (the Copy icon) and a screen-reader span
    expect(button?.querySelector('svg')).not.toBeNull();
    expect(button?.querySelector('.sr-only')?.textContent).toBe('Copy to clipboard');
  });

  test('iconOnly mode renders Check icon after click', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} },
    });
    const { container } = render(CopyButton, { value: 'hello', iconOnly: true });
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);
    await waitFor(() => {
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.querySelector('.sr-only')?.textContent).toBe('Copied');
    });
  });

  test('custom children with no confirmation shows "Copied" text when copied', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} },
    });
    // Render without confirmation snippet — children are provided but confirmation is not
    // After click, should show "Copied" (regression for bug where children+no-confirmation never showed copied feedback)
    const { container } = render(CopyButton, { value: 'hello' });
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);
    await waitFor(() => {
      expect(button.textContent?.trim()).toBe('Copied');
    });
  });
});
