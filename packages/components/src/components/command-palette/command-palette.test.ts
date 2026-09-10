/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { _resetEscapeStack, _resetScrollLock } from '../../_internal/overlay.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

// happy-dom does not implement HTMLDialogElement.showModal / close — stub
// them. `open` is reflected as a real IDL property (not just an attribute,
// see drawer.test.ts's identical stub) and `close()` dispatches the native
// `close` event itself, the way a real browser's "close the dialog" steps
// do — SlidingDialogState.handleClose() (wired to `onclose`) is now the sole
// place that releases the scroll lock/escape registration, restores focus,
// and reports `onClose`, so tests must let a genuine `close` event reach it
// rather than asserting those effects happened synchronously.
//
// Unconditionally redefined (not guarded behind `if (!HTMLDialogElement
// .prototype.close)`) — Bun's test runner executes every matched file in one
// shared process, so an EARLIER-loaded file's own (possibly less complete,
// non-event-dispatching) stub would otherwise win and silently leave this
// file's tests running against the wrong behavior. `configurable: true`
// makes redefining safe regardless of what ran before this file.
if (typeof HTMLDialogElement !== 'undefined') {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: function () {
      Object.defineProperty(this, 'open', {
        value: true,
        configurable: true,
        writable: true,
      });
      this.setAttribute('open', '');
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: function () {
      Object.defineProperty(this, 'open', {
        value: false,
        configurable: true,
        writable: true,
      });
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
    configurable: true,
    writable: true,
  });
}

