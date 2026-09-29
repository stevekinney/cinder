/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { flushSync } from 'svelte';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, installModalDialogStubs } from './modal-test-helpers.ts';

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
  test('clicking the close button sets open to false', async () => {
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

    const closeButton = requiredInstance(
      container.querySelector('.cinder-modal__close'),
      HTMLButtonElement,
    );
    expect(closeButton).not.toBeNull();
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
  });
  test('keeps the panel mounted with data-cinder-closing until its exit transition finishes', async () => {
    // Stub a real (non-zero) transition duration for `.cinder-modal__panel` so
    // `waitForTransitionCompletion` (shared with Drawer/Sheet via
    // `createSlidingDialogState`) takes its transitionend-listening path
    // instead of resolving on the next microtask — this is the only way to
    // observe the intermediate "closing but still mounted, dialog still
    // native-open" state that proves a real exit path now exists.
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
      const closeButton = requiredInstance(
        container.querySelector('.cinder-modal__close'),
        HTMLButtonElement,
      );
      await fireEvent.click(closeButton);

      // The bound `open` prop flips synchronously (consumers must see this
      // immediately), but the native <dialog> itself and the panel's DOM
      // node must both survive the exit transition instead of vanishing in
      // the same tick — that was the original bug (no exit animation could
      // ever play).
      expect(openValue).toBe(false);
      expect(dialog.hasAttribute('open')).toBe(true);
      const panel = container.querySelector('.cinder-modal__panel');
      expect(panel).not.toBeNull();
      expect(panel?.hasAttribute('data-cinder-closing')).toBe(true);
      expect(dialog.hasAttribute('data-cinder-closing')).toBe(true);

      for (const propertyName of ['opacity', 'translate']) {
        const event = new Event('transitionend');
        Object.defineProperty(event, 'propertyName', { value: propertyName });
        panel?.dispatchEvent(event);
      }

      flushSync();
      expect(dialog.hasAttribute('open')).toBe(false);
      expect(container.querySelector('.cinder-modal__panel')?.outerHTML ?? null).toBeNull();
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
  test('onExitComplete fires only once the exit transition genuinely finishes, not when open first flips false', async () => {
    // Same real-transition stub as the test above — this is the only way to
    // observe that onExitComplete is NOT called merely because `open` went
    // false; it must wait for the actual transitionend-driven completion.
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
      // Still mounted, still mid-transition — onExitComplete must not have
      // fired yet.
      expect(exitCompleteCount).toBe(0);

      const panel = container.querySelector('.cinder-modal__panel');
      for (const propertyName of ['opacity', 'translate']) {
        const event = new Event('transitionend');
        Object.defineProperty(event, 'propertyName', { value: propertyName });
        panel?.dispatchEvent(event);
      }

      await waitFor(() => {
        expect(container.querySelector('.cinder-modal__panel')?.outerHTML ?? null).toBeNull();
      });
      expect(exitCompleteCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
});
