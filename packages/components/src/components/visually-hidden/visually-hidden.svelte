<script lang="ts" module>
  export type { VisuallyHiddenElement, VisuallyHiddenProps } from './visually-hidden.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { VisuallyHiddenProps } from './visually-hidden.types.ts';

  let {
    as = 'span',
    focusable = false,
    class: className,
    children,
    ...rest
  }: VisuallyHiddenProps = $props();

  const mergedClass = $derived(
    classNames('cinder-sr-only', focusable && 'cinder-sr-only-focusable', className),
  );
</script>

<svelte:element this={as} class={mergedClass} {...rest}>{@render children()}</svelte:element>
