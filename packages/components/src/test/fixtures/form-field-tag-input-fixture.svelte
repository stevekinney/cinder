<script lang="ts" module>
  export type FormFieldTagInputFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    fieldDescription?: string;
    fieldError?: string;
    fieldRequired?: boolean;
    fieldDisabled?: boolean;
    tagInputId?: string;
    ariaLabel?: string;
    ariaLabelledby?: string;
    tagInputRequired?: boolean;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import TagInput from '../../components/tag-input/tag-input.svelte';

  let {
    fieldId,
    fieldLabel,
    fieldDescription,
    fieldError,
    fieldRequired,
    fieldDisabled,
    tagInputId,
    ariaLabel,
    ariaLabelledby,
    tagInputRequired,
  }: FormFieldTagInputFixtureProps = $props();

  const fieldOptional = $derived({
    ...(fieldDescription !== undefined ? { description: fieldDescription } : {}),
    ...(fieldError !== undefined ? { error: fieldError } : {}),
    ...(fieldRequired !== undefined ? { required: fieldRequired } : {}),
    ...(fieldDisabled !== undefined ? { disabled: fieldDisabled } : {}),
  });

  const tagInputOptional = $derived({
    ...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {}),
    ...(ariaLabelledby !== undefined ? { 'aria-labelledby': ariaLabelledby } : {}),
    ...(tagInputRequired !== undefined ? { required: tagInputRequired } : {}),
  });
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <TagInput id={tagInputId ?? fieldId} {...tagInputOptional} />
</FormField>
