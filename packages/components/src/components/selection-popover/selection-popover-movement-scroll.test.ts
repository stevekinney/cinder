/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { SelectionPopoverTestViewport } from './selection-popover-test-viewport';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');

afterEach(() => {
  cleanup();
  resetEscapeStack();
});

describe('SelectionPopover', () => {
  test('an external scroll dismisses even while the composer is focused', async () => {
    let closed = false;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onClose: () => {
          closed = true;
        },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const textarea = screen.getByRole('textbox', { name: 'Comment text' });
    textarea.focus();
    await fireEvent.scroll(window);

    expect(closed).toBe(true);
  });

  test.each(['scroll', 'resize'])(
    'a visual viewport %s dismisses a focused composer',
    async (eventType) => {
      let closed = false;
      const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
      const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');
      const visualViewport = new EventTarget();
      Object.defineProperties(visualViewport, {
        height: { value: window.innerHeight - 100 },
        scale: { value: 2 },
      });
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: visualViewport,
      });
      Object.defineProperty(navigator, 'virtualKeyboard', {
        configurable: true,
        value: { boundingRect: { height: 300 } },
      });

      try {
        render(SelectionPopover, {
          props: {
            id: 'selection-comment',
            open: true,
            position: { x: 120, y: 80 },
            onClose: () => {
              closed = true;
            },
          },
        });

        await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
        visualViewport.dispatchEvent(new Event(eventType));

        expect(closed).toBe(true);
      } finally {
        cleanup();
        if (originalVisualViewport) {
          Object.defineProperty(window, 'visualViewport', originalVisualViewport);
        } else {
          Reflect.deleteProperty(window, 'visualViewport');
        }
        if (originalVirtualKeyboard) {
          Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
        } else {
          Reflect.deleteProperty(navigator, 'virtualKeyboard');
        }
      }
    },
  );

  test('a keyboard-driven visual viewport scroll preserves the focused draft', async () => {
    let closed = false;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new SelectionPopoverTestViewport(window.innerHeight - 300);
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });

    try {
      render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80 },
          onClose: () => {
            closed = true;
          },
        },
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      const textarea = screen.getByRole('textbox', { name: 'Comment text' });
      await fireEvent.input(textarea, { target: { value: 'Keyboard pan draft' } });
      textarea.focus();

      visualViewport.dispatchEvent(new Event('scroll'));

      expect(closed).toBe(false);
      expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Keyboard pan draft');
    } finally {
      cleanup();
      if (originalVisualViewport) {
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      } else {
        Reflect.deleteProperty(window, 'visualViewport');
      }
    }
  });

  test('paired visual viewport movement events dismiss only once', async () => {
    let closeCount = 0;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new SelectionPopoverTestViewport(window.innerHeight - 100);
    visualViewport.scale = 2;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });

    try {
      render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80 },
          onClose: () => {
            closeCount += 1;
          },
        },
      });

      visualViewport.dispatchEvent(new Event('resize'));
      visualViewport.dispatchEvent(new Event('scroll'));

      expect(closeCount).toBe(1);
    } finally {
      cleanup();
      if (originalVisualViewport) {
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      } else {
        Reflect.deleteProperty(window, 'visualViewport');
      }
    }
  });

  test('focus-restoration scrolling does not request a second close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
    trigger.focus();

    let closeCount = 0;
    trigger.focus = () => {
      window.dispatchEvent(new Event('scroll'));
    };

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: false,
        position: { x: 120, y: 80 },
        onClose: () => {
          closeCount += 1;
        },
      },
    });

    try {
      await rerender({ open: true, position: { x: 120, y: 80 } });
      // Focus has to be inside the popover when Escape is pressed, otherwise
      // the restore short-circuits on "already focused" and the stubbed
      // scroll never fires — leaving this passing vacuously instead of
      // exercising the closeRequested latch it exists to pin.
      screen.getByRole('button', { name: 'Add comment' }).focus();
      await fireEvent.keyDown(screen.getByRole('toolbar', { name: 'Selection actions' }), {
        key: 'Escape',
      });

      expect(closeCount).toBe(1);
    } finally {
      trigger.remove();
    }
  });
});
