/// <reference lib="dom" />
import { join } from 'node:path';

import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { _resetEscapeStack, _resetScrollLock, pushEscapeHandler } from '../../_internal/overlay.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  flushOverflowFadeAnimationFrames,
  installOverflowFadeTestEnvironment,
  OverflowFadeResizeObserver,
  setScrollMeasurements,
} from '../../test/overflow-fade-test-helpers.ts';
import { renderToServerHtml } from '../../test/server-render.ts';
import type { DrawerProps } from './drawer.types.ts';

const DRAWER_SOURCE = join(import.meta.dir, 'drawer.svelte');

type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;
const excludesLowercaseNativeCloseHandler: HasKey<DrawerProps, 'onclose'> = false;
const excludesLowercaseNativeCancelHandler: HasKey<DrawerProps, 'oncancel'> = false;

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

const { cleanup, render, fireEvent } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');
// One shared read for every CSS-contract test below — drawer.css is asserted
// against nine times; re-reading it per test is pure waste.
const drawerCss = await Bun.file(new URL('./drawer.css', import.meta.url)).text();
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
afterAll(() => {
  window.getComputedStyle = originalGetComputedStyle;
});

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
  cleanup();
  document.body.replaceChildren();
  _resetScrollLock();
  _resetEscapeStack();
});

describe('Drawer', () => {
  test('omits native dialog handlers owned internally', () => {
    expect(excludesLowercaseNativeCloseHandler).toBe(false);
    expect(excludesLowercaseNativeCancelHandler).toBe(false);
  });

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

  // ---- 3. data-cinder-placement reflects side prop ----
  test('data-cinder-placement on panel reflects side prop (right default)', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const panel = container.querySelector('.cinder-drawer__panel');
    expect(panel?.getAttribute('data-cinder-placement')).toBe('right');
  });

  test('data-cinder-placement on panel reflects side="left"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', placement: 'left', children: emptySnippet },
    });
    const panel = container.querySelector('.cinder-drawer__panel');
    expect(panel?.getAttribute('data-cinder-placement')).toBe('left');
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
    const cssText = drawerCss;
    expect(cssText).toContain('prefers-reduced-motion: reduce');
    expect(cssText).toContain('.cinder-drawer__panel');
    expect(cssText).toContain('.cinder-drawer::backdrop');
    expect(cssText).toContain('transition: none');
  });

  // Regression guard: the backdrop faded OUT on close (via the
  // `[data-cinder-closing]::backdrop` rule) but had no `@starting-style` to
  // transition FROM on open, so it used to snap to full opacity instantly
  // while the panel slid in smoothly — an asymmetric "eases out, pops in".
  test('drawer.css gives the backdrop a starting-style, backdrop-filter transition, and allow-discrete', async () => {
    const cssText = drawerCss;
    const backdropRuleStart = cssText.indexOf('.cinder-drawer::backdrop {');
    const backdropRuleEnd = cssText.indexOf('}', backdropRuleStart);
    const backdropRule = cssText.slice(backdropRuleStart, backdropRuleEnd);
    expect(backdropRule).toContain('backdrop-filter');
    expect(backdropRule).toContain('transition-behavior: allow-discrete;');

    const startingStyleStart = cssText.indexOf('@starting-style {');
    expect(startingStyleStart).toBeGreaterThan(-1);
    const startingStyleBlock = cssText.slice(startingStyleStart, startingStyleStart + 300);
    expect(startingStyleBlock).toContain('.cinder-drawer::backdrop');
    expect(startingStyleBlock).toContain('background-color: transparent;');
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

    // A sibling escape handler below the drawer's marker: if unmount leaks
    // the drawer's no-op entry, Escape never reaches this handler again.
    let siblingEscapeCount = 0;
    const releaseSiblingEscape = pushEscapeHandler(() => {
      siblingEscapeCount += 1;
    });

    const { unmount } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
    await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(siblingEscapeCount).toBe(1);
    releaseSiblingEscape();

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

  // ---- 18. Exactly one onClose event per close path ----
  test('exactly one onClose event fires per close path (close button)', async () => {
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
  // (Escape-stack release across cycles is pinned separately in the
  // "Drawer escape-stack hygiene" describe below.)
  test('rapid open/close cycling: scroll lock cleans up correctly', async () => {
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

  test('body opts into the shared scroll-fade recipe with a surface-colored overlay, never a mask', async () => {
    const css = drawerCss;
    expect(css).toMatch(
      /\.cinder-drawer__body\s*\{[^}]*--_cinder-scroll-fade-color:\s*var\(--cinder-surface\)/s,
    );
    expect(css).not.toContain('mask-image:');
    expect(css).not.toMatch(/(?:-webkit-)?mask(?:-[a-z]+)?\s*:/);

    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: textSnippet('Drawer body content') },
    });
    const body = container.querySelector('.cinder-drawer__body');
    expect(body?.classList.contains('cinder-_scroll-fade')).toBe(true);
  });

  // ---- Additional: close button has correct aria-label ----
  test('close button has aria-label="Close drawer"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const closeButton = container.querySelector('.cinder-drawer__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close drawer');
  });

  // ---- Initial focus on open: host-managed body focus (the Modal policy) ----
  // The trap runs with `manageInitialFocus: false`; the drawer's own open
  // effect focuses the body container, so opening never lands focus on the
  // close button.
  test('opening focuses the body container when nothing is autofocused', async () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    // Svelte schedules the open-focus effect with tick().then(). In happy-dom,
    // effects run synchronously but the tick().then() microtask needs to drain.
    // Wait for two microtask cycles to ensure both the effect and the tick resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const body = container.querySelector('.cinder-drawer__body') as HTMLElement;
    expect(body).not.toBeNull();
    expect(document.activeElement).toBe(body);
  });
});

