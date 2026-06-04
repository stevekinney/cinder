<script lang="ts" module>
  export const title = 'Color picker with alpha';
  export const description =
    'Alpha slider enabled: emits an 8-character hex value. The footer row shows the full #rrggbbaa string.';
</script>

<script lang="ts">
  import { ColorPicker } from '@lostgradient/cinder/color-picker';

  const swatches = ['#ef444480', '#22c55e80', '#3b82f680'];
</script>

<ColorPicker defaultValue="#3b82f680" label="Color with opacity" alpha {swatches} />
