/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { stripCinderComponentsLayer } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');

afterEach(() => cleanup());

async function readSelectionPopoverCss(): Promise<string> {
  // Strip the @layer wrapper: happy-dom does not apply layer-nested rules to
  // getComputedStyle, so string-extraction assertions read the raw source
  // instead of relying on the cascade.
  return stripCinderComponentsLayer(
    await Bun.file(new URL('./selection-popover.css', import.meta.url)).text(),
  );
}

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

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        onClose: () => {
          closed = true;
        },
      } as never,
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
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox')));

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
    expect((textarea as HTMLTextAreaElement).value).toBe('Draft comment');
  });

  test('a viewport resize while the composer is focused preserves its draft', async () => {
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
    await fireEvent.input(textarea, { target: { value: 'Mobile draft' } });
    textarea.focus();
    await fireEvent(window, new Event('resize'));

    expect(closed).toBe(false);
    expect((textarea as HTMLTextAreaElement).value).toBe('Mobile draft');
    expect(document.activeElement).toBe(textarea);
  });

  test('a focused height-only resize preserves the soft-keyboard draft', async () => {
    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new EventTarget() as EventTarget & { height: number; scale: number };
    visualViewport.height = originalInnerHeight;
    visualViewport.scale = 1;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
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
    await fireEvent.input(textarea, { target: { value: 'Keyboard draft' } });
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
      visualViewport.height = originalInnerHeight - 100;
      await fireEvent(window, new Event('resize'));

      expect(closed).toBe(false);
      expect((textarea as HTMLTextAreaElement).value).toBe('Keyboard draft');

      Object.defineProperty(navigator, 'virtualKeyboard', {
        configurable: true,
        value: { boundingRect: { height: 0 } },
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      visualViewport.height = originalInnerHeight;
      await fireEvent(window, new Event('resize'));

      expect(closed).toBe(false);
      expect((textarea as HTMLTextAreaElement).value).toBe('Keyboard draft');
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      if (originalVisualViewport)
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      else Reflect.deleteProperty(window, 'visualViewport');
      if (originalVirtualKeyboard) {
        Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
      } else {
        Reflect.deleteProperty(navigator, 'virtualKeyboard');
      }
    }
  });

  test('a layout-keyboard height resize preserves the draft without the virtual keyboard API', async () => {
    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new EventTarget() as EventTarget & { height: number; scale: number };
    visualViewport.height = originalInnerHeight;
    visualViewport.scale = 1;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
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
    await fireEvent.input(textarea, { target: { value: 'Layout keyboard draft' } });
    textarea.focus();

    try {
      Reflect.deleteProperty(navigator, 'virtualKeyboard');
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight - 100,
      });
      visualViewport.height = originalInnerHeight - 100;
      await fireEvent(window, new Event('resize'));
      expect(closed).toBe(false);
      expect((textarea as HTMLTextAreaElement).value).toBe('Layout keyboard draft');

      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      visualViewport.height = originalInnerHeight;
      await fireEvent(window, new Event('resize'));
      expect(closed).toBe(false);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      if (originalVisualViewport)
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      else Reflect.deleteProperty(window, 'visualViewport');
      if (originalVirtualKeyboard)
        Object.defineProperty(navigator, 'virtualKeyboard', originalVirtualKeyboard);
    }
  });

  test('paired window and visual viewport keyboard resizes preserve the draft', async () => {
    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new EventTarget() as EventTarget & { height: number; scale: number };
    visualViewport.height = originalInnerHeight;
    visualViewport.scale = 1;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });

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
    await fireEvent.input(textarea, { target: { value: 'Paired keyboard draft' } });
    textarea.focus();

    try {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight - 100,
      });
      visualViewport.height = originalInnerHeight - 100;
      await fireEvent(window, new Event('resize'));
      await fireEvent.scroll(window);
      visualViewport.dispatchEvent(new Event('resize'));
      visualViewport.dispatchEvent(new Event('scroll'));

      expect(closed).toBe(false);
      expect((textarea as HTMLTextAreaElement).value).toBe('Paired keyboard draft');

      await new Promise((resolve) => setTimeout(resolve, 0));
      await fireEvent.scroll(window);
      expect(closed).toBe(true);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      if (originalVisualViewport) {
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      } else {
        Reflect.deleteProperty(window, 'visualViewport');
      }
    }
  });

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
      expect((textarea as HTMLTextAreaElement).value).toBe('Blurred keyboard draft');
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
    const visualViewport = new EventTarget() as EventTarget & { height: number; scale: number };
    visualViewport.height = window.innerHeight - 300;
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

  test('tabbing to a real destination outside the popover keeps focus there through a later movement dismissal', async () => {
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

    const outside = document.createElement('button');
    outside.textContent = 'Somewhere else';
    document.body.append(outside);

    try {
      // The user tabs out of the toolbar to a real destination outside the
      // popover.
      outside.focus();
      expect(document.activeElement).toBe(outside);

      // A later scroll dismisses the popover, but must not steal focus back
      // to wherever it was before the popover opened.
      await fireEvent.scroll(window);

      expect(closed).toBe(true);
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });

  test.each([
    { focusState: 'focused', blurBeforeClose: false },
    { focusState: 'just blurred', blurBeforeClose: true },
  ])(
    'closing the visual-viewport keyboard preserves a $focusState draft',
    async ({ blurBeforeClose }) => {
      let closed = false;
      const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
      const visualViewport = new EventTarget() as EventTarget & {
        height: number;
        scale: number;
      };
      visualViewport.height = window.innerHeight;
      visualViewport.scale = 1;
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
        await fireEvent.input(textarea, { target: { value: 'Visual viewport draft' } });
        textarea.focus();

        visualViewport.height = window.innerHeight - 300;
        visualViewport.dispatchEvent(new Event('resize'));
        expect(closed).toBe(false);

        if (blurBeforeClose) textarea.blur();
        visualViewport.height = window.innerHeight;
        visualViewport.dispatchEvent(new Event('resize'));
        visualViewport.dispatchEvent(new Event('scroll'));

        expect(closed).toBe(false);
        expect((textarea as HTMLTextAreaElement).value).toBe('Visual viewport draft');
      } finally {
        cleanup();
        if (originalVisualViewport) {
          Object.defineProperty(window, 'visualViewport', originalVisualViewport);
        } else {
          Reflect.deleteProperty(window, 'visualViewport');
        }
      }
    },
  );

  test('an external visual-viewport keyboard close dismisses a collapsed popover', async () => {
    let closed = false;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const externalInput = document.createElement('input');
    document.body.append(externalInput);
    const visualViewport = new EventTarget() as EventTarget & {
      height: number;
      scale: number;
    };
    visualViewport.height = window.innerHeight;
    visualViewport.scale = 1;
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
      textarea.focus();
      visualViewport.height = window.innerHeight - 300;
      visualViewport.dispatchEvent(new Event('resize'));
      expect(closed).toBe(false);

      await fireEvent.keyDown(textarea, { key: 'Escape' });
      externalInput.focus();
      visualViewport.height = window.innerHeight;
      visualViewport.dispatchEvent(new Event('resize'));

      expect(closed).toBe(true);
    } finally {
      cleanup();
      externalInput.remove();
      if (originalVisualViewport) {
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      } else {
        Reflect.deleteProperty(window, 'visualViewport');
      }
    }
  });

  test('a desktop height-only resize dismisses while the composer is focused', async () => {
    let closed = false;
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

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const textarea = screen.getByRole('textbox', { name: 'Comment text' });
    textarea.focus();
    try {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight + 100,
      });

      await fireEvent(window, new Event('resize'));

      expect(closed).toBe(true);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  test('a genuine window resize dismisses while the composer is focused', async () => {
    let closed = false;
    const originalInnerWidth = window.innerWidth;

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
    try {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth + 100,
      });

      await fireEvent(window, new Event('resize'));

      expect(closed).toBe(true);
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

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
    const visualViewport = new EventTarget() as EventTarget & {
      height: number;
      scale: number;
    };
    visualViewport.height = window.innerHeight - 300;
    visualViewport.scale = 1;
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
      expect((textarea as HTMLTextAreaElement).value).toBe('Keyboard pan draft');
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
    const visualViewport = new EventTarget() as EventTarget & {
      height: number;
      scale: number;
    };
    visualViewport.height = window.innerHeight - 100;
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

  test('survives the drag-select gesture that opened it, even when the browser autoscrolls mid-drag', async () => {
    // Regression test for issue E: SelectionPopover dismissed itself
    // immediately after opening. The real mechanism is that a drag-select
    // gesture reaching the viewport edge triggers the browser's native
    // autoscroll-while-selecting behavior — confirmed with a real Chromium
    // Playwright repro (packages/testing/tests/selection-popover-drag-
    // dismissal.playwright.ts) — which fires real `scroll` events on
    // `window` WHILE the pointer button is still held, i.e. as part of the
    // very selection gesture that is opening this popover. This test
    // reproduces that exact event sequence — pointerdown, scroll bursts
    // while held, pointerup — mirroring the consumer wiring in
    // selection-popover.examples.json (open flips true via selectionchange
    // mid-drag), and asserts the popover does not self-dismiss.
    let closed = false;

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

    // The pointer goes down to begin the drag-select — this happens BEFORE
    // the popover opens, exactly like a real drag-select: pointer tracking
    // must already be live at mount, not start only once the popover opens.
    await fireEvent.pointerDown(window);

    // Partway through the drag, the consumer's selectionchange handler sees
    // a non-collapsed selection and opens the popover (this is the false ->
    // true transition selection-popover.examples.json performs).
    await rerender({
      open: true,
      position: { x: 120, y: 80 },
      onClose: () => {
        closed = true;
      },
    });

    // The drag continues toward the viewport edge; the browser autoscrolls,
    // firing a burst of real `scroll` events while the pointer is still down.
    await fireEvent.scroll(window);
    await fireEvent.scroll(window);
    await fireEvent.scroll(window);

    expect(closed).toBe(false);
    expect(screen.getByRole('toolbar', { name: 'Selection actions' })).not.toBeNull();

    // The gesture ends.
    await fireEvent.pointerUp(window);
    expect(closed).toBe(false);

    // A later, genuinely external scroll (the user scrolling away after the
    // selection is done) must still dismiss normally.
    await fireEvent.scroll(window);
    expect(closed).toBe(true);
  });

  test('movement dismissal restores focus without scrolling the prior focus owner', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
    trigger.focus();

    let focusOptions: FocusOptions | undefined;
    trigger.focus = (options?: FocusOptions) => {
      focusOptions = options;
    };

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: false,
        position: { x: 120, y: 80 },
      },
    });

    await rerender({ open: true, position: { x: 120, y: 80 } });
    // Move focus onto the collapsed action first — the realistic sequence, and
    // the one that leaves something to restore. The resulting `focusin` targets
    // a node inside the panel, so the virtual-keyboard listener early-returns
    // and the remembered pre-open owner survives.
    screen.getByRole('button', { name: 'Add comment' }).focus();
    await fireEvent.scroll(window);

    expect(focusOptions).toEqual({ preventScroll: true });
    trigger.remove();
  });

  test('a consumer-passed inert=false cannot defeat the closing-state inert/aria-hidden (CIN-376)', async () => {
    // Regression guard: {...rest} used to trail every internal attribute, so
    // a consumer's own `inert`/`aria-hidden` prop would win over the
    // component-owned closing semantics. These two are lifecycle state the
    // component owns, not something a consumer prop should be able to cancel.
    //
    // Stub a real (non-zero) transition duration so `waitForTransitionCompletion`
    // takes its transitionend-listening path instead of resolving on the next
    // microtask — this is the only way to observe the intermediate
    // "closing but still mounted" state before `await rerender` itself
    // yields the microtask queue.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-selection-popover')) {
        return {
          transitionProperty: 'opacity, scale',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      const { rerender } = render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80 },
          inert: false,
          'aria-hidden': 'false',
        } as never,
      });

      const toolbar = document.querySelector('.cinder-selection-popover') as HTMLElement;
      expect(toolbar.hasAttribute('inert')).toBe(false);

      await rerender({
        open: false,
        position: null,
        inert: false,
        'aria-hidden': 'false',
      } as never);

      expect(toolbar.hasAttribute('inert')).toBe(true);
      expect(toolbar.getAttribute('aria-hidden')).toBe('true');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('the retained anchor rect stays stable after position clears (CIN-376)', async () => {
    // Regression guard: the snapshot used to copy `virtualAnchor`'s wrapper
    // object, whose `getBoundingClientRect` closure reads `position.x`/`.y`
    // live — so once `position` went `null`, the "frozen" anchor's rect
    // would actually read through to the now-null `position` instead of
    // staying at its last real coordinates.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-selection-popover')) {
        return {
          transitionProperty: 'opacity, scale',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      const { rerender } = render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80, height: 20 },
        },
      });

      const toolbar = document.querySelector('.cinder-selection-popover') as HTMLElement;
      await waitFor(() => {
        expect(toolbar.getAttribute('data-cinder-position-ready')).toBe('true');
      });
      const styleBeforeClose = toolbar.getAttribute('style');
      expect(styleBeforeClose).toBeTruthy();

      await rerender({ open: false, position: null });

      // Still mid-exit (the stubbed 80ms transition hasn't fired
      // `transitionend` yet).
      expect(toolbar.hasAttribute('data-cinder-closing')).toBe(true);

      // `anchoredOverlay`'s `open()` gate is keyed off `exitState.renderPanel`
      // (already `true` in this same render, unlike `isClosing` which only
      // flips in a later `$effect`), so it never takes its `!open()` reset
      // branch, and `virtualAnchor` now returns the exact same object
      // reference across this transition (see its own definition) instead of
      // switching to a differently-constructed snapshot. A narrower gap
      // remains even so: `open()`'s closure also reads `isPositionedOpen`,
      // a `$derived` that DOES recompute when `position`/`open` change —
      // Svelte still reruns `anchored-overlay.svelte.ts`'s positioning
      // effect whenever any of its tracked reads is invalidated, regardless
      // of whether the closure's overall boolean/anchor OUTPUT stayed the
      // same, so it still tears down and rebuilds once. Poll for it to
      // settle, then assert it converges back to the exact pre-close rect
      // (not an unpositioned fallback) — this is what "doesn't jump
      // mid-fade" means in practice: a live read through to the now-null
      // `position` would instead settle on `left: 0px; top: 0px;` (or an
      // empty style), never the original coordinates.
      await waitFor(() => {
        expect(toolbar.getAttribute('style')).toBe(styleBeforeClose);
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('stays hidden from the tab order until positioning is ready, exempting the closing state (CIN-376)', async () => {
    // Regression guard: `data-cinder-visible` (driven by
    // `exitState.renderPanel`) turns on as soon as the panel starts opening —
    // BEFORE Floating UI has set `data-cinder-position-ready='true'`. Gating
    // `visibility` on `data-cinder-visible` alone (as an earlier revision of
    // this migration did) removed the old `visibility: hidden` protection
    // during that positioning window: the toolbar stayed opacity:0/
    // pointer-events:none, but its buttons were still keyboard-focusable and
    // exposed to assistive technology. An initially-open SSR render has the
    // same invisible-interactive gap for the same reason. `[data-cinder-closing]`
    // is exempted so the retained exit stays visible even if it happens to
    // race positioning.
    const css = await readSelectionPopoverCss();
    expect(css).toMatch(
      /\.cinder-selection-popover:not\(\[data-cinder-position-ready='true'\]\):not\(\[data-cinder-closing\]\)\s*\{\s*visibility:\s*hidden;/,
    );

    // Behavioral half: before Floating UI resolves, `data-cinder-visible` is
    // already present (renderPanel mirrors `open` immediately) while
    // `data-cinder-position-ready` is still `'false'` and the panel isn't
    // closing — exactly the state the CSS rule above must key off instead of
    // `data-cinder-visible` alone.
    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
      },
    });

    const toolbar = document.querySelector('.cinder-selection-popover') as HTMLElement;
    expect(toolbar.getAttribute('data-cinder-visible')).toBe('');
    expect(toolbar.getAttribute('data-cinder-position-ready')).toBe('false');
    expect(toolbar.hasAttribute('data-cinder-closing')).toBe(false);
  });
});
