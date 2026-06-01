/// <reference lib="dom" />
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { _resetEscapeStack, _resetScrollLock } from '../../_internal/overlay.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  flushOverflowFadeAnimationFrames,
  installOverflowFadeTestEnvironment,
  OverflowFadeResizeObserver,
  setScrollMeasurements,
} from '../../test/overflow-fade-test-helpers.ts';
import { renderToServerHtml } from '../../test/server-render.ts';

const DRAWER_SOURCE = join(import.meta.dir, 'drawer.svelte');

setupHappyDom();

// happy-dom does not implement HTMLDialogElement.showModal / close — stub them.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
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
  }
  if (!HTMLDialogElement.prototype.close) {
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
}

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');
const originalGetComputedStyle = window.getComputedStyle.bind(window);

window.getComputedStyle = ((target: Element) => {
  if (target instanceof HTMLElement && target.classList.contains('cinder-drawer__panel')) {
    return {
      transitionProperty: 'translate, opacity',
      transitionDuration: '150ms, 150ms',
      transitionDelay: '0ms, 0ms',
    } as CSSStyleDeclaration;
  }

  return originalGetComputedStyle(target);
}) as typeof window.getComputedStyle;

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

function createTransitionEndEvent(propertyName: string): Event {
  const event = new Event('transitionend');
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  return event;
}

