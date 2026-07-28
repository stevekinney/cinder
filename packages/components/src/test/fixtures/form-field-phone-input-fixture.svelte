<script lang="ts" module>
  export type FormFieldPhoneInputFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    fieldRequired?: boolean;
    phoneRequired?: boolean;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import PhoneInput from '../../components/phone-input/phone-input.svelte';

  let { fieldId, fieldLabel, fieldRequired, phoneRequired }: FormFieldPhoneInputFixtureProps =
    $props();

  const fieldOptional = $derived({
    ...(fieldRequired !== undefined ? { required: fieldRequired } : {}),
  });
  const phoneOptional = $derived({
    ...(phoneRequired !== undefined ? { required: phoneRequired } : {}),
  });
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <PhoneInput id={fieldId} {...phoneOptional} />
</FormField>
