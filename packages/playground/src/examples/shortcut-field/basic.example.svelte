<script lang="ts" module>
  export const title = 'Shortcut field';
  export const description = 'Capture a keyboard shortcut in an accessible field.';
</script>

<script lang="ts">
  import { ShortcutField } from '@lostgradient/cinder/shortcut-field';
</script>

<ShortcutField label="Open command palette" value={['Meta', 'K']} />
