<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { FormFieldContext } from './form-field-context.ts';
  import { setFormFieldContext } from './form-field-context.ts';

  let {
    context,
    children,
  }: {
    context: FormFieldContext;
    children: Snippet;
  } = $props();

  // Forward through getters so the provider retains reactive context values
  // when its parent updates the derived field state.
  const forwardedContext: FormFieldContext = {
    get controlId() {
      return context.controlId;
    },
    get labelId() {
      return context.labelId;
    },
    get describedBy() {
      return context.describedBy;
    },
    get descriptionId() {
      return context.descriptionId;
    },
    get errorId() {
      return context.errorId;
    },
    get invalid() {
      return context.invalid;
    },
    get required() {
      return context.required;
    },
    get disabled() {
      return context.disabled;
    },
  };

  setFormFieldContext(forwardedContext);
</script>

{@render children()}
