# MenuBar

Command menubar for application chrome such as File, Edit, and View menus.

## Usage

```svelte
<script lang="ts">
  import MenuBar from '@lostgradient/cinder/menu-bar';
  import type { MenuBarMenu } from '@lostgradient/cinder/menu-bar';

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
```

## Guidance

### Use When

- Building a desktop-style command menubar with dropdown command groups.
- Exposing top-level application menus that need arrow-key traversal and optional submenus.

### Avoid When

- Linking between routes or sections — use navigation-bar or side-navigation instead.
- Showing one standalone trigger with a menu — use dropdown, dropdown-menu, and dropdown-item directly.

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default              | Description                                                                                                              |
| ---------------- | ---------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ariaLabelledby` | `string`   | no       | —                    | ID of an existing element whose text labels the menubar, applied as aria-labelledby. Takes precedence over label.        |
| `class`          | `string`   | no       | —                    | Additional class names merged with the component's root class.                                                           |
| `id`             | `string`   | no       | —                    | HTML id applied to the menubar root element. Auto-generated when omitted.                                                |
| `label`          | `string`   | no       | `"Application menu"` | Accessible label for the menubar, applied as aria-label. Ignored when ariaLabelledby is set. Default `Application menu`. |
| `menus`          | `(opaque)` | yes      | —                    | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
