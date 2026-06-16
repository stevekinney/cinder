<script lang="ts" module>
  export const title = 'Basic date range';
  export const description =
    'Start and end date inputs with built-in presets for today, yesterday & today, and last 7 days.';
</script>

<script lang="ts">
  import { DateRangeField } from '@lostgradient/cinder/date-range-field';
  import type { DateRangeValue } from '@lostgradient/cinder/date-range-field';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-date-range-field`);

  let range: DateRangeValue = $state({ start: undefined, end: undefined });
</script>

<DateRangeField id={fieldId} label="Time window" bind:value={range} />
