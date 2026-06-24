/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const computePositionSpy = mock(
  async (_reference: unknown, _menu: HTMLElement, options: unknown) => ({
    x: 32,
    y: 48,
    placement: (options as { placement?: string })?.placement ?? 'bottom-start',
  }),
);
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

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: MenuBar } = await import('./menu-bar.svelte');

function fileEditViewMenus(onOpenRecent = () => {}) {
  return [
    {
      id: 'file',
      label: 'File',
      accessKey: 'f',
      items: [
        { id: 'new', label: 'New', shortcut: 'Ctrl+N' },
        {
          type: 'submenu' as const,
          id: 'open-recent',
          label: 'Open Recent',
          items: [
            { id: 'project', label: 'Cinder workspace', onSelect: onOpenRecent },
            { type: 'separator' as const, id: 'recent-separator' },
            { id: 'clear', label: 'Clear Menu', disabled: true },
          ],
        },
        { type: 'separator' as const, id: 'file-separator' },
        { id: 'delete', label: 'Delete Project', variant: 'danger' as const },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
        { id: 'redo', label: 'Redo', disabled: true },
      ],
    },
    {
      id: 'view',
      label: 'View',
      disabled: true,
      items: [{ id: 'zoom-in', label: 'Zoom In' }],
    },
  ];
}

