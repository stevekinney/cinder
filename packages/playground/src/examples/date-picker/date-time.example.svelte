<script lang="ts" module>
  export const title = 'Date-time picker';
  export const description = 'Calendar selection plus time input for minute-level granularity.';
</script>

<script lang="ts">
  import { DatePicker } from '@lostgradient/cinder/date-picker';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  const pickerId = $derived(`${mountIdPrefix ?? uid}-date-time-picker`);

  let value = $state<string | undefined>('2026-06-29T09:30');
</script>

<div style="display: grid; gap: 0.75rem; max-inline-size: 22rem;">
  <DatePicker
    id={pickerId}
    bind:value
    granularity="minute"
    label="Scheduled at"
    min="2026-06-01T00:00"
    max="2026-12-31T23:59"
  />
  <code>{value ?? 'undefined'}</code>
</div>
