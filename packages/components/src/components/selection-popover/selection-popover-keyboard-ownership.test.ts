/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');

afterEach(() => {
  cleanup();
  resetEscapeStack();
});

describe('SelectionPopover', () => {
  test('a closing window keyboard resize preserves a draft after blur', async () => {
    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');

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
    await fireEvent.input(textarea, { target: { value: 'Blurred keyboard draft' } });
    textarea.focus();

    try {
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

      textarea.blur();
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
      expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Blurred keyboard draft');
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

  test('canceling the composer before a closing keyboard resize keeps the popover open', async () => {
    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');

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
    await fireEvent.input(textarea, { target: { value: 'Cancelled draft' } });

    try {
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

      // Cancel collapses the composer and moves focus away synchronously,
      // before the keyboard's asynchronous closing resize arrives.
      await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('textbox', { name: 'Comment text' })).toBeNull();

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
      expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
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

  test('canceling and restoring focus to a real prior owner preserves keyboard ownership', async () => {
    const priorFocusOwner = document.createElement('button');
    priorFocusOwner.textContent = 'Prior focus owner';
    document.body.append(priorFocusOwner);
    priorFocusOwner.focus();

    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVirtualKeyboard = Object.getOwnPropertyDescriptor(navigator, 'virtualKeyboard');

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: false,
        position: { x: 120, y: 80 },
        onClose: () => {
          closed = true;
        },
      },
    });

    try {
      // The false -> true transition captures `priorFocusOwner` — a real
      // element outside the popover, unlike document.body — as the element
      // to restore focus to on close.
      await rerender({
        open: true,
        position: { x: 120, y: 80 },
        onClose: () => {
          closed = true;
        },
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      const textarea = screen.getByRole('textbox', { name: 'Comment text' });
      await fireEvent.input(textarea, { target: { value: 'Cancelled draft' } });

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

      // Cancel restores focus to the real pre-open owner, outside the
      // popover. Before the fix, the window `focusin` this produces was
      // mistaken for the user moving on, clearing keyboard ownership.
      await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(document.activeElement).toBe(priorFocusOwner);

      // The keyboard's asynchronous closing resize should still be
      // recognized as owned by the composer's in-flight keyboard close.
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
      priorFocusOwner.remove();
    }
  });

  test('a controlled consumer declining a close still allows a later dismissal', async () => {
    let closeCount = 0;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onClose: () => {
          closeCount += 1;
          // The consumer intentionally declines the close (e.g. shows a
          // confirmation) — `open` never transitions to false.
        },
      },
    });

    await fireEvent.keyDown(screen.getByRole('toolbar', { name: 'Selection actions' }), {
      key: 'Escape',
    });
    expect(closeCount).toBe(1);

    // Let the microtask queue flush so the latch releases.
    await Promise.resolve();
    await Promise.resolve();

    await fireEvent.keyDown(screen.getByRole('toolbar', { name: 'Selection actions' }), {
      key: 'Escape',
    });
    expect(closeCount).toBe(2);
  });
});
