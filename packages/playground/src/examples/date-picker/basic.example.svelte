<script lang="ts" module>
  export const title = 'Basic date picker';
  export const description = 'Single-date picker with a custom calendar popover.';
</script>

<script lang="ts">
  import { DatePicker } from '@lostgradient/cinder/date-picker';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  const pickerId = $derived(`${mountIdPrefix ?? uid}-basic-date-picker`);

  let value = $state<string | undefined>('2026-06-29');
</script>

<div style="display: grid; gap: 0.75rem; max-inline-size: 22rem;">
  <DatePicker id={pickerId} bind:value label="Event date" />
  <code>{value ?? 'undefined'}</code>
</div>
