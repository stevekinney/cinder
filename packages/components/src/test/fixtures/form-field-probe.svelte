<script lang="ts" module>
  /**
   * Test-only fixture that mounts a `<FormField>` and renders a child probe
   * component that reads the published context and writes each field to
   * `data-*` attributes on a `<div data-probe>` element. Tests assert on those
   * attributes; the reactive-update test rebinds a prop and re-reads the DOM.
   *
   * Pattern mirrors toast-probe.svelte — a real child component is required
   * because snippets capture lexical scope, not render scope, and cannot read
   * context from their render parent.
   */
  export type FormFieldProbeProps = {
    id: string;
    label: string;
    description?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import FormFieldContextProbe from './form-field-context-probe.svelte';

  let { id, label, description, error, required, disabled }: FormFieldProbeProps = $props();

  const optionalProps = $derived({
    ...(description !== undefined ? { description } : {}),
    ...(error !== undefined ? { error } : {}),
    ...(required !== undefined ? { required } : {}),
    ...(disabled !== undefined ? { disabled } : {}),
  });
</script>

<FormField {id} {label} {...optionalProps}>
  <FormFieldContextProbe />
</FormField>
