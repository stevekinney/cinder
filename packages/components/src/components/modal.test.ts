/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

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

const { render, fireEvent } = await import('@testing-library/svelte');
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
});
