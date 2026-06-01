<script lang="ts" module>
  export const title = 'Color picker without swatches';
  export const description =
    'Omitting the swatches prop renders only the gradient, sliders, and footer row — useful when a freeform pick without preset guidance is needed.';
</script>

<script lang="ts">
  import { ColorPicker } from 'cinder/color-picker';
</script>

<ColorPicker defaultValue="#6366f1" label="Custom color" />
