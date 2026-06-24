<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import TimeField from '../../components/time-field/time-field.svelte';

  let {
    id = 'reminder',
    timeFieldId = id,
    fieldDescription = 'Choose when to send the reminder.',
    fieldError = 'Required by policy.',
    description = 'Stored as local time.',
    error = 'Choose a valid time.',
  }: {
    id?: string;
    timeFieldId?: string;
    fieldDescription?: string;
    fieldError?: string;
    description?: string;
    error?: string;
  } = $props();
</script>

<FormField {id} label="Reminder time" description={fieldDescription} error={fieldError}>
  <TimeField id={timeFieldId} value="09:30" {description} {error} />
</FormField>
