/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { tick } = await import('svelte');
const { default: ConfirmDialog } = await import('./confirm-dialog.svelte');

function footerButtons(container: HTMLElement): [HTMLButtonElement, HTMLButtonElement] {
  const footer = container.querySelector('.cinder-modal__footer');
  if (!(footer instanceof HTMLElement)) {
    throw new Error('Expected ConfirmDialog to render a modal footer.');
  }

  const buttons = Array.from(footer.querySelectorAll('button'));
  if (buttons.length !== 2) {
    throw new Error(`Expected ConfirmDialog footer to render 2 buttons, found ${buttons.length}.`);
  }

  const cancelButton = buttons.at(0);
  const confirmButton = buttons.at(1);
  if (!cancelButton || !confirmButton) {
    throw new Error('Expected ConfirmDialog footer buttons to be present.');
  }

  return [cancelButton, confirmButton];
}

describe('ConfirmDialog', () => {
  test('renders closed by default — no panel content when open=false', () => {
    const { container } = render(ConfirmDialog, {
      props: {
        open: false,
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });
    // Dialog element is present (mounted) but panel content is absent when closed
    expect(container.querySelector('.cinder-modal__panel')).toBeNull();
  });

  test('renders open with title and inherits aria-labelledby', () => {
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-labelledby')).not.toBeNull();
    expect(container.querySelector('.cinder-modal__title')?.textContent).toContain(
      'Delete account?',
    );
  });

  test('description wires aria-describedby to the <p> element', () => {
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const descriptionParagraph = container.querySelector(
      '.cinder-confirm-dialog__description',
    ) as HTMLElement;
    expect(descriptionParagraph).not.toBeNull();
    expect(descriptionParagraph.textContent).toContain('This cannot be undone.');
    const describedById = dialog.getAttribute('aria-describedby');
    expect(describedById).not.toBeNull();
    // Both reference the same ID — description paragraph's id matches aria-describedby.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(descriptionParagraph.id).toBe(describedById!);
  });

  test('aria-describedby is absent when description is omitted', () => {
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
  });

  test('cancel button carries autofocus; confirm button does not', () => {
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        cancelLabel: 'Cancel',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });
    const [cancelBtn, confirmBtn] = footerButtons(container);
    // Cancel is first, confirm is second (per plan's footer snippet ordering).
    // Svelte 5 processes autofocus as a DOM property (not an HTML attribute) via $.autofocus(),
    // so we check the .autofocus property rather than hasAttribute().
    expect(cancelBtn.autofocus).toBe(true);
    expect(confirmBtn.autofocus).toBeFalsy();
  });

  test('destructive=true applies danger variant to the confirm button', () => {
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        confirmLabel: 'Delete',
        destructive: true,
        onconfirm: () => {},
      },
    });
    const [, confirmBtn] = footerButtons(container);
    expect(confirmBtn.getAttribute('data-cinder-variant')).toBe('danger');
  });

  test('destructive=false uses primary variant for the confirm button', () => {
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Save changes?',
        confirmLabel: 'Save',
        destructive: false,
        onconfirm: () => {},
      },
    });
    const [, confirmBtn] = footerButtons(container);
    expect(confirmBtn.getAttribute('data-cinder-variant')).toBe('primary');
  });

  test('onconfirm fires and dialog closes when confirm is clicked', async () => {
    let confirmCount = 0;
    let cancelCount = 0;
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {
          confirmCount++;
        },
        oncancel: () => {
          cancelCount++;
        },
      },
    });
    const [, confirmBtn] = footerButtons(container);
    await fireEvent.click(confirmBtn);
    expect(confirmCount).toBe(1);
    expect(cancelCount).toBe(0);
    expect(openValue).toBe(false);
  });

  test('oncancel fires and dialog closes when cancel button is clicked', async () => {
    let confirmCount = 0;
    let cancelCount = 0;
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {
          confirmCount++;
        },
        oncancel: () => {
          cancelCount++;
        },
      },
    });
    const [cancelBtn] = footerButtons(container);
    await fireEvent.click(cancelBtn);
    expect(cancelCount).toBe(1);
    expect(confirmCount).toBe(0);
    expect(openValue).toBe(false);
  });

  test('oncancel fires on Escape (native cancel event on dialog)', async () => {
    let cancelCount = 0;
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        oncancel: () => {
          cancelCount++;
        },
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    await tick();
    expect(cancelCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('oncancel fires on backdrop click', async () => {
    let cancelCount = 0;
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        oncancel: () => {
          cancelCount++;
        },
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    await tick();
    expect(cancelCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('oncancel fires when the close-X button is clicked', async () => {
    let cancelCount = 0;
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        oncancel: () => {
          cancelCount++;
        },
      },
    });
    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    await tick();
    expect(cancelCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('parent-driven close does NOT fire oncancel', async () => {
    let cancelCount = 0;
    const { rerender } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        oncancel: () => {
          cancelCount++;
        },
      },
    });
    await rerender({
      open: false,
      title: 'Delete account?',
      confirmLabel: 'Delete',
      onconfirm: () => {},
    });
    expect(cancelCount).toBe(0);
  });

  test('custom labels render in the DOM', () => {
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Discard?',
        cancelLabel: 'Nope',
        confirmLabel: 'Burn it',
        onconfirm: () => {},
      },
    });
    const [cancelBtn, confirmBtn] = footerButtons(container);
    expect(cancelBtn.textContent?.trim()).toBe('Nope');
    expect(confirmBtn.textContent?.trim()).toBe('Burn it');
  });

  test('triggerRef focus restoration — cancel button closes dialog and triggerRef is accepted', async () => {
    // Focus restoration is owned by Modal's handleClose (fired on the native 'close' event).
    // happy-dom's dialog polyfill does not fire 'close' natively, so we verify the observable
    // contract we own: that clicking cancel sets open=false. Full focus-restore coverage is
    // Modal's responsibility and is covered by existing modal.test.ts tests.
    const trigger = document.createElement('button');
    trigger.textContent = 'Open dialog';
    document.body.appendChild(trigger);

    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        triggerRef: trigger,
      },
    });

    const [cancelBtn] = footerButtons(container);
    await fireEvent.click(cancelBtn);
    await tick();
    expect(openValue).toBe(false);

    document.body.removeChild(trigger);
  });

  test('reopen after cancel/confirm cycle — cancel button still has autofocus', async () => {
    let openValue = true;
    const { container, rerender } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });

    const [cancelBtn] = footerButtons(container);
    await fireEvent.click(cancelBtn); // cancel → closes

    openValue = true;
    await rerender({
      open: true,
      title: 'Delete account?',
      confirmLabel: 'Delete',
      onconfirm: () => {},
    });

    const [reopenedCancelBtn] = footerButtons(container);
    expect(reopenedCancelBtn.autofocus).toBe(true);
  });

  test('omitting optional oncancel does not throw when cancel is clicked', async () => {
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        // oncancel intentionally omitted
      },
    });
    const [cancelBtn] = footerButtons(container);
    // Directly await the click — if it threw synchronously the test would fail.
    // Then assert the state side-effect: dialog closed without error.
    await fireEvent.click(cancelBtn);
    expect(openValue).toBe(false);
  });

  test('thrown onconfirm does not block close — open is false after throw', async () => {
    // Behavioral assertion: open flips to false BEFORE the callback fires, so a thrown
    // callback cannot leave the dialog stuck open. fireEvent swallows handler errors
    // internally, so we assert the state side-effect rather than the throw itself.
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {
          throw new Error('confirm error');
        },
      },
    });
    const [, confirmBtn] = footerButtons(container);
    await fireEvent.click(confirmBtn);
    // open flipped to false before the callback ran, so the throw doesn't leave dialog stuck
    expect(openValue).toBe(false);
  });

  test('thrown oncancel does not block close — open is false after throw', async () => {
    // Same behavioral contract as the onconfirm throw test above.
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        oncancel: () => {
          throw new Error('cancel error');
        },
      },
    });
    const [cancelBtn] = footerButtons(container);
    await fireEvent.click(cancelBtn);
    expect(openValue).toBe(false);
  });

  // Dialog-model boundary tests
  // These document the public contract distinguishing ConfirmDialog from AlertDialog.
  // They will fail if ConfirmDialog loses the cancel-first focus default or if the
  // component is made to behave like a sticky alertdialog.

  test('boundary: ConfirmDialog defaults focus to the cancel button on open (default cancelLabel)', () => {
    // cancelLabel defaults to "Cancel" — verify autofocus goes to cancel without providing it.
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });
    const [cancelBtn, confirmBtn] = footerButtons(container);
    expect(cancelBtn.autofocus).toBe(true);
    expect(confirmBtn.autofocus).toBeFalsy();
  });

  test('boundary: ConfirmDialog IS dismissable by Escape (native cancel event fires oncancel)', async () => {
    let cancelCount = 0;
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        oncancel: () => {
          cancelCount++;
        },
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    await tick();
    // Unlike AlertDialog, ConfirmDialog allows Escape — open becomes false.
    expect(openValue).toBe(false);
    expect(cancelCount).toBe(1);
  });

  test('boundary: ConfirmDialog IS dismissable by backdrop click (fires oncancel)', async () => {
    let cancelCount = 0;
    let openValue = true;
    const { container } = render(ConfirmDialog, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
        oncancel: () => {
          cancelCount++;
        },
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    await tick();
    // Unlike AlertDialog, ConfirmDialog allows backdrop dismiss.
    expect(openValue).toBe(false);
    expect(cancelCount).toBe(1);
  });
});

