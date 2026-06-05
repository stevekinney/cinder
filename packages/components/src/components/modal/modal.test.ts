/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { _resetScrollLock } from '../../_internal/overlay.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  flushOverflowFadeAnimationFrames,
  installOverflowFadeTestEnvironment,
  OverflowFadeResizeObserver,
  setScrollMeasurements,
} from '../../test/overflow-fade-test-helpers.ts';

setupHappyDom();

// happy-dom does not implement HTMLDialogElement.showModal / close — stub them
// so the $effect inside modal.svelte doesn't throw when open=true.
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

const { cleanup, render, fireEvent } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

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

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  _resetScrollLock();
});

describe('Modal', () => {
  test('dialog is in the DOM but has no open attribute when open=false (client-side)', () => {
    // In a browser context $effect runs, setting mounted=true, so the <dialog> is always
    // present client-side. The dialog is closed (no 'open' attribute) but not torn down,
    // which allows dialogElement.close() to fire correctly on programmatic close.
    // In SSR (no $effect), mounted stays false, so the element is absent from HTML output.
    const { container } = render(Modal, {
      props: {
        open: false,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  test('renders a dialog element when open=true', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('dialog')).not.toBeNull();
  });

  test('renders the title inside the dialog', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'My Dialog Title',
        children: emptySnippet,
      },
    });
    const title = container.querySelector('.cinder-modal__title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('My Dialog Title');
  });

  test('renders children content inside the body', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: textSnippet('Modal body content'),
      },
    });
    const body = container.querySelector('.cinder-modal__body');
    expect(body?.textContent).toContain('Modal body content');
  });

  test('renders footer snippet when provided', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
        footer: textSnippet('Footer content'),
      },
    });
    const footer = container.querySelector('.cinder-modal__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('Footer content');
  });

  test('footer is absent when footer prop is not provided', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-modal__footer')).toBeNull();
  });

  test('close button has aria-label="Close dialog"', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const closeButton = container.querySelector('.cinder-modal__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close dialog');
  });

  test('showCloseButton=false omits the close button', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Sticky Modal',
        showCloseButton: false,
        children: emptySnippet,
      },
    });

    expect(container.querySelector('.cinder-modal__close')).toBeNull();
  });

  test('clicking the close button sets open to false', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
      },
    });

    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
  });

  test('dialog close event sets open to false', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    await fireEvent(dialog, new Event('close'));
    expect(openValue).toBe(false);
  });

  test('Escape key on dialog fires close event and sets open to false', async () => {
    // The native <dialog> element fires a "close" event when the user presses Escape
    // (the browser handles Escape → close automatically when showModal() is used).
    // happy-dom does not fully emulate this native behaviour, so we fire the close
    // event after dispatching Escape to replicate the browser sequence.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    // Simulate the browser sequence: Escape keydown → close event on the dialog.
    await fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await fireEvent(dialog, new Event('close'));
    expect(openValue).toBe(false);
  });

  test('dialog has role="dialog" via native element', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    // The native <dialog> element carries role="dialog" implicitly;
    // aria-modal and aria-labelledby are set explicitly.
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).not.toBeNull();
  });

  test('role prop can emit role="alertdialog"', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Session expired',
        role: 'alertdialog',
        describedById: 'session-description',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('role')).toBe('alertdialog');
  });

  test('applies custom class prop to root dialog element', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        class: 'my-custom-class',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.classList.contains('cinder-modal')).toBe(true);
    expect(dialog?.classList.contains('my-custom-class')).toBe(true);
  });

  test('body container has tabindex="-1" so it can receive programmatic focus', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const body = container.querySelector('.cinder-modal__body');
    expect(body?.getAttribute('tabindex')).toBe('-1');
  });

  test('overflow fade attachment marks and clears the modal body', () => {
    const cleanupOverflowFade = installOverflowFadeTestEnvironment();
    try {
      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
          children: textSnippet('Modal body content'),
        },
      });
      const body = container.querySelector('.cinder-modal__body') as HTMLElement;
      expect(body).not.toBeNull();

      setScrollMeasurements(body, { clientHeight: 100, scrollHeight: 160, scrollTop: 0 });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(body.hasAttribute('data-cinder-overflows')).toBe(true);

      setScrollMeasurements(body, { clientHeight: 100, scrollHeight: 160, scrollTop: 60 });
      body.dispatchEvent(new Event('scroll'));
      flushOverflowFadeAnimationFrames();
      expect(body.hasAttribute('data-cinder-overflows')).toBe(false);
    } finally {
      cleanupOverflowFade();
    }
  });

  test('autofocus DOM property on arbitrary child prevents body fallback focus', () => {
    const originalFocus = HTMLElement.prototype.focus;
    const focusTargets: HTMLElement[] = [];
    HTMLElement.prototype.focus = function focus() {
      focusTargets.push(this);
      return originalFocus.call(this);
    };

    try {
      const children = createRawSnippet(() => ({
        render: () => `<a href="/target">Autofocus link</a>`,
        setup: (node: Element) => {
          (node as HTMLElement).autofocus = true;
        },
      }));

      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
          children,
        },
      });

      const body = container.querySelector('.cinder-modal__body') as HTMLElement;
      expect(focusTargets).not.toContain(body);
    } finally {
      HTMLElement.prototype.focus = originalFocus;
    }
  });

  test('close button is the last focusable element inside the panel', () => {
    // The close button was deliberately moved to the end of the DOM so the
    // native <dialog>.showModal() autofocus fallback (first focusable) does
    // not land on the X. Visually it stays in the corner via CSS.
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: textSnippet('Body content'),
        footer: textSnippet('Footer'),
      },
    });
    const panel = container.querySelector('.cinder-modal__panel');
    const focusables = panel?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const last = focusables?.[focusables.length - 1];
    expect(last?.classList.contains('cinder-modal__close')).toBe(true);
  });

  test('describedById sets aria-describedby on the dialog element', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
        describedById: 'x-123',
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-describedby')).toBe('x-123');
  });

  test('aria-describedby is absent when describedById is omitted', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
  });

  test('ondismiss fires when native cancel event is dispatched (Escape)', async () => {
    let dismissCount = 0;
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
        ondismiss: () => {
          dismissCount++;
        },
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('native cancel event is prevented (Escape routes through dismiss())', async () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
  });

  test('ondismiss fires when backdrop is clicked', async () => {
    let dismissCount = 0;
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
        ondismiss: () => {
          dismissCount++;
        },
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('ondismiss fires when the close-X button is clicked', async () => {
    let dismissCount = 0;
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
        ondismiss: () => {
          dismissCount++;
        },
      },
    });
    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('ondismiss does NOT fire when open is set to false by the parent', async () => {
    let dismissCount = 0;
    let openValue = true;
    const { rerender } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
        ondismiss: () => {
          dismissCount++;
        },
      },
    });
    // Parent-driven close: update the prop directly
    await rerender({ open: false, title: 'Test Modal', children: emptySnippet });
    expect(dismissCount).toBe(0);
  });

  test('focus restores to triggerRef on close', async () => {
    // Baseline focus so captureFocus() sees a known state. Without this, a
    // stale activeElement from a prior test can leak into capturedFocus and
    // win against triggerRef in the candidate iteration.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const button = document.createElement('button');
    button.id = 'modal-trigger';
    document.body.appendChild(button);

    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        triggerRef: button,
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });

  test('focus restores to captured element when triggerRef is unmounted before close', async () => {
    const previouslyFocused = document.createElement('button');
    previouslyFocused.id = 'prev-focus';
    document.body.appendChild(previouslyFocused);
    previouslyFocused.focus();

    const triggerEl = document.createElement('button');
    triggerEl.id = 'transient-trigger';
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        triggerRef: triggerEl,
        children: emptySnippet,
      },
    });

    // Unmount the trigger before the dialog closes.
    document.body.removeChild(triggerEl);

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(document.activeElement).toBe(previouslyFocused);

    document.body.removeChild(previouslyFocused);
  });

  test('no focus is forced when all candidates are disconnected', async () => {
    const triggerEl = document.createElement('button');
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        triggerRef: triggerEl,
        children: emptySnippet,
      },
    });

    // Drop the trigger AND make sure captured focus is null (it was null at open
    // because focus was on body before render).
    document.body.removeChild(triggerEl);

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    // No fallback to document.body — focus stays where the dialog left it.
    expect(document.activeElement).not.toBe(triggerEl);
  });

  test('body scroll lock is acquired on open and released on close', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    expect(document.body.style.overflow).toBe('hidden');

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(document.body.style.overflow).toBe('');
  });

  test('body scroll lock is released when modal is unmounted while open', () => {
    const { unmount } = render(Modal, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  test('two stacked modals: closing the inner one keeps the lock held', async () => {
    const outer = render(Modal, {
      props: { open: true, title: 'Outer', children: emptySnippet },
    });
    expect(document.body.style.overflow).toBe('hidden');

    let innerOpen = true;
    const inner = render(Modal, {
      props: {
        get open() {
          return innerOpen;
        },
        set open(value: boolean) {
          innerOpen = value;
        },
        title: 'Inner',
        children: emptySnippet,
      },
    });
    expect(document.body.style.overflow).toBe('hidden');

    const innerDialog = inner.container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(innerDialog, new Event('close'));
    expect(document.body.style.overflow).toBe('hidden');

    const outerDialog = outer.container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(outerDialog, new Event('close'));
    expect(document.body.style.overflow).toBe('');
  });

  test('release is idempotent across close-then-unmount', async () => {
    let openValue = true;
    const { container, unmount } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    expect(document.body.style.overflow).toBe('hidden');

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(document.body.style.overflow).toBe('');

    // Unmount after close — second release MUST be a no-op (it would otherwise
    // refcount-underflow and could clear overflow set by an unrelated overlay).
    document.body.style.overflow = 'scroll';
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  test('a throwing ondismiss callback propagates the error but open is still false', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
        ondismiss: () => {
          throw new Error('ondismiss error');
        },
      },
    });
    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    // fireEvent swallows handler errors internally; we assert the state side-effect instead.
    await fireEvent.click(closeButton);
    // open flipped to false before the callback ran, so the throw doesn't leave dialog stuck
    expect(openValue).toBe(false);
  });

  test('dismissOnBackdropClick=false keeps backdrop clicks from closing', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Sticky modal',
        dismissOnBackdropClick: false,
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    expect(openValue).toBe(true);
  });

  test('dismissOnEscape=false prevents native cancel dismissal', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Sticky modal',
        dismissOnEscape: false,
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(true);
  });

  // Dialog-model boundary tests
  // These tests document the public contract separating Modal (generic shell),
  // ConfirmDialog (user-initiated binary decision), and AlertDialog (urgent
  // blocking acknowledgement). They also guard the alertdialog escape hatch.

  test('default Modal is dismissable by Escape — unlike AlertDialog', async () => {
    // Modal defaults dismissOnEscape=true. This test documents the contrast with
    // AlertDialog, which passes dismissOnEscape={false} and cannot be Escape-dismissed.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Generic modal',
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    // Default Modal allows Escape (dismissOnEscape=true) — open becomes false.
    expect(openValue).toBe(false);
  });

  test('default Modal is dismissable by backdrop click — unlike AlertDialog', async () => {
    // Modal defaults dismissOnBackdropClick=true. This test documents the contrast
    // with AlertDialog, which passes dismissOnBackdropClick={false}.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Generic modal',
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    expect(openValue).toBe(false);
  });

  test('DEV warning fires when role="alertdialog" is used without companion dismiss flags', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Modal, {
        props: {
          open: true,
          title: 'Session expired',
          role: 'alertdialog',
          describedById: 'session-description',
          // dismissOnBackdropClick and dismissOnEscape intentionally left at their defaults (true)
          // to trigger the dev warning about the broken alertdialog contract
          children: emptySnippet,
        },
      });
      expect(warnings.some((warning) => warning.includes('[cinder/Modal]'))).toBe(true);
      expect(warnings.some((warning) => warning.includes('role="alertdialog"'))).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('DEV warning does NOT fire when role="alertdialog" has all companion flags set correctly', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Modal, {
        props: {
          open: true,
          title: 'Session expired',
          role: 'alertdialog',
          dismissOnBackdropClick: false,
          dismissOnEscape: false,
          showCloseButton: false,
          describedById: 'session-description',
          children: emptySnippet,
        },
      });
      expect(warnings.some((warning) => warning.includes('[cinder/Modal]'))).toBe(false);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('role="alertdialog" with both dismiss flags off is the sticky alertdialog contract', async () => {
    // Documents the manual composition required when using Modal's role="alertdialog"
    // escape hatch: both dismiss flags must be false to satisfy the alertdialog contract.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Session expired',
        role: 'alertdialog',
        describedById: 'manual-desc',
        dismissOnBackdropClick: false,
        dismissOnEscape: false,
        showCloseButton: false,
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog?.getAttribute('role')).toBe('alertdialog');

    // Neither Escape (native cancel event) nor backdrop click should dismiss.
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(true);

    await fireEvent.click(dialog);
    expect(openValue).toBe(true);

    // No close button rendered when showCloseButton=false.
    expect(container.querySelector('.cinder-modal__close')).toBeNull();
  });
});
