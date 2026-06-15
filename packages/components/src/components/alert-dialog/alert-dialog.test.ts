/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { _resetEscapeStack, _resetScrollLock } from '../../_internal/overlay.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

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
const { default: AlertDialog } = await import('./alert-dialog.svelte');

// AlertDialog renders a native <dialog> via showModal(); without this teardown the
// dialog (and its title "Session expired") leaks into the shared happy-dom document,
// so a later `getByRole('alertdialog', { name: 'Session expired' })` finds duplicates
// once these tests run in the same `bun test` invocation as the modal/drawer suites.
// Mirror the sibling overlay suites: unmount, clear the body, and reset the overlay
// scroll-lock refcount + escape stack so neither leaks across tests.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  _resetScrollLock();
  _resetEscapeStack();
});

describe('AlertDialog', () => {
  test('renders alertdialog semantics with required description', () => {
    const { container } = render(AlertDialog, {
      props: {
        open: true,
        title: 'Session expired',
        description: 'Sign in again before continuing.',
        onacknowledge: () => {},
      },
    });

    const dialog = container.querySelector('dialog');
    const description = container.querySelector('.cinder-alert-dialog__description');
    expect(dialog?.getAttribute('role')).toBe('alertdialog');
    expect(dialog?.getAttribute('aria-describedby')).toBe(description?.id);
    expect(description?.textContent).toContain('Sign in again');
    expect(container.querySelector('.cinder-modal__close')).toBeNull();
  });

  test('acknowledge button is autofocus and closes before callback', async () => {
    let openValue = true;
    let callbackSawOpen = true;
    const { container } = render(AlertDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Session expired',
        description: 'Sign in again before continuing.',
        acknowledgeLabel: 'Sign in',
        onacknowledge: () => {
          callbackSawOpen = openValue;
        },
      },
    });

    const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Sign in'),
    );
    expect(button?.autofocus).toBe(true);
    await fireEvent.click(button as HTMLButtonElement);
    expect(openValue).toBe(false);
    expect(callbackSawOpen).toBe(false);
  });

  test('Escape and backdrop click do not dismiss', async () => {
    let openValue = true;
    const { container } = render(AlertDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Session expired',
        description: 'Sign in again before continuing.',
        onacknowledge: () => {},
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    await fireEvent.click(dialog);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(true);
  });

  test('optional cancel action fires and closes', async () => {
    let cancelCount = 0;
    let openValue = true;
    const { container } = render(AlertDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete workspace',
        description: 'This action affects collaborators.',
        cancelLabel: 'Cancel',
        oncancel: () => {
          cancelCount++;
        },
        onacknowledge: () => {},
      },
    });

    const cancelButton = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Cancel'),
    );
    await fireEvent.click(cancelButton as HTMLButtonElement);
    expect(cancelCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('exposes alertdialog role with described content and ignores Escape keydown', async () => {
    let openValue = true;
    const { getByRole } = render(AlertDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Session expired',
        description: 'Sign in again before continuing.',
        onacknowledge: () => {},
      },
    });

    // Role + ARIA wiring: a modal alertdialog with an accessible name (from the
    // title) whose description is announced. Querying by name also guards the
    // aria-labelledby wiring — a broken name would fail the role+name lookup.
    const dialog = getByRole('alertdialog', { name: 'Session expired' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const description = dialog.querySelector(`#${describedBy}`);
    expect(description?.textContent).toContain('Sign in again');

    // Keyboard contract for a sticky alert dialog: acknowledgement is mandatory,
    // so neither an Escape keydown nor the native dialog `cancel` it triggers may
    // dismiss it. Assert BOTH paths are inert and the dialog stays open.
    await fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    expect(openValue).toBe(true); // Escape keydown alone does not close it.
    expect(getByRole('alertdialog')).toBe(dialog);

    // The platform fires `cancel` on the native <dialog> for Escape; AlertDialog
    // passes dismissOnEscape={false}, so its handler preventDefault()s and keeps open.
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(true);
    expect(getByRole('alertdialog')).toBe(dialog);
  });

  test('destructive alert dialog defaults focus to cancel when present', () => {
    const { container } = render(AlertDialog, {
      props: {
        open: true,
        title: 'Delete workspace',
        description: 'This action affects collaborators.',
        acknowledgeLabel: 'Delete',
        cancelLabel: 'Cancel',
        destructive: true,
        onacknowledge: () => {},
      },
    });

    const [cancelButton, deleteButton] = Array.from(container.querySelectorAll('button'));
    expect(cancelButton?.autofocus).toBe(true);
    expect(deleteButton?.autofocus ?? false).toBe(false);
  });

  // Dialog-model boundary tests
  // These document the public contract that distinguishes AlertDialog from Modal and ConfirmDialog.
  // They will fail if AlertDialog is accidentally made dismissible by Escape, backdrop click,
  // or a close button — the three affordances that must NOT exist for a sticky alertdialog.

  test('boundary: AlertDialog has role="alertdialog" by default', () => {
    const { container } = render(AlertDialog, {
      props: {
        open: true,
        title: 'Session expired',
        description: 'Sign in again before continuing.',
        onacknowledge: () => {},
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('role')).toBe('alertdialog');
  });

  test('boundary: AlertDialog has no close button by default', () => {
    const { container } = render(AlertDialog, {
      props: {
        open: true,
        title: 'Session expired',
        description: 'Sign in again before continuing.',
        onacknowledge: () => {},
      },
    });
    expect(container.querySelector('.cinder-modal__close')).toBeNull();
  });

  test('boundary: AlertDialog does NOT dismiss on Escape (native cancel event)', async () => {
    let openValue = true;
    const { container } = render(AlertDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Session expired',
        description: 'Sign in again before continuing.',
        onacknowledge: () => {},
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(true);
  });

  test('boundary: AlertDialog does NOT dismiss on backdrop click', async () => {
    let openValue = true;
    const { container } = render(AlertDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Session expired',
        description: 'Sign in again before continuing.',
        onacknowledge: () => {},
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    expect(openValue).toBe(true);
  });
});
