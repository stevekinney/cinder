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
const shiftSpy = mock((options: unknown) => ({ name: 'shift', options, fn: () => ({}) }));

mock.module('@floating-ui/dom', () => ({
  autoUpdate: autoUpdateSpy,
  computePosition: computePositionSpy,
  flip: flipSpy,
  shift: shiftSpy,
}));

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: ContextMenuHarness } = await import('./_context-menu-test-harness.svelte');

function queryMenu(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="menu"]');
}

beforeEach(() => {
  computePositionSpy.mockClear();
  autoUpdateSpy.mockClear();
  autoUpdateTeardown.mockClear();
  flipSpy.mockClear();
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

  test('outside pointerdown closes a touch-opened context menu', async () => {
    const { container } = render(ContextMenuHarness, { props: { longPressDelay: 0 } });
    const region = container.querySelector('.context-menu-region') as HTMLElement;
    const outside = container.querySelector('.context-menu-selection') as HTMLElement;

    await fireEvent.pointerDown(region, { pointerType: 'touch', clientX: 14, clientY: 18 });
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await fireEvent.pointerDown(outside, { pointerType: 'touch' });

    await waitFor(() => expect(queryMenu()).toBeNull());
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
});
