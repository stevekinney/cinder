<script lang="ts" module>
  export const title = 'Range date picker';
  export const description =
    'Click once to set the start, again to set the end. Hover over days to preview the range.';
</script>

<script lang="ts">
  import { DatePicker } from '../../../../components/src/index.ts';

  let selected = $state<[Date, Date] | null>(null);
</script>

<DatePicker
  id="dp-range"
  label="Travel dates"
  description="Select check-in and check-out dates."
  mode="range"
  bind:value={selected}
  locale="en-US"
/>

{#if selected}
  <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--cinder-text-muted);">
    From {selected[0].toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}
    to {selected[1].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  </p>
{/if}