async function finishCloseTransition(container: HTMLElement): Promise<void> {
  const panel = container.querySelector('.cinder-drawer__panel');
  if (!panel) return;
  panel.dispatchEvent(createTransitionEndEvent('translate'));
  panel.dispatchEvent(createTransitionEndEvent('opacity'));
  await Promise.resolve();
}

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

  // ---- 2. Post-hydration: dialog present (closed) once the $effect fires ----
  test('dialog is present but closed after hydration when open=false', () => {
    // In happy-dom $effect runs synchronously, so `hydrated` is true by the
    // time we read the DOM and the dialog is mounted (but closed). The
    // server-side absence of the dialog is asserted separately in the
    // "Drawer SSR contract" describe block below.
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

    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
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

    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
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

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(dialog).not.toBeNull();
    await fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(openValue).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(panel.getAttribute('data-cinder-closing')).toBe('');
    await finishCloseTransition(container);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  // ---- 15. Stylesheet regression: reduced-motion disables panel and backdrop transitions ----
  test('drawer.css disables panel and backdrop transitions under prefers-reduced-motion: reduce', async () => {
    const cssText = await Bun.file(new URL('./drawer.css', import.meta.url)).text();
    expect(cssText).toContain('prefers-reduced-motion: reduce');
    expect(cssText).toContain('.cinder-drawer__panel');
    expect(cssText).toContain('.cinder-drawer::backdrop');
    expect(cssText).toContain('transition: none');
  });

  test('close applies inert closing state until the delayed close finishes', async () => {
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
    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(openValue).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('data-cinder-closing')).toBe('');
    expect(panel.getAttribute('data-cinder-closing')).toBe('');
    expect(panel.hasAttribute('inert')).toBe(true);
    await finishCloseTransition(container);
    expect(dialog.hasAttribute('open')).toBe(false);
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
    await finishCloseTransition(container);
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
    expect(closeCount).toBe(0);
    await finishCloseTransition(container);
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

    // Close via parent-driven state change
    openValue = false;
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
    await finishCloseTransition(container);
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

  test('overflow fade attachment marks and clears the drawer body', () => {
    const cleanupOverflowFade = installOverflowFadeTestEnvironment();
    try {
      const { container } = render(Drawer, {
        props: { open: true, title: 'Test', children: textSnippet('Drawer body content') },
      });
      const body = container.querySelector('.cinder-drawer__body') as HTMLElement;
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

  // ---- Additional: close button has correct aria-label ----
  test('close button has aria-label="Close drawer"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const closeButton = container.querySelector('.cinder-drawer__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close drawer');
  });
});

// ---------------------------------------------------------------------------
// Slide direction lifecycle — regression for wrong-edge entry/exit.
//
// The panel's `data-cinder-side` must reflect the side that was current when
// the drawer *opened* (the active-open-cycle side), not the live `side` prop.
// happy-dom cannot render CSS, so these tests assert the state contract that
// drives direction: whichever value `data-cinder-side` carries on the panel
// is the value the CSS will use for translate/anchor rules.
// ---------------------------------------------------------------------------
describe('Drawer slide direction lifecycle', () => {
  // 1. Opening a right drawer and then changing side while open must NOT
  //    mutate data-cinder-side during the open cycle.
  test('side change while open does not affect data-cinder-side until the next open cycle', async () => {
    let openValue = true;
    let sideValue: 'left' | 'right' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get side() {
          return sideValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-side')).toBe('right');

    // Change the side while the drawer remains open.
    sideValue = 'left';
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get side() {
        return sideValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // Panel should still report the open-cycle side ('right'), not 'left'.
    expect(panel.getAttribute('data-cinder-side')).toBe('right');
  });

  // 2. Side change while closed takes effect on the next open.
  test('side change while closed is reflected on the next open', async () => {
    let openValue = false;
    let sideValue: 'left' | 'right' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get side() {
          return sideValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    // First open — right side.
    openValue = true;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get side() {
        return sideValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-side')).toBe('right');

    // Close the drawer fully.
    openValue = false;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get side() {
        return sideValue;
      },
      title: 'Test',
      children: emptySnippet,
    });
    await finishCloseTransition(container);

    // Change side while closed.
    sideValue = 'left';

    // Reopen — the new side should now be snapshotted.
    openValue = true;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get side() {
        return sideValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    const newPanel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(newPanel.getAttribute('data-cinder-side')).toBe('left');
  });

  // 3. Close transition keeps data-cinder-side stable even if side prop changes
  //    mid-transition (e.g. the user queues a new side while the exit plays).
  test('side change during a close transition does not flip data-cinder-side mid-transition', async () => {
    let openValue = true;
    let sideValue: 'left' | 'right' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get side() {
          return sideValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-side')).toBe('right');

    // Begin closing.
    openValue = false;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get side() {
        return sideValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // Panel should be in closing state.
    expect(panel.getAttribute('data-cinder-closing')).toBe('');
    // Side must still be the open-cycle side, not whatever side is now.
    expect(panel.getAttribute('data-cinder-side')).toBe('right');

    // Change side prop while transition is running.
    sideValue = 'left';
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get side() {
        return sideValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // data-cinder-side must remain 'right' throughout the transition.
    expect(panel.getAttribute('data-cinder-side')).toBe('right');

    // Transition completes — panel unmounts.
    await finishCloseTransition(container);
    expect(container.querySelector('.cinder-drawer__panel')).toBeNull();
  });

  // 4. Quick-close then reopen: if side changed before the reopen, the new
  //    side is snapshotted and used for the re-entry animation.
  test('quick-reopen after mid-close-side-change uses the new side', async () => {
    let openValue = true;
    let sideValue: 'left' | 'right' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get side() {
          return sideValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    // Close — transition starts.
    openValue = false;
    sideValue = 'left'; // side changes while closing
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get side() {
        return sideValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // Panel is still mounted mid-transition.
    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-closing')).toBe('');

    // Reopen before the transition completes (quick-reopen scenario).
    openValue = true;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get side() {
        return sideValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // After quick-reopen, isClosing should be cleared and the new side snapshot applies.
    expect(panel.getAttribute('data-cinder-closing')).toBeNull();
    expect(panel.getAttribute('data-cinder-side')).toBe('left');
  });

  // 5. Opening with side='left' from the start uses left entry.
  test('left-side drawer opens with data-cinder-side="left"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', side: 'left', children: emptySnippet },
    });
    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-side')).toBe('left');
  });

  // 6. Right-side drawer (default) closes with data-cinder-side='right' throughout.
  test('right-side drawer exit transition preserves data-cinder-side="right"', async () => {
    let openValue = true;
    const { container, rerender } = render(Drawer, {
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

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-side')).toBe('right');

    openValue = false;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // During the close transition, direction must still be 'right'.
    expect(panel.getAttribute('data-cinder-side')).toBe('right');
    expect(panel.getAttribute('data-cinder-closing')).toBe('');

    await finishCloseTransition(container);
    expect(container.querySelector('.cinder-drawer__panel')).toBeNull();
  });
});

// The drawer's <dialog> is gated behind a `hydrated` $state set inside an
// $effect, which never runs on the server. These tests render the component in
// Svelte's server compiler and assert the gated markup is absent server-side —
// the contract that prevents client-only dialog markup from leaking into SSR
// and causing a hydration mismatch.
describe('Drawer SSR contract', () => {
  test('emits no <dialog> server-side even when open=true', async () => {
    const html = await renderToServerHtml(DRAWER_SOURCE, {
      open: true,
      title: 'Test Drawer',
      children: emptySnippet,
    });
    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('cinder-drawer');
    expect(html).not.toContain('cinder-drawer__panel');
  });

  test('emits no <dialog> server-side when open=false', async () => {
    const html = await renderToServerHtml(DRAWER_SOURCE, {
      open: false,
      title: 'Test Drawer',
      children: emptySnippet,
    });
    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('cinder-drawer');
  });
});
