<script lang="ts" module>
  /**
   * Test fixture: ColorField wrapped in a FormField. Used to verify dual-error
   * composition — when both FormField (semantic) and ColorField (parse) raise
   * errors, both ids must appear in `aria-describedby` without collision.
   */
  export type FormFieldColorFieldFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    fieldError?: string;
    initialValue?: string;
  };
</script>

<script lang="ts">
  import ColorField from '../../components/color-field/color-field.svelte';
  import FormField from '../../components/form-field/form-field.svelte';

  let { fieldId, fieldLabel, fieldError, initialValue }: FormFieldColorFieldFixtureProps = $props();

  const fieldOptional = $derived(fieldError !== undefined ? { error: fieldError } : {});
  const fieldOptionalValue = $derived(initialValue !== undefined ? { value: initialValue } : {});
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <ColorField id={fieldId} {...fieldOptionalValue} />
</FormField>
