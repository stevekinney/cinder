<script lang="ts">
  /**
   * Test fixture that wraps an Input inside a FormField with deliberately
   * mismatched ids — the FormField's id is "field-id" but the Input's id
   * is "input-id". Used to test the dev-only id-mismatch console.warn.
   */
  import FormField from '../../components/form-field.svelte';
  import Input from '../../components/input.svelte';
</script>

<FormField id="field-id" label="Label">
  <Input id="mismatched-input-id" value="" />
</FormField>
