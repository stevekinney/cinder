/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

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

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: AlertDialog } = await import('./alert-dialog.svelte');

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

    // Role + ARIA wiring: a modal alertdialog whose description is announced.
    const dialog = getByRole('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const description = dialog.querySelector(`#${describedBy}`);
    expect(description?.textContent).toContain('Sign in again');

    // Keyboard: pressing Escape and the native dialog cancel it triggers must NOT
    // dismiss a sticky alert dialog — the acknowledgement is mandatory.
    await fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
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
});
