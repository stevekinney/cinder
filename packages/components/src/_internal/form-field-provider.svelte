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

  setFormFieldContext(context);
</script>

{@render children()}
