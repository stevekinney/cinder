<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import Toggle from '../../components/toggle/toggle.svelte';

  let {
    fieldId,
    fieldLabel,
    disabled = false,
    toggleLabel = 'Toggle',
  }: {
    fieldId: string;
    fieldLabel: string;
    /** Disabled on the FormField — Toggle should inherit it from context. */
    disabled?: boolean;
    toggleLabel?: string;
  } = $props();

  const fieldOptional = $derived(disabled ? { disabled: true } : {});
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <Toggle id={fieldId} label={toggleLabel} />
</FormField>
