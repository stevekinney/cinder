/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';

setupHappyDom();

// ContextMenu positions its menu through floating-ui; stub it so opening the
// menu does not depend on real layout (matches context-menu.test.ts).
const computePositionSpy = mock(async () => ({ x: 32, y: 48, placement: 'right-start' }));
const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock((_reference: unknown, _menu: HTMLElement, update: () => void) => {
  update();
  return autoUpdateTeardown;
});

mock.module('@floating-ui/dom', () => ({
  arrow: () => ({ name: 'arrow', fn: () => ({}) }),
  autoUpdate: autoUpdateSpy,
  computePosition: computePositionSpy,
  flip: () => ({ name: 'flip', fn: () => ({}) }),
  offset: (options: unknown) => ({ name: 'offset', options, fn: () => ({}) }),
  shift: (options: unknown) => ({ name: 'shift', options, fn: () => ({}) }),
}));

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: Harness } = await import('../context-menu/_context-menu-test-harness.svelte');
const { default: ContextMenuTrigger } = await import('./context-menu-trigger.svelte');

afterEach(() => cleanup());

describe('ContextMenuTrigger', () => {
  test('throws when rendered outside a ContextMenu', () => {
    expect(() =>
      render(ContextMenuTrigger, {
        props: {
          children: createRawSnippet(() => ({ render: () => '<span>x</span>', setup: () => {} })),
        },
      }),
    ).toThrow();
  });

  test('renders a trigger region wrapping its child content', () => {
    const { container } = render(Harness);
    const region = container.querySelector('.cinder-context-menu-trigger');
    expect(region).not.toBeNull();
    expect(region?.querySelector('.context-menu-button')?.textContent).toContain('File one.txt');
  });

  test('a contextmenu event on the trigger opens the menu', async () => {
    const { container } = render(Harness);
    const region = container.querySelector('.cinder-context-menu-trigger') as HTMLElement;
    expect(document.body.querySelector('[role="menu"]')).toBeNull();

    await fireEvent.contextMenu(region, { clientX: 12, clientY: 18 });

    await waitFor(() => {
      expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    });
  });

  // Keyboard accessibility: a keyboard-only user opens the same context menu
  // with Shift+F10 (the platform-standard context-menu key combination). The
  // trigger handles keydown and calls openAt, which renders the menu with
  // role="menu" — so this asserts both the keyboard wiring and the ARIA role
  // the trigger exposes its menu through.
  test('Shift+F10 on the trigger opens the menu (role="menu")', async () => {
    const { container } = render(Harness);
    expect(screen.queryByRole('menu')).toBeNull();

    // Fire from a genuinely keyboard-reachable element: the trigger wrapper has no
    // tabindex/role of its own, so a real keyboard user focuses the focusable child
    // (the button) and the Shift+F10 keydown bubbles up to the trigger's handler.
    const triggerButton = container.querySelector('.context-menu-button') as HTMLElement;
    triggerButton.focus();
    expect(document.activeElement).toBe(triggerButton);

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F10', shiftKey: true });

    const menu = await screen.findByRole('menu');
    expect(menu).not.toBeNull();
    expect(menu.getAttribute('aria-orientation')).toBe('vertical');
  });

  // Regression test: handlePointerdown schedules longPressTimer when the pointer
  // type is "touch". onDestroy must call clearLongPress() so the timer does not
  // outlive the component. Use a very large longPressDelay so the timer is still
  // pending at the moment unmount() is called.
  test('unmounting after a touch pointerdown leaves no pending long-press timer', () => {
    const timers = trackTimers();
    try {
      const { container, unmount } = render(Harness, { longPressDelay: 60_000 });
      const region = container.querySelector('.cinder-context-menu-trigger') as HTMLElement;

      // A touch pointerdown is the exact event that schedules longPressTimer
      // (handlePointerdown guards on event.pointerType === 'touch').
      fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 50, clientY: 50 });

      // Unmount before the 60-second timer fires — onDestroy must clear it.
      unmount();
      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });
});
