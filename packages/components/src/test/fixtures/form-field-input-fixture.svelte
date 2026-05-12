<script lang="ts" module>
  /**
   * Test fixture that wraps an Input inside a FormField, forwarding all the
   * props that tests need to vary. Used to test context inheritance — that an
   * Input inside a FormField reads aria-describedby, aria-invalid, required,
   * and disabled from the FormField context when the Input doesn't have its
   * own values for those.
   */
  export type FormFieldInputFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    fieldDescription?: string;
    fieldError?: string;
    fieldRequired?: boolean;
    fieldDisabled?: boolean;
    inputDescription?: string;
    inputError?: string;
    inputRequired?: boolean;
    inputDisabled?: boolean;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field.svelte';
  import Input from '../../components/input.svelte';

  let {
    fieldId,
    fieldLabel,
    fieldDescription,
    fieldError,
    fieldRequired,
    fieldDisabled,
    inputDescription,
    inputError,
    inputRequired,
    inputDisabled,
  }: FormFieldInputFixtureProps = $props();

  const fieldOptional = $derived({
    ...(fieldDescription !== undefined ? { description: fieldDescription } : {}),
    ...(fieldError !== undefined ? { error: fieldError } : {}),
    ...(fieldRequired !== undefined ? { required: fieldRequired } : {}),
    ...(fieldDisabled !== undefined ? { disabled: fieldDisabled } : {}),
  });

  const inputOptional = $derived({
    ...(inputDescription !== undefined ? { description: inputDescription } : {}),
    ...(inputError !== undefined ? { error: inputError } : {}),
    ...(inputRequired !== undefined ? { required: inputRequired } : {}),
    ...(inputDisabled !== undefined ? { disabled: inputDisabled } : {}),
  });
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <Input id={fieldId} value="" {...inputOptional} />
</FormField>
