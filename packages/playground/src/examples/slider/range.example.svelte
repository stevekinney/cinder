<script lang="ts" module>
  export const title = 'Range slider';
  export const description =
    'Two thumbs constrained so the low value never exceeds the high value.';
</script>

<script lang="ts">
  import { Slider } from 'cinder/slider';
  let value = $state<[number, number]>([20, 80]);
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 24rem;">
  <Slider
    label="Price"
    mode="range"
    {value}
    onchange={(next) => {
      value = next;
    }}
  />
  <p>Range: {value[0]} – {value[1]}</p>
</div>
