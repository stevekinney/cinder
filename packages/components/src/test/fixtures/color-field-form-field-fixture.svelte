<script lang="ts" module>
  /**
   * Test fixture: ColorField composed inside a FormField wrapper. Used to
   * verify that field-level errors raised inside ColorField coexist with
   * application-level errors raised by the wrapping FormField — both error
   * texts render, aria-invalid is set, and aria-describedby contains both
   * error ids without collision.
   */
  export type ColorFieldFormFieldFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    fieldError?: string;
    typedValue?: string;
  };
</script>

<script lang="ts">
  import ColorField from '../../components/color-field/color-field.svelte';
  import FormField from '../../components/form-field/form-field.svelte';

  let { fieldId, fieldLabel, fieldError, typedValue }: ColorFieldFormFieldFixtureProps = $props();

  const fieldErrorProp = $derived(fieldError !== undefined ? { error: fieldError } : {});
  const colorFieldValueProp = $derived(typedValue !== undefined ? { value: typedValue } : {});
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldErrorProp}>
  <ColorField id={fieldId} {...colorFieldValueProp} />
</FormField>
