/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, fireNativeClose, installModalDialogStubs } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal', () => {
  test('onExitComplete does NOT fire when open flips back to true before the exit transition finishes (reopen during close)', async () => {
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = (target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-modal__panel')) {
        return new Proxy(originalGetComputedStyle(target), {
          get(style, property, receiver) {
            if (property === 'transitionProperty') return 'opacity, translate';
            if (property === 'transitionDuration') return '80ms, 80ms';
            if (property === 'transitionDelay') return '0ms, 0ms';
            return Reflect.get(style, property, receiver);
          },
        });
      }
      return originalGetComputedStyle(target);
    };

    try {
      let openValue = true;
      let exitCompleteCount = 0;
      const { container, rerender } = render(Modal, {
        props: {
          get open() {
            return openValue;
          },
          set open(value: boolean) {
            openValue = value;
          },
          title: 'Test Modal',
          children: emptySnippet,
          onExitComplete: () => {
            exitCompleteCount++;
          },
        },
      });

      const closeButton = requiredInstance(
        container.querySelector('.cinder-modal__close'),
        HTMLButtonElement,
      );
      await fireEvent.click(closeButton);
      expect(openValue).toBe(false);

      // Reopen mid-transition, before any transitionend fires.
      openValue = true;
      await rerender({ open: true, title: 'Test Modal', children: emptySnippet });

      // The panel never actually unmounted, so onExitComplete must not fire —
      // even after the exit-transition's own generation is force-completed
      // internally on reopen.
      expect(container.querySelector('.cinder-modal__panel')).not.toBeNull();
      expect(exitCompleteCount).toBe(0);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
  test('onExitComplete fires after the render flush — the panel is already gone from the DOM at the moment the callback runs, not merely by the time a later assertion checks', async () => {
    // Regression: `#finishClosing()` used to call `onClosed?.()` (which
    // forwards to `onExitComplete`) synchronously in the same stack as
    // `renderPanel = false` — before Svelte reconciled the `{#if renderPanel}`
    // block and actually removed `.cinder-modal__panel` from the DOM. A
    // consumer's callback would still find the panel present, contradicting
    // the documented "fires once ... the panel actually unmounts" contract.
    // Assert the DOM state INSIDE the callback itself, not via a later
    // `waitFor` (which would pass even with the old synchronous-and-wrong
    // ordering, since it merely polls until eventually true).
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = (target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-modal__panel')) {
        return new Proxy(originalGetComputedStyle(target), {
          get(style, property, receiver) {
            if (property === 'transitionProperty') return 'opacity, translate';
            if (property === 'transitionDuration') return '80ms, 80ms';
            if (property === 'transitionDelay') return '0ms, 0ms';
            return Reflect.get(style, property, receiver);
          },
        });
      }
      return originalGetComputedStyle(target);
    };

    try {
      let openValue = true;
      let panelPresentWhenCallbackFired: boolean | undefined;
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
          onExitComplete: () => {
            panelPresentWhenCallbackFired =
              container.querySelector('.cinder-modal__panel') !== null;
          },
        },
      });

      const closeButton = requiredInstance(
        container.querySelector('.cinder-modal__close'),
        HTMLButtonElement,
      );
      await fireEvent.click(closeButton);

      const panel = container.querySelector('.cinder-modal__panel');
      for (const propertyName of ['opacity', 'translate']) {
        const event = new Event('transitionend');
        Object.defineProperty(event, 'propertyName', { value: propertyName });
        panel?.dispatchEvent(event);
      }

      await waitFor(() => {
        expect(panelPresentWhenCallbackFired).toBe(false);
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
  test('destroying the component (e.g. a consumer unmounting Modal from onExitComplete) detaches the <dialog> from the DOM', () => {
    // Regression: a native <dialog> shown via showModal() is promoted to
    // the browser's top layer, outside ordinary document flow — a consumer
    // composing Modal behind its own conditional mount keyed off
    // onExitComplete (the documented pattern) could otherwise be left with
    // a stale, already-destroyed instance's <dialog> still attached to the
    // DOM after the surrounding block tears down, since top-layer promotion
    // means it is not always removed by ordinary child-removal alone.
    const { container, unmount } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(document.body.contains(dialog)).toBe(true);

    unmount();

    expect(document.body.contains(dialog)).toBe(false);
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

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    expect(dialog).not.toBeNull();
    await fireNativeClose(dialog);
    expect(openValue).toBe(false);
  });
});
