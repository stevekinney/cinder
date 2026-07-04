<script lang="ts" module>
  import type { MultiSelectItem } from '../../components/multi-select/multi-select.types.ts';

  export type FormFieldMultiSelectFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    items: ReadonlyArray<MultiSelectItem<string>>;
    selectedIds?: string[];
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import MultiSelect from '../../components/multi-select/multi-select.svelte';

  let { fieldId, fieldLabel, items, selectedIds = [] }: FormFieldMultiSelectFixtureProps = $props();
</script>

<FormField id={fieldId} label={fieldLabel}>
  <MultiSelect id={fieldId} {items} bind:selectedIds />
</FormField>
