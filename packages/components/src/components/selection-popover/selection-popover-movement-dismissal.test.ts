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
      const visualViewport = new SelectionPopoverTestViewport(window.innerHeight);
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
        expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Visual viewport draft');
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
    const visualViewport = new SelectionPopoverTestViewport(window.innerHeight);
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
});
