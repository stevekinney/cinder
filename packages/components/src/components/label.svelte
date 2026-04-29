<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLLabelAttributes } from 'svelte/elements';

  /**
   * Props for the Label component.
   *
   * Use Label when composing your own form layout — Input, Textarea, Select,
   * Checkbox, and Radio already render their own labels via the `label` prop.
   * Standalone Label exists so consumers building hand-rolled forms (e.g. a
   * custom field that wraps two inputs) can match the same visual treatment.
   */
  export type LabelProps = HTMLLabelAttributes & {
    /** The id of the form control this label labels. Sets `for` on the rendered `<label>`. */
    for: string;
    /** When true, append a visual indicator that the field is required. */
    required?: boolean;
    /** When true, render the label in the disabled color treatment. */
    disabled?: boolean;
    /** Additional class names merged with `.cinder-label`. */
    class?: string;
    /** The label text or composed content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    for: forId,
    required = false,
    disabled = false,
    class: className,
    children,
    ...rest
  }: LabelProps = $props();
</script>

<label
  for={forId}
  class={cn('cinder-label', className)}
  data-disabled={disabled || undefined}
  {...rest}
>
  {@render children()}
  {#if required}
    <!-- Decorative — accessible name comes from the field's `required` attribute. -->
    <span class="cinder-label__required" aria-hidden="true">*</span>
  {/if}
</label>
