/// <reference lib="dom" />
import { beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

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

  test('opens a submenu on pointer entry while the parent menu is open', async () => {
    const { getByRole } = render(MenuBar, { menus: fileEditViewMenus() });
    const file = getByRole('menuitem', { name: 'File' });

    await fireEvent.click(file);
    await tick();
    const submenuTrigger = getByRole('menuitem', { name: 'Open Recent' });
    await fireEvent.pointerEnter(submenuTrigger);
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
