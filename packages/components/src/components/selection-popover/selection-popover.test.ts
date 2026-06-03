/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');

afterEach(() => cleanup());

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

  test('expands, submits trimmed comment text, and resets', async () => {
    const submitted: string[] = [];

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        oncommentsubmit: (body: string) => submitted.push(body),
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await fireEvent.input(screen.getByPlaceholderText('Add a comment...'), {
      target: { value: '  Please clarify this.  ' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }));

    expect(submitted).toEqual(['Please clarify this.']);
    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });

  test('Escape closes when collapsed and cancels when expanded', async () => {
    let closed = false;
    let canceled = false;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onclose: () => {
          closed = true;
        },
        oncancel: () => {
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
        oncommentsubmit: (body: string) => submitted.push(body),
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const textarea = screen.getByPlaceholderText('Add a comment...');
    await fireEvent.input(textarea, { target: { value: '  Looks good.  ' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', ...modifier });

    expect(submitted).toEqual(['Looks good.']);
    // The composer must be unmounted, not merely "trigger present alongside form".
    expect(screen.queryByPlaceholderText('Add a comment...')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });

  test('Escape from the focused textarea cancels the composer', async () => {
    let canceled = false;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        oncancel: () => {
          canceled = true;
        },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const textarea = screen.getByPlaceholderText('Add a comment...');
    textarea.focus();
    await fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(canceled).toBe(true);
    expect(screen.queryByPlaceholderText('Add a comment...')).toBeNull();
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
        oncancel: () => {
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

    // The consumer's onclose handler subsequently flips `open` to false; because
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
        oncommentsubmit: (body: string) => submitted.push(body),
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await fireEvent.input(screen.getByPlaceholderText('Add a comment...'), {
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

  test('outside pointerdown on an element outside the popover closes it (attachment wiring)', async () => {
    // Verifies the {@attach dismissOnOutsidePointerdown} is correctly wired — a pointerdown
    // outside the popover element calls closePopover (which calls onclose). If the attachment
    // is missing or attached to the wrong node, this test will fail because onclose never fires.
    let closed = false;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onclose: () => {
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

    const { container } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onclose: () => {
          closed = true;
        },
      },
    });

    // Fire a pointerdown from inside the popover panel.
    const panel = container.querySelector('.cinder-selection-popover');
    expect(panel).not.toBeNull();
    panel!.dispatchEvent(new (globalThis.PointerEvent ?? Event)('pointerdown', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(closed).toBe(false);
  });
});
