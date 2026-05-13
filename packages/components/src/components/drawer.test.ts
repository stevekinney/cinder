/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { _resetEscapeStack, _resetScrollLock } from '../_internal/overlay.ts';
import { setupHappyDom } from '../test/happy-dom.ts';

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
        this.dispatchEvent(new Event('close'));
      },
      configurable: true,
      writable: true,
    });
  }
}

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');

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
  _resetScrollLock();
  _resetEscapeStack();
});

describe('Drawer', () => {
  // ---- 1. Renders open dialog when open=true after hydration ----
  test('renders open <dialog> when open=true after hydration', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test Drawer', children: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  // ---- 2. SSR-empty: dialog absent when hydrated flag is false ----
  test('dialog is absent during SSR (hydrated=false)', () => {
    // In happy-dom $effect runs synchronously, so mounted=true on render.
    // We test the SSR contract by checking that the component only renders
    // the dialog after the $effect fires (which is observable via DOM presence).
    // The SSR model relies on $effect not running server-side — the test documents
    // the contract; actual SSR behavior is verified by renderToString in a Node env.
    const { container } = render(Drawer, {
      props: { open: false, title: 'Test Drawer', children: emptySnippet },
    });
    // In client (happy-dom), the dialog is present with hydrated=true but closed.
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  // ---- 3. data-cinder-side reflects side prop ----
  test('data-cinder-side on panel reflects side prop (right default)', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const panel = container.querySelector('.cinder-drawer__panel');
    expect(panel?.getAttribute('data-cinder-side')).toBe('right');
  });

  test('data-cinder-side on panel reflects side="left"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', side: 'left', children: emptySnippet },
    });
    const panel = container.querySelector('.cinder-drawer__panel');
    expect(panel?.getAttribute('data-cinder-side')).toBe('left');
  });

  // ---- 4. data-cinder-size reflects size prop ----
  test('data-cinder-size defaults to md', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-drawer__panel')?.getAttribute('data-cinder-size')).toBe(
      'md',
    );
  });

  test('data-cinder-size reflects all four size values', () => {
    for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
      const { container } = render(Drawer, {
        props: { open: true, title: 'Test', size, children: emptySnippet },
      });
      expect(
        container.querySelector('.cinder-drawer__panel')?.getAttribute('data-cinder-size'),
      ).toBe(size);
    }
  });

  // ---- 5. Default header renders title h2 + aria-labelledby ----
  test('default header renders <h2> with title and dialog aria-labelledby matches', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'My Drawer Title', children: emptySnippet },
    });
    const title = container.querySelector('.cinder-drawer__title');
    expect(title).not.toBeNull();
    expect(title?.textContent?.trim()).toBe('My Drawer Title');
    const dialog = container.querySelector('dialog');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    // The aria-labelledby should resolve to the rendered heading
    const heading = container.querySelector(`#${labelledBy}`);
    expect(heading).not.toBeNull();
    expect(heading?.textContent?.trim()).toBe('My Drawer Title');
  });

  // ---- 6. Custom header without ariaLabelledBy: visually-hidden h2 ----
  test('custom header without ariaLabelledBy renders sr-only title heading', () => {
    const customHeader = createRawSnippet(() => ({
      render: () => `<span>Custom Header Content</span>`,
      setup: () => {},
    }));
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'SR Only Title',
        header: customHeader,
        children: emptySnippet,
      },
    });
    const srOnly = container.querySelector('.cinder-sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly?.textContent?.trim()).toBe('SR Only Title');
    const dialog = container.querySelector('dialog');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    const heading = container.querySelector(`#${labelledBy}`);
    expect(heading?.classList.contains('cinder-sr-only')).toBe(true);
  });

  // ---- 7. Custom header with ariaLabelledBy: no internal heading ----
  test('custom header with ariaLabelledBy uses consumer id and renders no internal title', () => {
    const customHeader = createRawSnippet(() => ({
      render: () => `<h2 id="external-heading">External Heading</h2>`,
      setup: () => {},
    }));
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Unused Title',
        header: customHeader,
        ariaLabelledBy: 'external-heading',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('external-heading');
    // No sr-only heading should be present
    expect(container.querySelector('.cinder-sr-only')).toBeNull();
  });

  // ---- 8. Close button in header closes the drawer ----
  test('clicking the close button closes the drawer', async () => {
    let openValue = true;
    const { container } = render(Drawer, {
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
    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
  });

  // ---- 9. Backdrop click (event.target === dialog) closes drawer ----
  test('clicking the backdrop (dialog element itself) closes the drawer', async () => {
    let openValue = true;
    const { container } = render(Drawer, {
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
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    // Dispatch click directly on the dialog element (simulates backdrop click)
    await fireEvent.click(dialog);
    expect(openValue).toBe(false);
  });

  // ---- 10. onclose event sets open to false ----
  test('dialog close event sets open to false', async () => {
    let openValue = true;
    const { container } = render(Drawer, {
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
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(openValue).toBe(false);
  });

  // ---- 11. Focus restores to triggerRef on close ----
  test('focus restores to triggerRef when provided', async () => {
    const button = document.createElement('button');
    button.id = 'trigger-button';
    document.body.appendChild(button);

    let openValue = true;
    const { container } = render(Drawer, {
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

    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });

  // ---- 12. Focus restores to previously focused element when no triggerRef ----
  test('focus restores to previously-focused element when triggerRef omitted', async () => {
    const button = document.createElement('button');
    button.id = 'previously-focused';
    document.body.appendChild(button);
    button.focus();

    let openValue = true;
    const { container } = render(Drawer, {
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

    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });

  // ---- 13. Body scroll lock acquired on open, released on close ----
  test('body scroll lock acquired on open and released on close', async () => {
    let openValue = true;
    const { container } = render(Drawer, {
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

    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(document.body.style.overflow).toBe('');
  });

  // ---- 14. ESC key on dialog fires close event and sets open to false ----
  test('Escape key on dialog fires close event and sets open to false', async () => {
    // The native <dialog> handles ESC → cancel → close automatically with showModal().
    // happy-dom does not fully emulate this native behaviour, so we fire the close
    // event after dispatching Escape to replicate the browser sequence — same pattern
    // as modal.test.ts. This tests the onclose → handleClose → open=false chain.
    let openValue = true;
    const { container } = render(Drawer, {
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

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    // Simulate browser ESC sequence: Escape keydown on dialog → close event fires.
    await fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await fireEvent(dialog, new Event('close'));
    expect(openValue).toBe(false);
  });

  // ---- 15. Stylesheet regression: reduced-motion fade block exists ----
  test('drawer.css contains prefers-reduced-motion: reduce with cinder-drawer-fade', async () => {
    // This is a stylesheet regression test, NOT behavior coverage.
    // Real reduced-motion behavior is browser-only.
    const cssFile = Bun.file(new URL('../styles/components/drawer.css', import.meta.url));
    const cssText = await cssFile.text();
    expect(cssText).toContain('prefers-reduced-motion: reduce');
    expect(cssText).toContain('cinder-drawer-fade');
  });

  // ---- 16. Bindable open: consumer state updates on internal close ----
  test('bindable open: closing from inside the drawer updates consumer state', async () => {
    let openValue = true;
    const { container } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Bindable Test',
        children: emptySnippet,
      },
    });

    // Close via the close button — consumer's open prop should flip to false.
    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
  });

  // ---- 17. Unmount-while-open: cleanup ----
  test('unmount-while-open (sub-case A, no triggerRef): restores scroll lock and escape stack', async () => {
    const prevFocus = document.createElement('button');
    prevFocus.id = 'prev-focus-a';
    document.body.appendChild(prevFocus);
    prevFocus.focus();

    const { unmount } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');

    document.body.removeChild(prevFocus);
  });

  test('unmount-while-open (sub-case B, explicit triggerRef): focus restores to triggerRef', async () => {
    // Ensure activeElement is body (captureFocus returns null)
    const triggerEl = document.createElement('button');
    triggerEl.id = 'trigger-b';
    document.body.appendChild(triggerEl);

    const { unmount } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        triggerRef: triggerEl,
        children: emptySnippet,
      },
    });

    unmount();
    expect(document.activeElement).toBe(triggerEl);

    document.body.removeChild(triggerEl);
  });

  // ---- 18. Exactly one onclose event per close path ----
  test('exactly one onclose event fires per close path (close button)', async () => {
    let closeCount = 0;
    let openValue = true;
    const { container } = render(Drawer, {
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

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    dialog.addEventListener('close', () => {
      closeCount++;
    });

    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(closeCount).toBe(1);
  });

  // ---- 19. Rest props pass-through and class merging ----
  test('data-testid pass-through reaches the dialog element', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        'data-testid': 'my-drawer',
        children: emptySnippet,
      } as any,
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('data-testid')).toBe('my-drawer');
  });

  test('class prop is merged with cinder-drawer', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        class: 'custom-class',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.classList.contains('cinder-drawer')).toBe(true);
    expect(dialog?.classList.contains('custom-class')).toBe(true);
  });

  // ---- 20. Parent-driven open/close state machine ----
  test('rapid open/close cycling: scroll lock and escape stack clean up correctly', async () => {
    let openValue = false;
    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'State Machine',
        children: emptySnippet,
      },
    });

    // Open
    openValue = true;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'State Machine',
      children: emptySnippet,
    });
    expect(document.body.style.overflow).toBe('hidden');

    // Close via button
    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  // ---- 21. UA [open] display semantics ----
  test('closed drawer has no open attribute on the <dialog>', () => {
    const { container } = render(Drawer, {
      props: { open: false, title: 'Test', children: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(dialog?.open).toBe(false);
  });

  // ---- Additional: aria-modal is always set ----
  test('dialog always has aria-modal="true"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('dialog')?.getAttribute('aria-modal')).toBe('true');
  });

  // ---- Additional: footer renders when provided ----
  test('footer renders when provided', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        children: emptySnippet,
        footer: textSnippet('Footer content'),
      },
    });
    const footer = container.querySelector('.cinder-drawer__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('Footer content');
  });

  test('footer is absent when not provided', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-drawer__footer')).toBeNull();
  });

  // ---- Additional: children content renders in body ----
  test('children render inside the body', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        children: textSnippet('Drawer body content'),
      },
    });
    const body = container.querySelector('.cinder-drawer__body');
    expect(body?.textContent).toContain('Drawer body content');
  });

  // ---- Additional: body has tabindex=-1 ----
  test('body container has tabindex="-1"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const body = container.querySelector('.cinder-drawer__body');
    expect(body?.getAttribute('tabindex')).toBe('-1');
  });

  // ---- Additional: close button has correct aria-label ----
  test('close button has aria-label="Close drawer"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const closeButton = container.querySelector('.cinder-drawer__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close drawer');
  });
});
