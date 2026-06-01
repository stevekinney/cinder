/**
 * Visual-regression fixtures for MenuBar.
 */
export default [
  {
    name: 'workspace',
    props: {
      label: 'Workspace menu',
      menus: [
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
      ],
    },
  },
  {
    name: 'file-open',
    props: {
      label: 'Workspace menu',
      menus: [
        {
          id: 'file',
          label: 'File',
          accessKey: 'f',
          items: [
            { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N' },
            { id: 'open', label: 'Open...', shortcut: 'Ctrl+O' },
            { id: 'delete-workspace', label: 'Delete Workspace', variant: 'danger' },
          ],
        },
        {
          id: 'edit',
          label: 'Edit',
          accessKey: 'e',
          items: [{ id: 'find', label: 'Find in Project', shortcut: 'Ctrl+F' }],
        },
      ],
    },
    interact: [{ action: 'click', target: { role: 'menuitem', name: 'File' } }],
  },
];
