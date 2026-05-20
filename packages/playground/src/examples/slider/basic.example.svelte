<script lang="ts" module>
  export const title = 'Single-value slider';
  export const description =
    'A simple slider for one numeric value. Keyboard, mouse, and touch all work.';
</script>

<script lang="ts">
  import { Slider } from 'cinder/slider';
  let value = $state(40);
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 24rem;">
  <Slider
    label="Volume"
    {value}
    onchange={(next) => {
      value = next;
    }}
  />
  <p>Value: {value}</p>
</div>
