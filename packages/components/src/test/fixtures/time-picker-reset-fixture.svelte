<script lang="ts">
  import TimePicker from '../../components/time-picker/time-picker.svelte';

  let value = $state('09:30');
</script>

<form>
  <TimePicker id="appointment-time" bind:value defaultValue="09:30" label="Appointment time" />
  <button type="reset">Reset</button>
</form>
