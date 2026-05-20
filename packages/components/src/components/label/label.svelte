<script lang="ts" module>
  export type { LabelProps } from './label.types.ts';
</script>

<script lang="ts">
  import type { LabelProps } from './label.types.ts';
  import { cn } from '../../utilities/class-names.ts';

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
    <span class="cinder-label__required" aria-hidden="true"></span>
  {/if}
</label>
