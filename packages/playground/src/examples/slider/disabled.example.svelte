<script lang="ts" module>
  export const title = 'Disabled slider';
  export const description =
    'A disabled slider does not respond to keyboard or pointer input and is excluded from tab order.';
</script>

<script lang="ts">
  import { Slider } from 'cinder/slider';
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 24rem;">
  <Slider label="Volume" defaultValue={40} disabled />
</div>
