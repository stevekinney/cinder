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

const SHEET_SOURCE = join(import.meta.dir, 'sheet.svelte');

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
const { default: Sheet } = await import('./sheet.svelte');
const originalGetComputedStyle = window.getComputedStyle.bind(window);

window.getComputedStyle = ((target: Element) => {
  if (target instanceof HTMLElement && target.classList.contains('cinder-sheet__panel')) {
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
  const panel = container.querySelector('.cinder-sheet__panel');
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

describe('Sheet', () => {
  test('renders open <dialog> when open=true after hydration', () => {
    const { container } = render(Sheet, {
      props: { open: true, title: 'Test Sheet', children: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  test('dialog is closed when open=false', () => {
    const { container } = render(Sheet, {
      props: { open: false, title: 'Test Sheet', children: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  test('default header renders <h2> with title and dialog aria-labelledby matches', () => {
    const { container } = render(Sheet, {
      props: { open: true, title: 'My Sheet Title', children: emptySnippet },
    });
    const title = container.querySelector('.cinder-sheet__title');
    expect(title).not.toBeNull();
    expect(title?.textContent?.trim()).toBe('My Sheet Title');
    const dialog = container.querySelector('dialog');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    const heading = container.querySelector(`#${labelledBy}`);
    expect(heading).not.toBeNull();
    expect(heading?.textContent?.trim()).toBe('My Sheet Title');
  });

  test('custom header without ariaLabelledBy renders sr-only title heading', () => {
    const customHeader = createRawSnippet(() => ({
      render: () => `<span>Custom Header Content</span>`,
      setup: () => {},
    }));
    const { container } = render(Sheet, {
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

  test('custom header with ariaLabelledBy uses consumer id and renders no internal title', () => {
    const customHeader = createRawSnippet(() => ({
      render: () => `<h2 id="external-heading">External Heading</h2>`,
      setup: () => {},
    }));
    const { container } = render(Sheet, {
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
    expect(container.querySelector('.cinder-sr-only')).toBeNull();
  });

  test('clicking the close button closes the sheet', async () => {
    let openValue = true;
    const { container } = render(Sheet, {
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
    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
  });

  test('clicking the backdrop (dialog element itself) closes the sheet', async () => {
    let openValue = true;
    const { container } = render(Sheet, {
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
    await fireEvent.click(dialog);
    expect(openValue).toBe(false);
  });

  test('dialog close event sets open to false', async () => {
    let openValue = true;
    const { container } = render(Sheet, {
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

  test('focus restores to triggerRef when provided', async () => {
    const button = document.createElement('button');
    button.id = 'trigger-button';
    document.body.appendChild(button);

    let openValue = true;
    const { container } = render(Sheet, {
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

    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });

  test('focus restores to capturedFocus when triggerRef is unmounted before close', async () => {
    const previouslyFocused = document.createElement('button');
    previouslyFocused.id = 'sheet-prev-focus';
    document.body.appendChild(previouslyFocused);
    previouslyFocused.focus();

    const triggerEl = document.createElement('button');
    triggerEl.id = 'sheet-transient-trigger';
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Sheet, {
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

    // Remove the trigger while the sheet is open.
    document.body.removeChild(triggerEl);

    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.activeElement).toBe(previouslyFocused);

    document.body.removeChild(previouslyFocused);
  });

  test('no focus is forced when both triggerRef and capturedFocus are gone', async () => {
    const triggerEl = document.createElement('button');
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Sheet, {
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

    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.activeElement).not.toBe(triggerEl);
  });

  test('focus restores to previously-focused element when triggerRef omitted', async () => {
    const button = document.createElement('button');
    button.id = 'previously-focused';
    document.body.appendChild(button);
    button.focus();

    let openValue = true;
    const { container } = render(Sheet, {
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

    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });

  test('body scroll lock acquired on open and released on close', async () => {
    let openValue = true;
    const { container } = render(Sheet, {
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

    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.body.style.overflow).toBe('');
  });

  test('Escape cancel keeps the sheet mounted until the close transition completes', async () => {
    let openValue = true;
    const { container } = render(Sheet, {
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
    const panel = container.querySelector('.cinder-sheet__panel') as HTMLElement;
    expect(dialog).not.toBeNull();
    await fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(openValue).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(panel.getAttribute('data-cinder-closing')).toBe('');
    await finishCloseTransition(container);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  test('close applies inert closing state until the delayed close finishes', async () => {
    let openValue = true;
    const { container } = render(Sheet, {
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
    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    const panel = container.querySelector('.cinder-sheet__panel') as HTMLElement;
    expect(openValue).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('data-cinder-closing')).toBe('');
    expect(panel.getAttribute('data-cinder-closing')).toBe('');
    expect(panel.hasAttribute('inert')).toBe(true);
    await finishCloseTransition(container);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  test('sheet.css disables panel and backdrop transitions under prefers-reduced-motion: reduce', async () => {
    const cssText = await Bun.file(new URL('./sheet.css', import.meta.url)).text();
    expect(cssText).toContain('prefers-reduced-motion: reduce');
    expect(cssText).toContain('.cinder-sheet__panel');
    expect(cssText).toContain('.cinder-sheet::backdrop');
    expect(cssText).toContain('transition: none');
  });

  test('bindable open: closing from inside the sheet updates consumer state', async () => {
    let openValue = true;
    const { container } = render(Sheet, {
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

    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
    await finishCloseTransition(container);
  });

  test('unmount-while-open (no triggerRef): restores scroll lock and escape stack', () => {
    const prevFocus = document.createElement('button');
    prevFocus.id = 'prev-focus-a';
    document.body.appendChild(prevFocus);
    prevFocus.focus();

    const { unmount } = render(Sheet, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');

    document.body.removeChild(prevFocus);
  });

  test('unmount-while-open (explicit triggerRef): focus restores to triggerRef', () => {
    const triggerEl = document.createElement('button');
    triggerEl.id = 'trigger-b';
    document.body.appendChild(triggerEl);

    const { unmount } = render(Sheet, {
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

  test('exactly one onclose event fires per close path (close button)', async () => {
    let closeCount = 0;
    let openValue = true;
    const { container } = render(Sheet, {
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

    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(closeCount).toBe(0);
    await finishCloseTransition(container);
    expect(closeCount).toBe(1);
  });

  test('data-testid pass-through reaches the dialog element', () => {
    const { container } = render(Sheet, {
      props: {
        open: true,
        title: 'Test',
        'data-testid': 'my-sheet',
        children: emptySnippet,
      } as any,
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('data-testid')).toBe('my-sheet');
  });

  test('class prop is merged with cinder-sheet', () => {
    const { container } = render(Sheet, {
      props: {
        open: true,
        title: 'Test',
        class: 'custom-class',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.classList.contains('cinder-sheet')).toBe(true);
    expect(dialog?.classList.contains('custom-class')).toBe(true);
  });

  test('rapid open/close cycling: scroll lock cleans up correctly', async () => {
    let openValue = false;
    const { container, rerender } = render(Sheet, {
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

  test('closed sheet has no open attribute on the <dialog>', () => {
    const { container } = render(Sheet, {
      props: { open: false, title: 'Test', children: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(dialog?.open).toBe(false);
  });

  test('dialog always has aria-modal="true"', () => {
    const { container } = render(Sheet, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('dialog')?.getAttribute('aria-modal')).toBe('true');
  });

  test('footer renders when provided', () => {
    const { container } = render(Sheet, {
      props: {
        open: true,
        title: 'Test',
        children: emptySnippet,
        footer: textSnippet('Footer content'),
      },
    });
    const footer = container.querySelector('.cinder-sheet__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('Footer content');
  });

  test('footer is absent when not provided', () => {
    const { container } = render(Sheet, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-sheet__footer')).toBeNull();
  });

  test('children render inside the body', () => {
    const { container } = render(Sheet, {
      props: {
        open: true,
        title: 'Test',
        children: textSnippet('Sheet body content'),
      },
    });
    const body = container.querySelector('.cinder-sheet__body');
    expect(body?.textContent).toContain('Sheet body content');
  });

  test('body container has tabindex="-1"', () => {
    const { container } = render(Sheet, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const body = container.querySelector('.cinder-sheet__body');
    expect(body?.getAttribute('tabindex')).toBe('-1');
  });

  test('overflow fade attachment marks and clears the sheet body', () => {
    const cleanupOverflowFade = installOverflowFadeTestEnvironment();
    try {
      const { container } = render(Sheet, {
        props: { open: true, title: 'Test', children: textSnippet('Sheet body content') },
      });
      const body = container.querySelector('.cinder-sheet__body') as HTMLElement;
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

  test('close button has aria-label="Close sheet"', () => {
    const { container } = render(Sheet, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const closeButton = container.querySelector('.cinder-sheet__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close sheet');
  });

  test('drag handle is absent by default (showDragHandle=false)', () => {
    const { container } = render(Sheet, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-sheet__drag-handle')).toBeNull();
  });

  test('drag handle renders when showDragHandle=true with aria-hidden="true"', () => {
    const { container } = render(Sheet, {
      props: { open: true, title: 'Test', showDragHandle: true, children: emptySnippet },
    });
    const handle = container.querySelector('.cinder-sheet__drag-handle');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
  });

  test('sheet.css close button meets 44px touch target (2.75rem × 2.75rem)', async () => {
    const cssFile = Bun.file(new URL('./sheet.css', import.meta.url));
    const cssText = await cssFile.text();
    const closeRule = cssText.split('.cinder-sheet__close {')[1]?.split('}')[0];
    expect(closeRule).toContain('width: 2.75rem');
    expect(closeRule).toContain('height: 2.75rem');
  });

  test('sheet.css drag handle meets 44px touch target', async () => {
    const cssFile = Bun.file(new URL('./sheet.css', import.meta.url));
    const cssText = await cssFile.text();
    const handleRule = cssText.split('.cinder-sheet__drag-handle {')[1]?.split('}')[0];
    // Accept either the literal 2.75rem or the --cinder-touch-target-min token
    // (both resolve to 44px). The audit migrated this site to the token.
    expect(handleRule).toMatch(/min-height:\s*(?:2\.75rem|var\(--cinder-touch-target-min\))/);
  });

  // Documents that successive open/close cycles do not leak escape-stack
  // entries. If the sheet's no-op marker handler were not released on close,
  // it would stay above this sibling handler and prevent Escape from routing
  // back to the sibling overlay after the sheet closes.
  test('open/close cycles do not leak scroll lock or escape stack entries', async () => {
    let siblingEscapeCount = 0;
    const releaseSiblingEscape = pushEscapeHandler(() => {
      siblingEscapeCount += 1;
    });
    let openValue = true;
    const { container, rerender } = render(Sheet, {
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

describe('Sheet focus trap', () => {
  function makeSnippetWithInput() {
    return createRawSnippet(() => ({
      render: () => `<input type="text" data-testid="sheet-input" />`,
      setup: () => {},
    }));
  }

  // DOM order inside the panel: the close button lives in the <header> first,
  // then the body <input>. So the close button is the FIRST tabbable and the
  // input is the LAST — asserting exact wrap destinations (not mere panel
  // containment, which is already true before the event) makes these tests fail
  // if the shared trap is removed or its boundary logic breaks.
  //
  // Each test `await tick()`s after render: on open, the sheet defers its own
  // initial focus to the body via `tick().then(() => bodyElement.focus())`. That
  // microtask must drain BEFORE we exercise the trap, otherwise it races in
  // during the `await fireEvent` and clobbers the trap's wrap destination. In
  // real usage the deferred focus has long settled before a user tabs.
  test('Tab from the last focusable element wraps to the first and prevents default', async () => {
    const { container } = render(Sheet, {
      props: {
        open: true,
        title: 'Test Sheet',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = container.querySelector('.cinder-sheet__panel') as HTMLElement;
    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLElement;
    const input = container.querySelector('input[data-testid="sheet-input"]') as HTMLElement;
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
    const { container } = render(Sheet, {
      props: {
        open: true,
        title: 'Test Sheet',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = container.querySelector('.cinder-sheet__panel') as HTMLElement;
    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLElement;
    const input = container.querySelector('input[data-testid="sheet-input"]') as HTMLElement;

    // The close button is the FIRST tabbable (header precedes the body input).
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    const result = await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });

    expect(result).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  test('document.body never receives focus while tabbing inside an open sheet', async () => {
    const { container } = render(Sheet, {
      props: {
        open: true,
        title: 'Test Sheet',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = container.querySelector('.cinder-sheet__panel') as HTMLElement;
    const input = container.querySelector('input[data-testid="sheet-input"]') as HTMLElement;
    input.focus();

    // Tab repeatedly from the boundary — focus must never escape to the body.
    for (let i = 0; i < 5; i++) {
      await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).not.toBe(document.body);
      expect(panel.contains(document.activeElement)).toBe(true);
    }
  });
});

// The sheet's <dialog> is gated behind a `hydrated` $state set inside an
// $effect, which never runs on the server. Keep this as a source-level contract
// so the invariant is checked without paying a full server compile inside the
// large coverage suite.
describe('Sheet SSR contract', () => {
  test('gates the dialog behind the hydrated state that is set only from an effect', async () => {
    const source = await Bun.file(SHEET_SOURCE).text();
    const hydratedGateIndex = source.indexOf('{#if dialogState.hydrated}');
    const dialogIndex = source.indexOf('<dialog', hydratedGateIndex);

    expect(source).toContain('$effect(() => {\n    dialogState.markHydrated();\n  });');
    expect(hydratedGateIndex).toBeGreaterThan(-1);
    expect(dialogIndex).toBeGreaterThan(hydratedGateIndex);
  });
});
