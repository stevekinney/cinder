<script lang="ts" module>
  import type { ScrollAreaElement } from './scroll-area.types.ts';

  const explicitRegionElements = new Set<ScrollAreaElement>(['div', 'pre']);

  export type {
    ScrollAreaDirection,
    ScrollAreaElement,
    ScrollAreaProps,
  } from './scroll-area.types.ts';
</script>

<script lang="ts">
  import type { ScrollAreaProps } from './scroll-area.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    direction = 'vertical',
    maxHeight,
    maxWidth,
    ariaLabel,
    tabindex = 0,
    as = 'div',
    class: className,
    children,
    ...rest
  }: ScrollAreaProps = $props();

  const normalizedAriaLabel = $derived(
    typeof ariaLabel === 'string' && ariaLabel.trim().length > 0 ? ariaLabel.trim() : undefined,
  );
  const role = $derived(
    normalizedAriaLabel && explicitRegionElements.has(as) ? 'region' : undefined,
  );
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-scroll-area', className)}
  data-cinder-direction={direction}
  {role}
  aria-label={normalizedAriaLabel}
  {tabindex}
  style:max-block-size={maxHeight}
  style:max-inline-size={maxWidth}
>
  {@render children()}
</svelte:element>
