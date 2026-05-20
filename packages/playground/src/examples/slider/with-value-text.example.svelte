<script lang="ts" module>
  export const title = 'Slider with formatted value text';
  export const description =
    'Use `valueText` to format the value for screen readers — percentages, currency, dates.';
</script>

<script lang="ts">
  import { Slider } from 'cinder/slider';
  let percent = $state(60);
  let price = $state(250);

  const usd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
</script>

<div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 24rem;">
  <div>
    <Slider
      label="Opacity"
      value={percent}
      valueText={(value) => `${value} percent`}
      onchange={(next) => {
        percent = next;
      }}
    />
    <p>Opacity: {percent}%</p>
  </div>

  <div>
    <Slider
      label="Budget"
      value={price}
      min={0}
      max={1000}
      step={25}
      valueText={(value) => usd.format(value)}
      onchange={(next) => {
        price = next;
      }}
    />
    <p>Budget: {usd.format(price)}</p>
  </div>
</div>