// ---------------------------------------------------------------------------
// Slide direction lifecycle — regression for wrong-edge entry/exit.
//
// The panel's `data-cinder-placement` must reflect the side that was current when
// the drawer *opened* (the active-open-cycle side), not the live `side` prop.
// happy-dom cannot render CSS, so these tests assert the state contract that
// drives direction: whichever value `data-cinder-placement` carries on the panel
// is the value the CSS will use for translate/anchor rules.
// ---------------------------------------------------------------------------
describe('Drawer slide direction lifecycle', () => {
  // 1. Opening a right drawer and then changing side while open must NOT
  //    mutate data-cinder-placement during the open cycle.
  test('side change while open does not affect data-cinder-placement until the next open cycle', async () => {
    let openValue = true;
    let placementValue: 'left' | 'right' | 'bottom' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get placement() {
          return placementValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Change the side while the drawer remains open.
    placementValue = 'left';
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // Panel should still report the open-cycle side ('right'), not 'left'.
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');
  });

  // 2. Side change while closed takes effect on the next open.
  test('side change while closed is reflected on the next open', async () => {
    let openValue = false;
    let placementValue: 'left' | 'right' | 'bottom' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get placement() {
          return placementValue;
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
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Close the drawer fully.
    openValue = false;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });
    await finishCloseTransition(container);

    // Change side while closed.
    placementValue = 'left';

    // Reopen — the new side should now be snapshotted.
    openValue = true;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    const newPanel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(newPanel.getAttribute('data-cinder-placement')).toBe('left');
  });

  // 3. Close transition keeps data-cinder-placement stable even if side prop changes
  //    mid-transition (e.g. the user queues a new side while the exit plays).
  test('side change during a close transition does not flip data-cinder-placement mid-transition', async () => {
    let openValue = true;
    let placementValue: 'left' | 'right' | 'bottom' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get placement() {
          return placementValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Begin closing.
    openValue = false;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // Panel should be in closing state.
    expect(panel.getAttribute('data-cinder-closing')).toBe('');
    // Side must still be the open-cycle side, not whatever side is now.
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Change side prop while transition is running.
    placementValue = 'left';
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // data-cinder-placement must remain 'right' throughout the transition.
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Transition completes — panel unmounts.
    await finishCloseTransition(container);
    expect(container.querySelector('.cinder-drawer__panel')).toBeNull();
  });

  // 4. Quick-close then reopen: if side changed before the reopen, the new
  //    side is snapshotted and used for the re-entry animation.
  test('quick-reopen after mid-close-side-change uses the new side', async () => {
    let openValue = true;
    let placementValue: 'left' | 'right' | 'bottom' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get placement() {
          return placementValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    // Close — transition starts.
    openValue = false;
    placementValue = 'left'; // side changes while closing
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
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
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // After quick-reopen, isClosing should be cleared and the new side snapshot applies.
    expect(panel.getAttribute('data-cinder-closing')).toBeNull();
    expect(panel.getAttribute('data-cinder-placement')).toBe('left');
  });

  // 5. Opening with side='left' from the start uses left entry.
  test('left-side drawer opens with data-cinder-placement="left"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', placement: 'left', children: emptySnippet },
    });
    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel.getAttribute('data-cinder-placement')).toBe('left');
  });

  // 6. Right-side drawer (default) closes with data-cinder-placement='right' throughout.
  test('right-side drawer exit transition preserves data-cinder-placement="right"', async () => {
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
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

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
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');
    expect(panel.getAttribute('data-cinder-closing')).toBe('');

    await finishCloseTransition(container);
    expect(container.querySelector('.cinder-drawer__panel')).toBeNull();
  });

  // Same-tick open + side change: a consumer that does `open = true; side = 'left'`
  // in one event handler batches both writes into a single reactive update. The
  // open-handling effect must read the NEW side when it snapshots activePlacement, so
  // the fresh panel slides from the correct edge.
  test('open=false→true with a simultaneous side change snapshots the new side', async () => {
    let openValue = false;
    let placementValue: 'left' | 'right' | 'bottom' = 'right';

    const props = () => ({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    const { container, rerender } = render(Drawer, { props: props() });
    expect(container.querySelector('.cinder-drawer__panel')).toBeNull();

    // Flip both atomically before the single rerender (one reactive batch).
    openValue = true;
    placementValue = 'left';
    await rerender(props());

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('data-cinder-placement')).toBe('left');
  });
});

