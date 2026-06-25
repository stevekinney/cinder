<script lang="ts">
  import DateRangeField from '../../components/date-range-field/date-range-field.svelte';
  import type {
    DateRangeGranularity,
    DateRangeValue,
  } from '../../components/date-range-field/date-range-field.types.ts';

  let granularity = $state<DateRangeGranularity>('second');
  let value = $state<DateRangeValue>({
    start: '2026-06-01T09:30:45',
    end: '2026-06-01T10:45:30',
  });
</script>

<button
  type="button"
  class="set-minute-granularity"
  onclick={() => {
    granularity = 'minute';
  }}
>
  Minute granularity
</button>

<output data-testid="range-value">{JSON.stringify(value)}</output>
<DateRangeField id="range" bind:value {granularity} hidePresets />