describe('MenuBar', () => {
  beforeEach(() => {
    computePositionSpy.mockClear();
    autoUpdateSpy.mockClear();
    autoUpdateTeardown.mockClear();
  });

  // Unmount AFTER each test so the last test's render doesn't leak into the next
  // file (cleanup() in beforeEach never runs after the final test).
  afterEach(() => {
    cleanup();
  });

  test('renders a labelled menubar with top-level menuitem triggers', () => {
    const { container, getByRole } = render(MenuBar, {
      id: 'application-menu',
      menus: fileEditViewMenus(),
      label: 'Workspace menu',
      'data-testid': 'menu-root',
      role: 'presentation',
    } as any);

    const root = getByRole('menubar', { name: 'Workspace menu' });
    expect(root.id).toBe('application-menu');
    expect(root.getAttribute('data-testid')).toBe('menu-root');
    expect(root.getAttribute('role')).toBe('menubar');
    expect(container.querySelectorAll('.cinder-menu-bar__trigger')).toHaveLength(3);
    expect(getByRole('menuitem', { name: 'File' }).getAttribute('tabindex')).toBe('0');
    expect(getByRole('menuitem', { name: 'View' }).getAttribute('aria-disabled')).toBe('true');
  });

  test('opens a menu with ArrowDown and focuses the first enabled item', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.keyDown(file, { key: 'ArrowDown' });
    await tick();

    expect(file.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'New' }));
  });

  test('moves between enabled top-level triggers and skips disabled triggers', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });
    const edit = getByRole('menuitem', { name: 'Edit' });

    file.focus();
    await fireEvent.keyDown(file, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(edit);
    await fireEvent.keyDown(edit, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(file);
  });

  test('opens a submenu and keeps parent menu traversal scoped to parent items', async () => {
    const { getByRole, queryByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowRight' });
    await tick();

    expect(submenuTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Cinder workspace' }));

    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowDown' });
    expect(queryByRole('menuitem', { name: 'Cinder workspace' })).not.toBe(document.activeElement);
  });

  test('right-to-left submenus fall back to the inline-start side', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus(), dir: 'rtl' } as any);
    const file = getByRole('menuitem', { name: 'File' });
    const root = getByRole('menubar');

    expect(root.getAttribute('dir')).toBe('rtl');
    await fireEvent.click(file);
    await tick();
    computePositionSpy.mockClear();

    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowLeft' });
    await tick();

    const submenuCall = computePositionSpy.mock.calls.find((call) => {
      const options = call.at(2) as { placement?: string } | undefined;
      return options?.placement === 'left-start';
    });
    expect(submenuCall).toBeDefined();
    expect(getByRole('menu', { name: 'Open Recent' }).getAttribute('dir')).toBe('rtl');
  });

  test('right-to-left submenu ArrowRight returns focus to the submenu trigger', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus(), dir: 'rtl' } as any);
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowLeft' });
    await tick();
    await fireEvent.keyDown(getByRole('menuitem', { name: 'Cinder workspace' }), {
      key: 'ArrowRight',
    });
    await tick();

    expect(document.activeElement).toBe(submenuTrigger);
    expect(submenuTrigger.getAttribute('aria-expanded')).toBe('false');
  });

  test('opens a submenu on the first enabled item after opening the parent menu from ArrowUp', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.keyDown(file, { key: 'ArrowUp' });
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowRight' });
    await tick();

    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Cinder workspace' }));
  });

  test('returns focus to the submenu trigger when Escape closes a submenu', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowRight' });
    await tick();
    await fireEvent.keyDown(getByRole('menuitem', { name: 'Cinder workspace' }), { key: 'Escape' });

    expect(document.activeElement).toBe(submenuTrigger);
    expect(submenuTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(file.getAttribute('aria-expanded')).toBe('true');
  });

  test('closes an open submenu when focus moves to a sibling menu item', async () => {
    const { getByRole, queryByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowRight' });
    await tick();
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowDown' });
    await tick();

    expect(submenuTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('menuitem', { name: 'Cinder workspace' })).toBeNull();
  });

  test('does not move focus into a submenu when focus lands on the submenu trigger', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.keyDown(file, { key: 'ArrowDown' });
    await tick();
    await fireEvent.keyDown(getByRole('menuitem', { name: 'New' }), { key: 'ArrowDown' });
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });

    expect(document.activeElement).toBe(submenuTrigger);
    expect(submenuTrigger.getAttribute('aria-expanded')).toBe('true');
  });

  test('moves focus into an already disclosed submenu on explicit keyboard activation', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.keyDown(file, { key: 'ArrowDown' });
    await tick();
    await fireEvent.keyDown(getByRole('menuitem', { name: 'New' }), { key: 'ArrowDown' });
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowRight' });
    await tick();

    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Cinder workspace' }));
  });

  test('moves from an open submenu to the next top-level menu with ArrowRight', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });
    const edit = getByRole('menuitem', { name: 'Edit' });

    await fireEvent.keyDown(file, { key: 'ArrowDown' });
    await tick();
    await fireEvent.keyDown(getByRole('menuitem', { name: 'Open Recent' }), { key: 'ArrowRight' });
    await tick();
    await fireEvent.keyDown(getByRole('menuitem', { name: 'Cinder workspace' }), {
      key: 'ArrowRight',
    });
    await tick();

    expect(edit.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Undo' }));
  });

  test('closes all menus and restores top-level focus when a submenu item is selected', async () => {
    const { getByRole, queryByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    await tick();
    await fireEvent.keyDown(getByRole('menuitem', { name: 'Open Recent' }), { key: 'ArrowRight' });
    await tick();
    await fireEvent.click(getByRole('menuitem', { name: 'Cinder workspace' }));
    await tick();

    expect(file.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('menuitem', { name: 'Cinder workspace' })).toBeNull();
    expect(document.activeElement).toBe(file);
  });

  test('closes the menu and restores top-level focus when a top-level item is selected', async () => {
    const { getByRole, queryByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    await tick();
    await fireEvent.click(getByRole('menuitem', { name: 'New' }));
    await tick();

    expect(file.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('menuitem', { name: 'New' })).toBeNull();
    expect(document.activeElement).toBe(file);
  });

  test('opens a submenu on pointer entry while the parent menu is open', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    submenuTrigger.dispatchEvent(new PointerEvent('pointerenter'));
    await tick();

    expect(submenuTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('menuitem', { name: 'Cinder workspace' })).toBeTruthy();
    expect(document.activeElement?.textContent).not.toContain('Cinder workspace');
  });

  test('Alt access key opens the first enabled matching menu', async () => {
    const { getByRole } = render(MenuBar, {
      menus: [
        { id: 'disabled-file', label: 'Format', accessKey: 'f', disabled: true, items: [] },
        ...fileEditViewMenus(),
      ],
    });
    const root = getByRole('menubar');

    await fireEvent.keyDown(root, { key: 'f', altKey: true });
    await tick();

    expect(getByRole('menuitem', { name: 'File' }).getAttribute('aria-expanded')).toBe('true');
  });

  test('closes on outside pointer down', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    expect(file.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.pointerDown(document.body);

    expect(file.getAttribute('aria-expanded')).toBe('false');
  });

  test('Escape closes the open top-level menu when focus is on the trigger button', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const fileButton = getByRole('menuitem', { name: 'File' });

    // Open the File menu
    await fireEvent.click(fileButton);
    await tick();
    expect(fileButton.getAttribute('aria-expanded')).toBe('true');

    // Press Escape while focus is on the trigger button
    await fireEvent.keyDown(fileButton, { key: 'Escape' });
    await tick();
    expect(fileButton.getAttribute('aria-expanded')).toBe('false');
  });

  test('Escape on a closed menubar item is not consumed, so enclosing handlers still run', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const fileButton = getByRole('menuitem', { name: 'File' });
    fileButton.focus();
    expect(fileButton.getAttribute('aria-expanded')).toBe('false');

    // Construct a cancelable KeyboardEvent so we can assert `defaultPrevented`
    // after dispatch. With nothing open, the menu bar must let Escape through —
    // calling preventDefault here would swallow it from an enclosing overlay or
    // page-level Escape handler.
    const closedEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    fileButton.dispatchEvent(closedEscape);
    await tick();
    expect(closedEscape.defaultPrevented).toBe(false);

    // Open the menu, then Escape IS consumed (it has something to close).
    await fireEvent.click(fileButton);
    await tick();
    expect(fileButton.getAttribute('aria-expanded')).toBe('true');
    const openEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    fileButton.dispatchEvent(openEscape);
    await tick();
    expect(openEscape.defaultPrevented).toBe(true);
    expect(fileButton.getAttribute('aria-expanded')).toBe('false');
  });

  test('reuses dropdown primitives instead of copying their markup classes', async () => {
    const source = await Bun.file(new URL('./menu-bar.svelte', import.meta.url)).text();

    expect(source).toContain("DropdownMenu from '../dropdown-menu/dropdown-menu.svelte'");
    expect(source).toContain("DropdownItem from '../dropdown-item/dropdown-item.svelte'");
    expect(source).toContain("DropdownLabel from '../dropdown-label/dropdown-label.svelte'");
    expect(source).toContain(
      "DropdownSeparator from '../dropdown-separator/dropdown-separator.svelte'",
    );
    expect(source).not.toContain('class="cinder-dropdown-menu');
    expect(source).not.toContain('class="cinder-dropdown-item');
  });
});
