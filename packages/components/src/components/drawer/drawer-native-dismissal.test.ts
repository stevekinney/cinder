/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import {
  emptySnippet,
  finishCloseTransition,
  installDrawerDialogStubs,
  installDrawerStyleProbe,
} from './drawer-test-helpers.ts';

setupHappyDom();
installDrawerDialogStubs();
const restoreDrawerStyles = installDrawerStyleProbe();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');

afterAll(() => {
  restoreDrawerStyles();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
  resetEscapeStack();
});
describe('Drawer', () => {
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
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    expect(dialog).not.toBeNull();
    // Dispatch click directly on the dialog element (simulates backdrop click)
    await fireEvent.click(dialog);
    expect(openValue).toBe(false);
  });

  // ---- 10. onClose event sets open to false ----
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
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    // `dialog.close()` — not a bare `fireEvent(dialog, new Event('close'))`
    // (PR #1422 review): this file's own `HTMLDialogElement.prototype.close`
    // stub above already flips `.open` to `false` SYNCHRONOUSLY before
    // dispatching the `close` event itself, matching a REAL browser's
    // native close ALGORITHM. `create-sliding-dialog-state.svelte.ts`'s
    // `handleClose()` now validates an unmatched/external event against
    // `dialogElement.open` to detect a stale event arriving after a
    // reopen — a dialog still `.open === true` at event time looks stale.
    // A bare synthetic event never toggles `.open` at all, so it would be
    // (wrongly) treated as stale here and skip all cleanup.
    dialog.close();
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

    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
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

    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
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

    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.body.style.overflow).toBe('');
  });

  // ---- 14. ESC cancel path goes through animated close lifecycle ----
  test('Escape cancel keeps the drawer mounted until the close transition completes', async () => {
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    expect(dialog).not.toBeNull();
    await fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(openValue).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(panel.getAttribute('data-cinder-closing')).toBe('');
    await finishCloseTransition(container);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  // ---- 15. Stylesheet regression: reduced-motion disables panel and backdrop transitions ----
});
