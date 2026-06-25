/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const computePositionSpy = mock(async () => ({
  x: 32,
  y: 48,
  placement: 'right-start',
}));

const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock((_reference: unknown, _menu: HTMLElement, update: () => void) => {
  update();
  return autoUpdateTeardown;
});
const flipSpy = mock(() => ({ name: 'flip', fn: () => ({}) }));
const offsetSpy = mock((options: unknown) => ({ name: 'offset', options, fn: () => ({}) }));
const shiftSpy = mock((options: unknown) => ({ name: 'shift', options, fn: () => ({}) }));

mock.module('@floating-ui/dom', () => ({
  arrow: () => ({ name: 'arrow', fn: () => ({}) }),
  autoUpdate: autoUpdateSpy,
  computePosition: computePositionSpy,
  flip: flipSpy,
  offset: offsetSpy,
  shift: shiftSpy,
}));

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: ContextMenuHarness } = await import('./_context-menu-test-harness.svelte');

function queryMenu(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="menu"]');
}

beforeEach(() => {
  computePositionSpy.mockClear();
  autoUpdateSpy.mockClear();
  autoUpdateTeardown.mockClear();
  flipSpy.mockClear();
  offsetSpy.mockClear();
  shiftSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('ContextMenu', () => {
  test('right-click opens a dropdown menu at the requested pointer coordinates', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => {
      const menu = queryMenu();
      expect(menu).not.toBeNull();
      expect(menu?.getAttribute('data-cinder-requested-x')).toBe('24');
      expect(menu?.getAttribute('data-cinder-requested-y')).toBe('36');
      expect(menu?.getAttribute('style')).toContain('left: 32px');
      expect(menu?.getAttribute('style')).toContain('top: 48px');
    });
    expect(autoUpdateSpy).toHaveBeenCalled();
    expect(computePositionSpy).toHaveBeenCalled();
  });

  test('right-to-left context menus open toward inline-start by default', async () => {
    const { container } = render(ContextMenuHarness, { props: { direction: 'rtl' } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => expect(computePositionSpy).toHaveBeenCalled());
    const options = computePositionSpy.mock.calls[0]?.at(2) as { placement?: string } | undefined;
    expect(options?.placement).toBe('left-start');
  });

  test('provider-only right-to-left context menus open toward inline-start', async () => {
    const { container } = render(ContextMenuHarness, { props: { providerDirection: 'rtl' } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => expect(computePositionSpy).toHaveBeenCalled());
    const options = computePositionSpy.mock.calls[0]?.at(2) as { placement?: string } | undefined;
    expect(options?.placement).toBe('left-start');
    expect(queryMenu()?.getAttribute('dir')).toBe('rtl');
  });

  test('preserves explicit dropdown menu direction while using provider direction for placement', async () => {
    const { container } = render(ContextMenuHarness, {
      props: { providerDirection: 'rtl', menuDirection: 'ltr' },
    });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => expect(computePositionSpy).toHaveBeenCalled());
    const options = computePositionSpy.mock.calls[0]?.at(2) as { placement?: string } | undefined;
    expect(options?.placement).toBe('left-start');
    expect(queryMenu()?.getAttribute('dir')).toBe('ltr');
  });

  test('local left-to-right direction overrides right-to-left provider placement', async () => {
    const { container } = render(ContextMenuHarness, {
      props: { direction: 'ltr', providerDirection: 'rtl' },
    });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => expect(computePositionSpy).toHaveBeenCalled());
    const options = computePositionSpy.mock.calls[0]?.at(2) as { placement?: string } | undefined;
    expect(options?.placement).toBe('right-start');
    expect(queryMenu()?.getAttribute('dir')).toBe('ltr');
  });

  test('reacts to ancestor direction changes after mount', async () => {
    const { container, rerender } = render(ContextMenuHarness, {
      props: { direction: 'ltr' },
    });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await tick();
    await rerender({ direction: 'rtl' });
    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => expect(computePositionSpy).toHaveBeenCalled());
    const options = computePositionSpy.mock.calls[0]?.at(2) as { placement?: string } | undefined;
    expect(options?.placement).toBe('left-start');
    expect(queryMenu()?.getAttribute('dir')).toBe('rtl');
  });

  test('fallback menu portals virtual-anchor surfaces before they are positioned', async () => {
    computePositionSpy.mockImplementationOnce(async () => {
      throw new Error('detached panel');
    });
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => {
      const menu = queryMenu();
      expect(menu).not.toBeNull();
      expect(menu?.parentElement).toBe(document.body);
      expect(menu?.getAttribute('data-cinder-position-ready')).toBe('false');
      expect(menu?.getAttribute('data-cinder-requested-x')).toBe('24');
      expect(menu?.getAttribute('data-cinder-requested-y')).toBe('36');
      expect(menu?.getAttribute('style')).toBeNull();
    });
  });

  test('consumer trigger handlers do not replace core context-menu handlers', async () => {
    const triggerContextMenu = mock(() => {});
    const triggerPointerDown = mock(() => {});
    const triggerPointerMove = mock(() => {});
    const triggerPointerUp = mock(() => {});
    const triggerKeyDown = mock(() => {});
    const triggerClick = mock(() => {});
    const { container } = render(ContextMenuHarness, {
      props: {
        longPressDelay: 0,
        triggerHandlers: {
          onclick: triggerClick,
          oncontextmenu: triggerContextMenu,
          onkeydown: triggerKeyDown,
          onpointerdown: triggerPointerDown,
          onpointermove: triggerPointerMove,
          onpointerup: triggerPointerUp,
        },
      },
    });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => {
      expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('24');
      expect(queryMenu()?.getAttribute('data-cinder-requested-y')).toBe('36');
    });
    expect(triggerContextMenu).toHaveBeenCalledTimes(1);

    await fireEvent.click(region);
    await fireEvent.keyDown(region, { key: 'Escape' });
    await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });
    await fireEvent.pointerMove(region, { pointerType: 'touch', clientX: 15, clientY: 18 });
    await fireEvent.pointerUp(region, { pointerType: 'touch' });

    expect(triggerPointerDown).toHaveBeenCalledTimes(1);
    expect(triggerPointerMove).toHaveBeenCalledTimes(1);
    expect(triggerPointerUp).toHaveBeenCalledTimes(1);
    expect(triggerClick).toHaveBeenCalledTimes(1);
    expect(triggerKeyDown).toHaveBeenCalledTimes(1);
  });

  test('right-clicking again while open repositions to the latest pointer coordinates', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('24'));

    await fireEvent.contextMenu(region, { clientX: 80, clientY: 96 });

    await waitFor(() => {
      expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('80');
      expect(queryMenu()?.getAttribute('data-cinder-requested-y')).toBe('96');
    });
  });

  test('controlled open uses the provided anchor point', async () => {
    render(ContextMenuHarness, {
      props: { open: true, anchorPoint: { x: 64, y: 72 } },
    });

    await waitFor(() => {
      expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('64');
      expect(queryMenu()?.getAttribute('data-cinder-requested-y')).toBe('72');
    });
  });

  test('disabled context menu leaves native contextmenu behavior alone', async () => {
    const { container } = render(ContextMenuHarness, { props: { disabled: true } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    expect(queryMenu()).toBeNull();
    expect(autoUpdateSpy).not.toHaveBeenCalled();
  });

  test('selecting a menu item closes the menu and restores focus to the trigger', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;
    const triggerButton = container.querySelector('.context-menu-button') as HTMLButtonElement;
    triggerButton.focus();

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    const openItem = queryMenu()?.querySelector('[role="menuitem"]') as HTMLButtonElement;
    await fireEvent.click(openItem);

    await waitFor(() => expect(queryMenu()).toBeNull());
    expect(document.activeElement).toBe(triggerButton);
  });

  test('touch long-press opens the menu after the configured delay', async () => {
    const { container } = render(ContextMenuHarness, { props: { longPressDelay: 0 } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });

    await waitFor(() => {
      const menu = queryMenu();
      expect(menu).not.toBeNull();
      expect(menu?.getAttribute('data-cinder-requested-x')).toBe('14');
      expect(menu?.getAttribute('data-cinder-requested-y')).toBe('18');
    });
  });

  test('touch movement beyond the threshold cancels long-press open', async () => {
    const { container } = render(ContextMenuHarness, { props: { longPressDelay: 10 } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });
    await fireEvent.pointerMove(region, { pointerType: 'touch', clientX: 40, clientY: 18 });
    await Bun.sleep(20);

    expect(queryMenu()).toBeNull();
  });

  test('touch cleanup events cancel long-press open', async () => {
    const cleanupEvents = ['pointerup', 'pointercancel', 'pointerleave'] as const;

    for (const eventName of cleanupEvents) {
      cleanup();
      const { container } = render(ContextMenuHarness, { props: { longPressDelay: 10 } });
      const region = container.querySelector('.context-menu-region') as HTMLElement;

      await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });
      await fireEvent(region, new PointerEvent(eventName, { bubbles: true, pointerType: 'touch' }));
      await Bun.sleep(20);

      expect(queryMenu()).toBeNull();
    }
  });

  test('long-press suppresses the synthetic click and native contextmenu that follow', async () => {
    const outerClick = mock(() => {});
    document.addEventListener('click', outerClick);
    const { container } = render(ContextMenuHarness, { props: { longPressDelay: 0 } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    try {
      await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });
      await waitFor(() => expect(queryMenu()).not.toBeNull());

      await fireEvent.click(region);
      await fireEvent.contextMenu(region, { clientX: 99, clientY: 101 });

      expect(outerClick).not.toHaveBeenCalled();
      expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('14');
      expect(queryMenu()?.getAttribute('data-cinder-requested-y')).toBe('18');
    } finally {
      document.removeEventListener('click', outerClick);
    }
  });

  test('long-press suppresses duplicate synthetic contextmenu events until another pointerdown', async () => {
    const { container } = render(ContextMenuHarness, { props: { longPressDelay: 0 } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.contextMenu(region, { clientX: 99, clientY: 101 });
    await fireEvent.contextMenu(region, { clientX: 140, clientY: 160 });

    expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('14');
    expect(queryMenu()?.getAttribute('data-cinder-requested-y')).toBe('18');
  });

  test('long-press suppression clears before a later mouse contextmenu request', async () => {
    const { container } = render(ContextMenuHarness, { props: { longPressDelay: 0 } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.pointerDown(region, { pointerType: 'mouse', clientX: 99, clientY: 101 });
    await fireEvent.contextMenu(region, { clientX: 99, clientY: 101 });

    expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('99');
    expect(queryMenu()?.getAttribute('data-cinder-requested-y')).toBe('101');
  });

  test('outside pointerdown closes a touch-opened context menu', async () => {
    const { container } = render(ContextMenuHarness, { props: { longPressDelay: 0 } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;
    const outside = container.querySelector('.context-menu-selection') as HTMLElement;

    await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await fireEvent.pointerDown(outside, { pointerType: 'touch' });

    await waitFor(() => expect(queryMenu()).toBeNull());
  });

  test('outside pointerdown restores the captured focus instead of the focusable trigger wrapper', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;
    const triggerButton = container.querySelector('.context-menu-button') as HTMLButtonElement;
    const outside = container.querySelector('.context-menu-selection') as HTMLElement;
    region.tabIndex = 0;
    triggerButton.focus();

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await fireEvent.pointerDown(outside);

    await waitFor(() => expect(queryMenu()).toBeNull());
    expect(document.activeElement).toBe(triggerButton);
  });

  test('opening focuses the first enabled menu item', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Open');
    });
  });

  test('ArrowDown and ArrowUp navigate enabled items and skip disabled ones', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Open');
    });

    // "Disabled action" is skipped — ArrowDown lands on the next enabled item.
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Rename');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Delete');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent).toContain('Rename');
  });

  test('ArrowDown wraps from the last enabled item back to the first', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Open');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(document.activeElement?.textContent).toContain('Delete');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Open');
  });

  test('ArrowUp wraps from the first enabled item to the last', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Open');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent).toContain('Delete');
  });

  test('Enter on the focused item selects it and closes the menu', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Open');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Rename');

    // In a real browser, pressing Enter on a focused <button> dispatches a native
    // click, which drives selection + close-on-select. DropdownItem no longer
    // synthesizes its own click on keydown (that caused double-activation), and
    // happy-dom does not synthesize the native click from keydown — so we fire
    // the click directly on the focused item to exercise the same native path.
    await fireEvent.click(document.activeElement as HTMLElement);

    await waitFor(() => expect(queryMenu()).toBeNull());
    expect(container.querySelector('.context-menu-selected')?.textContent).toBe('rename');
  });

  test('Escape closes the menu and restores focus to the trigger region', async () => {
    const { container } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;
    const triggerButton = container.querySelector('.context-menu-button') as HTMLButtonElement;
    triggerButton.focus();

    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Open');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    // Escape both flips open to false (the close effect restores focus) and
    // runs DropdownMenu's own focusTrigger() call, so focus lands back inside
    // the trigger region rather than escaping to the body.
    await waitFor(() => expect(queryMenu()).toBeNull());
    expect(region.contains(document.activeElement)).toBe(true);
  });

  test('keyboard navigation drives the role=menu items: ArrowDown/ArrowUp move, Enter selects, Escape closes', async () => {
    const { container, getByRole, getAllByRole, queryByRole } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;
    const triggerButton = container.querySelector('.context-menu-button') as HTMLButtonElement;
    triggerButton.focus();

    // Open the floating menu from the pointer location.
    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });

    // The overlay exposes a role=menu with role=menuitem children, and focus
    // lands on the first enabled item.
    const menu = await waitFor(() => getByRole('menu'));
    const items = getAllByRole('menuitem');
    expect(items.length).toBe(4);
    expect(menu.contains(getByRole('menuitem', { name: 'Open' }))).toBe(true);
    await waitFor(() => {
      expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Open' }));
    });

    // ArrowDown skips the disabled item and lands on the next enabled one.
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Rename' }));

    // ArrowUp moves focus back up to the first enabled item.
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Open' }));

    // Enter on the focused item selects it and closes the menu. In a real
    // browser Enter on a <button> dispatches a native click; DropdownItem relies
    // on that (it no longer synthesizes its own click) and happy-dom does not
    // synthesize it from keydown, so we fire the click to drive the native path.
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Rename' }));
    await fireEvent.click(document.activeElement as HTMLElement);

    await waitFor(() => expect(queryByRole('menu')).toBeNull());
    expect(container.querySelector('.context-menu-selected')?.textContent).toBe('rename');

    // Re-open, then Escape closes the menu and restores focus to the trigger.
    await fireEvent.contextMenu(region, { clientX: 24, clientY: 36 });
    await waitFor(() => getByRole('menu'));
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    await waitFor(() => expect(queryByRole('menu')).toBeNull());
    expect(region.contains(document.activeElement)).toBe(true);
  });

  test('Escape closes the menu when focus is on the trigger region not the menu panel', async () => {
    const { container, getByRole, queryByRole } = render(ContextMenuHarness);
    const region = container.querySelector('.context-menu-region') as HTMLElement;

    // Open the context menu via right-click
    await fireEvent.contextMenu(region, { clientX: 50, clientY: 50 });
    await waitFor(() => getByRole('menu'));

    // Fire Escape on the trigger region (not inside the menu)
    await fireEvent.keyDown(region, { key: 'Escape' });
    await waitFor(() => expect(queryByRole('menu')).toBeNull());
  });

  test('keyboard context menu keys open at the focused target edge', async () => {
    const { container } = render(ContextMenuHarness);
    const button = container.querySelector('.context-menu-button') as HTMLButtonElement;
    button.getBoundingClientRect = () =>
      ({
        x: 10,
        y: 12,
        top: 12,
        left: 10,
        right: 110,
        bottom: 32,
        width: 100,
        height: 20,
      }) as DOMRect;
    button.focus();

    await fireEvent.keyDown(button, { key: 'F10', shiftKey: true });

    await waitFor(() => {
      expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('10');
      expect(queryMenu()?.getAttribute('data-cinder-requested-y')).toBe('32');
    });
  });

  test('keyboard context menu keys use the inline-end edge in right-to-left direction', async () => {
    const { container } = render(ContextMenuHarness, { props: { direction: 'rtl' } });
    const button = container.querySelector('.context-menu-button') as HTMLButtonElement;
    button.getBoundingClientRect = () =>
      ({
        x: 10,
        y: 12,
        top: 12,
        left: 10,
        right: 110,
        bottom: 32,
        width: 100,
        height: 20,
      }) as DOMRect;
    button.focus();

    await fireEvent.keyDown(button, { key: 'F10', shiftKey: true });

    await waitFor(() => {
      expect(queryMenu()?.getAttribute('data-cinder-requested-x')).toBe('110');
      expect(queryMenu()?.getAttribute('data-cinder-requested-y')).toBe('32');
    });
  });
});
