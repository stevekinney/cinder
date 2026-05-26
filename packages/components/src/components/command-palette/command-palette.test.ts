/// <reference lib="dom" />
import { beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { _resetEscapeStack, _resetScrollLock } from '../../_internal/overlay.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

// happy-dom does not implement HTMLDialogElement.showModal / close — stub them.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function () {
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function () {
        this.removeAttribute('open');
      },
      configurable: true,
      writable: true,
    });
  }
}

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: CommandPalette } = await import('./command-palette.svelte');
const { default: CommandItem } = await import('../command-item/command-item.svelte');
const { default: CommandPaletteFixture } =
  await import('../../test/fixtures/command-palette-fixture.svelte');
const { default: CommandPaletteRichItemFixture } =
  await import('../../test/fixtures/command-palette-rich-item-fixture.svelte');
const { default: CommandPaletteAttachFixture } =
  await import('../../test/fixtures/command-palette-attach-fixture.svelte');

// ── Snippet helpers ────────────────────────────────────────────────────────

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

async function settleCommandPalette() {
  await Promise.resolve();
  await tick();
}

function getInput(container: HTMLElement) {
  return container.querySelector('input[role="combobox"]') as HTMLInputElement;
}

function expectActiveOption(container: HTMLElement, label: string) {
  const input = getInput(container);
  const selectedOptions = Array.from(
    container.querySelectorAll('[role="option"][aria-selected="true"]'),
  );
  expect(selectedOptions).toHaveLength(1);
  const selectedOption = selectedOptions[0] as HTMLElement;
  expect(selectedOption.textContent).toContain(label);
  expect(input.getAttribute('aria-activedescendant')).toBe(selectedOption.id);
  return selectedOption;
}

// ── Shared setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  _resetEscapeStack();
  _resetScrollLock();
});

// ── Lifecycle ──────────────────────────────────────────────────────────────

describe('CommandPalette — lifecycle', () => {
  test('dialog is in the DOM (mounted) even when open=false', () => {
    const { container } = render(CommandPalette, {
      props: {
        open: false,
        items: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  test('dialog has open attribute when open=true', () => {
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        items: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  test('external open=false closes dialog, restores focus, and fires onclose once', async () => {
    let closeCount = 0;
    const { container, getByTestId } = render(CommandPaletteFixture, {
      initialOpen: false,
      onClosed: () => {
        closeCount += 1;
      },
    });
    const trigger = getByTestId('command-palette-trigger') as HTMLButtonElement;
    trigger.focus();

    await fireEvent.click(trigger);
    await settleCommandPalette();

    const input = getInput(container);
    expect(document.activeElement).toBe(input);

    await fireEvent.click(getByTestId('command-palette-external-close'));
    await settleCommandPalette();

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(closeCount).toBe(1);
  });
});

// ── ARIA / combobox ────────────────────────────────────────────────────────

describe('CommandPalette — combobox ARIA', () => {
  test('input has role="combobox"', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input');
    expect(input?.getAttribute('role')).toBe('combobox');
  });

  test('input has aria-expanded="true" while open', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input');
    expect(input?.getAttribute('aria-expanded')).toBe('true');
  });

  test('input has aria-controls pointing at the listbox', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input');
    const listbox = container.querySelector('[role="listbox"]');
    expect(input?.getAttribute('aria-controls')).toBe(listbox?.getAttribute('id'));
  });

  test('listbox has role="listbox"', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
  });

  test('dialog has aria-modal="true"', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  test('dialog has aria-label from label prop', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, label: 'My palette', items: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-label')).toBe('My palette');
  });

  test('dialog defaults to aria-label="Command palette"', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-label')).toBe('Command palette');
  });

  test('search input has a <label> element associated via for/id', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    const inputId = input?.getAttribute('id');
    expect(inputId).not.toBeNull();
    const label = container.querySelector(`label[for="${inputId}"]`);
    expect(label).not.toBeNull();
  });

  test('listbox has no aria-label (name provided via combobox aria-controls)', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.getAttribute('aria-label')).toBeNull();
  });
});

