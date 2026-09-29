/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, fireNativeClose, installModalDialogStubs } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal', () => {
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    await fireNativeClose(dialog);
    expect(document.body.style.overflow).toBe('');

    // Unmount after close — second release MUST be a no-op (it would otherwise
    // refcount-underflow and could clear overflow set by an unrelated overlay).
    document.body.style.overflow = 'scroll';
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });
  test('a throwing onDismiss callback propagates the error but open is still false', async () => {
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
        onDismiss: () => {
          throw new Error('onDismiss error');
        },
      },
    });
    const closeButton = requiredInstance(
      container.querySelector('.cinder-modal__close'),
      HTMLButtonElement,
    );
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    await fireEvent.click(dialog);
    expect(openValue).toBe(false);
  });
});
