<script lang="ts" module>
  export const title = 'Basic time picker';
  export const description =
    'Type a time directly or click the clock icon to open the scroll-list picker.';
</script>

<script lang="ts">
  import { TimePicker } from 'cinder';

  let value = $state('09:30');
</script>

<div style="max-width: 18rem;">
  <TimePicker id="appointment-time" bind:value label="Appointment time" />
  <p>Selected: {value || 'none'}</p>
</div>
