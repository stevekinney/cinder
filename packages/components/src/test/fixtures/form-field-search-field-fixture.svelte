<script lang="ts" module>
  /**
   * Test fixture that wraps a SearchField inside a FormField, forwarding the
   * props that tests need to vary. Used to test context inheritance — that a
   * SearchField inside a FormField reads aria-describedby, aria-invalid,
   * required, and disabled from the FormField context.
   */
  export type FormFieldSearchFieldFixtureProps = {
    fieldId: string;
    fieldLabel: string;
    fieldDescription?: string;
    fieldError?: string;
    fieldRequired?: boolean;
    fieldDisabled?: boolean;
    searchFieldRequired?: boolean;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import SearchField from '../../components/search-field.svelte';

  let {
    fieldId,
    fieldLabel,
    fieldDescription,
    fieldError,
    fieldRequired,
    fieldDisabled,
    searchFieldRequired,
  }: FormFieldSearchFieldFixtureProps = $props();

  const fieldOptional = $derived({
    ...(fieldDescription !== undefined ? { description: fieldDescription } : {}),
    ...(fieldError !== undefined ? { error: fieldError } : {}),
    ...(fieldRequired !== undefined ? { required: fieldRequired } : {}),
    ...(fieldDisabled !== undefined ? { disabled: fieldDisabled } : {}),
  });

  const searchFieldOptional = $derived(
    searchFieldRequired !== undefined ? { required: searchFieldRequired } : {},
  );
</script>

<FormField id={fieldId} label={fieldLabel} {...fieldOptional}>
  <SearchField id={fieldId} {...searchFieldOptional} />
</FormField>
