<script lang="ts" module>
  export const title = 'Basic time picker';
  export const description = 'Choose a time with direct input or the popover list.';
</script>

<script lang="ts">
  import { TimePicker } from 'cinder';

  let value = $state('09:30');
</script>

<div style="max-width: 18rem;">
  <TimePicker id="appointment-time" bind:value label="Appointment time" />
  <p>Selected: {value || 'none'}</p>
</div>