const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

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

  test('external open=false closes dialog, restores focus, and fires onClose once', async () => {
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
          onSelect: () => {},
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

  test('Enter with no registered items does not invoke onClose', async () => {
    let closed = false;
    const { container } = render(CommandPalette, {
      props: {
        open: true,
        onClose: () => {
          closed = true;
        },
        items: emptySnippet,
      },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(closed).toBe(false);
    expect(event.defaultPrevented).toBe(true);
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

  test('Escape fires onCancel with preventDefault', async () => {
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

  test('Escape (native cancel event) closes the palette and fires onClose', async () => {
    // Per OVERLAY-POLICY.md's "Escape priority" section: "Native <dialog> ESC
    // dispatches via onCancel/onClose, not via the JS stack." SlidingDialogState
    // registers a NO-OP handler on the escape stack purely for LIFO bookkeeping
    // with other overlays — actual Escape handling is the native `cancel` event,
    // routed through dialogState.handleNativeCancel() -> requestClose().
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
        onClose: () => {
          closeFired = true;
        },
        items: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await settleCommandPalette();
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

  test('omits empty optional ARIA labels and shortcuts', () => {
    const { container } = render(CommandPaletteRichItemFixture);
    const option = container.querySelector('.cinder-command-item');

    expect(option?.hasAttribute('aria-label')).toBe(false);
    expect(option?.hasAttribute('aria-keyshortcuts')).toBe(false);
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
  test('onClose fires exactly once when close event fires', async () => {
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
        onClose: () => {
          closeCount++;
        },
        items: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    // Simulate a genuine external/native close: `dialog.close()` (the fixed
    // happy-dom stub) both flips the `open` IDL property and dispatches the
    // real `close` event itself — SlidingDialogState.handleClose() validates
    // an unmatched (external) `close` event against `dialogElement.open` to
    // detect staleness, so a bare synthetic `close` Event with `open` still
    // `true` is correctly ignored rather than double-firing `onClose`.
    dialog.close();
    await settleCommandPalette();
    expect(closeCount).toBe(1);
  });
});

// ── Exit-transition lifecycle (CIN-426) ───────────────────────────────────
//
// OVERLAY-POLICY.md, "Transition lifecycle" > "The contract": the component
// renders data-cinder-closing on its animated element for the full duration
// of the exit transition; the shared waitForTransitionCompletion helper —
// not open flipping false — decides when the panel actually unmounts and
// the native dialog closes. CommandPalette now gets this via
// SlidingDialogState, the same mechanism Modal/Drawer use.

describe('CommandPalette — exit transition lifecycle', () => {
  test('keeps the panel mounted with data-cinder-closing until its exit transition finishes; dialog.close() fires only after completion', async () => {
    // Stub a real (non-zero) transition duration for
    // `.cinder-command-palette__panel` so `waitForTransitionCompletion`
    // takes its transitionend-listening path instead of resolving on the
    // next microtask — mirrors modal.test.ts's identical technique, the
    // only way to observe the intermediate "closing but still mounted"
    // state.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (
        target instanceof HTMLElement &&
        target.classList.contains('cinder-command-palette__panel')
      ) {
        return {
          transitionProperty: 'opacity, translate',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      const { container, rerender } = render(CommandPalette, {
        props: { open: true, items: emptySnippet },
      });

      const dialog = container.querySelector('dialog') as HTMLDialogElement;
      await rerender({ open: false, items: emptySnippet });

      // `open` flips synchronously, but the native <dialog> and the panel's
      // DOM node must both survive the exit transition instead of vanishing
      // in the same tick.
      expect(dialog.hasAttribute('open')).toBe(true);
      const panel = container.querySelector('.cinder-command-palette__panel');
      expect(panel).not.toBeNull();
      expect(panel?.hasAttribute('data-cinder-closing')).toBe(true);

      for (const propertyName of ['opacity', 'translate']) {
        const event = new Event('transitionend');
        Object.defineProperty(event, 'propertyName', { value: propertyName });
        panel?.dispatchEvent(event);
      }

      await waitFor(() => {
        expect(dialog.hasAttribute('open')).toBe(false);
        expect(container.querySelector('.cinder-command-palette__panel')).toBeNull();
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('closes immediately under prefers-reduced-motion: reduce', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((media: string): MediaQueryList =>
      ({
        matches: media === '(prefers-reduced-motion: reduce)',
        media,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;

    // Stub a real transition duration too — if this test passed only because
    // happy-dom's DEFAULT computed style is a zero duration, it would not
    // actually prove the reduced-motion path is what caused the immediate
    // close (see the "attribute override" test below for the companion
    // case: zero duration WITHOUT the reduced-motion hook returning true).
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (
        target instanceof HTMLElement &&
        target.classList.contains('cinder-command-palette__panel')
      ) {
        return {
          transitionProperty: 'opacity, translate',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      const { container, rerender } = render(CommandPalette, {
        props: { open: true, items: emptySnippet },
      });

      await rerender({ open: false, items: emptySnippet });

      // useReducedMotion() reports true, so SlidingDialogState passes
      // reducedMotion: true to waitForTransitionCompletion, which ignores
      // the (non-zero) computed duration entirely and resolves via
      // queueMicrotask regardless.
      await waitFor(() => {
        expect(container.querySelector('.cinder-command-palette__panel')).toBeNull();
      });
    } finally {
      window.matchMedia = originalMatchMedia;
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('closes immediately when duration tokens are collapsed to 0 by attribute override (no reduced-motion preference)', async () => {
    // No matchMedia mock — useReducedMotion() reports false. This proves the
    // CSS-side collapse (tokens-base.css's `[data-cinder-reduced-motion]`/
    // `[data-reduced-motion]` attribute overrides collapsing every
    // `--cinder-duration-*` token to 0ms) is independently sufficient:
    // waitForTransitionCompletion reads the ACTUAL computed duration, not
    // just the JS reducedMotion flag, per OVERLAY-POLICY.md's ruling that
    // "CSS-side overrides cannot disagree with the JS wait."
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (
        target instanceof HTMLElement &&
        target.classList.contains('cinder-command-palette__panel')
      ) {
        return {
          transitionProperty: 'opacity, translate',
          transitionDuration: '0ms, 0ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      const { container, rerender } = render(CommandPalette, {
        props: { open: true, items: emptySnippet },
      });

      await rerender({ open: false, items: emptySnippet });

      await waitFor(() => {
        expect(container.querySelector('.cinder-command-palette__panel')).toBeNull();
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('reopening mid-close does not unmount the freshly reopened palette', async () => {
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (
        target instanceof HTMLElement &&
        target.classList.contains('cinder-command-palette__panel')
      ) {
        return {
          transitionProperty: 'opacity, translate',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      const { container, rerender } = render(CommandPalette, {
        props: { open: true, items: emptySnippet },
      });

      await rerender({ open: false, items: emptySnippet });
      expect(container.querySelector('.cinder-command-palette__panel')).not.toBeNull();

      // Reopen mid-transition, before any transitionend fires.
      await rerender({ open: true, items: emptySnippet });

      expect(container.querySelector('.cinder-command-palette__panel')).not.toBeNull();
      expect(
        container
          .querySelector('.cinder-command-palette__panel')
          ?.hasAttribute('data-cinder-closing'),
      ).toBe(false);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
});

// ── Scroll lock ────────────────────────────────────────────────────────────

describe('CommandPalette — scroll lock', () => {
  test('body scroll lock is acquired on open and released on close', async () => {
    let openValue = true;
    const { container } = render(CommandPalette, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        items: emptySnippet,
      },
    });

    expect(document.body.style.overflow).toBe('hidden');

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    dialog.close();
    await settleCommandPalette();
    expect(document.body.style.overflow).toBe('');
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
  test('keyboard focus is indicated by the standard library ring on the input, via :focus-visible', async () => {
    const css = await Bun.file(new URL('./command-palette.css', import.meta.url)).text();

    // The bespoke bottom-border-recolor idiom is gone; the search row no longer
    // paints any focus indication of its own.
    expect(css).not.toMatch(/\.cinder-command-palette__search\s*\{[\s\S]*?border-block-end/);
    expect(css).not.toMatch(/\.cinder-command-palette__search:focus-within/);

    // The input now carries the library's standard ring recipe — transparent
    // outline + the shared two-stop box-shadow formula — gated on :focus-visible
    // (not :focus) so a mouse click does not show the ring.
    expect(css).toMatch(
      /\.cinder-command-palette__input:focus-visible\s*\{[\s\S]*?outline:\s*var\(--cinder-ring-width\) solid transparent;/,
    );
    expect(css).toMatch(
      /\.cinder-command-palette__input:focus-visible\s*\{[\s\S]*?box-shadow:\s*var\(--_cinder-focus-ring-shadow\);/,
    );
    expect(css).not.toMatch(/\.cinder-command-palette__input:focus\s*\{/);

    // forced-colors fallback matches the library's other :focus-visible inputs.
    expect(css).toMatch(
      /@media \(forced-colors: active\)\s*\{[\s\S]*?\.cinder-command-palette__input:focus-visible\s*\{[\s\S]*?outline:\s*var\(--cinder-ring-width\) solid Highlight;/,
    );
    expect(css).toMatch(
      /\.cinder-command-palette__search\s*\{[\s\S]*?background:\s*var\(--cinder-surface-raised\);/,
    );
  });

  test('search input padding-block matches the command item rhythm (both use --cinder-space-2-5)', async () => {
    const paletteCss = await Bun.file(new URL('./command-palette.css', import.meta.url)).text();
    const commandItemCss = await Bun.file(
      new URL('../command-item/command-item.css', import.meta.url),
    ).text();

    // The search input's own vertical padding must agree with the block padding
    // of the rows beneath it — both use --cinder-space-2-5 (0.625rem), not the
    // old --cinder-space-4 (1rem) that produced an uneven gap before the first
    // result row.
    expect(paletteCss).toMatch(
      /\.cinder-command-palette__input\s*\{[\s\S]*?padding-block:\s*var\(--cinder-space-2-5\);/,
    );
    expect(commandItemCss).toMatch(
      /\.cinder-command-item\s*\{[\s\S]*?padding:\s*var\(--cinder-space-2-5\)\s+var\(--cinder-space-5\);/,
    );
  });

  test('listbox has correct padding and command items span full width', async () => {
    const paletteCss = await Bun.file(new URL('./command-palette.css', import.meta.url)).text();
    // CommandItem rules were extracted to command-item/command-item.css so both
    // CommandPalette and CommandMenu can import them without duplication.
    const commandItemCss = await Bun.file(
      new URL('../command-item/command-item.css', import.meta.url),
    ).text();

    expect(paletteCss).toMatch(
      /\.cinder-command-palette__listbox\s*\{[\s\S]*?padding:\s*var\(--cinder-space-2\)\s*0;/,
    );
    // CommandItem rules now live in command-item.css (imported by command-palette.css).
    expect(commandItemCss).toMatch(/\.cinder-command-item\s*\{[\s\S]*?margin:\s*0;/);
    expect(commandItemCss).toMatch(
      /\.cinder-command-item\[data-cinder-active\]\s*\{[\s\S]*?background:\s*var\(--cinder-accent-solid\);[\s\S]*?color:\s*var\(--cinder-accent-contrast\);/,
    );
    // Confirm command-palette.css now @imports command-item.css (import chain).
    expect(paletteCss).toMatch(/@import\s+['"]\.\.\/command-item\/command-item\.css['"]/);
  });
});

// ── Consumer-owned filtering ───────────────────────────────────────────────
//
// These tests guard the searchable-example contract. With `filters`, the
// fixture filters INSIDE its `{#snippet items({ query })}` using the snippet's
// `query` argument — exactly the pattern the basic/grouped examples use. Typing a
// query that does not match an item must remove that item from the DOM. A failure
// here means the items snippet is ignoring its `query` parameter, which was the
// original "search does nothing" bug (MVP task: CommandPalette real search).

describe('CommandPalette — consumer-owned filtering', () => {
  test('items matching the query remain visible', async () => {
    const { container } = render(CommandPaletteFixture, {
      filters: true,
    });
    await settleCommandPalette();

    // "Alpha" and "Gamma" are the enabled items; both contain 'a' / 'A'.
    await fireEvent.click(container.querySelector('[data-testid="command-palette-query-a"]')!);
    await settleCommandPalette();

    const options = container.querySelectorAll('[role="option"]');
    const labels = Array.from(options).map((el) => el.textContent?.trim());
    expect(labels).toContain('Alpha');
    expect(labels).toContain('Gamma');
  });

  test('items that do not match the query are removed from the DOM', async () => {
    const { container } = render(CommandPaletteFixture, {
      filters: true,
    });
    await settleCommandPalette();

    // Query 'z' matches none of Alpha / Beta / Gamma.
    await fireEvent.click(container.querySelector('[data-testid="command-palette-query-z"]')!);
    await settleCommandPalette();

    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(0);

    // A no-match query must surface the empty state, not just a blank list.
    const emptyEl = container.querySelector('.cinder-command-palette__empty');
    expect(emptyEl).not.toBeNull();
    expect(emptyEl?.textContent?.trim()).toBe('No results');
  });

  test('query that partially matches leaves only matching items in the DOM', async () => {
    const { container } = render(CommandPaletteFixture, {
      filters: true,
      items: [
        { value: 'settings', label: 'Open settings' },
        { value: 'sign-out', label: 'Sign out' },
        { value: 'new-file', label: 'New file' },
      ],
    });
    await settleCommandPalette();

    // Set query to 'set' — only 'Open settings' should survive.
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'set' } });
    await settleCommandPalette();

    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent?.trim()).toBe('Open settings');
  });
});
