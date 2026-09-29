/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');

afterEach(() => {
  cleanup();
  resetEscapeStack();
});

describe('SelectionPopover', () => {
  test('onExitComplete fires once the exit transition genuinely finishes, not immediately on close (CIN-376 round 20)', async () => {
    // Regression guard: lets a composing consumer (ReviewEditor's
    // `{#if showSelectionPopover}` was the concrete case) decouple its own
    // wrapping mount gate from the live `open` prop — without this
    // callback, that consumer's `{#if}` would destroy the whole
    // SelectionPopover instance the instant `open` flips false, before this
    // component's own retained-exit lifecycle (which never unmounts its own
    // root element while closing) ever gets a chance to run.
    const onExitComplete = mock(() => {});
    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onExitComplete,
      },
    });

    await rerender({ open: false, position: { x: 120, y: 80 }, onExitComplete });

    await waitFor(() => {
      expect(onExitComplete).toHaveBeenCalledTimes(1);
    });
  });

  test('a cancel followed by a real external focus move abandons restoration', async () => {
    // The surviving reference must still be abandoned when the user genuinely
    // moves on — onFocusMovedOutside clears it, so a later dismissal does not
    // steal focus back from wherever they went.
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    const outside = document.createElement('button');
    outside.textContent = 'Somewhere else';
    document.body.append(trigger, outside);
    trigger.focus();

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

    try {
      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(document.activeElement).toBe(trigger);

      outside.focus();
      await fireEvent.scroll(window);

      expect(closed).toBe(true);
      expect(document.activeElement).toBe(outside);
    } finally {
      trigger.remove();
      outside.remove();
    }
  });

  test('portals the toolbar to document.body', () => {
    const { container } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
      },
    });

    const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' });

    expect(toolbar.parentElement).toBe(document.body);
    expect(container.querySelector('.cinder-selection-popover')).toBeNull();
  });

  test('outside pointerdown on an element outside the popover closes it (attachment wiring)', async () => {
    // Verifies the {@attach dismissOnOutsidePointerdown} is correctly wired — a pointerdown
    // outside the popover element calls closePopover (which calls onClose). If the attachment
    // is missing or attached to the wrong node, this test will fail because onClose never fires.
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

    // Fire a pointerdown from a node that is not inside the popover.
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    outside.dispatchEvent(new (globalThis.PointerEvent ?? Event)('pointerdown', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(closed).toBe(true);
    outside.remove();
  });

  test('pointerdown inside the popover does NOT close it', async () => {
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

    // Fire a pointerdown from inside the popover panel.
    const panel = document.body.querySelector('.cinder-selection-popover');
    expect(panel).not.toBeNull();
    panel!.dispatchEvent(new (globalThis.PointerEvent ?? Event)('pointerdown', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(closed).toBe(false);
  });

  test('scrolling the expanded comment field preserves the draft and keeps the popover open', async () => {
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
    await fireEvent.input(textarea, { target: { value: 'Draft comment' } });
    textarea.dispatchEvent(new Event('scroll'));

    expect(closed).toBe(false);
    expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Draft comment');
  });
});
