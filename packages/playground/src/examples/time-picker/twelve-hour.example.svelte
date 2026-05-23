<script lang="ts" module>
  export const title = 'Twelve-hour display';
  export const description = 'Render a picker with AM and PM selection controls.';
</script>

<script lang="ts">
  import { TimePicker } from 'cinder';

  let value = $state('13:15');
</script>

<div style="max-width: 18rem;">
  <TimePicker
    id="follow-up-time"
    bind:value
    label="Follow-up time"
    hourCycle="h12"
    locale="en-US"
  />
  <p>Selected: {value || 'none'}</p>
</div>
