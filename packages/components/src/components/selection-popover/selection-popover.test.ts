/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
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
      visualViewport.dispatchEvent(new Event('resize'));

      expect(closed).toBe(false);
      expect((textarea as HTMLTextAreaElement).value).toBe('Paired keyboard draft');
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
    await fireEvent.scroll(window);

    expect(focusOptions).toEqual({ preventScroll: true });
    trigger.remove();
  });
});
