<script lang="ts">
  import { setFormFieldContext } from '../../_internal/form-field-context.ts';
  import type { FormFieldContext } from '../../_internal/form-field-context.ts';

  let { children }: { children: import('svelte').Snippet } = $props();

  // Option controls inside a composite list belong to the listbox, not to the
  // surrounding field's single-control label association.
  setFormFieldContext(undefined as unknown as FormFieldContext);
</script>

{@render children()}
