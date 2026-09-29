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
  test('onExitComplete fires immediately under reduced motion (transition collapsed to zero)', async () => {
    // No getComputedStyle stub here — happy-dom's default (zero) transition
    // duration is exactly the reduced-motion-collapsed path
    // waitForTransitionCompletion takes, resolving via queueMicrotask.
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

    flushSync();
    expect(container.querySelector('.cinder-modal__panel')?.outerHTML ?? null).toBeNull();
    expect(exitCompleteCount).toBe(1);
  });
  test('a throwing onExitComplete does not block the native dialog from closing or the scroll lock from releasing', async () => {
    // Regression: `#finishClosing` used to call `onClosed?.()` (which
    // forwards to this consumer callback) BEFORE `dialogElement.close()`.
    // A throwing consumer callback would therefore propagate out before the
    // native `close()` call ever ran — leaving the dialog stuck open in the
    // top layer, and the scroll lock/escape-stack hold (released by the
    // native `close` event's own `onclose` handler) never released. The
    // fix reorders `#finishClosing` to call `close()` first.
    //
    // Uses the same real-(non-collapsed)-transition stub as the
    // "keeps the panel mounted..." test above, and drives completion via an
    // explicit `dispatchEvent('transitionend')`. `onExitComplete` now fires
    // from a `tick().then()` continuation past the render flush (see the
    // "fires after the render flush" test above), so the throw is no longer
    // synchronously observable at all — `#finishClosing` catches it and
    // reports it via `globalThis.reportError` rather than letting it
    // surface as an unhandled promise rejection. What this test actually
    // proves is the ORDERING: `dialogElement.close()` (and the scroll-lock/
    // escape-stack release its native `close` event triggers) still runs
    // unconditionally, before the (now-deferred, now-caught) throwing
    // callback ever runs.
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

    // `#finishClosing` now reports a throwing `onExitComplete` via
    // `globalThis.reportError` (see create-sliding-dialog-state.svelte.ts) —
    // the async equivalent of a DOM event listener's "reported, not
    // propagated to any caller" throw semantics. Stub it so this
    // intentional test exception doesn't surface as a real uncaught error
    // to the test runner, while still proving it WAS reported exactly once.
    const originalReportError = globalThis.reportError;
    const reportedErrors: unknown[] = [];
    globalThis.reportError = (error: unknown) => {
      reportedErrors.push(error);
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
          onExitComplete: () => {
            throw new Error('boom — a throwing consumer callback');
          },
        },
      });

      expect(document.body.style.overflow).toBe('hidden');
      const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
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

      // The native dialog is genuinely closed and body scroll is restored —
      // despite the consumer callback throwing — because `close()` runs
      // unconditionally before the deferred, now-caught callback.
      await waitFor(() => {
        expect(dialog.hasAttribute('open')).toBe(false);
      });
      expect(document.body.style.overflow).toBe('');
      await waitFor(() => {
        expect(reportedErrors).toHaveLength(1);
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      globalThis.reportError = originalReportError;
    }
  });
});
