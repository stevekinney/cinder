<script lang="ts">
  import Checkbox from '../../components/checkbox/checkbox.svelte';
  import FormField from '../../components/form-field/form-field.svelte';

  let {
    fieldId,
    fieldLabel,
    fieldDescription,
    fieldError,
    disabled = false,
    required = false,
    checkboxLabel,
    /** When true, omit `id` on the Checkbox so it inherits controlId from FormField context. */
    inheritId = false,
  }: {
    fieldId: string;
    fieldLabel: string;
    fieldDescription?: string;
    fieldError?: string;
    disabled?: boolean;
    required?: boolean;
    checkboxLabel?: string;
    inheritId?: boolean;
  } = $props();

  const fieldOptional = $derived({
    ...(fieldDescription !== undefined ? { description: fieldDescription } : {}),
    ...(fieldError !== undefined ? { error: fieldError } : {}),
    ...(disabled ? { disabled: true } : {}),
    ...(required ? { required: true } : {}),
  });
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <Checkbox
    {...inheritId ? {} : { id: fieldId }}
    {...checkboxLabel !== undefined ? { label: checkboxLabel } : {}}
  />
</FormField>
