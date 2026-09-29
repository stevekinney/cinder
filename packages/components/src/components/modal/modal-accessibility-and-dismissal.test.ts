/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, installModalDialogStubs } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal', () => {
  test('describedById sets aria-describedby on the dialog element', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
        describedById: 'x-123',
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-describedby')).toBe('x-123');
  });
  test('aria-describedby is absent when describedById is omitted', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
  });
  test('aria-describedby is absent when describedById is whitespace-only (PR #1422 review)', () => {
    // Regression: a bare truthiness check (`describedById ? ... : {}`)
    // treats a whitespace-only string as truthy in JS — it would have
    // emitted `aria-describedby="   "`, referencing an id that cannot
    // exist, even though the `described-by-non-empty` constraint
    // (`nonEmpty`, which trims) already rejects that same value, and the
    // generated schema's `pattern: '\\S'` restriction on `describedById`
    // rejects it too. `isNonEmptyString` (the same guard the title/
    // aria-label nameless-effect already relies on) keeps the runtime in
    // agreement with both.
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
        describedById: '   ',
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
  });
  test('onDismiss fires when native cancel event is dispatched (Escape)', async () => {
    let dismissCount = 0;
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
        onDismiss: () => {
          dismissCount++;
        },
      },
    });
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });
  test('native cancel event is prevented (Escape routes through dismiss())', async () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
  });
  test('onDismiss fires when backdrop is clicked', async () => {
    let dismissCount = 0;
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
        onDismiss: () => {
          dismissCount++;
        },
      },
    });
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    await fireEvent.click(dialog);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });
  test('onDismiss fires when the close-X button is clicked', async () => {
    let dismissCount = 0;
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
        onDismiss: () => {
          dismissCount++;
        },
      },
    });
    const closeButton = requiredInstance(
      container.querySelector('.cinder-modal__close'),
      HTMLButtonElement,
    );
    await fireEvent.click(closeButton);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });
  test('onDismiss does NOT fire when open is set to false by the parent', async () => {
    let dismissCount = 0;
    let openValue = true;
    const { rerender } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
        onDismiss: () => {
          dismissCount++;
        },
      },
    });
    // Parent-driven close: update the prop directly
    await rerender({ open: false, title: 'Test Modal', children: emptySnippet });
    expect(dismissCount).toBe(0);
  });
});
