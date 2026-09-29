/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import { flushSync } from 'svelte';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');
const { default: RuntimeSelectionPopover } =
  await import('./selection-popover-javascript-consumer.svelte');
const { pushEscapeHandler, resetEscapeStack } = await import('../../_internal/overlay.ts');

afterEach(() => {
  cleanup();
  resetEscapeStack();
});

describe('SelectionPopover', () => {
  test('renders the collapsed selection action when open', () => {
    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
      },
    });

    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });

  test('does not activate open behavior when position is omitted at runtime', async () => {
    let closed = false;

    render(RuntimeSelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        onClose: () => {
          closed = true;
        },
      },
    });

    const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' });
    expect(toolbar.getAttribute('data-cinder-position-ready')).toBe('false');

    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    outside.dispatchEvent(new (globalThis.PointerEvent ?? Event)('pointerdown', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(closed).toBe(false);
    outside.remove();
  });

  test('expands, submits trimmed comment text, and resets', async () => {
    const submitted: string[] = [];

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onCommentSubmit: (body: string) => submitted.push(body),
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'Comment text' }), {
      target: { value: '  Please clarify this.  ' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }));

    expect(submitted).toEqual(['Please clarify this.']);
    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });

  test('expanding focuses the composer without scrolling the page', async () => {
    const originalFocus = HTMLTextAreaElement.prototype.focus;
    let focusOptions: FocusOptions | undefined;
    HTMLTextAreaElement.prototype.focus = function (options?: FocusOptions): void {
      focusOptions = options;
      originalFocus.call(this, options);
    };

    try {
      render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80 },
        },
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      flushSync();
      expect(document.activeElement).toBe(screen.getByRole('textbox'));

      expect(focusOptions).toEqual({ preventScroll: true });
    } finally {
      HTMLTextAreaElement.prototype.focus = originalFocus;
    }
  });

  test('cancelling the composer restores focus without scrolling and stays open', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
    trigger.focus();

    let focusOptions: FocusOptions | undefined;
    trigger.focus = (options?: FocusOptions) => {
      focusOptions = options;
    };

    try {
      render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80 },
        },
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(focusOptions).toEqual({ preventScroll: true });
      expect(screen.getByRole('toolbar', { name: 'Selection actions' })).not.toBeNull();
    } finally {
      trigger.remove();
    }
  });

  test('submitting the composer restores focus without scrolling and stays open', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
    trigger.focus();

    let focusOptions: FocusOptions | undefined;
    trigger.focus = (options?: FocusOptions) => {
      focusOptions = options;
    };

    try {
      render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80 },
          onCommentSubmit: () => {},
        },
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
      await fireEvent.input(screen.getByRole('textbox', { name: 'Comment text' }), {
        target: { value: 'Looks good.' },
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }));

      expect(focusOptions).toEqual({ preventScroll: true });
      expect(screen.getByRole('toolbar', { name: 'Selection actions' })).not.toBeNull();
    } finally {
      trigger.remove();
    }
  });

  test('Escape closes when collapsed and cancels when expanded', async () => {
    let closed = false;
    let canceled = false;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onClose: () => {
          closed = true;
        },
        onCancel: () => {
          canceled = true;
        },
      },
    });

    const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' });
    await fireEvent.keyDown(toolbar, { key: 'Escape' });
    expect(closed).toBe(true);

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await fireEvent.keyDown(toolbar, { key: 'Escape' });
    expect(canceled).toBe(true);
  });

  test('holds a pushEscapeHandler registration while open and releases it when close begins', async () => {
    let parentEscapeCount = 0;
    const releaseParent = pushEscapeHandler(() => {
      parentEscapeCount += 1;
    });

    try {
      const { rerender } = render(SelectionPopover, {
        props: { id: 'selection-comment', open: true, position: { x: 120, y: 80 } },
      });

      const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' });
      const escapeEvent = new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      toolbar.dispatchEvent(escapeEvent);
      expect(escapeEvent.defaultPrevented).toBe(true);
      expect(parentEscapeCount).toBe(0);

      // Release timing (CIN-428): released when close BEGINS — the very next
      // render that flips `open` false — not after any exit transition.
      await rerender({ open: false, position: { x: 120, y: 80 } });

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(parentEscapeCount).toBe(1);
    } finally {
      releaseParent();
    }
  });

  test('with the popover open above another stack registration, Escape dismisses only the popover', async () => {
    let parentEscapeCount = 0;
    let closed = false;
    const releaseParent = pushEscapeHandler(() => {
      parentEscapeCount += 1;
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

      const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' });
      const escapeEvent = new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      toolbar.dispatchEvent(escapeEvent);

      expect(escapeEvent.defaultPrevented).toBe(true);
      expect(closed).toBe(true);
      expect(parentEscapeCount).toBe(0);
    } finally {
      releaseParent();
    }
  });

  test('Escape dismisses the popover with focus outside its DOM tree', async () => {
    // New, intended behavior (CIN-428): the escape-stack registration fires
    // regardless of focus location, unlike the deleted local onkeydown branch.
    let closed = false;
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    outside.focus();

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

      expect(document.activeElement).toBe(outside);
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(closed).toBe(true);
    } finally {
      outside.remove();
    }
  });

  test.each([
    { label: 'Cmd+Enter', modifier: { metaKey: true } },
    { label: 'Ctrl+Enter', modifier: { ctrlKey: true } },
  ])('$label submits the comment and collapses the composer', async ({ modifier }) => {
    const submitted: string[] = [];

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onCommentSubmit: (body: string) => submitted.push(body),
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const textarea = screen.getByRole('textbox', { name: 'Comment text' });
    await fireEvent.input(textarea, { target: { value: '  Looks good.  ' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', ...modifier });

    expect(submitted).toEqual(['Looks good.']);
    // The composer must be unmounted, not merely "trigger present alongside form".
    expect(screen.queryByRole('textbox', { name: 'Comment text' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });
});
