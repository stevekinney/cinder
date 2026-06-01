<script lang="ts" module>
  export type FormFieldTextareaFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    fieldDescription?: string;
    fieldError?: string;
    fieldRequired?: boolean;
    fieldDisabled?: boolean;
    textareaDescription?: string;
    textareaError?: string;
    textareaDisabled?: boolean;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import Textarea from '../../components/textarea/textarea.svelte';

  let {
    fieldId,
    fieldLabel,
    fieldDescription,
    fieldError,
    fieldRequired,
    fieldDisabled,
    textareaDescription,
    textareaError,
    textareaDisabled,
  }: FormFieldTextareaFixtureProps = $props();

  const fieldOptional = $derived({
    ...(fieldDescription !== undefined ? { description: fieldDescription } : {}),
    ...(fieldError !== undefined ? { error: fieldError } : {}),
    ...(fieldRequired !== undefined ? { required: fieldRequired } : {}),
    ...(fieldDisabled !== undefined ? { disabled: fieldDisabled } : {}),
  });

  const textareaOptional = $derived({
    ...(textareaDescription !== undefined ? { description: textareaDescription } : {}),
    ...(textareaError !== undefined ? { error: textareaError } : {}),
    ...(textareaDisabled !== undefined ? { disabled: textareaDisabled } : {}),
  });
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <Textarea id={fieldId} value="" {...textareaOptional} />
</FormField>