// ── Backdrop click ─────────────────────────────────────────────────────────

describe('CommandPalette — backdrop click', () => {
  test('click on dialog element closes the palette', async () => {
    let openValue = true;
    const { container } = render(CommandPalette, {
      props: {
        get open() {
          return openValue;
        },
        set open(v: boolean) {
          openValue = v;
        },
        items: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    // Simulate a click where target === dialog (backdrop area).
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: dialog });
    dialog.dispatchEvent(event);
    await tick();
    expect(openValue).toBe(false);
  });

  test('click on input does not close the palette', async () => {
    let openValue = true;
    const { container } = render(CommandPalette, {
      props: {
        get open() {
          return openValue;
        },
        set open(v: boolean) {
          openValue = v;
        },
        items: emptySnippet,
      },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.click(input);
    expect(openValue).toBe(true);
  });
});

// ── Query ──────────────────────────────────────────────────────────────────

describe('CommandPalette — query', () => {
  test('typing into the input updates the bound query', async () => {
    let queryValue = '';
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        get query() {
          return queryValue;
        },
        set query(v: string) {
          queryValue = v;
        },
        items: emptySnippet,
      },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'hello' } });
    expect(queryValue).toBe('hello');
  });
});

// ── Footer and empty snippet ───────────────────────────────────────────────

describe('CommandPalette — slots', () => {
  test('renders footer when provided', () => {
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        items: emptySnippet,
        footer: textSnippet('Footer hint'),
      },
    });
    const footer = container.querySelector('.cinder-command-palette__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('Footer hint');
  });

  test('footer is absent when not provided', () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    expect(container.querySelector('.cinder-command-palette__footer')).toBeNull();
  });
});

// ── Context guard ──────────────────────────────────────────────────────────

describe('CommandItem — context guard', () => {
  test('throws when rendered without a command list parent', () => {
    expect(() => {
      render(CommandItem, {
        props: {
          value: 'test',
          onselect: () => {},
          children: textSnippet('Item'),
        },
      });
    }).toThrow('CommandItem must be used within a CommandPalette or CommandMenu.');
  });
});

// ── Keyboard routing ───────────────────────────────────────────────────────

describe('CommandPalette — keyboard routing (no registered items)', () => {
  // These tests verify the handlers fire without throwing and produce correct
  // ARIA state when no CommandItem children have registered.

  test('ArrowDown with no registered items leaves aria-activedescendant absent', async () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('ArrowUp with no registered items leaves aria-activedescendant absent', async () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('Enter with no registered items does not invoke onclose', async () => {
    let closed = false;
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        onclose: () => {
          closed = true;
        },
        items: emptySnippet,
      },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(closed).toBe(false);
  });

  test('Home with no registered items leaves aria-activedescendant absent', async () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Home' });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('End with no registered items leaves aria-activedescendant absent', async () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'End' });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('Escape fires oncancel with preventDefault', async () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    let cancelPrevented = false;
    const cancelEvent = new Event('cancel', { cancelable: true });
    cancelEvent.preventDefault = () => {
      cancelPrevented = true;
    };
    dialog.dispatchEvent(cancelEvent);
    await tick();
    expect(cancelPrevented).toBe(true);
  });

  test('Escape key via the escape stack closes the palette and fires onclose', async () => {
    // This tests the pushEscapeHandler path: opening the palette registers a
    // handler on the escape stack, and a keydown Escape on the window fires it.
    let closeFired = false;
    let openValue = true;
    render(CommandPalette, {
      props: {
        get open() {
          return openValue;
        },
        set open(v: boolean) {
          openValue = v;
        },
        onclose: () => {
          closeFired = true;
        },
        items: emptySnippet,
      },
    });
    // Dispatch Escape on the window — the escape stack listens on window with capture.
    await fireEvent.keyDown(window, { key: 'Escape' });
    await tick();
    expect(openValue).toBe(false);
    expect(closeFired).toBe(true);
  });
});