// The drawer's <dialog> is gated behind a `hydrated` $state set inside an
// $effect, which never runs on the server. Keep this as a source-level contract
// so the invariant is checked without paying a full server compile inside the
// large coverage suite.
describe('Drawer SSR contract', () => {
  test('gates the dialog behind the hydrated state that is set only from an effect', async () => {
    const source = await Bun.file(DRAWER_SOURCE).text();
    const hydratedGateIndex = source.indexOf('{#if dialogState.hydrated}');
    const dialogIndex = source.indexOf('<dialog', hydratedGateIndex);

    expect(source).toMatch(/\$effect\(\(\) => \{\s*dialogState\.markHydrated\(\);\s*\}\);/);
    expect(hydratedGateIndex).toBeGreaterThan(-1);
    expect(dialogIndex).toBeGreaterThan(hydratedGateIndex);
  });

  test('server output omits the dialog before hydration even when open', async () => {
    const html = await renderToServerHtml(DRAWER_SOURCE, { open: true, title: 'Server Drawer' });

    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('Server Drawer');
  });
});

// ---------------------------------------------------------------------------
// Bottom placement (the former Sheet). The drag handle, the 90dvh cap, and
// the touch-target sizes are placement-specific contracts.
// ---------------------------------------------------------------------------
describe('Drawer bottom placement', () => {
  test('drag handle is absent by default (dragHandleVisible=false)', () => {
    const { container } = render(Drawer, {
      props: { open: true, placement: 'bottom', title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-drawer__drag-handle')).toBeNull();
  });

  test('drag handle renders when dragHandleVisible=true with aria-hidden="true"', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        placement: 'bottom',
        title: 'Test',
        dragHandleVisible: true,
        children: emptySnippet,
      },
    });
    const handle = container.querySelector('.cinder-drawer__drag-handle');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
  });

  test('drag handle never renders on side placements even when dragHandleVisible=true', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        placement: 'right',
        title: 'Test',
        dragHandleVisible: true,
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-drawer__drag-handle')).toBeNull();
  });

  test('drawer.css close button meets 44px touch target (2.75rem × 2.75rem)', async () => {
    const cssText = drawerCss;
    const closeRule = cssText.split('.cinder-drawer__close {')[1]?.split('}')[0];
    expect(closeRule).toContain('width: 2.75rem');
    expect(closeRule).toContain('height: 2.75rem');
  });

  test('drawer.css drag handle meets 44px touch target', async () => {
    const cssText = drawerCss;
    const handleRule = cssText.split('.cinder-drawer__drag-handle {')[1]?.split('}')[0];
    expect(handleRule).toMatch(/min-height:\s*(?:2\.75rem|var\(--cinder-touch-target-min\))/);
  });

  test('drawer.css caps the bottom panel and keeps overflow inside the body', async () => {
    const cssText = drawerCss;

    expect(cssText).toMatch(
      /\.cinder-drawer__panel\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;/s,
    );
    expect(cssText).toMatch(
      /\.cinder-drawer__panel\[data-cinder-placement='bottom'\]\s*\{[^}]*max-height:\s*90dvh;/s,
    );
    expect(cssText).not.toMatch(/max-block-size:\s*90dvh;/s);
    expect(cssText).toMatch(
      /\.cinder-drawer__body\s*\{[^}]*flex:\s*1;[^}]*min-block-size:\s*0;[^}]*overflow-y:\s*auto;/s,
    );
    expect(cssText).toMatch(/\.cinder-drawer__header\s*\{[^}]*flex-shrink:\s*0;/s);
    expect(cssText).toMatch(/\.cinder-drawer__footer\s*\{[^}]*flex-shrink:\s*0;/s);
  });

  test('body uses the panel surface beneath header and footer', async () => {
    const cssText = drawerCss;
    expect(cssText).toMatch(
      /\.cinder-drawer__body\s*\{[^}]*background:\s*var\(--cinder-surface\)/s,
    );
  });
});

