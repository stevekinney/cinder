<script lang="ts" module>
  export const title = 'Basic color picker';
  export const description =
    'A color picker with preset swatches where the selected swatch shows a persistent check indicator without looking keyboard-focused.';
</script>

<script lang="ts">
  import { ColorPicker } from '@lostgradient/cinder/color-picker';

  const swatches = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b'];
</script>

<ColorPicker defaultValue="#22c55e" label="Accent color" {swatches} />
