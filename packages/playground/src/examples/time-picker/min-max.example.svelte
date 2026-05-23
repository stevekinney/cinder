<script lang="ts" module>
  export const title = 'Constrained range';
  export const description = 'Limit selections to a valid time window with min and max.';
</script>

<script lang="ts">
  import { TimePicker } from 'cinder';

  let value = $state('09:30');
</script>

<div style="max-width: 18rem;">
  <TimePicker
    id="office-hours"
    bind:value
    label="Office hours"
    min="09:00"
    max="17:00"
    description="Choose a time during office hours."
  />
  <p>Selected: {value || 'none'}</p>
</div>
