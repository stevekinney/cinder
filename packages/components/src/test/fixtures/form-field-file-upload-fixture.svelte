<script lang="ts">
  import FileUpload from '../../components/file-upload/file-upload.svelte';
  import FormField from '../../components/form-field/form-field.svelte';

  let {
    fieldId = 'upload',
    fieldLabel = 'Upload a file',
    fieldDescription = 'Choose a file to attach',
    fieldError,
    describedBy,
    required = false,
    disabled = false,
  }: {
    fieldId?: string;
    fieldLabel?: string;
    fieldDescription?: string;
    fieldError?: string;
    describedBy?: string;
    required?: boolean;
    disabled?: boolean;
  } = $props();
</script>

{#if fieldError !== undefined}
  <FormField
    id={fieldId}
    label={fieldLabel}
    description={fieldDescription}
    error={fieldError}
    {required}
    {disabled}
  >
    <FileUpload id={fieldId} aria-describedby={describedBy} />
  </FormField>
{:else}
  <FormField id={fieldId} label={fieldLabel} description={fieldDescription} {required} {disabled}>
    <FileUpload id={fieldId} aria-describedby={describedBy} />
  </FormField>
{/if}
