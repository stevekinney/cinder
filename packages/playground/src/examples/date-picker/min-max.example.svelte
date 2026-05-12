<script lang="ts" module>
  export const title = 'Date picker with min and max';
  export const description =
    'Days outside the allowed range are visually disabled and cannot be selected.';
</script>

<script lang="ts">
  import { DatePicker } from '../../../../components/src/index.ts';

  // Only allow dates within the next 30 days
  const today = new Date();
  const min = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
  const max = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30, 12, 0, 0, 0);

  let selected = $state<Date | null>(null);
</script>

<DatePicker
  id="dp-minmax"
  label="Appointment date"
  description="Appointments available within the next 30 days."
  {min}
  {max}
  bind:value={selected}
  locale="en-US"
/>

{#if selected}
  <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--cinder-text-muted);">
    Appointment: {selected.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}
  </p>
{/if}
