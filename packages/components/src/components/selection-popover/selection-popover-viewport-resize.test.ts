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
    expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Mobile draft');
    expect(document.activeElement).toBe(textarea);
  });

  test('a focused height-only resize preserves the soft-keyboard draft', async () => {
    let closed = false;
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new SelectionPopoverTestViewport(originalInnerHeight);
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
      expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Keyboard draft');

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
      expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Keyboard draft');
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
    const visualViewport = new SelectionPopoverTestViewport(originalInnerHeight);
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
      expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Layout keyboard draft');

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
    const visualViewport = new SelectionPopoverTestViewport(originalInnerHeight);
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
      expect(requiredInstance(textarea, HTMLTextAreaElement).value).toBe('Paired keyboard draft');

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
});
