<script lang="ts" module>
  export const title = 'Toolbar shortcut hints';
  export const description =
    'Inline shortcut hints in a compact toolbar, keys positioned after the label.';
</script>

<script lang="ts">
  import { ShortcutHint } from '@lostgradient/cinder/shortcut-hint';
</script>

<div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
  <ShortcutHint keys={['Ctrl', 'S']}>Save</ShortcutHint>
  <ShortcutHint keys={['Ctrl', 'Z']}>Undo</ShortcutHint>
  <ShortcutHint keys={['Escape']}>Cancel</ShortcutHint>
  <ShortcutHint keys={['Space']} keysLabel="Space bar" keysPosition="before">Play</ShortcutHint>
</div>
