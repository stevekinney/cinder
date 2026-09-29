/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { pushEscapeHandler, resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
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
const drawerCss = await Bun.file(new URL('./drawer.css', import.meta.url)).text();

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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    await fireEvent.click(closeButton);
    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
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
    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    dialog.addEventListener('close', () => {
      closeCount++;
    });

    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    await fireEvent.click(closeButton);
    expect(closeCount).toBe(0);
    await finishCloseTransition(container);
    expect(closeCount).toBe(1);
  });

  // ---- 19. Rest props pass-through and class merging ----
});
