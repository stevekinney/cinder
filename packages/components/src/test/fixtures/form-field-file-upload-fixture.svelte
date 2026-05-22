<script lang="ts">
  import FileUpload from '../../components/file-upload/file-upload.svelte';
  import FormField from '../../components/form-field/form-field.svelte';

  let {
    fieldId = 'upload',
    fieldLabel = 'Upload a file',
    fieldDescription = 'Choose a file to attach',
    fieldError,
  }: {
    fieldId?: string;
    fieldLabel?: string;
    fieldDescription?: string;
    fieldError?: string;
  } = $props();
</script>

{#if fieldError !== undefined}
  <FormField id={fieldId} label={fieldLabel} description={fieldDescription} error={fieldError}>
    <FileUpload id={fieldId} />
  </FormField>
{:else}
  <FormField id={fieldId} label={fieldLabel} description={fieldDescription}>
    <FileUpload id={fieldId} />
  </FormField>
{/if}
