<script lang="ts" module>
  export const title = 'File, Edit, and View';
  export const description =
    'A desktop-style application menubar with shortcuts, a disabled row, and an Open Recent submenu.';
</script>

<script lang="ts">
  import { MenuBar, type MenuBarMenu } from 'cinder/menu-bar';

  const menus: MenuBarMenu[] = [
    {
      id: 'file',
      label: 'File',
      accessKey: 'f',
      items: [
        { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N' },
        { id: 'open', label: 'Open...', shortcut: 'Ctrl+O' },
        {
          type: 'submenu',
          id: 'open-recent',
          label: 'Open Recent',
          items: [
            { id: 'design-system', label: 'Design system audit' },
            { id: 'component-roadmap', label: 'Component roadmap' },
            { type: 'separator', id: 'recent-separator' },
            { id: 'clear-recent', label: 'Clear Recent', disabled: true },
          ],
        },
        { type: 'separator', id: 'file-separator' },
        { id: 'delete-workspace', label: 'Delete Workspace', variant: 'danger' },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      accessKey: 'e',
      items: [
        { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
        { id: 'redo', label: 'Redo', shortcut: 'Shift+Ctrl+Z', disabled: true },
        { type: 'separator', id: 'edit-separator' },
        { id: 'find', label: 'Find in Project', shortcut: 'Ctrl+F' },
      ],
    },
    {
      id: 'view',
      label: 'View',
      accessKey: 'v',
      items: [
        { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: 'Ctrl+B' },
        { id: 'command-palette', label: 'Command Palette', shortcut: 'Ctrl+K' },
      ],
    },
  ];
</script>

<MenuBar {menus} label="Workspace menu" />
