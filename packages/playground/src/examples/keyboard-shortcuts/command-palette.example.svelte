<script lang="ts" module>
  export const title = 'Command palette shortcuts reference';
  export const description =
    'A grouped shortcut reference panel suitable for embedding in a modal or sheet.';
</script>

<script lang="ts">
  import { KeyboardShortcuts } from '@lostgradient/cinder/keyboard-shortcuts';
</script>

<div style="max-width: 28rem;">
  <KeyboardShortcuts
    heading="Keyboard Shortcuts"
    groups={[
      {
        label: 'General',
        shortcuts: [
          { action: 'Open command palette', keys: ['Ctrl', 'K'], keysLabel: 'Control plus K' },
          { action: 'Search', keys: ['Ctrl', 'F'], keysLabel: 'Control plus F' },
          { action: 'Go back', keys: ['Alt', '←'], keysLabel: 'Alt plus Left arrow' },
        ],
      },
      {
        label: 'Editing',
        shortcuts: [
          { action: 'Save', keys: ['Ctrl', 'S'], keysLabel: 'Control plus S' },
          { action: 'Undo', keys: ['Ctrl', 'Z'], keysLabel: 'Control plus Z' },
          { action: 'Redo', keys: ['Ctrl', 'Shift', 'Z'], keysLabel: 'Control plus Shift plus Z' },
        ],
      },
    ]}
  />
</div>
