<script lang="ts" module>
  /**
   * Wraps a ColorField inside a FormField. Used to test that a parse error
   * raised by the field coexists with a semantic error raised by the form-
   * field wrapper — both messages render and both ids appear in the inner
   * input's `aria-describedby`.
   */
  export type ColorFieldFormFieldFixtureProps = {
    id: string;
    fieldError?: string;
  };
</script>

<script lang="ts">
  import ColorField from '../../components/color-field/color-field.svelte';
  import FormField from '../../components/form-field/form-field.svelte';

  let { id, fieldError }: ColorFieldFormFieldFixtureProps = $props();

  const fieldOptional = $derived(
    fieldError !== undefined ? { error: fieldError } : {},
  );
</script>

<FormField {id} label="Accent color" {...fieldOptional}>
  <ColorField {id} name="c" />
</FormField>