describe('CommandPalette — keyboard routing with registered items', () => {
  test('arrow keys move aria-activedescendant through enabled items and skip disabled items', async () => {
    const { container } = render(CommandPaletteFixture);
    await settleCommandPalette();

    const input = getInput(container);
    expect(document.activeElement).toBe(input);

    expectActiveOption(container, 'Alpha');

    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'Gamma');
    expect(container.querySelector('[aria-disabled="true"]')?.getAttribute('aria-selected')).toBe(
      'false',
    );

    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'Alpha');

    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    await tick();
    expectActiveOption(container, 'Gamma');
  });

  test('Home and End use the registered enabled item boundaries', async () => {
    const { container } = render(CommandPaletteFixture);
    await settleCommandPalette();

    const input = getInput(container);

    await fireEvent.keyDown(input, { key: 'End' });
    await tick();
    expectActiveOption(container, 'Gamma');

    await fireEvent.keyDown(input, { key: 'Home' });
    await tick();
    expectActiveOption(container, 'Alpha');
  });

  test('Enter invokes the active registered item callback', async () => {
    let selectedValue = '';
    const { container } = render(CommandPaletteFixture, {
      onSelected: (value: string) => {
        selectedValue = value;
      },
    });
    await settleCommandPalette();

    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(selectedValue).toBe('gamma');
  });

  test('active registered item is scrolled into view for keyboard navigation', async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const calls: unknown[] = [];
    Element.prototype.scrollIntoView = function (options?: ScrollIntoViewOptions | boolean) {
      calls.push({ element: this, options });
    };

    try {
      const { container } = render(CommandPaletteFixture);
      await settleCommandPalette();

      const input = getInput(container);
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      await tick();

      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls.at(-1) as { element: Element; options: ScrollIntoViewOptions };
      expect(lastCall.options).toEqual({ block: 'nearest' });
      expect((lastCall.element as HTMLElement).getAttribute('aria-selected')).toBe('true');
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});

describe('CommandItem — rich row content', () => {
  test('renders optional description text inside the option', () => {
    const { container } = render(CommandPaletteRichItemFixture);
    expect(container.querySelector('.cinder-command-item__description')?.textContent).toContain(
      'Add freeform text',
    );
  });
});

// ── Empty state timing ────────────────────────────────────────────────────

describe('CommandPalette — empty state timing', () => {
  test('empty snippet is NOT shown synchronously on open (before microtask)', () => {
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        items: emptySnippet,
        empty: textSnippet('Nothing here'),
      },
    });
    // registrationsReady has not yet been set to true (queueMicrotask pending)
    expect(container.querySelector('.cinder-command-palette__empty')).toBeNull();
  });

  test('empty snippet appears after microtask when no items are registered', async () => {
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        items: emptySnippet,
        empty: textSnippet('Nothing here'),
      },
    });
    // Drain the microtask queue
    await Promise.resolve();
    await tick();
    const emptyEl = container.querySelector('.cinder-command-palette__empty');
    expect(emptyEl).not.toBeNull();
    expect(emptyEl?.textContent).toContain('Nothing here');
  });

  test('empty snippet has role="status" for screen reader announcement', async () => {
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        items: emptySnippet,
        empty: textSnippet('No results'),
      },
    });
    await Promise.resolve();
    await tick();
    const emptyEl = container.querySelector('.cinder-command-palette__empty');
    expect(emptyEl?.getAttribute('role')).toBe('status');
  });

  test('empty state is not shown before registrationsReady (readyCycle prevents premature flash)', async () => {
    // The three tests above cover the queueMicrotask mechanism for initial open.
    // This test verifies the synchronous reset: immediately on open, before any
    // microtask fires, the empty snippet is not rendered.
    for (let i = 0; i < 3; i++) {
      const { container, unmount } = render(CommandPalette, {
        props: {
          open: true,
          items: emptySnippet,
          empty: textSnippet('No results'),
        },
      });
      // Synchronously after render — queueMicrotask has not fired yet.
      expect(container.querySelector('.cinder-command-palette__empty')).toBeNull();
      unmount();
    }
  });
});

