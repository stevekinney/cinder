<script lang="ts">
  import Autocomplete from '../../components/autocomplete/autocomplete.svelte';
  import FormField from '../../components/form-field/form-field.svelte';
  import type { AutocompleteSuggestionSource } from '../../components/autocomplete/autocomplete.types.ts';

  type Props = {
    fieldId: string;
    fieldLabel: string;
    fieldDescription?: string;
    fieldError?: string;
    controlError?: string;
    disabled?: boolean;
    required?: boolean;
    value?: string;
    suggestionSource?: AutocompleteSuggestionSource;
  };

  let {
    fieldId,
    fieldLabel,
    fieldDescription,
    fieldError,
    controlError,
    disabled = false,
    required = false,
    value = '',
    suggestionSource = () => [],
  }: Props = $props();

  const formFieldProps = {
    id: fieldId,
    label: fieldLabel,
    ...(fieldDescription !== undefined ? { description: fieldDescription } : {}),
    ...(fieldError !== undefined ? { error: fieldError } : {}),
    ...(disabled ? { disabled: true } : {}),
    ...(required ? { required: true } : {}),
  };

  const autocompleteProps = {
    id: fieldId,
    value,
    suggestionSource,
    placeholder: 'Start typing',
    ...(controlError !== undefined ? { error: controlError } : {}),
  };
</script>

<FormField {...formFieldProps}>
  <Autocomplete {...autocompleteProps} />
</FormField>
