<script lang="ts" module>
  export const title = 'Slider with tick marks';
  export const description =
    'Discrete tick marks. When `ticks` is an array, arrow keys step between adjacent ticks.';
</script>

<script lang="ts">
  import { Slider } from '../../../../components/src/index.ts';

  let value = $state(50);
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 24rem;">
  <Slider
    label="Density"
    {value}
    ticks={[0, 25, 50, 75, 100]}
    onchange={(next) => {
      value = next as number;
    }}
  />
  <p>Value: {value}</p>
</div>
