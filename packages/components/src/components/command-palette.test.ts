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
    }).toThrow('CommandItem must be used within a CommandPalette.');
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
