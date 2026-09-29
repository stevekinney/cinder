/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');

afterEach(() => {
  cleanup();
  resetEscapeStack();
});

describe('SelectionPopover', () => {
  test('Escape from the focused textarea cancels the composer', async () => {
    let canceled = false;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onCancel: () => {
          canceled = true;
        },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const textarea = screen.getByRole('textbox', { name: 'Comment text' });
    textarea.focus();
    await fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(canceled).toBe(true);
    expect(screen.queryByRole('textbox', { name: 'Comment text' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });

  test('restores focus to the prior element when closed externally via the open prop', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
      },
    });

    // The consumer flips `open` to false directly (not via cancel/submit/close).
    await rerender({ open: false, position: { x: 120, y: 80 } });

    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  test('does nothing on external close when no focus was captured', async () => {
    // Use a real focusable element so `document.activeElement` is deterministic.
    // `document.body.focus()` is unreliable in HappyDOM (body is not focusable
    // without tabindex), so focus may not move to body at all.
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.append(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        // Never opened — wasOpen latch is never set, so restoreFocus is never called.
        open: false,
        position: { x: 120, y: 80 },
      },
    });

    // Toggling the already-closed popover must not throw and must not steal focus.
    await rerender({ open: false, position: { x: 120, y: 80 } });

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  test('internal cancel restores focus exactly once and the external effect is a no-op', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
    trigger.focus();

    let focusCalls = 0;
    const originalFocus = trigger.focus.bind(trigger);
    trigger.focus = () => {
      focusCalls += 1;
      originalFocus();
    };

    let canceled = false;

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onCancel: () => {
          canceled = true;
        },
      },
    });

    // Expand so a focus owner is captured, then cancel internally.
    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(canceled).toBe(true);
    expect(focusCalls).toBe(1);
    expect(document.activeElement).toBe(trigger);

    // The consumer's onClose handler subsequently flips `open` to false; because
    // the internal cancel already restored (and nulled the ref), the open->false
    // effect's restore is a no-op — focus is not driven a second time.
    await rerender({ open: false, position: { x: 120, y: 80 } });

    expect(focusCalls).toBe(1);

    trigger.remove();
  });

  test('internal submit restores focus exactly once', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
    trigger.focus();

    let focusCalls = 0;
    const originalFocus = trigger.focus.bind(trigger);
    trigger.focus = () => {
      focusCalls += 1;
      originalFocus();
    };

    const submitted: string[] = [];

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onCommentSubmit: (body: string) => submitted.push(body),
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'Comment text' }), {
      target: { value: 'Ship it.' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }));

    expect(submitted).toEqual(['Ship it.']);
    expect(focusCalls).toBe(1);
    expect(document.activeElement).toBe(trigger);

    // External close after submit is idempotent — no second focus call.
    await rerender({ open: false, position: { x: 120, y: 80 } });
    expect(focusCalls).toBe(1);

    trigger.remove();
  });

  test('Escape without a prior expand restores focus to the pre-open owner', async () => {
    // Control case for the regression below: this path always worked, because
    // the remembered element was still unspent when the Escape arrived.
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
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
      const collapsedAction = screen.getByRole('button', { name: 'Add comment' });
      collapsedAction.focus();
      expect(document.activeElement).toBe(collapsedAction);

      await fireEvent.keyDown(screen.getByRole('toolbar', { name: 'Selection actions' }), {
        key: 'Escape',
      });

      expect(closed).toBe(true);
      expect(document.activeElement).toBe(trigger);
    } finally {
      trigger.remove();
    }
  });

  test('Escape after a cancel still restores focus to the pre-open owner', async () => {
    // Regression test for issue #1269: the remembered element used to be spent
    // by the first restore, so a cancel consumed it and the later Escape —
    // pressed from a control inside the still-mounted popover — restored
    // nothing, dropping focus on <body>.
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
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

      // The popover is still mounted, collapsed back to its icon. Focus moves
      // onto that control, which is where a keyboard user presses Escape from.
      const collapsedAction = screen.getByRole('button', { name: 'Add comment' });
      collapsedAction.focus();
      expect(document.activeElement).toBe(collapsedAction);

      await fireEvent.keyDown(screen.getByRole('toolbar', { name: 'Selection actions' }), {
        key: 'Escape',
      });

      expect(closed).toBe(true);
      expect(document.activeElement).toBe(trigger);
      expect(document.activeElement).not.toBe(document.body);
    } finally {
      trigger.remove();
    }
  });

  test('re-opening after an external close re-arms the focus memory', async () => {
    // The reference now survives a restore, so it MUST be released when the
    // popover closes — otherwise a second open would restore to the first
    // session's owner.
    const firstOwner = document.createElement('button');
    firstOwner.textContent = 'First owner';
    const secondOwner = document.createElement('button');
    secondOwner.textContent = 'Second owner';
    document.body.append(firstOwner, secondOwner);
    firstOwner.focus();

    const props = { id: 'selection-comment', position: { x: 120, y: 80 } };
    const { rerender } = render(SelectionPopover, { props: { ...props, open: true } });

    try {
      await rerender({ ...props, open: false });
      expect(document.activeElement).toBe(firstOwner);

      secondOwner.focus();
      await rerender({ ...props, open: true });
      screen.getByRole('button', { name: 'Add comment' }).focus();
      await rerender({ ...props, open: false });

      expect(document.activeElement).toBe(secondOwner);
    } finally {
      firstOwner.remove();
      secondOwner.remove();
    }
  });
});
