/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
  autoUpdate: autoUpdateSpy,
  computePosition: computePositionSpy,
  flip: () => ({ name: 'flip', fn: () => ({}) }),
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
    ).toThrow(/must be used within a ContextMenu/);
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
    const region = container.querySelector('.cinder-context-menu-trigger') as HTMLElement;
    expect(screen.queryByRole('menu')).toBeNull();

    await fireEvent.keyDown(region, { key: 'F10', shiftKey: true });

    const menu = await screen.findByRole('menu');
    expect(menu).not.toBeNull();
    expect(menu.getAttribute('aria-orientation')).toBe('vertical');
  });
});
