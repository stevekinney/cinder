<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import TimePicker from '../../components/time-picker/time-picker.svelte';

  let value = $state('09:30');
</script>

<FormField
  id="appointment-time"
  label="Appointment time"
  description="Choose a start time."
  required
>
  <TimePicker id="appointment-time" bind:value />
</FormField>
