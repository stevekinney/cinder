export function fileEditViewMenus(onOpenRecent = () => {}) {
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
