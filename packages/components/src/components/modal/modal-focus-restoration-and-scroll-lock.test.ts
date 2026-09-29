/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, fireNativeClose, installModalDialogStubs } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal', () => {
  test('focus restores to triggerRef on close', async () => {
    // Baseline focus so captureFocus() sees a known state. Without this, a
    // stale activeElement from a prior test can leak into capturedFocus and
    // win against triggerRef in the candidate iteration.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const button = document.createElement('button');
    button.id = 'modal-trigger';
    document.body.appendChild(button);

    let openValue = true;
    const { container } = render(Modal, {
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    await fireNativeClose(dialog);
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });
  test('focus restores to captured element when triggerRef is unmounted before close', async () => {
    const previouslyFocused = document.createElement('button');
    previouslyFocused.id = 'prev-focus';
    document.body.appendChild(previouslyFocused);
    previouslyFocused.focus();

    const triggerEl = document.createElement('button');
    triggerEl.id = 'transient-trigger';
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Modal, {
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

    // Unmount the trigger before the dialog closes.
    document.body.removeChild(triggerEl);

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    await fireNativeClose(dialog);
    expect(document.activeElement).toBe(previouslyFocused);

    document.body.removeChild(previouslyFocused);
  });
  test('no focus is forced when all candidates are disconnected', async () => {
    const triggerEl = document.createElement('button');
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Modal, {
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

    // Drop the trigger AND make sure captured focus is null (it was null at open
    // because focus was on body before render).
    document.body.removeChild(triggerEl);

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    await fireNativeClose(dialog);
    // No fallback to document.body — focus stays where the dialog left it.
    expect(document.activeElement).not.toBe(triggerEl);
  });
  test('body scroll lock is acquired on open and released on close', async () => {
    let openValue = true;
    const { container } = render(Modal, {
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    await fireNativeClose(dialog);
    expect(document.body.style.overflow).toBe('');
  });
  test('body scroll lock is released when modal is unmounted while open', () => {
    const { unmount } = render(Modal, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
  test('two stacked modals: closing the inner one keeps the lock held', async () => {
    const outer = render(Modal, {
      props: { open: true, title: 'Outer', children: emptySnippet },
    });
    expect(document.body.style.overflow).toBe('hidden');

    let innerOpen = true;
    const inner = render(Modal, {
      props: {
        get open() {
          return innerOpen;
        },
        set open(value: boolean) {
          innerOpen = value;
        },
        title: 'Inner',
        children: emptySnippet,
      },
    });
    expect(document.body.style.overflow).toBe('hidden');

    const innerDialog = requiredInstance(
      inner.container.querySelector('dialog'),
      HTMLDialogElement,
    );
    await fireNativeClose(innerDialog);
    expect(document.body.style.overflow).toBe('hidden');

    const outerDialog = requiredInstance(
      outer.container.querySelector('dialog'),
      HTMLDialogElement,
    );
    await fireNativeClose(outerDialog);
    expect(document.body.style.overflow).toBe('');
  });
});