describe('ConfirmDialog focus trap', () => {
  // ConfirmDialog inherits Modal's focus trap. These tests verify that the inherited
  // Tab-wrap behavior works for ConfirmDialog's footer buttons.

  test('Tab on the close button (last tabbable) wraps back — focus trap prevents default', async () => {
    // Modal's focus trap is active on the panel when open. The close button is the last
    // tabbable element; Tab on it must be intercepted so focus never reaches <body>.
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });

    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    expect(panel).not.toBeNull();

    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();

    closeButton.focus();

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    panel.dispatchEvent(tabEvent);

    // The focus trap must have prevented default — Tab wraps within the dialog.
    expect(tabEvent.defaultPrevented).toBe(true);
  });

  test('Shift+Tab on the cancel button (first tabbable) wraps to last — focus trap prevents default', async () => {
    // The cancel button carries autofocus and is the first tabbable element in the footer.
    // Shift+Tab on it must wrap to the last element inside the dialog.
    const { container } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete account?',
        cancelLabel: 'Cancel',
        confirmLabel: 'Delete',
        onconfirm: () => {},
      },
    });

    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    expect(panel).not.toBeNull();

    // The first tabbable element in the ConfirmDialog panel is the cancel button
    // (the modal body has tabindex=-1 and is excluded from tabbable set).
    const [cancelButton] = footerButtons(container);
    expect(cancelButton).not.toBeNull();

    cancelButton.focus();

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    panel.dispatchEvent(shiftTabEvent);

    // The focus trap must have prevented default — Shift+Tab wraps within the dialog.
    expect(shiftTabEvent.defaultPrevented).toBe(true);
  });
});
