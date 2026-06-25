<script lang="ts" module>
  export const title = 'Basic time field';
  export const description = 'Standalone time input with optional timezone selection.';
</script>

<script lang="ts">
  import { TimeField } from '@lostgradient/cinder/time-field';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-time-field`);

  let time = $state('09:30');
  let timezone = $state<string | undefined>('America/Denver');
</script>

<TimeField
  id={fieldId}
  label="Reminder time"
  bind:value={time}
  bind:timezone
  timezones={['America/Denver', 'UTC']}
  description="Stored as a canonical 24-hour time string."
/>

<p style="margin-block: 0; color: var(--cinder-text-muted);">
  Value: {time}
  {timezone}
</p>