// ---------------------------------------------------------------------------
// Motion contract: every placement must have BOTH a closing rule and a
// matching @starting-style rule, or that placement pops in with no from-state
// while the backdrop fades (the asymmetric "eases out, pops in" defect).
// ---------------------------------------------------------------------------
describe('Drawer per-placement motion contract', () => {
  // Expected slide-from-edge vector per placement, declared as the
  // --_cinder-drawer-slide custom property in each placement's block and
  // consumed by ONE closing rule and ONE @starting-style rule. Keyed by the
  // SCHEMA's placement enum (generated from DrawerPlacement; components:check
  // forces regeneration), so adding a new placement to the type fails the
  // coverage test below until its block declares a vector — a new edge
  // cannot ship the missing-enter-animation pop-in silently.
  const PLACEMENT_SLIDE_VECTORS: Record<string, string> = {
    right: '--_cinder-drawer-slide: 100% 0;',
    left: '--_cinder-drawer-slide: -100% 0;',
    bottom: '--_cinder-drawer-slide: 0 100%;',
  };

  async function schemaPlacements(): Promise<string[]> {
    const schema = JSON.parse(
      await Bun.file(new URL('./drawer.schema.json', import.meta.url)).text(),
    ) as { properties?: { placement?: { enum?: string[] } } };
    const enumValues = schema.properties?.placement?.enum;
    if (!Array.isArray(enumValues) || enumValues.length === 0) {
      throw new Error('drawer.schema.json no longer exposes a placement enum');
    }
    return enumValues;
  }

  test('the slide-vector map covers every placement in the generated schema', async () => {
    const placements = await schemaPlacements();
    expect(Object.keys(PLACEMENT_SLIDE_VECTORS).toSorted()).toEqual(placements.toSorted());
  });

  test('every placement block declares its slide vector', async () => {
    for (const placement of await schemaPlacements()) {
      const selector = `.cinder-drawer__panel[data-cinder-placement='${placement}']`;
      const selectorIndex = drawerCss.indexOf(`${selector} {`);
      expect(selectorIndex).toBeGreaterThan(-1);
      const rule = drawerCss.slice(selectorIndex, drawerCss.indexOf('}', selectorIndex));
      expect(rule).toContain(
        PLACEMENT_SLIDE_VECTORS[placement] ?? `<no slide vector mapped for ${placement}>`,
      );
    }
  });

  test('one closing rule and one @starting-style rule consume the slide vector', () => {
    const closingIndex = drawerCss.indexOf('.cinder-drawer__panel[data-cinder-closing]');
    expect(closingIndex).toBeGreaterThan(-1);
    const closingRule = drawerCss.slice(closingIndex, drawerCss.indexOf('}', closingIndex));
    expect(closingRule).toContain('translate: var(--_cinder-drawer-slide);');

    const panelStartingStyleIndex = drawerCss.indexOf('@starting-style', closingIndex);
    expect(panelStartingStyleIndex).toBeGreaterThan(-1);
    const startingBlock = drawerCss.slice(panelStartingStyleIndex);
    const panelIndex = startingBlock.indexOf('.cinder-drawer__panel');
    expect(panelIndex).toBeGreaterThan(-1);
    const startingRule = startingBlock.slice(panelIndex, startingBlock.indexOf('}', panelIndex));
    expect(startingRule).toContain('translate: var(--_cinder-drawer-slide);');
  });
});

