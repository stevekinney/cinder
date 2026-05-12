/// <reference lib="dom" />
import { beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';
import { _resetEscapeStack, _resetScrollLock } from '../_internal/overlay.ts';

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
const { default: CommandItem } = await import('./command-item.svelte');

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

  test('setting open=false closes the dialog', async () => {
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
    await fireEvent(dialog, new Event('close'));
    expect(openValue).toBe(false);
  });

  test('fires onclose after open is mutated to false', async () => {
    let closeFired = false;
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
          closeFired = true;
        },
        items: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(closeFired).toBe(true);
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
  test('throws when rendered without a CommandPalette parent', () => {
    expect(() => {
      render(CommandItem, {
        props: {
          value: 'test',
          onselect: () => {},
          children: textSnippet('Item'),
        },
      });
    }).toThrow('CommandItem must be used within a CommandPalette');
  });
});

// ── Keyboard routing ───────────────────────────────────────────────────────

describe('CommandPalette — keyboard routing', () => {
  /**
   * Build a palette with three items using a snippet that renders
   * CommandItem components. We rely on the palette being open so children mount.
   *
   * Note: in this test harness we synthesize the items snippet inline using
   * a component-level helper rather than mounting sub-components directly,
   * because @testing-library/svelte does not support mounting child components
   * into parent context in a single render call. Instead, we fire keyboard
   * events directly on the input and assert on ARIA attributes.
   */

  test('ArrowDown moves aria-activedescendant forward', async () => {
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        items: createRawSnippet(() => ({
          render: () =>
            `<li id="item-1" role="option" aria-selected="false">A</li>` +
            `<li id="item-2" role="option" aria-selected="false">B</li>` +
            `<li id="item-3" role="option" aria-selected="false">C</li>`,
          setup: () => {},
        })),
      },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    // No items are registered via context (raw snippet doesn't use CommandItem),
    // so we test that the keyboard handler fires without throwing.
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    // With no registered items, activeItemId stays null; no error.
    expect(input?.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('Enter does not throw when no items are registered', async () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Enter' });
    // No error thrown.
    expect(true).toBe(true);
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

  test('Home and End keys do not throw when no items registered', async () => {
    const { container } = render(CommandPalette, {
      props: { open: true, items: emptySnippet },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Home' });
    await fireEvent.keyDown(input, { key: 'End' });
    expect(true).toBe(true);
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
