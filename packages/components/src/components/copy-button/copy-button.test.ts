/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';

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

  test('button aria-label stays stable; copiedLabel is announced via the live region', async () => {
    // Corrected a11y model: the success feedback is announced by a SEPARATE
    // visually-hidden live region, not by flipping aria-live on the button itself.
    // A live region on an interactive control double-announces (the AT reads the
    // button name on focus AND as a live change) and conflicts with the button role.
    // The button keeps a stable accessible name; the live region carries the status.
    mockClipboard();
    const { container } = render(CopyButton, {
      value: 'x',
      label: 'Copy code',
      copiedLabel: 'Code copied',
      iconOnly: true,
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Copy code');
    // The button has NO aria-live — the live region owns announcements.
    expect(button.hasAttribute('aria-live')).toBe(false);

    await fireEvent.click(button);
    await waitFor(() => {
      // aria-label is unchanged.
      expect(button.getAttribute('aria-label')).toBe('Copy code');
      // The copiedLabel is announced in the dedicated polite live region.
      const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
      expect(liveRegion?.textContent?.trim()).toBe('Code copied');
    });
  });

  test('default "Copied" is announced in the live region when no copiedLabel provided', async () => {
    mockClipboard();
    const { container } = render(CopyButton, { value: 'x', label: 'Copy code' });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Copy code');
    await fireEvent.click(button);
    await waitFor(() => {
      expect(button.getAttribute('aria-label')).toBe('Copy code');
      const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion?.textContent?.trim()).toBe('Copied');
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
      // aria-label stays stable; the success is announced in the live region.
      expect(button.getAttribute('aria-label')).toBe('Copy to clipboard');
      expect(button.hasAttribute('data-cinder-copied')).toBe(true);
      const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion?.textContent?.trim()).toBe('Copied');
      // The rendered SVG changes from Copy to Check — verify the path data differs
      // so the icon swap actually happened.
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

  test('native attributes pass through to the button element', () => {
    const { container } = render(CopyButton, {
      value: 'hello',
      id: 'copy-btn',
      'data-testid': 'copy-btn-testid',
      name: 'copy-action',
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('id')).toBe('copy-btn');
    expect(button?.getAttribute('data-testid')).toBe('copy-btn-testid');
    expect(button?.getAttribute('name')).toBe('copy-action');
  });

  test('consumer cannot clobber the controlled aria-label', () => {
    // aria-label is computed internally and Omit-ted from the prop type, so a
    // consumer can only reach it by bypassing types. Even then the component wins
    // by spread ordering: a bypassed value lands in `rest` but the explicit
    // aria-label rendered AFTER {...rest} overrides it.
    const { container } = render(CopyButton, {
      value: 'hello',
      'aria-label': 'CONSUMER_OVERRIDE',
    } as never);
    const button = container.querySelector('button');
    // Internal computed label wins.
    expect(button?.getAttribute('aria-label')).toBe('Copy to clipboard');
    // The button carries NO aria-live — announcements live in the separate region.
    expect(button?.hasAttribute('aria-live')).toBe(false);
  });

  test('consumer onclick via rest does not bypass the internal copy handler', async () => {
    // `onclick` is Omit-ted from the type (compile-time guard). A bypassed handler lands
    // in `rest`, but the explicit onclick={handleClick} rendered AFTER {...rest} overrides
    // it (Svelte 5: the later same-key attribute wins), so the clipboard logic still runs.
    const writes: string[] = [];
    mockClipboard(writes);
    let consumerFired = 0;
    const { container } = render(CopyButton, {
      value: 'copy-me',
      onclick: () => {
        consumerFired += 1;
      },
    } as never);
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);
    // The internal handler ran (value copied)…
    await waitFor(() => expect(writes).toEqual(['copy-me']));
    // …and the consumer's overridden onclick never fired.
    expect(consumerFired).toBe(0);
  });

  test('consumer cannot turn the copy button into a form submitter via type', () => {
    // `type` is Omit-ted and `type="button"` is rendered AFTER {...rest}, so a bypassed
    // `type="submit"` cannot make CopyButton submit an enclosing form.
    const { container } = render(CopyButton, { value: 'x', type: 'submit' } as never);
    expect(container.querySelector('button')?.getAttribute('type')).toBe('button');
  });

  test('unmounting after a copy leaves no pending timers', async () => {
    // handleClick schedules a setTimeout(confirmDuration) to flip `copied` back to
    // false; the VisuallyHiddenLiveRegion schedules its own auto-clear timeout.
    // Both must be cleared on unmount (copy-button's onDestroy + the live region's
    // $effect cleanup) — otherwise a callback fires against an unmounted component.
    mockClipboard();
    const timers = trackTimers();
    try {
      const { container, unmount } = render(CopyButton, { value: 'hi', confirmDuration: 10_000 });
      const button = container.querySelector('button') as HTMLButtonElement;
      await fireEvent.click(button);
      // Wait for the copied state (announced in the live region), confirming both
      // the reset timer and the live-region auto-clear timer are now pending.
      await waitFor(() => {
        expect(button.hasAttribute('data-cinder-copied')).toBe(true);
        const liveRegion = container.querySelector('[role="status"]');
        expect(liveRegion?.textContent?.trim()).toBe('Copied');
      });

      unmount();
      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });
});
