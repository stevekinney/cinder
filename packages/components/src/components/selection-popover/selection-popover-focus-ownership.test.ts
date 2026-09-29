/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
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
  test('an intervening event while the keyboard is still visible does not clear composer ownership', async () => {
    let closed = false;
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');
    const originalInnerHeight = window.innerHeight;

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

    try {
      // The soft keyboard opens while the composer is expanded and focused,
      // latching ownership to true.
      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      Object.defineProperty(navigator, 'virtualKeyboard', {
        configurable: true,
        value: { boundingRect: { height: 300 } },
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight - 100,
      });
      await fireEvent(window, new Event('resize'));
      expect(closed).toBe(false);

      // Cancel collapses the composer before the keyboard reports itself
      // hidden.
      await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // An intervening resize arrives while the keyboard is still (falsely)
      // reported visible, with the composer already collapsed. This must
      // not downgrade the latched ownership back to false.
      await fireEvent(window, new Event('resize'));
      expect(closed).toBe(false);

      // The keyboard's actual closing resize should still be recognized as
      // owned by the composer.
      Object.defineProperty(navigator, 'virtualKeyboard', {
        configurable: true,
        value: { boundingRect: { height: 0 } },
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      await fireEvent(window, new Event('resize'));

      expect(closed).toBe(false);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      if (originalVirtualKeyboard)
        Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
      else Reflect.deleteProperty(navigator, 'virtualKeyboard');
    }
  });

  test('moving focus to a real external destination is not re-owned by a stale expanded composer', async () => {
    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');
    const externalInput = document.createElement('input');
    document.body.append(externalInput);

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

    try {
      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      const textarea = screen.getByRole('textbox', { name: 'Comment text' });
      textarea.focus();

      // The soft keyboard opens while the composer is expanded and focused,
      // latching ownership to true.
      Object.defineProperty(navigator, 'virtualKeyboard', {
        configurable: true,
        value: { boundingRect: { height: 300 } },
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight - 100,
      });
      await fireEvent(window, new Event('resize'));
      expect(closed).toBe(false);

      // Keyboard navigation moves focus to a real external control WITHOUT
      // canceling the composer — `expanded` stays true, so ownership must
      // not simply be re-derived from that stale state.
      externalInput.focus();

      // A later resize while the keyboard is still reported visible must
      // not be re-claimed as composer-owned just because `expanded` is
      // still true; it belongs to whatever the user tabbed to.
      await fireEvent(window, new Event('resize'));

      expect(closed).toBe(true);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      if (originalVirtualKeyboard)
        Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
      else Reflect.deleteProperty(navigator, 'virtualKeyboard');
      externalInput.remove();
    }
  });

  test('focus genuinely returning to the composer lets it reclaim keyboard ownership', async () => {
    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');
    const externalInput = document.createElement('input');
    document.body.append(externalInput);

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

    try {
      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      const textarea = screen.getByRole('textbox', { name: 'Comment text' });
      await fireEvent.input(textarea, { target: { value: 'Reclaimed draft' } });
      textarea.focus();

      // The soft keyboard opens while the composer is expanded and focused.
      Object.defineProperty(navigator, 'virtualKeyboard', {
        configurable: true,
        value: { boundingRect: { height: 300 } },
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight - 100,
      });
      await fireEvent(window, new Event('resize'));
      expect(closed).toBe(false);

      // Focus briefly moves to an external control (e.g. an autofill
      // suggestion) and then genuinely returns to the composer, all while
      // the keyboard stays visible.
      externalInput.focus();
      textarea.focus();

      // A further event while still visible lets the composer re-establish
      // ownership now that it has focus again.
      await fireEvent(window, new Event('resize'));
      expect(closed).toBe(false);

      // Cancel collapses the composer before the keyboard reports itself
      // hidden — ownership must have survived the earlier round trip for
      // this to still work.
      await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      Object.defineProperty(navigator, 'virtualKeyboard', {
        configurable: true,
        value: { boundingRect: { height: 0 } },
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      await fireEvent(window, new Event('resize'));

      expect(closed).toBe(false);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      if (originalVirtualKeyboard)
        Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
      else Reflect.deleteProperty(navigator, 'virtualKeyboard');
      externalInput.remove();
    }
  });

  test('external keyboard movement dismisses after focus lands on collapsed action', async () => {
    let closed = false;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');
    const visualViewport = new SelectionPopoverTestViewport(window.innerHeight - 300);
    visualViewport.scale = 1;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });
    Object.defineProperty(navigator, 'virtualKeyboard', {
      configurable: true,
      value: { boundingRect: { height: 300 } },
    });

    const externalInput = document.createElement('input');
    document.body.append(externalInput);

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

      // An external input owns a keyboard that is already visible. Do not
      // dispatch a movement event here: that would itself be the dismissal
      // under test before focus reaches the collapsed action.
      externalInput.focus();

      // Switch navigation lands on the collapsed action inside the popover.
      // That control is not the composer and must not preserve external
      // keyboard movement as if the textarea still owned focus.
      screen.getByRole('button', { name: 'Add comment' }).focus();
      visualViewport.dispatchEvent(new Event('scroll'));

      expect(closed).toBe(true);
    } finally {
      cleanup();
      externalInput.remove();
      if (originalVisualViewport)
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      else Reflect.deleteProperty(window, 'visualViewport');
      if (originalVirtualKeyboard)
        Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
      else Reflect.deleteProperty(navigator, 'virtualKeyboard');
    }
  });
});
