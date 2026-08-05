/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render, fireEvent } = await import('@testing-library/svelte');
const { default: VirtualKeyboardDismissalFixture } =
  await import('../../test/fixtures/virtual-keyboard-dismissal-fixture.svelte');

afterEach(cleanup);

/**
 * Simulates the on-screen keyboard reporting itself open (`height > 0`) or
 * closed (`height === 0`) via the `navigator.virtualKeyboard` API — the same
 * deterministic signal `selection-popover.test.ts` uses for its full-mount
 * equivalents of these scenarios.
 */
function setVirtualKeyboardHeight(height: number): void {
  Object.defineProperty(navigator, 'virtualKeyboard', {
    configurable: true,
    value: { boundingRect: { height } },
  });
}

describe('createVirtualKeyboardDismissal', () => {
  test('fires the dismiss callback on a visualViewport resize/scroll sequence consistent with the on-screen keyboard opening then closing, when nothing owns it', async () => {
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new EventTarget() as EventTarget & { scale: number };
    visualViewport.scale = 1;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });

    const dismissCalls: boolean[] = [];
    render(VirtualKeyboardDismissalFixture, {
      props: {
        onDismiss: (preventScroll: boolean) => dismissCalls.push(preventScroll),
      },
    });

    try {
      // The textarea never receives focus in this test — the composer is
      // not "in use," so a keyboard transition it didn't request should
      // dismiss the popover, not be swallowed.
      setVirtualKeyboardHeight(300);
      visualViewport.dispatchEvent(new Event('resize'));
      expect(dismissCalls).toEqual([true]);

      setVirtualKeyboardHeight(0);
      visualViewport.dispatchEvent(new Event('scroll'));
      expect(dismissCalls).toEqual([true, true]);
    } finally {
      if (originalVirtualKeyboard) {
        Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
      } else {
        Reflect.deleteProperty(navigator, 'virtualKeyboard');
      }
      if (originalVisualViewport) {
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      } else {
        Reflect.deleteProperty(window, 'visualViewport');
      }
    }
  });

  test('does not fire on a visualViewport resize/scroll sequence consistent with the composer itself owning the on-screen keyboard (real focus inside the panel)', async () => {
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new EventTarget() as EventTarget & { scale: number };
    visualViewport.scale = 1;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });

    const dismissCalls: boolean[] = [];
    const { getByTestId } = render(VirtualKeyboardDismissalFixture, {
      props: {
        onDismiss: (preventScroll: boolean) => dismissCalls.push(preventScroll),
      },
    });

    try {
      // Real DOM focus inside the panel is what `composerForm?.contains(document.activeElement)`
      // reads — this is the "the user is actively typing" signal, distinct
      // from an unrelated/external viewport movement.
      const textarea = getByTestId('textarea');
      (textarea as HTMLTextAreaElement).focus();

      setVirtualKeyboardHeight(300);
      visualViewport.dispatchEvent(new Event('resize'));
      setVirtualKeyboardHeight(0);
      visualViewport.dispatchEvent(new Event('scroll'));

      expect(dismissCalls).toEqual([]);
    } finally {
      if (originalVirtualKeyboard) {
        Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
      } else {
        Reflect.deleteProperty(navigator, 'virtualKeyboard');
      }
      if (originalVisualViewport) {
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      } else {
        Reflect.deleteProperty(window, 'visualViewport');
      }
    }
  });

  test('ignores a window scroll that arrives while a pointer is still held, then dismisses once released', async () => {
    // Regression test for issue E: a drag-select gesture that reaches the
    // viewport edge triggers the browser's native autoscroll-while-selecting
    // behavior, which fires real `window` `scroll` events WHILE the pointer
    // button is still down — before the gesture that opened the popover has
    // finished. Without the pointer-down gate, that self-produced scroll was
    // indistinguishable from the user scrolling away afterward, so the
    // popover dismissed itself the instant it opened.
    const dismissCalls: boolean[] = [];
    render(VirtualKeyboardDismissalFixture, {
      props: {
        onDismiss: (preventScroll: boolean) => dismissCalls.push(preventScroll),
      },
    });

    // The pointer goes down (drag-select begins) and the browser's
    // autoscroll fires a burst of scroll events while it is still held.
    await fireEvent.pointerDown(window);
    await fireEvent.scroll(window);
    await fireEvent.scroll(window);
    await fireEvent.scroll(window);

    expect(dismissCalls).toEqual([]);

    // The gesture ends — the pointer is released.
    await fireEvent.pointerUp(window);

    // A later, genuinely external scroll must still dismiss normally.
    await fireEvent.scroll(window);

    expect(dismissCalls).toEqual([true]);
  });

  test('ignores a window scroll while a pointer is held even after pointercancel resumes tracking', async () => {
    const dismissCalls: boolean[] = [];
    render(VirtualKeyboardDismissalFixture, {
      props: {
        onDismiss: (preventScroll: boolean) => dismissCalls.push(preventScroll),
      },
    });

    await fireEvent.pointerDown(window);
    await fireEvent.scroll(window);
    expect(dismissCalls).toEqual([]);

    // A cancelled gesture (e.g. the browser takes over for a system gesture)
    // must release the latch just like pointerup does — otherwise every
    // future scroll would be silently swallowed forever.
    await fireEvent.pointerCancel(window);
    await fireEvent.scroll(window);

    expect(dismissCalls).toEqual([true]);
  });

  test('does nothing while disabled', async () => {
    const dismissCalls: boolean[] = [];
    render(VirtualKeyboardDismissalFixture, {
      props: {
        enabled: false,
        onDismiss: (preventScroll: boolean) => dismissCalls.push(preventScroll),
      },
    });

    await fireEvent(window, new Event('resize'));

    expect(dismissCalls).toEqual([]);
  });
});
