/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { _resetEscapeStack, _resetScrollLock, pushEscapeHandler } from '../_internal/overlay.ts';
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
const { default: Sheet } = await import('./sheet.svelte');

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
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
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
    expect(document.body.style.overflow).toBe('');
  });

  test('Escape key on dialog fires close event and sets open to false', async () => {
    // The native <dialog> handles ESC → cancel → close automatically with showModal().
    // happy-dom does not fully emulate this native behaviour, so we fire the close
    // event after dispatching Escape to replicate the browser sequence — same pattern
    // as drawer.test.ts. This tests the onclose → handleClose → open=false chain.
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
    await fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await fireEvent(dialog, new Event('close'));
    expect(openValue).toBe(false);
  });

  test('sheet.css contains prefers-reduced-motion: reduce with cinder-sheet-fade', async () => {
    const cssFile = Bun.file(new URL('../styles/components/sheet.css', import.meta.url));
    const cssText = await cssFile.text();
    expect(cssText).toContain('prefers-reduced-motion: reduce');
    expect(cssText).toContain('cinder-sheet-fade');
  });

  test('sheet.css contains slide-up keyframe under prefers-reduced-motion: no-preference', async () => {
    const cssFile = Bun.file(new URL('../styles/components/sheet.css', import.meta.url));
    const cssText = await cssFile.text();
    expect(cssText).toContain('prefers-reduced-motion: no-preference');
    expect(cssText).toContain('cinder-sheet-slide-up');
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

    const closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
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
    const cssFile = Bun.file(new URL('../styles/components/sheet.css', import.meta.url));
    const cssText = await cssFile.text();
    const closeRule = cssText.split('.cinder-sheet__close {')[1]?.split('}')[0];
    expect(closeRule).toContain('width: 2.75rem');
    expect(closeRule).toContain('height: 2.75rem');
  });

  test('sheet.css drag handle meets 44px touch target (min-height: 2.75rem)', async () => {
    const cssFile = Bun.file(new URL('../styles/components/sheet.css', import.meta.url));
    const cssText = await cssFile.text();
    const handleRule = cssText.split('.cinder-sheet__drag-handle {')[1]?.split('}')[0];
    expect(handleRule).toContain('min-height: 2.75rem');
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
    let closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
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
    closeButton = container.querySelector('.cinder-sheet__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(document.body.style.overflow).toBe('');
    await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(siblingEscapeCount).toBe(2);
    releaseSiblingEscape();
  });
});
