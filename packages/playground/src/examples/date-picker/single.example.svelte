<script lang="ts" module>
  export const title = 'Single date picker';
  export const description =
    'Click the input or press Space/Enter to open the calendar popover. Navigate with arrow keys, Page Up/Down, and Ctrl+Page Up/Down.';
</script>

<script lang="ts">
  import { DatePicker } from '../../../../components/src/index.ts';

  let selected = $state<Date | null>(null);
</script>

<DatePicker
  id="dp-single"
  label="Departure date"
  description="Select your travel date."
  bind:value={selected}
  locale="en-US"
/>

{#if selected}
  <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--cinder-text-muted);">
    Selected: {selected.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}
  </p>
{/if}
