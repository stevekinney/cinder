<script lang="ts" module>
  export type FormFieldSelectFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    fieldDescription?: string;
    fieldError?: string;
    fieldRequired?: boolean;
    fieldDisabled?: boolean;
    selectDescription?: string;
    selectError?: string;
    selectRequired?: boolean;
    selectDisabled?: boolean;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import Select from '../../components/select/select.svelte';

  let {
    fieldId,
    fieldLabel,
    fieldDescription,
    fieldError,
    fieldRequired,
    fieldDisabled,
    selectDescription,
    selectError,
    selectRequired,
    selectDisabled,
  }: FormFieldSelectFixtureProps = $props();

  const options = [
    { value: 'alpha', label: 'Alpha' },
    { value: 'beta', label: 'Beta' },
  ];

  const fieldOptional = $derived({
    ...(fieldDescription !== undefined ? { description: fieldDescription } : {}),
    ...(fieldError !== undefined ? { error: fieldError } : {}),
    ...(fieldRequired !== undefined ? { required: fieldRequired } : {}),
    ...(fieldDisabled !== undefined ? { disabled: fieldDisabled } : {}),
  });

  const selectOptional = $derived({
    ...(selectDescription !== undefined ? { description: selectDescription } : {}),
    ...(selectError !== undefined ? { error: selectError } : {}),
    ...(selectRequired !== undefined ? { required: selectRequired } : {}),
    ...(selectDisabled !== undefined ? { disabled: selectDisabled } : {}),
  });
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <Select id={fieldId} value="alpha" {options} {...selectOptional} />
</FormField>