// ---------------------------------------------------------------------------
// Focus trap wrap behavior (ported from the former Sheet suite).
//
// DOM order inside the panel: the close button lives in the <header> first,
// then the body <input>. So the close button is the FIRST tabbable and the
// input is the LAST — asserting exact wrap destinations (not mere panel
// containment, which is already true before the event) makes these tests fail
// if the shared trap is removed or its boundary logic breaks.
//
// Each test `await tick()`s after render: on open, the drawer defers its own
// initial focus to the body via `tick().then(() => bodyElement.focus())`. That
// microtask must drain BEFORE we exercise the trap, otherwise it races in
// during the `await fireEvent` and clobbers the trap's wrap destination. In
// real usage the deferred focus has long settled before a user tabs.
// ---------------------------------------------------------------------------
describe('Drawer focus trap', () => {
  function makeSnippetWithInput() {
    return createRawSnippet(() => ({
      render: () => `<input type="text" data-testid="drawer-input" />`,
      setup: () => {},
    }));
  }

  test('Tab from the last focusable element wraps to the first and prevents default', async () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test Drawer',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLElement;
    const input = container.querySelector('input[data-testid="drawer-input"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(closeButton).not.toBeNull();
    expect(input).not.toBeNull();

    // The input is the LAST tabbable (close button is first, in the header).
    input.focus();
    expect(document.activeElement).toBe(input);

    const result = await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: false });

    // Trap intercepted the boundary Tab and wrapped focus to the first tabbable.
    expect(result).toBe(false); // fireEvent returns false when preventDefault was called
    expect(document.activeElement).toBe(closeButton);
  });

  test('Shift+Tab from the first focusable element wraps to the last and prevents default', async () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test Drawer',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLElement;
    const input = container.querySelector('input[data-testid="drawer-input"]') as HTMLElement;

    // The close button is the FIRST tabbable (header precedes the body input).
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    const result = await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });

    expect(result).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  test('document.body never receives focus while tabbing inside an open drawer', async () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test Drawer',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = container.querySelector('.cinder-drawer__panel') as HTMLElement;
    const input = container.querySelector('input[data-testid="drawer-input"]') as HTMLElement;
    input.focus();

    // Tab repeatedly from the boundary — focus must never escape to the body.
    for (let i = 0; i < 5; i++) {
      await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).not.toBe(document.body);
      expect(panel.contains(document.activeElement)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Escape-stack hygiene (ported from the former Sheet suite).
//
// Documents that successive open/close cycles do not leak escape-stack
// entries. If the drawer's no-op marker handler were not released on close,
// it would stay above this sibling handler and prevent Escape from routing
// back to the sibling overlay after the drawer closes.
// ---------------------------------------------------------------------------
describe('Drawer escape-stack hygiene', () => {
  test('open/close cycles do not leak scroll lock or escape stack entries', async () => {
    let siblingEscapeCount = 0;
    const releaseSiblingEscape = pushEscapeHandler(() => {
      siblingEscapeCount += 1;
    });
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

    expect(document.body.style.overflow).toBe('hidden');
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
    await finishCloseTransition(container);
    expect(document.body.style.overflow).toBe('');
    await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(siblingEscapeCount).toBe(1);

    openValue = true;
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

    expect(document.body.style.overflow).toBe('hidden');
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
    await finishCloseTransition(container);
    expect(document.body.style.overflow).toBe('');
    await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(siblingEscapeCount).toBe(2);
    releaseSiblingEscape();
  });
});

// ---------------------------------------------------------------------------
// Focus-restore edge cases (ported from the former Sheet suite).
// ---------------------------------------------------------------------------
describe('Drawer focus restore edge cases', () => {
  // Regression: reopening while the close transition is still running takes
  // the quick-reopen branch in syncOpenState, where the native dialog never
  // closed — onOpen must re-fire there or the body-focus policy never runs
  // and focus stays stranded on document.body behind the modal drawer.
  test('reopen while closing re-applies body focus instead of stranding focus on document.body', async () => {
    let openValue = true;
    const props = {
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'Test',
      children: emptySnippet,
    };
    const { container, rerender } = render(Drawer, { props });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Begin closing (panel goes inert, focus falls back to document.body)…
    openValue = false;
    await rerender(props);
    // …then reopen BEFORE the exit transition finishes.
    openValue = true;
    await rerender(props);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const body = container.querySelector('.cinder-drawer__body') as HTMLElement;
    expect(body).not.toBeNull();
    expect(document.activeElement).toBe(body);
  });

  test('focus restores to capturedFocus when triggerRef is unmounted before close', async () => {
    const previouslyFocused = document.createElement('button');
    previouslyFocused.id = 'drawer-prev-focus';
    document.body.appendChild(previouslyFocused);
    previouslyFocused.focus();

    const triggerEl = document.createElement('button');
    triggerEl.id = 'drawer-transient-trigger';
    document.body.appendChild(triggerEl);

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
        triggerRef: triggerEl,
        children: emptySnippet,
      },
    });

    // Remove the trigger while the drawer is open.
    document.body.removeChild(triggerEl);

    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.activeElement).toBe(previouslyFocused);

    document.body.removeChild(previouslyFocused);
  });

  test('no focus is forced when both triggerRef and capturedFocus are gone', async () => {
    const triggerEl = document.createElement('button');
    document.body.appendChild(triggerEl);

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
        triggerRef: triggerEl,
        children: emptySnippet,
      },
    });

    document.body.removeChild(triggerEl);

    const closeButton = container.querySelector('.cinder-drawer__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.activeElement).not.toBe(triggerEl);
  });
});