// ── Close idempotency ─────────────────────────────────────────────────────

describe('CommandPalette — close idempotency', () => {
  test('onclose fires exactly once when close event fires', async () => {
    let closeCount = 0;
    let openValue = true;
    const { container } = render(CommandPalette, {
      props: {
        get open() {
          return openValue;
        },
        set open(v: boolean) {
          openValue = v;
        },
        onclose: () => {
          closeCount++;
        },
        items: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    await tick();
    expect(closeCount).toBe(1);
  });
});

// ── Custom class ───────────────────────────────────────────────────────────

describe('CommandPalette — class prop', () => {
  test('applies custom class to the panel', () => {
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        class: 'my-custom-palette',
        items: emptySnippet,
      },
    });
    const panel = container.querySelector('.cinder-command-palette__panel');
    expect(panel?.classList.contains('my-custom-palette')).toBe(true);
  });
});

// ── Attachment-based registration ─────────────────────────────────────────

describe('CommandPalette — attachment registration', () => {
  test('arrow keys walk items in DOM order after the middle item remounts', async () => {
    const { container, rerender } = render(CommandPaletteAttachFixture, {
      props: { showMiddle: true },
    });
    await settleCommandPalette();

    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3);
    expectActiveOption(container, 'alpha');

    // Unmount the middle item; remaining items are alpha and gamma in DOM order.
    await rerender({ showMiddle: false });
    await tick();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);

    const input = getInput(container);
    expect(input.getAttribute('aria-activedescendant')).not.toBeNull();
    expectActiveOption(container, 'alpha');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'gamma');

    // Remount the middle item; navigation should once again pass through beta.
    await rerender({ showMiddle: true });
    await tick();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3);

    // From gamma, ArrowDown wraps to first DOM-order item: alpha.
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'alpha');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'beta');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'gamma');
  });

  test('conditional item unmount/remount keeps the registry clean (no leaks)', async () => {
    const { container, rerender } = render(CommandPaletteAttachFixture, {
      props: { showMiddle: true },
    });
    await settleCommandPalette();

    const initialCount = container.querySelectorAll('[role="option"]').length;
    expect(initialCount).toBe(3);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await rerender({ showMiddle: false });
      await tick();
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(initialCount - 1);

      await rerender({ showMiddle: true });
      await tick();
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(initialCount);
    }

    // After repeated mount/unmount cycles, arrow navigation still visits every
    // currently-mounted item exactly once before wrapping.
    const input = getInput(container);
    expectActiveOption(container, 'alpha');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'beta');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'gamma');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expectActiveOption(container, 'alpha');
  });
});

// ── Visual contract ───────────────────────────────────────────────────────

describe('CommandPalette — visual contract', () => {
  test('command palette CSS uses visible search focus and full-width active item highlight', async () => {
    const css = await Bun.file(new URL('./command-palette.css', import.meta.url)).text();

    expect(css).toMatch(
      /\.cinder-command-palette__search:focus-within\s*\{[\s\S]*?box-shadow:\s*inset 0 0 0 var\(--cinder-ring-width\) var\(--cinder-ring-color\);/,
    );
    expect(css).toMatch(
      /\.cinder-command-palette__listbox\s*\{[\s\S]*?padding:\s*var\(--cinder-space-2\)\s*0;/,
    );
    expect(css).toMatch(/\.cinder-command-item\s*\{[\s\S]*?margin:\s*0;/);
    expect(css).toMatch(
      /\.cinder-command-item\[data-cinder-active\]\s*\{[\s\S]*?background:\s*var\(--cinder-accent\);[\s\S]*?color:\s*var\(--cinder-accent-contrast\);/,
    );
  });
});
